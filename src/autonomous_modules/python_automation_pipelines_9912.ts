import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Represents execution states for pipeline nodes and tasks.
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  RETRYING = 'RETRYING'
}

/**
 * Data interchange format for pipeline inter-process communication (IPC).
 */
export interface IPCPacket<T = unknown> {
  id: string;
  taskId: string;
  timestamp: number;
  type: 'DATA' | 'LOG' | 'METRIC' | 'STATUS' | 'ERROR' | 'HEARTBEAT';
  payload: T;
}

export interface TaskLogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: number;
  stream: 'stdout' | 'stderr' | 'ipc';
}

export interface TaskMetrics {
  cpuPercent: number;
  memoryBytes: number;
  executionTimeMs: number;
  customMetrics: Record<string, number>;
}

export interface PipelineTaskDefinition {
  id: string;
  name: string;
  description?: string;
  dependencies?: string[];
  scriptPath?: string;
  inlineScript?: string;
  arguments?: string[];
  environmentVars?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  virtualEnvPath?: string;
  pythonExecutable?: string;
  tags?: string[];
}

export interface TaskExecutionResult {
  taskId: string;
  status: TaskStatus;
  exitCode: number | null;
  outputData: unknown;
  logs: TaskLogEntry[];
  metrics: TaskMetrics;
  error?: string;
  startTime: number;
  endTime: number;
}

export interface PipelineStateCheckpoint {
  pipelineId: string;
  executionId: string;
  timestamp: number;
  completedTasks: Record<string, TaskExecutionResult>;
  taskStatuses: Record<string, TaskStatus>;
  sharedContext: Record<string, unknown>;
}

/**
 * Manages dependency resolution, topological sorting, and cycle detection.
 */
export class DAGResolver {
  public static buildExecutionOrder(tasks: PipelineTaskDefinition[]): string[][] {
    const taskMap = new Map<string, PipelineTaskDefinition>();
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    tasks.forEach(task => {
      taskMap.set(task.id, task);
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    });

    tasks.forEach(task => {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          if (!taskMap.has(depId)) {
            throw new Error(`Dependency '${depId}' required by task '${task.id}' does not exist.`);
          }
          graph.get(depId)!.push(task.id);
          inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        }
      }
    });

    const parallelStages: string[][] = [];
    let processedCount = 0;

    while (true) {
      const currentStage: string[] = [];
      for (const [taskId, deg] of inDegree.entries()) {
        if (deg === 0) {
          currentStage.push(taskId);
        }
      }

      if (currentStage.length === 0) {
        break;
      }

      parallelStages.push(currentStage);
      for (const taskId of currentStage) {
        inDegree.delete(taskId);
        processedCount++;
        for (const dependentId of graph.get(taskId) || []) {
          const currentDeg = inDegree.get(dependentId);
          if (currentDeg !== undefined) {
            inDegree.set(dependentId, currentDeg - 1);
          }
        }
      }
    }

    if (processedCount !== tasks.length) {
      throw new Error('Cyclic dependency detected within Python automation DAG definitions.');
    }

    return parallelStages;
  }
}

/**
 * IPC Stream Wrapper for Python Subprocesses.
 */
