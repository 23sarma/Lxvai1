# Aegis AI Memory: Python Automation Pipelines Engine

### Architectural Context
- **Engine**: `PyNexusPipelineEngine` / `python_automation_pipelines_2969.ts`
- **Target Purpose**: Provide Node.js/TypeScript environments with high-reliability Python task DAG orchestration, automatic IPC input/output mapping, concurrent task scheduling, and isolated child process monitoring.
- **Design Patterns**: Directed Acyclic Graph (DAG) with Kahn's Algorithm for cycle validation, Event-Driven Stream Telemetry (`EventEmitter`), and Circuit-Broken Retries.

### Key Invariants
- Every task communicates typed output via tagged telemetry blocks (`---PYNEXUS_DATA_START---`).
- Dependent tasks inherit resolved upstream outputs in their execution context.
- Process lifecycles are guaranteed clean termination using graceful `SIGTERM` followed by forceful `SIGKILL` escalation on timeouts.
