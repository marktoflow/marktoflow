# TODO - Marktoflow v2.0 TypeScript Rewrite

This file tracks the TypeScript rewrite of marktoflow for native MCP support and direct SDK integration.

---

## Decision: TypeScript Rewrite

**Date:** 2026-01-23

**Rationale:** See `FRAMEWORK_ANALYSIS.md` for full analysis.

Key reasons for TypeScript:
1. **MCP Ecosystem is npm-native** - All MCP servers are npm packages
2. **Better official SDKs** - Slack, Jira, Microsoft Graph, GitHub are primarily Node.js
3. **Simpler tool integration** - Just import and use, no subprocess bridging
4. **One ecosystem** - No Python-Node bridge complexity

---

## v2.0 Architecture Goals

### 1. Native MCP Support
- Direct import of MCP server packages
- No subprocess spawning or JSON-RPC bridging
- Hot-reload of MCP servers

### 2. Direct SDK References in YAML
```yaml
# Workflow can directly reference SDKs
tools:
  slack:
    sdk: "@slack/web-api"
    auth:
      token: "${SLACK_BOT_TOKEN}"

  anthropic:
    sdk: "@anthropic-ai/sdk"
    auth:
      api_key: "${ANTHROPIC_API_KEY}"

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: "#general"
      text: "Hello from marktoflow!"
```

### 3. Simple Installation
```bash
npx marktoflow init
npx marktoflow connect slack  # OAuth flow
npx marktoflow run workflow.md
```

---

## Phase 1: Foundation (TypeScript Core)

### Project Setup
- [ ] Initialize TypeScript monorepo (pnpm/turborepo)
- [ ] Create package structure:
  ```
  packages/
    core/           # Parser, engine, state
    cli/            # CLI commands
    integrations/   # Slack, Jira, Gmail, etc.
  ```
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Set up Vitest for testing
- [ ] Create CI/CD pipeline

### Core Engine (Port from Python)
- [ ] Data models (Workflow, Step, Context, Result)
- [ ] Workflow parser (YAML frontmatter + markdown)
- [ ] Step executor with retry/circuit breaker
- [ ] State persistence (SQLite via better-sqlite3)
- [ ] Execution logging

### CLI (Port from Python)
- [ ] `marktoflow init` - Project initialization
- [ ] `marktoflow run` - Workflow execution
- [ ] `marktoflow workflow list/validate/show`
- [ ] `marktoflow connect <service>` - OAuth setup (NEW)
- [ ] `marktoflow doctor` - Environment check

---

## Phase 2: Native Integrations

### MCP Integration
- [ ] MCP server loader (npm package management)
- [ ] Direct MCP server imports
- [ ] MCP tool discovery and schema extraction
- [ ] MCP server lifecycle management

### Built-in Integrations (via SDKs)
- [ ] **Slack** (`@slack/web-api`, `@slack/bolt`)
  - Actions: send_message, create_channel, get_messages
  - Triggers: message_received, app_mention (Socket Mode)
  - OAuth flow with token storage
- [ ] **Jira** (`jira.js`)
  - Actions: create_issue, update_issue, search, transition
  - Triggers: issue_created, issue_updated (webhooks)
  - OAuth flow with Atlassian
- [ ] **GitHub** (`@octokit/rest`)
  - Actions: create_pr, merge, create_issue, search
  - Triggers: push, pull_request, issues (webhooks)
  - Personal access token or GitHub App
- [ ] **Gmail** (`googleapis`)
  - Actions: get_emails, send_email, create_draft
  - Triggers: email_received (Pub/Sub push)
  - OAuth 2.0 with Google
- [ ] **Outlook** (`@microsoft/microsoft-graph-client`)
  - Actions: get_emails, send_email, calendar
  - Triggers: email_received (Graph subscriptions)
  - OAuth 2.0 with Microsoft

### AI SDKs (Direct YAML Reference)
- [ ] **Anthropic** (`@anthropic-ai/sdk`)
  - Direct Claude API access
  - Streaming support
  - Tool use
- [ ] **OpenAI** (`openai`)
  - GPT-4, GPT-4o access
  - Function calling
  - Streaming
- [ ] **Google AI** (`@google/generative-ai`)
  - Gemini models
  - Function calling

---

## Phase 3: Triggers & Events

### Trigger System
- [ ] Unified trigger manager
- [ ] Cron-based scheduling (node-cron)
- [ ] Webhook receiver (Express/Fastify)
- [ ] File system watcher (chokidar)

### External Triggers
- [ ] Slack Socket Mode (real-time messages)
- [ ] Gmail Pub/Sub (email notifications)
- [ ] GitHub webhooks
- [ ] Microsoft Graph subscriptions

### Tunnel Support (Development)
- [ ] Built-in cloudflared tunnel
- [ ] ngrok integration
- [ ] Local webhook testing

---

## Phase 4: Developer Experience

### Workflow Authoring
- [ ] `marktoflow new` - Interactive workflow wizard
- [ ] Dry-run mode with mocked responses
- [ ] Step-by-step debugging
- [ ] Hot reload during development

### Quick Start Presets
- [ ] Email-to-Jira workflow
- [ ] Slack notifications
- [ ] GitHub PR automation
- [ ] Daily digest generator

### Documentation
- [ ] Getting started guide
- [ ] Integration setup guides
- [ ] YAML reference
- [ ] Examples library

---

## Phase 5: Production Features

### From Python v1.0 (Port if needed)
- [ ] RBAC and permissions
- [ ] Approval workflows
- [ ] Audit logging
- [ ] Cost tracking
- [ ] Plugin system
- [ ] Workflow templates

### New Features
- [ ] Visual workflow editor (web UI)
- [ ] Workflow marketplace
- [ ] Team collaboration
- [ ] Hosted webhook service

---

## Migration Notes

### What to Keep from Python
- Workflow YAML format (compatible)
- Example workflows (convert to new format)
- Architecture patterns (retry, circuit breaker, failover)
- Test scenarios (rewrite in Vitest)

### What Changes
- No agent adapters (direct SDK calls instead)
- No MCP bridge (native MCP support)
- No subprocess spawning for tools
- Simpler tool registration (just import)

### Breaking Changes
- Python package no longer maintained after v2.0
- Configuration format changes
- Some workflow syntax updates for SDK references

---

## Python v1.0 - Archived

The Python implementation is feature-complete and archived. See `PROGRESS.md` for completed work.

**Final Python Stats:**
- 615+ tests
- Production-ready features:
  - Scheduling, webhooks, file watching
  - State persistence, retry logic, circuit breakers
  - RBAC, audit logging, credential encryption
  - Plugin system, workflow templates
  - Agent adapters (Claude Code, OpenCode, Ollama)

---

## Quick Reference

### New Project Structure
```
marktoflow/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── parser.ts
│   │   │   ├── engine.ts
│   │   │   ├── state.ts
│   │   │   └── models.ts
│   │   └── package.json
│   ├── cli/
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   └── integrations/
│       ├── slack/
│       ├── jira/
│       ├── gmail/
│       └── package.json
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

### Key Dependencies
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
