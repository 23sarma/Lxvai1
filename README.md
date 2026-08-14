# PyAutomata: Distributed Python Automation Pipeline Engine

PyAutomata is a high-performance orchestration framework designed to execute, schedule, and monitor Python workflows from TypeScript.

## Features
- **DAG Graph Resolution**: Automatic topological ordering with cycle detection.
- **IPC Stream Bridge**: Native JSON messaging between Python and TypeScript processes.
- **Fault Recovery**: Checkpointing and automated exponential backoff retries.
- **Shared Pipeline Context**: Downstream tasks automatically receive upstream context variables.