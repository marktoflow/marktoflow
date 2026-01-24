# marktoflow - Universal Automation Framework

**Write once, run anywhere.**

A universal automation framework that enables markdown-based workflows with native MCP support, direct SDK integrations, and distributed execution.

**Version:** 2.0.0-alpha.1 (TypeScript Rewrite)

## Key Features

- **Workflow as Code**: Define workflows in Markdown + YAML.
- **Native MCP Support**: Direct import of MCP server packages (no sidecars needed).
- **Direct SDK Integration**: Built-in support for Slack, GitHub, Jira, and more.
- **Enterprise Ready**: RBAC, Approval Workflows, Audit Logging.
- **Distributed Execution**: Scalable queue system (Redis/RabbitMQ).
- **Universal Triggering**: Webhooks, File Watchers, Cron Schedules.

## Quick Start

### Installation

```bash
npm install -g marktoflow
# or
npx marktoflow init
```

### Initialize a Project

```bash
marktoflow init
```

This creates the `.marktoflow/` directory structure with default configuration.

### Create a Workflow

Create `.marktoflow/workflows/my-workflow.md`:

```markdown
---
workflow:
  id: my-workflow
  name: "My First Workflow"

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

# My First Workflow

This workflow sends a message to Slack using the official SDK.
```

### Run a Workflow

```bash
marktoflow run my-workflow.md
```

## Architecture (v2.0)

```
Workflow Layer (Markdown + YAML)
         ▼
Parser (TypeScript Core)
         ▼
Engine (Executor + State + Retry)
         ▼
Integrations / SDK Registry
    ├── Direct SDKs (@slack/web-api, @octokit/rest, etc.)
    ├── Native MCP (In-memory MCP Servers)
    └── Script Tools (Local Executables)
```

## Supported Integrations

| Integration | Type | Notes |
|-------------|------|-------|
| **Slack** | SDK | Uses `@slack/web-api` |
| **GitHub** | SDK | Uses `@octokit/rest` |
| **Jira** | SDK | Uses `jira.js` |
| **Ollama** | Agent | Local LLM execution |
| **Claude Code** | Agent | CLI wrapper for Claude Code |
| **OpenCode** | Agent | SDK integration for OpenCode |
| **MCP** | Protocol | Native support for any MCP module |
| **Script** | Tool | Run bash/python scripts as tools |

## CLI Commands

```bash
# Project management
marktoflow init                    # Initialize project
marktoflow version                 # Show version
marktoflow doctor                  # Check environment

# Workflow operations
marktoflow run <workflow.md>       # Run a workflow
marktoflow workflow list           # List available workflows

# Distributed execution
marktoflow worker                  # Start a workflow worker
marktoflow trigger                 # Start trigger service (Scheduler)
```

## Advanced Features

### Native MCP Support

Marktoflow v2.0 can load MCP servers directly from NPM packages and communicate with them in-memory, bypassing the need for separate processes or JSON-RPC over stdio.

```yaml
tools:
  filesystem:
    sdk: "@modelcontextprotocol/server-filesystem"
    options:
      allowedDirectories: ["./safe-zone"]
```

### Script Tools

Execute local scripts as part of your workflow:

```yaml
tools:
  deploy:
    sdk: "script"
    options:
      path: "./tools/deploy.sh"

steps:
  - action: deploy.run
    inputs:
      env: production
```

### File Watcher Triggers

Trigger workflows on file changes:

```typescript
import { FileWatcher } from '@marktoflow/core';

const watcher = new FileWatcher({ path: './src' });
watcher.onEvent(async (event) => {
  // Trigger workflow execution
});
watcher.start();
```

## Development

This project is a monorepo managed with `pnpm` and `turborepo`.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Engine, State, Security, Queue, Costs, Metrics
│   ├── cli/                  # Command Line Interface
│   └── integrations/         # Service Integrations
├── .marktoflow/              # User configuration
├── package.json
└── pnpm-workspace.yaml
```

## Documentation

- [AGENTS.md](AGENTS.md) - Development guidance
- [GEMINI.md](GEMINI.md) - Port status tracking
- [PROGRESS.md](PROGRESS.md) - Development history

## License

Apache License 2.0
