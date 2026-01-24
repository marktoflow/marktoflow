# AGENTS.md - Development Guidance

This file provides guidance for AI coding agents working on this project.

---

## Project Overview

**marktoflow** - A universal automation framework that enables markdown-based workflows with native MCP support and direct SDK integration.

**Current Status:** TypeScript v2.0 rewrite in progress

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

**v1.0 (Python):** Agent adapters translate to Claude/OpenCode/Ollama subprocess calls
**v2.0 (TypeScript):** Direct SDK calls, no agent abstraction needed

---

## Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Parser, engine, state
│   │   ├── src/
│   │   │   ├── parser.ts     # YAML + markdown parsing
│   │   │   ├── engine.ts     # Step execution
│   │   │   ├── state.ts      # SQLite persistence
│   │   │   └── models.ts     # TypeScript types
│   │   └── package.json
│   ├── cli/                  # CLI commands
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   └── integrations/         # Service integrations
│       ├── slack/
│       ├── jira/
│       ├── gmail/
│       ├── github/
│       └── package.json
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

### Key Patterns

**SDK Integration Pattern**:
```typescript
// Direct SDK usage, no abstraction layers
import { WebClient } from '@slack/web-api';

async function sendMessage(channel: string, text: string) {
  const client = new WebClient(process.env.SLACK_TOKEN);
  return client.chat.postMessage({ channel, text });
}
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
  action: string;      // e.g., "slack.chat.postMessage"
  inputs: Record<string, unknown>;
  output_variable?: string;
}

async function executeStep(step: Step, context: Context): Promise<StepResult> {
  const [service, method] = step.action.split('.');
  const sdk = await loadSDK(service);
  return sdk[method](resolveInputs(step.inputs, context));
}
```

---

## Workflow Format

Workflows use markdown with YAML frontmatter:

```markdown
---
workflow:
  id: notify-slack
  name: "Slack Notification"

tools:
  slack:
    sdk: "@slack/web-api"
    auth:
      token: "${SLACK_BOT_TOKEN}"

steps:
  - id: send
    action: slack.chat.postMessage
    inputs:
      channel: "#general"
      text: "Hello from marktoflow!"
---

# Slack Notification

This workflow sends a message to Slack.
```

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
    "better-sqlite3": "^11.x",
    "commander": "^12.x",
    "yaml": "^2.x"
  }
}
```

---

## Current Focus

See `TODO.md` for the full roadmap. Priority:

1. **Phase 1**: TypeScript project setup, core engine port
2. **Phase 2**: Native MCP + SDK integrations
3. **Phase 3**: Triggers (webhooks, Slack events, email)
4. **Phase 4**: Developer experience (wizard, dry-run)

---

## File References

- `TODO.md` - v2.0 TypeScript roadmap
- `PROGRESS.md` - Development history
- `CLAUDE.md` - Claude Code context
- `FRAMEWORK_ANALYSIS.md` - Full analysis and recommendations
