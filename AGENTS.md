# AGENTS.md - Development Guidance

This file provides guidance for AI coding agents working on this project.

---

## Project Overview

**marktoflow v2.0** - Agent automation framework with markdown-based workflows, native MCP support, and direct SDK integration.

### Key Principles

1. **Native MCP Support**: Direct npm package imports, no subprocess bridging
2. **Direct SDK Integration**: Reference SDKs directly in workflow YAML
3. **Simple Setup**: `npx marktoflow connect slack` for OAuth flows
4. **Write Once, Run Anywhere**: Workflows work with any compatible service

---

## Quick Reference

### Common Commands

```bash
# Build & Test
pnpm build                    # Build all packages
pnpm test                     # Run all tests
pnpm test --filter=@marktoflow/core         # Core only
pnpm test --filter=@marktoflow/integrations # Integrations only

# Run Workflows
./marktoflow run examples/daily-standup/workflow.md
./marktoflow run workflow.md --input key=value
./marktoflow workflow validate workflow.md
```

### Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Parser, engine, state, security, costs
│   │   └── src/
│   │       ├── parser.ts     # YAML + markdown parsing
│   │       ├── engine.ts     # Step execution with retry/circuit breaker
│   │       ├── state.ts      # SQLite persistence
│   │       ├── security.ts   # RBAC, audit logging
│   │       ├── costs.ts      # Cost tracking
│   │       └── plugins.ts    # Plugin system (17 hook types)
│   ├── cli/                  # CLI commands, OAuth flows
│   ├── gui/                  # Visual workflow designer
│   └── integrations/         # Service integrations + AI adapters
│       ├── services/         # 20+ native integrations
│       └── adapters/         # AI agents (Copilot, Claude, OpenCode, Ollama)
├── examples/                 # Production-ready workflow templates
└── docs/                     # Documentation
```

### Available Integrations

**Services (20+):** Slack, GitHub, Jira, Gmail, Outlook, Linear, Notion, Discord, Airtable, Confluence, HTTP, Google Sheets, Google Calendar, Google Drive, Google Docs, Telegram, WhatsApp, Supabase, PostgreSQL, MySQL

**AI Agents:** GitHub Copilot, Claude Code, OpenCode, Ollama

---

## Development Guidelines

### Code Style

- TypeScript strict mode
- pnpm for package management
- Vitest for testing
- ESLint + Prettier for formatting
- `exactOptionalPropertyTypes: false` for packages with external SDK types

### SDK Integration Pattern

```typescript
import { WebClient } from '@slack/web-api';
import type { SDKInitializer } from '@marktoflow/core';

export const SlackInitializer: SDKInitializer = {
  name: 'slack',
  async initialize(config) {
    return new WebClient(config.auth.token);
  },
  actions: {
    'chat.postMessage': async (sdk, inputs) => sdk.chat.postMessage(inputs),
  },
};
```

### MCP Integration Pattern

```typescript
import { Server } from '@modelcontextprotocol/server-slack';

const server = new Server({ token: process.env.SLACK_TOKEN });
const tools = await server.listTools();
```

---

## Workflow Format

Workflows use markdown with YAML frontmatter:

```yaml
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
---

# Slack Notification

## Step 1: Post Message

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "{{ inputs.message }}"
output_variable: result
```
```

---

## Current Status

### Completed

- Core engine with retry/circuit breaker/failover
- State persistence (SQLite)
- Scheduling (cron), webhooks, file watching
- Queue system (Redis/RabbitMQ/InMemory)
- RBAC, approval workflows, audit logging
- Cost tracking and budget management
- Plugin system with 17 hook types
- 20+ native service integrations
- Visual workflow designer (GUI)
- GitHub Copilot SDK integration

### In Progress

- Expand test coverage (145 → 615+ tests)
- Prometheus metrics integration

---

## Key Documentation

- `README.md` - Project overview and quick start
- `PROGRESS.md` - Development history
- `docs/INSTALLATION.md` - Installation guide
- `docs/REST-API-GUIDE.md` - HTTP integration guide
- `examples/` - Production workflow examples
