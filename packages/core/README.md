# @marktoflow/core

> AI workflow engine — parse, execute, and orchestrate markdown-based automations with tool calling, parallel execution, and structured output.

[![npm](https://img.shields.io/npm/v/@marktoflow/core)](https://www.npmjs.com/package/@marktoflow/core)

Part of [marktoflow](https://github.com/marktoflow/marktoflow) — open-source AI workflow automation.

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

- **Workflow Parser** — Parse markdown + YAML workflow definitions with Zod validation
- **Execution Engine** — Step-by-step execution with retry, circuit breakers, and error handling
- **Control Flow** — Conditionals (`if/else`), loops (`for-each`), `try/catch/finally`, `parallel` branches
- **Parallel Execution** — `parallel.spawn` (multi-agent) and `parallel.map` (batch processing)
- **Sub-Workflows** — Nested workflow execution with optional AI sub-agent mode
- **Template Engine** — Nunjucks-based expressions with 50+ built-in filters
- **State Management** — SQLite-based persistent state tracking
- **Plugin System** — Extensible architecture with 17 hook types
- **Cost Tracking** — Monitor and budget API usage per workflow/step
- **Agent Routing** — Capability-based agent selection with cost optimization and load balancing
- **Scheduling** — Cron-based workflow scheduling
- **Security** — RBAC, approval workflows, secret management (Vault, AWS, Azure, env), audit logging
- **Queue System** — Distributed execution via Redis, RabbitMQ, or in-memory

## Usage

### Control Flow

```typescript
// The engine handles conditionals, loops, parallel, and try/catch natively
const workflow = await parser.parseWorkflow('complex-workflow.md');
const result = await engine.execute(workflow);

// Access step results
console.log(result.output);
console.log(result.stepResults);
```

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

### Agent Routing

```typescript
import { AgentRouter, AgentSelector, BudgetTracker } from '@marktoflow/core';

const selector = new AgentSelector(agentProfiles, 'balanced');
const budget = new BudgetTracker({ totalBudget: 10.0 });
const router = new AgentRouter(selector, budget);

const result = router.route({
  requiredCapabilities: new Set(['tool_calling', 'streaming']),
  maxCost: 0.05,
});
```

## Architecture

```
@marktoflow/core
├── engine/              # Workflow execution engine
│   ├── control-flow     # if/else, for-each, parallel, try/catch
│   ├── subworkflow      # Sub-workflow and AI sub-agent execution
│   ├── variable-resolution  # Nunjucks template resolution
│   ├── conditions       # Condition evaluation
│   └── retry            # Retry with exponential backoff
├── operations/          # 9 built-in operation modules
├── filters/             # 9 Nunjucks filter modules (50+ filters)
├── parser               # Markdown + YAML parser
├── routing              # Agent selection and routing
├── costs                # Cost tracking and budgeting
├── state-manager        # SQLite-based state persistence
├── sdk-registry         # Dynamic SDK loading and caching
├── plugin-registry      # Plugin system with 17 hook types
└── utils/               # Duration parsing, error handling
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

class AgentSelector {
  select(context: RoutingContext): RoutingResult;
  registerAgent(profile: AgentProfile): void;
}

class SDKRegistry {
  registerTools(tools: Record<string, ToolConfig>): void;
  load(name: string): Promise<unknown>;
}
```

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

[AGPL-3.0](https://github.com/marktoflow/marktoflow/blob/main/LICENSE)
