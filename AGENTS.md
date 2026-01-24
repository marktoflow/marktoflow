# AGENTS.md - Development Guidance

This file provides guidance for AI coding agents working on this project.

---

## Project Overview

**marktoflow v2.0** - A universal automation framework that enables markdown-based workflows with native MCP support and direct SDK integration.

**Current Status:** TypeScript v2.0 - Feature parity with Python v1.0 achieved

### Key Principles

1. **Native MCP Support**: Direct npm package imports, no subprocess bridging
2. **Direct SDK Integration**: Reference SDKs directly in workflow YAML
3. **Simple Setup**: `npx marktoflow connect slack` for OAuth flows
4. **Write Once, Run Anywhere**: Workflows work with any compatible service

---

## v2.0 Architecture (TypeScript)

```
Workflow Layer (Markdown + YAML)
         ▼
Parser (TypeScript)
         ▼
Engine (Executor + State + Retry)
         ▼
Integrations (Direct SDK Imports)
         ▼
External Services (Slack, Jira, GitHub, etc.)
```

### Key Difference from v1.0

**v1.0 (Python - Archived):** Agent adapters translate to Claude/OpenCode/Ollama subprocess calls
**v2.0 (TypeScript - Current):** Direct SDK calls, no subprocess bridging needed

---

## Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Parser, engine, state, security, costs
│   │   ├── src/
│   │   │   ├── parser.ts     # YAML + markdown parsing
│   │   │   ├── engine.ts     # Step execution with retry/circuit breaker
│   │   │   ├── state.ts      # SQLite persistence
│   │   │   ├── security.ts   # RBAC, audit logging
│   │   │   ├── costs.ts      # Cost tracking
│   │   │   ├── plugins.ts    # Plugin system
│   │   │   ├── templates.ts  # Workflow templates
│   │   │   ├── routing.ts    # Agent routing
│   │   │   └── models.ts     # TypeScript types
│   │   ├── tests/            # 89 tests
│   │   └── package.json
│   ├── cli/                  # CLI commands
│   │   ├── src/
│   │   │   ├── index.ts      # All CLI commands
│   │   │   └── oauth.ts      # OAuth flows
│   │   ├── tests/            # 8 tests
│   │   └── package.json
│   └── integrations/         # Service integrations
│       ├── src/
│       │   ├── services/     # 11 native integrations
│       │   │   ├── slack.ts
│       │   │   ├── github.ts
│       │   │   ├── jira.ts
│       │   │   ├── gmail.ts
│       │   │   ├── outlook.ts
│       │   │   ├── linear.ts
│       │   │   ├── notion.ts
│       │   │   ├── discord.ts
│       │   │   ├── airtable.ts
│       │   │   ├── confluence.ts
│       │   │   └── http.ts
│       │   ├── adapters/     # AI agents
│       │   │   ├── ollama.ts
│       │   │   ├── claude-code.ts
│       │   │   └── opencode.ts
│       │   └── tools/
│       │       └── script.ts
│       ├── tests/            # 48 tests
│       └── package.json
├── examples/                 # Production-ready workflows
│   ├── code-review/
│   ├── daily-standup/
│   ├── incident-response/
│   ├── sprint-planning/
│   └── dependency-update/
├── .marktoflow/              # User configuration
│   ├── workflows/            # Workflow definitions
│   └── credentials/          # OAuth tokens
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Development Guidelines

### Code Style

- TypeScript strict mode
- Use pnpm for package management
- Use Vitest for testing
- ESLint + Prettier for formatting
- Use `exactOptionalPropertyTypes: false` for packages with external SDK types

### Key Patterns

**SDK Integration Pattern**:

```typescript
// Direct SDK usage, no abstraction layers
import { WebClient } from '@slack/web-api';
import type { SDKInitializer } from '@marktoflow/core';

export const SlackInitializer: SDKInitializer = {
  name: 'slack',
  async initialize(config) {
    return new WebClient(config.auth.token);
  },
  actions: {
    'chat.postMessage': async (sdk, inputs) => {
      return sdk.chat.postMessage(inputs);
    },
  },
};
```

**MCP Integration Pattern**:

```typescript
// Native MCP server import
import { Server } from '@modelcontextprotocol/server-slack';

const server = new Server({ token: process.env.SLACK_TOKEN });
const tools = await server.listTools();
```

**Workflow Step Execution**:

```typescript
interface Step {
  action: string; // e.g., "slack.chat.postMessage"
  inputs: Record<string, unknown>;
  output_variable?: string;
}

async function executeStep(step: Step, context: Context): Promise<StepResult> {
  const [service, ...methodParts] = step.action.split('.');
  const method = methodParts.join('.');
  const sdk = await sdkRegistry.loadSDK(service, context.config);
  const action = sdkRegistry.getAction(service, method);
  return action(sdk, resolveInputs(step.inputs, context));
}
```

---

## Workflow Format

Workflows use markdown with YAML frontmatter:

````markdown
---
workflow:
  id: notify-slack
  name: 'Slack Notification'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

triggers:
  - type: schedule
    cron: '0 9 * * 1-5'

inputs:
  message:
    type: string
    required: true

outputs:
  message_id:
    type: string
---

# Slack Notification

This workflow sends a message to Slack.

## Step 1: Post Message

````yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "{{ inputs.message }}"
output_variable: result
\```
````
````

---

## Test Coverage

Current test status: **145 tests passing**

- Core: 89 tests
- Integrations: 48 tests
- CLI: 8 tests

Goal: Expand to match Python v1.0's 615+ tests

---

## Key Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.x",
    "@slack/web-api": "^7.x",
    "@slack/bolt": "^4.x",
    "@octokit/rest": "^21.x",
    "jira.js": "^4.x",
    "googleapis": "^140.x",
    "@microsoft/microsoft-graph-client": "^3.x",
    "linear": "^x.x",
    "notion": "^x.x",
    "airtable": "^x.x",
    "confluence": "^x.x",
    "discord": "^x.x",
    "better-sqlite3": "^11.x",
    "commander": "^12.x",
    "yaml": "^2.x",
    "zod": "^3.x"
  }
}
```

---

## Current Status

### ✅ Completed (Feature Parity with Python v1.0)

1. ✅ Core engine with retry/circuit breaker/failover
2. ✅ State persistence (SQLite)
3. ✅ Scheduling (cron), webhooks, file watching
4. ✅ Queue system (Redis/RabbitMQ/InMemory)
5. ✅ RBAC, approval workflows, audit logging
6. ✅ Cost tracking and budget management
7. ✅ Plugin system with 17 hook types
8. ✅ Workflow templates
9. ✅ Agent routing and selection
10. ✅ Credential encryption (Fernet/Age/GPG)
11. ✅ Tool registry (MCP/OpenAPI/Custom)
12. ✅ 11 native service integrations
13. ✅ CLI commands (25+ commands)
14. ✅ OAuth flows for Gmail and Outlook

### 🔄 In Progress

- Expand test coverage (145 → 615+ tests)
- Prometheus metrics integration
- Developer experience improvements (Phase 4)

---

## File References

- `TODO.md` - v2.0 TypeScript roadmap and remaining work
- `PROGRESS.md` - Development history
- `FRAMEWORK_ANALYSIS.md` - Full analysis and recommendations
- `README.md` - Project overview
- `examples/` - Production-ready workflow examples
