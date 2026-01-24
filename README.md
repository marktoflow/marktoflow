# marktoflow - Universal Automation Framework

**Write once, run anywhere.**

A universal automation framework that enables markdown-based workflows with native MCP support, direct SDK integrations, and distributed execution.

**Version:** 2.0.0-alpha.1 (TypeScript)

## What's New in v2.0

marktoflow v2.0 is a complete rewrite in TypeScript that replaces Python subprocess-based tool execution with **native SDK integrations**:

- ✅ **No more Python subprocess bridging** - Direct SDK method calls
- ✅ **Native MCP support** - Import MCP servers as npm packages
- ✅ **11 built-in integrations** - Slack, GitHub, Jira, Gmail, Outlook, Linear, Notion, Discord, Airtable, Confluence, HTTP
- ✅ **Full type safety** - TypeScript all the way through
- ✅ **Feature parity achieved** - All Python v1.0 features ported

## Key Features

- **Workflow as Code**: Define workflows in Markdown + YAML
- **Native MCP Support**: Direct import of MCP server packages (no subprocess spawning)
- **Direct SDK Integration**: Built-in support for 11+ services with official SDKs
- **Enterprise Ready**: RBAC, Approval Workflows, Audit Logging, Cost Tracking
- **Distributed Execution**: Scalable queue system (Redis/RabbitMQ/InMemory)
- **Universal Triggering**: Webhooks, File Watchers, Cron Schedules
- **AI Agent Integration**: Claude Code, OpenCode, Ollama

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
  name: 'My First Workflow'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - id: send
    action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello from marktoflow!'
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

marktoflow v2.0 includes native SDK integrations for 11+ services:

### Communication & Collaboration

- **Slack** (`@slack/web-api`) - Messages, channels, Socket Mode triggers
- **Discord** (`discord`) - Messages, threads, webhooks, guild management

### Email

- **Gmail** (`googleapis`) - Send/receive emails, Pub/Sub triggers, labels
- **Outlook** (`@microsoft/microsoft-graph-client`) - Emails, calendar, Graph subscriptions

### Project Management

- **Jira** (`jira.js`) - Issues, sprints, transitions, search (JQL)
- **Linear** (`linear`) - Issues, projects, GraphQL API

### Documentation & Knowledge

- **Notion** (`notion`) - Pages, databases, blocks, search
- **Confluence** (`confluence`) - Pages, spaces, comments, CQL search

### Developer Tools

- **GitHub** (`@octokit/rest`) - PRs, issues, repos, webhooks
- **Airtable** (`airtable`) - Records, pagination, batch operations

### Generic HTTP

- **HTTP Client** (`http`) - REST APIs, GraphQL, auth (Bearer/Basic/API-Key)

### AI Agents

- **Claude Code** - CLI wrapper for Claude with MCP
- **OpenCode** - SDK + CLI, 75+ AI backends
- **Ollama** - Local LLM execution

### MCP Protocol

- **Native MCP Support** - Import any MCP server as npm package

All integrations support:

- ✅ Full TypeScript type safety
- ✅ Automatic retry with circuit breakers
- ✅ Built-in error handling
- ✅ Credential encryption
- ✅ Cost tracking

## Example Workflows

See `examples/` directory for production-ready workflow templates:

- **[code-review](examples/code-review/)** - Automated PR reviews with AI
- **[daily-standup](examples/daily-standup/)** - Team update aggregation (scheduled)
- **[incident-response](examples/incident-response/)** - Incident coordination (webhook-triggered)
- **[sprint-planning](examples/sprint-planning/)** - AI-powered sprint planning
- **[dependency-update](examples/dependency-update/)** - Automated dependency PRs

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
    sdk: '@modelcontextprotocol/server-filesystem'
    options:
      allowedDirectories: ['./safe-zone']
```

### Script Tools

Execute local scripts as part of your workflow:

```yaml
tools:
  deploy:
    sdk: 'script'
    options:
      path: './tools/deploy.sh'

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
