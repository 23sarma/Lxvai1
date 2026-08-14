# PyNexus Stream - Python Automation Pipelines Orchestrator

An autonomous, high-throughput TypeScript module designed to coordinate, sandbox, execute, and stream Directed Acyclic Graph (DAG) workflows of Python automation scripts.

## Features
- **Topological DAG Scheduler**: Automatic dependency resolution and cycle detection using Kahn's algorithm.
- **Structured Bi-directional IPC**: Seamless exchange of typed inputs and outputs between Python and TypeScript.
- **Resilience & Fault Tolerance**: Granular retry policies (linear and exponential backoff) and process timeout guards.
- **Real-Time Telemetry**: Event-driven stdout/stderr log streaming per task node.
- **Resource Sandbox Management**: Dynamic workspace isolation and cleanup.

## Quick Start

typescript
import { PipelineBuilder } from './src/autonomous_modules/python_automation_pipelines_2969';

const pipeline = new PipelineBuilder('data-etl-pipeline')
  .step({
    id: 'fetch-data',
    name: 'Fetch Data',
    scriptContent: `
pynexus_export({'raw_items': [10, 20, 30, 40]})
`,
  })
  .step({
    id: 'process-data',
    name: 'Process Data',
    dependencies: ['fetch-data'],
    scriptContent: `
inp = get_input()
items = inp['fetch-data']['raw_items']
squared = [x ** 2 for x in items]
pynexus_export({'processed_items': squared})
`,
  })
  .build();

pipeline.on('log', (log) => {
  console.log(`[${log.taskId}] ${log.message.trim()}`);
});

const report = await pipeline.executePipeline();
console.log('Pipeline Result:', report.status);
await pipeline.cleanup();

