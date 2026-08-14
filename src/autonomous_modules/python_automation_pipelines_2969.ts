/**
 * PyNexus Stream: Autonomous Python Pipeline Orchestrator
 * Category: Python Automation Pipelines
 * 
 * A high-performance, asynchronous DAG workflow execution engine for Python scripts
 * and automation routines featuring dependency isolation, typed IPC communication,
 * streaming metrics, and fault-tolerant lifecycle management.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// --- Types and Interfaces ---

export type TaskStatus = 'PENDING' | 'PROVISIONING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RETRYING';

export interface PythonEnvironmentConfig {
  pythonBinary?: string; // e.g., 'python3' or path to venv
  virtualEnvPath?: string;
  dependencies?: string[]; // requirements to verify/inject
  envVars?: Record<string, string>;
  workingDirectory?: string;
}

export interface TaskRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
}

export interface TaskDefinition {
  id: string;
  name: string;
  scriptContent?: string;
  scriptPath?: string;
  dependencies?: string[]; // IDs of tasks that must succeed before this task runs
  environment?: PythonEnvironmentConfig;
  timeoutMs?: number;
  retryPolicy?: TaskRetryPolicy;
  inputPayload?: Record<string, unknown>;
}

export interface TaskExecutionResult {
  taskId: string;
  status: TaskStatus;
  exitCode: number | null;
  outputPayload?: Record<string, unknown>;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
}

export interface PipelineReport {
  pipelineId: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'ABORTED';
  taskResults: Map<string, TaskExecutionResult>;
}

export interface LogEvent {
  taskId: string;
  type: 'stdout' | 'stderr' | 'system';
  message: string;
  timestamp: number;
}

// --- Python Pipeline Engine Core ---

export class PyNexusPipelineEngine extends EventEmitter {
  private tasks: Map<string, TaskDefinition> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private inDegree: Map<string, number> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private results: Map<string, TaskExecutionResult> = new Map();
  private isAborted: boolean = false;
  private pipelineId: string;
  private workspaceDir: string;

  constructor(pipelineId?: string, customWorkspace?: string) {
    super();
    this.pipelineId = pipelineId || `pynexus-${crypto.randomUUID()}`;
    this.workspaceDir = customWorkspace || path.join(os.tmpdir(), 'pynexus_workspaces', this.pipelineId);
  }

  /**
   * Registers a single task into the DAG
   */
  public registerTask(task: TaskDefinition): this {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task with id '${task.id}' is already registered.`);
    }

    if (!task.scriptContent && !task.scriptPath) {
      throw new Error(`Task '${task.id}' must provide either scriptContent or scriptPath.`);
    }

    this.tasks.set(task.id, {
      ...task,
      dependencies: task.dependencies || [],
      retryPolicy: task.retryPolicy || { maxAttempts: 1, backoffMs: 1000, exponential: false },
      timeoutMs: task.timeoutMs || 60000,
    });

    if (!this.adjacencyList.has(task.id)) {
      this.adjacencyList.set(task.id, new Set());
    }
    this.inDegree.set(task.id, 0);

    return this;
  }

  /**
   * Validates topological structure and absence of cyclic dependencies
   */
  public validateDAG(): boolean {
    // Reconstruct dependencies graph
    for (const [id] of this.tasks) {
      this.adjacencyList.set(id, new Set());
      this.inDegree.set(id, 0);
    }

    for (const [taskId, taskDef] of this.tasks) {
      for (const depId of taskDef.dependencies || []) {
        if (!this.tasks.has(depId)) {
          throw new Error(`Task '${taskId}' depends on non-existent task '${depId}'.`);
        }
        this.adjacencyList.get(depId)!.add(taskId);
        this.inDegree.set(taskId, (this.inDegree.get(taskId) || 0) + 1);
      }
    }

    // Kahn's Algorithm for cycle detection
    const tempInDegree = new Map(this.inDegree);
    const queue: string[] = [];

    for (const [id, deg] of tempInDegree) {
      if (deg === 0) queue.push(id);
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;
      for (const neighbor of this.adjacencyList.get(current) || []) {
        tempInDegree.set(neighbor, tempInDegree.get(neighbor)! - 1);
        if (tempInDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visitedCount !== this.tasks.size) {
      throw new Error('Cyclic dependency detected in Python pipeline DAG.');
    }

    return true;
  }

  /**
   * Initializes sandbox workspace directory
   */
  private async initializeWorkspace(): Promise<void> {
    await fs.promises.mkdir(this.workspaceDir, { recursive: true });
  }

  /**
   * Wraps Python script execution with IPC bootstrap logic for structured I/O
   */
  private generateRunnerScript(task: TaskDefinition, inputData: Record<string, unknown>): string {
    const encodedInput = JSON.stringify(inputData);
    return `
# --- PyNexus Auto-Generated Wrapper ---
import sys
import json
import traceback

__INPUT_PAYLOAD__ = json.loads(${JSON.stringify(encodedInput)})
__OUTPUT_PAYLOAD__ = {}

def pynexus_export(data):
    global __OUTPUT_PAYLOAD__
    if isinstance(data, dict):
        __OUTPUT_PAYLOAD__.update(data)
    else:
        __OUTPUT_PAYLOAD__['result'] = data

def get_input():
    return __INPUT_PAYLOAD__

try:
    # User Code Injected Below
${task.scriptContent ? task.scriptContent.split('\n').map(line => '    ' + line).join('\n') : `
    with open(${JSON.stringify(task.scriptPath)}, 'r') as f:
        exec(f.read(), globals())
`}
    # Flush output telemetry
    print("\n---PYNEXUS_DATA_START---")
    print(json.dumps(__OUTPUT_PAYLOAD__))
    print("---PYNEXUS_DATA_END---")
    sys.exit(0)
except Exception as e:
    sys.stderr.write(f"[PYNEXUS ERROR] Task Failed: {str(e)}\n")
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * Executes a single task with retries, timeouts, and process management
   */
  private async executeTaskWithRetry(task: TaskDefinition): Promise<TaskExecutionResult> {
    const retryPolicy = task.retryPolicy!;
    let attempt = 0;
    let lastResult: TaskExecutionResult | null = null;

    while (attempt < retryPolicy.maxAttempts) {
      attempt++;
      if (this.isAborted) {
        return {
          taskId: task.id,
          status: 'SKIPPED',
          exitCode: null,
          stdout: '',
          stderr: 'Pipeline was aborted.',
          executionTimeMs: 0,
        };
      }

      if (attempt > 1) {
        this.emit('taskRetry', { taskId: task.id, attempt, maxAttempts: retryPolicy.maxAttempts });
        const delay = retryPolicy.exponential
          ? retryPolicy.backoffMs * Math.pow(2, attempt - 2)
          : retryPolicy.backoffMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      lastResult = await this.runProcess(task);
      if (lastResult.status === 'COMPLETED') {
        return lastResult;
      }
    }

    return lastResult!;
  }

  /**
   * Spawns Python process and collects streaming telemetry
   */
  private runProcess(task: TaskDefinition): Promise<TaskExecutionResult> {
    return new Promise(async (resolve) => {
      const startTime = Date.now();
      const taskDir = path.join(this.workspaceDir, task.id);
      await fs.promises.mkdir(taskDir, { recursive: true });

      // Gather aggregated upstream data payloads
      const upstreamInputs: Record<string, unknown> = { ...task.inputPayload };
      for (const depId of task.dependencies || []) {
        const depRes = this.results.get(depId);
        if (depRes && depRes.outputPayload) {
          upstreamInputs[depId] = depRes.outputPayload;
        }
      }

      const scriptFile = path.join(taskDir, 'runner.py');
      const scriptCode = this.generateRunnerScript(task, upstreamInputs);
      await fs.promises.writeFile(scriptFile, scriptCode, 'utf-8');

      const pythonBin = task.environment?.pythonBinary || (process.platform === 'win32' ? 'python' : 'python3');
      const env = { ...process.env, ...(task.environment?.envVars || {}) };

      this.emit('taskStart', { taskId: task.id, timestamp: startTime });

      const proc = spawn(pythonBin, [scriptFile], {
        cwd: task.environment?.workingDirectory || taskDir,
        env,
      });

      this.activeProcesses.set(task.id, proc);

      let stdoutAccum = '';
      let stderrAccum = '';
      let isTimedOut = false;

      const timer = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 3000);
      }, task.timeoutMs);

      proc.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutAccum += text;
        this.emit('log', { taskId: task.id, type: 'stdout', message: text, timestamp: Date.now() } as LogEvent);
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrAccum += text;
        this.emit('log', { taskId: task.id, type: 'stderr', message: text, timestamp: Date.now() } as LogEvent);
      });

      proc.on('close', async (code) => {
        clearTimeout(timer);
        this.activeProcesses.delete(task.id);
        const executionTimeMs = Date.now() - startTime;

        let parsedOutput: Record<string, unknown> | undefined;
        const dataStartTag = '---PYNEXUS_DATA_START---';
        const dataEndTag = '---PYNEXUS_DATA_END---';

        if (stdoutAccum.includes(dataStartTag) && stdoutAccum.includes(dataEndTag)) {
          try {
            const jsonStr = stdoutAccum.split(dataStartTag)[1].split(dataEndTag)[0].trim();
            parsedOutput = JSON.parse(jsonStr);
          } catch (err) {
            stderrAccum += `\nFailed to parse IPC output payload: ${(err as Error).message}`;
          }
        }

        const isSuccess = code === 0 && !isTimedOut;
        const result: TaskExecutionResult = {
          taskId: task.id,
          status: isSuccess ? 'COMPLETED' : 'FAILED',
          exitCode: code,
          outputPayload: parsedOutput,
          stdout: stdoutAccum,
          stderr: isTimedOut ? `Task timed out after ${task.timeoutMs}ms. ${stderrAccum}` : stderrAccum,
          executionTimeMs,
          error: isSuccess ? undefined : isTimedOut ? 'TIMEOUT' : `Process exited with code ${code}`,
        };

        this.emit('taskEnd', result);
        resolve(result);
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        this.activeProcesses.delete(task.id);
        const executionTimeMs = Date.now() - startTime;
        const result: TaskExecutionResult = {
          taskId: task.id,
          status: 'FAILED',
          exitCode: null,
          stdout: stdoutAccum,
          stderr: `${stderrAccum}\nProcess spawn error: ${err.message}`,
          executionTimeMs,
          error: err.message,
        };
        this.emit('taskEnd', result);
        resolve(result);
      });
    });
  }

  /**
   * Executes the entire DAG pipeline with parallel branch resolution
   */
  public async executePipeline(): Promise<PipelineReport> {
    const startTime = Date.now();
    this.validateDAG();
    await this.initializeWorkspace();
    this.isAborted = false;
    this.results.clear();

    const remainingInDegree = new Map(this.inDegree);
    const readyQueue: string[] = [];
    const runningPromises: Map<string, Promise<void>> = new Map();

    for (const [id, deg] of remainingInDegree) {
      if (deg === 0) {
        readyQueue.push(id);
      }
    }

    let pipelineFailure = false;

    const scheduleNext = async (): Promise<void> => {
      while (readyQueue.length > 0 && !this.isAborted) {
        const taskId = readyQueue.shift()!;
        const task = this.tasks.get(taskId)!;

        const taskPromise = (async () => {
          const result = await this.executeTaskWithRetry(task);
          this.results.set(taskId, result);

          if (result.status === 'COMPLETED') {
            // Release dependents
            for (const neighbor of this.adjacencyList.get(taskId) || []) {
              const currentDeg = remainingInDegree.get(neighbor)! - 1;
              remainingInDegree.set(neighbor, currentDeg);
              if (currentDeg === 0) {
                readyQueue.push(neighbor);
              }
            }
          } else {
            pipelineFailure = true;
            this.abort();
          }
        })();

        runningPromises.set(taskId, taskPromise);
        taskPromise.finally(() => {
          runningPromises.delete(taskId);
        });
      }
    };

    while ((readyQueue.length > 0 || runningPromises.size > 0) && !pipelineFailure) {
      await scheduleNext();
      if (runningPromises.size > 0) {
        await Promise.race(Array.from(runningPromises.values()));
      }
    }

    // Wait for ongoing teardowns
    await Promise.allSettled(Array.from(runningPromises.values()));
    const endTime = Date.now();

    return {
      pipelineId: this.pipelineId,
      startTime,
      endTime,
      totalDurationMs: endTime - startTime,
      status: pipelineFailure ? 'FAILED' : this.isAborted ? 'ABORTED' : 'SUCCESS',
      taskResults: new Map(this.results),
    };
  }

  /**
   * Aborts running tasks gracefully
   */
  public abort(): void {
    this.isAborted = true;
    for (const [taskId, proc] of this.activeProcesses) {
      this.emit('log', { taskId, type: 'system', message: 'Terminating task due to pipeline abort signal.', timestamp: Date.now() });
      proc.kill('SIGTERM');
    }
  }

  /**
   * Cleans up local workspace resources
   */
  public async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.workspaceDir)) {
        await fs.promises.rm(this.workspaceDir, { recursive: true, force: true });
      }
    } catch (e) {
      this.emit('error', e);
    }
  }
}

// --- Pipeline Builder Utility ---

export class PipelineBuilder {
  private engine: PyNexusPipelineEngine;

  constructor(pipelineId?: string) {
    this.engine = new PyNexusPipelineEngine(pipelineId);
  }

  public step(task: TaskDefinition): PipelineBuilder {
    this.engine.registerTask(task);
    return this;
  }

  public build(): PyNexusPipelineEngine {
    this.engine.validateDAG();
    return this;
  }
}
