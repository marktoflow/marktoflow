# @marktoflow/core

> **Author:** Scott Glover <scottgl@gmail.com>

Core engine for marktoflow - parser, executor, and state management.

## Overview

`@marktoflow/core` is the foundation of the marktoflow automation framework. It provides the core workflow engine, state management, scheduling, and execution infrastructure.

## Features

- **Workflow Parser** - Parse markdown + YAML workflow definitions
- **Execution Engine** - Step-by-step workflow execution with retry and error handling
- **State Management** - SQLite-based persistent state tracking
- **Scheduling** - Cron-based workflow scheduling
- **Queue System** - Support for Redis, RabbitMQ, and in-memory queues
- **Webhooks** - HTTP webhook trigger support
- **File Watching** - Monitor files for changes and trigger workflows
- **Security** - RBAC, approval workflows, and audit logging
- **Cost Tracking** - Track and manage API usage costs
- **Plugin System** - Extensible plugin architecture with 17 hook types
- **Templates** - Reusable workflow templates with variables
- **Tool Registry** - Support for MCP, OpenAPI, and custom tools
- **Agent Routing** - Multi-agent workflow support with routing strategies

## Installation

```bash
npm install @marktoflow/core
```

## Usage

### Basic Workflow Execution

```typescript
import { WorkflowParser, WorkflowEngine } from '@marktoflow/core';

// Parse workflow
const parser = new WorkflowParser();
const workflow = await parser.parseWorkflow('workflow.md');

// Execute workflow
const engine = new WorkflowEngine();
const result = await engine.execute(workflow, {
  inputs: { message: 'Hello World' },
});

console.log(result);
```

### With State Management

```typescript
import { WorkflowEngine, StateManager } from '@marktoflow/core';

// Initialize state manager
const stateManager = new StateManager({
  dbPath: '.marktoflow/state.db',
});

// Execute workflow with state
const engine = new WorkflowEngine({ stateManager });
const result = await engine.execute(workflow);

// Query state
const history = await stateManager.getWorkflowHistory(workflow.id);
```

### Scheduling

```typescript
import { Scheduler } from '@marktoflow/core';

// Create scheduler
const scheduler = new Scheduler();

// Schedule workflow (cron format)
await scheduler.schedule({
  workflowId: 'daily-report',
  cron: '0 9 * * 1-5', // 9 AM weekdays
  workflowPath: './workflows/daily-report.md',
});

// Start scheduler
await scheduler.start();
```

### Webhooks

```typescript
import { WebhookServer } from '@marktoflow/core';

// Create webhook server
const webhookServer = new WebhookServer({ port: 3000 });

// Register webhook
await webhookServer.registerWebhook({
  path: '/github',
  workflowPath: './workflows/github-pr.md',
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

// Start server
await webhookServer.start();
```

### Plugin System

```typescript
import { PluginRegistry } from '@marktoflow/core';

// Register plugin
const registry = new PluginRegistry();
await registry.register({
  name: 'my-plugin',
  hooks: {
    beforeWorkflowStart: async (context) => {
      console.log('Starting workflow:', context.workflow.id);
    },
    afterStepComplete: async (context) => {
      console.log('Completed step:', context.step.action);
    },
  },
});
```

## Workflow Format

Workflows are written in markdown with YAML frontmatter:

```markdown
---
workflow:
  id: example
  name: Example Workflow

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

triggers:
  - type: schedule
    cron: '0 9 * * *'

inputs:
  message:
    type: string
    required: true

outputs:
  result:
    type: string
---

# Example Workflow

This workflow posts a message to Slack.

## Step 1: Post Message

\`\`\`yaml
action: slack.chat.postMessage
inputs:
channel: '#general'
text: '{{ inputs.message }}'
output_variable: result
\`\`\`
```

## Architecture

### Core Components

1. **Parser** (`parser.ts`) - Parse markdown + YAML workflow definitions
2. **Engine** (`engine.ts`) - Execute workflows with retry/circuit breaker
3. **State Manager** (`state.ts`) - SQLite-based state persistence
4. **Scheduler** (`scheduler.ts`) - Cron-based workflow scheduling
5. **Queue** (`queue.ts`) - Redis/RabbitMQ/InMemory queue support
6. **Webhook** (`webhook.ts`) - HTTP webhook triggers
7. **File Watcher** (`filewatcher.ts`) - File change monitoring
8. **Security** (`security.ts`) - RBAC and audit logging
9. **Cost Tracker** (`costs.ts`) - API usage cost management
10. **Plugin System** (`plugins.ts`) - Extensible hooks
11. **Templates** (`templates.ts`) - Reusable workflow patterns
12. **Tool Registry** (`tool-registry.ts`) - MCP/OpenAPI/Custom tools
13. **Agent Routing** (`routing.ts`) - Multi-agent coordination

### Execution Flow

```
Parser → Validate → Security Check → Execute Steps → Save State → Output
           ↓           ↓                    ↓            ↓
        Schema      RBAC              Retry/Failover  Audit Log
```

## Configuration

### Environment Variables

```bash
# Database
MARKTOFLOW_DB_PATH=.marktoflow/state.db

# Queue (Redis)
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue (RabbitMQ)
RABBITMQ_URL=amqp://localhost

# Security
MARKTOFLOW_SECRET_KEY=your-secret-key
```

### Configuration File

Create `.marktoflow/config.yaml`:

```yaml
state:
  dbPath: .marktoflow/state.db

queue:
  type: redis # redis, rabbitmq, or memory
  redis:
    host: localhost
    port: 6379

security:
  rbac:
    enabled: true
  auditLog:
    enabled: true

costs:
  budget:
    daily: 100
    monthly: 3000
  alerts:
    - threshold: 50
      emails: [admin@example.com]
```

## API Reference

### WorkflowParser

```typescript
class WorkflowParser {
  parseWorkflow(filePath: string): Promise<Workflow>;
  parseYAML(content: string): Workflow;
  validate(workflow: Workflow): ValidationResult;
}
```

### WorkflowEngine

```typescript
class WorkflowEngine {
  constructor(options?: EngineOptions);
  execute(workflow: Workflow, context?: ExecutionContext): Promise<WorkflowResult>;
  stop(): Promise<void>;
}
```

### StateManager

```typescript
class StateManager {
  constructor(options: StateOptions);
  getWorkflowHistory(workflowId: string): Promise<WorkflowRun[]>;
  getWorkflowState(runId: string): Promise<WorkflowState>;
  saveWorkflowState(state: WorkflowState): Promise<void>;
}
```

### Scheduler

```typescript
class Scheduler {
  schedule(config: ScheduleConfig): Promise<void>;
  unschedule(workflowId: string): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

## Testing

```bash
npm test
```

## Links

- [Main Repository](https://github.com/scottgl9/marktoflow)
- [Documentation](https://github.com/scottgl9/marktoflow#readme)
- [CLI Package](@marktoflow/cli)
- [Integrations Package](@marktoflow/integrations)

## License

Apache-2.0
