# @marktoflow/core

> Workflow engine for parsing, executing, and managing markdown-based automations.

[![npm](https://img.shields.io/npm/v/@marktoflow/core)](https://www.npmjs.com/package/@marktoflow/core)

Part of [marktoflow](../../README.md) — open-source markdown workflow automation.

## Quick Start

```bash
npm install @marktoflow/core
```

```typescript
import { WorkflowParser, WorkflowEngine } from '@marktoflow/core';

const parser = new WorkflowParser();
const workflow = await parser.parseWorkflow('workflow.md');

const engine = new WorkflowEngine();
const result = await engine.execute(workflow, {
  inputs: { message: 'Hello World' },
});
```

## Features

- **Workflow Parser** — Parse markdown + YAML workflow definitions
- **Execution Engine** — Step-by-step execution with retry, circuit breakers, and error handling
- **State Management** — SQLite-based persistent state tracking
- **Plugin System** — Extensible architecture with 17 hook types
- **Cost Tracking** — Monitor and budget API usage per workflow
- **Scheduling** — Cron-based workflow scheduling
- **Security** — RBAC, approval workflows, and audit logging
- **Queue System** — Distributed execution via Redis, RabbitMQ, or in-memory

## Usage

### State Management

```typescript
import { WorkflowEngine, StateManager } from '@marktoflow/core';

const stateManager = new StateManager({ dbPath: '.marktoflow/state.db' });
const engine = new WorkflowEngine({ stateManager });
const result = await engine.execute(workflow);

const history = await stateManager.getWorkflowHistory(workflow.id);
```

### Scheduling

```typescript
import { Scheduler } from '@marktoflow/core';

const scheduler = new Scheduler();
await scheduler.schedule({
  workflowId: 'daily-report',
  cron: '0 9 * * 1-5',
  workflowPath: './workflows/daily-report.md',
});
await scheduler.start();
```

### Plugin System

```typescript
import { PluginRegistry } from '@marktoflow/core';

const registry = new PluginRegistry();
await registry.register({
  name: 'my-plugin',
  hooks: {
    beforeWorkflowStart: async (ctx) => console.log('Starting:', ctx.workflow.id),
    afterStepComplete: async (ctx) => console.log('Done:', ctx.step.action),
  },
});
```

## API Reference

```typescript
class WorkflowParser {
  parseWorkflow(filePath: string): Promise<Workflow>;
  parseYAML(content: string): Workflow;
  validate(workflow: Workflow): ValidationResult;
}

class WorkflowEngine {
  constructor(options?: EngineOptions);
  execute(workflow: Workflow, context?: ExecutionContext): Promise<WorkflowResult>;
  stop(): Promise<void>;
}

class StateManager {
  constructor(options: StateOptions);
  getWorkflowHistory(workflowId: string): Promise<WorkflowRun[]>;
  saveWorkflowState(state: WorkflowState): Promise<void>;
}
```

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

Apache-2.0