export class PythonBridgeProcess extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private buffer: string = '';
  private killed: boolean = false;

  constructor(
    public readonly taskId: string,
    private readonly executable: string,
    private readonly scriptArgs: string[],
    private readonly env: Record<string, string>,
    private readonly cwd: string
  ) {
    super();
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.childProcess = spawn(this.executable, this.scriptArgs, {
          env: { ...process.env, ...this.env, PYTHONUNBUFFERED: '1' },
          cwd: this.cwd,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.childProcess.stdout?.on('data', (chunk: Buffer) => {
          this.handleRawOutput(chunk.toString(), 'stdout');
        });

        this.childProcess.stderr?.on('data', (chunk: Buffer) => {
          this.handleRawOutput(chunk.toString(), 'stderr');
        });

        this.childProcess.on('close', (code, signal) => {
          this.emit('exit', { code, signal });
        });

        this.childProcess.on('error', (err) => {
          this.emit('error', err);
          reject(err);
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  public sendIPCMessage(type: IPCPacket['type'], payload: unknown): void {
    if (this.childProcess && this.childProcess.stdin && !this.killed) {
      const packet: IPCPacket = {
        id: crypto.randomUUID(),
        taskId: this.taskId,
        timestamp: Date.now(),
        type,
        payload
      };
      this.childProcess.stdin.write(`__PYAUTOMATA_IPC__:${JSON.stringify(packet)}\n`);
    }
  }

  private handleRawOutput(data: string, stream: 'stdout' | 'stderr'): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('__PYAUTOMATA_IPC__:')) {
        try {
          const jsonStr = line.substring('__PYAUTOMATA_IPC__:'.length);
          const packet: IPCPacket = JSON.parse(jsonStr);
          this.emit('ipc_packet', packet);
        } catch {
          this.emit('log', { level: 'ERROR', message: `Malformed IPC packet: ${line}`, timestamp: Date.now(), stream });
        }
      } else {
        this.emit('log', {
          level: stream === 'stderr' ? 'WARN' : 'INFO',
          message: line,
          timestamp: Date.now(),
          stream
        });
      }
    }
  }

  public terminate(signal: NodeJS.Signals = 'SIGTERM'): void {
    this.killed = true;
    if (this.childProcess) {
      this.childProcess.kill(signal);
    }
  }
}

/**
 * Main Python Automation Pipeline Engine.
 */
export class PythonPipelineEngine extends EventEmitter {
  private tasks: Map<string, PipelineTaskDefinition> = new Map();
  private results: Map<string, TaskExecutionResult> = new Map();
  private sharedContext: Map<string, unknown> = new Map();
  private defaultPythonBin: string = 'python3';
  private checkpointDirectory: string;

  constructor(public readonly pipelineId: string, options?: { pythonBin?: string; checkpointDir?: string }) {
    super();
    this.defaultPythonBin = options?.pythonBin || 'python3';
    this.checkpointDirectory = options?.checkpointDir || path.join(os.tmpdir(), 'pyautomata_checkpoints');
    if (!fs.existsSync(this.checkpointDirectory)) {
      fs.mkdirSync(this.checkpointDirectory, { recursive: true });
    }
  }

  public registerTask(task: PipelineTaskDefinition): this {
    this.tasks.set(task.id, task);
    return this;
  }

  public registerTasks(tasks: PipelineTaskDefinition[]): this {
    tasks.forEach(t => this.registerTask(t));
    return this;
  }

  public setContextValue(key: string, value: unknown): void {
    this.sharedContext.set(key, value);
  }

  public getContextValue<T>(key: string): T | undefined {
    return this.sharedContext.get(key) as T | undefined;
  }

  public async executePipeline(executionId: string = crypto.randomUUID()): Promise<Map<string, TaskExecutionResult>> {
    const stages = DAGResolver.buildExecutionOrder(Array.from(this.tasks.values()));
    this.emit('pipeline_start', { pipelineId: this.pipelineId, executionId, stageCount: stages.length });

    for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
      const currentStage = stages[stageIdx];
      this.emit('stage_start', { stageIndex: stageIdx, taskIds: currentStage });

      const stagePromises = currentStage.map(taskId => {
        const taskDef = this.tasks.get(taskId)!;
        return this.executeTaskWithRetry(taskDef, executionId);
      });

      const stageResults = await Promise.all(stagePromises);
      for (const result of stageResults) {
        this.results.set(result.taskId, result);
        if (result.status === TaskStatus.FAILED) {
          this.emit('pipeline_error', { executionId, failedTask: result });
          this.saveCheckpoint(executionId);
          throw new Error(`Pipeline halted due to failure in task '${result.taskId}': ${result.error}`);
        }
      }

      this.saveCheckpoint(executionId);
      this.emit('stage_complete', { stageIndex: stageIdx, results: stageResults });
    }

    this.emit('pipeline_complete', { pipelineId: this.pipelineId, executionId, results: this.results });
    return this.results;
  }

  private async executeTaskWithRetry(task: PipelineTaskDefinition, executionId: string): Promise<TaskExecutionResult> {
    const maxRetries = task.maxRetries ?? 0;
    const backoffMs = task.retryBackoffMs ?? 1000;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (attempt > 0) {
        this.emit('task_retry', { taskId: task.id, attempt, maxRetries });
        await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
      }

      const result = await this.executeTask(task, executionId);
      if (result.status === TaskStatus.COMPLETED) {
        return result;
      }

      attempt++;
      if (attempt > maxRetries) {
        return result;
      }
    }

    throw new Error(`Task '${task.id}' failed beyond retry bounds.`);
  }

  private async executeTask(task: PipelineTaskDefinition, executionId: string): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const logs: TaskLogEntry[] = [];
    let outputData: unknown = null;
    let taskError: string | undefined;

    const executable = task.virtualEnvPath
      ? path.join(task.virtualEnvPath, 'bin', 'python')
      : (task.pythonExecutable || this.defaultPythonBin);

    let temporaryScriptPath: string | null = null;
    let targetScriptPath = task.scriptPath;

    if (task.inlineScript) {
      temporaryScriptPath = path.join(os.tmpdir(), `pyautomata_${task.id}_${Date.now()}.py`);
      fs.writeFileSync(temporaryScriptPath, task.inlineScript, { encoding: 'utf-8' });
      targetScriptPath = temporaryScriptPath;
    }

    if (!targetScriptPath) {
      throw new Error(`Task '${task.id}' must provide either a scriptPath or an inlineScript.`);
    }

    const scriptArgs = [targetScriptPath, ...(task.arguments || [])];
    const contextPayload = JSON.stringify(Object.fromEntries(this.sharedContext));
    const envVars = {
      PYAUTOMATA_TASK_ID: task.id,
      PYAUTOMATA_EXECUTION_ID: executionId,
      PYAUTOMATA_SHARED_CONTEXT: contextPayload,
      ...(task.environmentVars || {})
    };

    const bridge = new PythonBridgeProcess(task.id, executable, scriptArgs, envVars, process.cwd());

    return new Promise((resolve) => {
      let isTimeout = false;
      let timeoutTimer: NodeJS.Timeout | null = null;

      if (task.timeoutMs && task.timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          isTimeout = true;
          bridge.terminate('SIGKILL');
        }, task.timeoutMs);
      }

      bridge.on('log', (logEntry: TaskLogEntry) => {
        logs.push(logEntry);
        this.emit('task_log', { taskId: task.id, log: logEntry });
      });

      bridge.on('ipc_packet', (packet: IPCPacket) => {
        if (packet.type === 'DATA') {
          outputData = packet.payload;
          if (typeof packet.payload === 'object' && packet.payload !== null) {
            for (const [k, v] of Object.entries(packet.payload)) {
              this.sharedContext.set(k, v);
            }
          }
        } else if (packet.type === 'STATUS') {
          this.emit('task_status_update', { taskId: task.id, status: packet.payload });
        }
      });

      bridge.on('exit', ({ code }) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (temporaryScriptPath && fs.existsSync(temporaryScriptPath)) {
          try { fs.unlinkSync(temporaryScriptPath); } catch { /* ignore cleanup errors */ }
        }

        const endTime = Date.now();
        const success = code === 0 && !isTimeout;
        if (isTimeout) {
          taskError = `Execution exceeded timeout threshold of ${task.timeoutMs}ms`;
        } else if (code !== 0) {
          taskError = `Python script exited with non-zero status code: ${code}`;
        }

        const result: TaskExecutionResult = {
          taskId: task.id,
          status: success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          exitCode: code,
          outputData,
          logs,
          metrics: {
            cpuPercent: 0,
            memoryBytes: 0,
            executionTimeMs: endTime - startTime,
            customMetrics: {}
          },
          error: taskError,
          startTime,
          endTime
        };

        resolve(result);
      });

      bridge.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (temporaryScriptPath && fs.existsSync(temporaryScriptPath)) {
          try { fs.unlinkSync(temporaryScriptPath); } catch { /* ignore cleanup errors */ }
        }

        resolve({
          taskId: task.id,
          status: TaskStatus.FAILED,
          exitCode: -1,
          outputData: null,
          logs,
          metrics: {
            cpuPercent: 0,
            memoryBytes: 0,
            executionTimeMs: Date.now() - startTime,
            customMetrics: {}
          },
          error: err.message,
          startTime,
          endTime: Date.now()
        });
      });

      bridge.start().then(() => {
        bridge.sendIPCMessage('DATA', Object.fromEntries(this.sharedContext));
      }).catch(err => {
        bridge.emit('error', err);
      });
    });
  }

  private saveCheckpoint(executionId: string): void {
    const checkpoint: PipelineStateCheckpoint = {
      pipelineId: this.pipelineId,
      executionId,
      timestamp: Date.now(),
      completedTasks: Object.fromEntries(this.results),
      taskStatuses: Object.fromEntries(Array.from(this.results.entries()).map(([k, v]) => [k, v.status])),
      sharedContext: Object.fromEntries(this.sharedContext)
    };
    const targetPath = path.join(this.checkpointDirectory, `${this.pipelineId}_${executionId}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  public loadCheckpoint(checkpointFilePath: string): void {
    const rawData = fs.readFileSync(checkpointFilePath, 'utf-8');
    const checkpoint: PipelineStateCheckpoint = JSON.parse(rawData);
    this.results = new Map(Object.entries(checkpoint.completedTasks));
    this.sharedContext = new Map(Object.entries(checkpoint.sharedContext));
  }
}
