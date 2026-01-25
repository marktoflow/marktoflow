# TODO - Marktoflow v2.0 TypeScript Rewrite

This file tracks the TypeScript rewrite of marktoflow for native MCP support and direct SDK integration.

---

## npm Publishing & Organization

### Current Status (2026-01-24)

**Published Packages (Under @marktoflow organization)** ✅

- `@marktoflow/cli@2.0.0-alpha.3` - Main CLI package ✅ **WORKING**
- `@marktoflow/core@2.0.0-alpha.3` - Core engine ✅ **WORKING**
- `@marktoflow/integrations@2.0.0-alpha.3` - Service integrations ✅ **WORKING**

**Installation**:

```bash
npm install -g @marktoflow/cli@alpha
```

**Test Results**:

- ✅ Packages are publicly accessible via npm registry
- ✅ Successfully installs 297 packages
- ✅ CLI works: `npx @marktoflow/cli@alpha version` outputs `marktoflow v2.0.0-alpha.1`

### Legacy @scottgl Packages

**Status**: ❌ **BROKEN** - Not installable

**Issue**:

- `@scottgl/marktoflow@2.0.0-alpha.1` and `alpha.2` were published with `workspace:*` dependencies
- npm cannot resolve `workspace:*` protocol, causing install failures
- Error: `EUNSUPPORTEDPROTOCOL: Unsupported URL Type "workspace:"`

**Action**:

- [x] Migrated to @marktoflow organization with proper version dependencies
- [ ] Optional: Deprecate @scottgl packages with message pointing to @marktoflow

**Documentation**: See `docs/PUBLISHING.md` for publishing guide

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
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

  anthropic:
    sdk: '@anthropic-ai/sdk'
    auth:
      api_key: '${ANTHROPIC_API_KEY}'

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello from marktoflow!'
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

- [x] Initialize TypeScript monorepo (pnpm/turborepo)
- [x] Create package structure:
  ```
  packages/
    core/           # Parser, engine, state
    cli/            # CLI commands
    integrations/   # Slack, Jira, Gmail, etc.
  ```
- [x] Configure TypeScript, ESLint, Prettier
- [x] Set up Vitest for testing
- [x] Create CI/CD pipeline

### Core Engine (Port from Python)

- [x] Data models (Workflow, Step, Context, Result)
- [x] Workflow parser (YAML frontmatter + markdown)
- [x] Step executor with retry/circuit breaker
- [x] State persistence (SQLite via better-sqlite3)
- [x] Execution logging
- [x] Env loading + config helpers (.env discovery, typed accessors)
- [x] Credential manager + encryption backends (Fernet/Age/GPG parity)
- [x] Agent routing + selection + budgeting (routing/selection strategies)
- [x] Failover + agent health tracking (engine failover parity)
  - [x] Failover config + health tracker types
  - [x] Engine integration
- [x] Rollback/compensation framework (transaction + file/git handlers)

### CLI (Port from Python)

- [x] `marktoflow init` - Project initialization
- [x] `marktoflow run` - Workflow execution
- [x] `marktoflow workflow list/validate/show`
- [x] `marktoflow connect <service>` - OAuth setup (placeholder)
- [x] `marktoflow doctor` - Environment check
- [x] `marktoflow agent` - Agent management commands
- [x] `marktoflow tools` - Tool registry/inspection commands
- [x] `marktoflow schedule` - Scheduler management commands
- [x] `marktoflow bundle` - Workflow bundle commands
- [x] `marktoflow template` - Workflow template commands

---

## Phase 2: Native Integrations

### MCP Integration

- [x] MCP server loader (npm package management)
- [x] Direct MCP server imports
- [x] MCP tool discovery and schema extraction
- [x] MCP server lifecycle management

### Built-in Integrations (via SDKs)

- [x] **Slack** (`@slack/web-api`, `@slack/bolt`)
  - Actions: send_message, create_channel, get_messages
  - Triggers: message_received, app_mention (Socket Mode)
  - OAuth flow with token storage
- [x] **Jira** (`jira.js`)
  - Actions: create_issue, update_issue, search, transition
  - Triggers: issue_created, issue_updated (webhooks)
  - OAuth flow with Atlassian
- [x] **GitHub** (`@octokit/rest`)
  - Actions: create_pr, merge, create_issue, search
  - Triggers: push, pull_request, issues (webhooks)
  - Personal access token or GitHub App
- [x] **Gmail** (`googleapis`)
  - [x] SDK initializer (OAuth2 client)
  - [x] Actions: get_emails, send_email, create_draft (+ getEmail, markAsRead, addLabels, trash, delete, listLabels)
  - [x] Triggers: email_received (Pub/Sub push via GmailTrigger)
  - [x] OAuth 2.0 with Google (CLI flow via `marktoflow connect gmail`)
- [x] **Outlook** (`@microsoft/microsoft-graph-client`)
  - [x] SDK initializer (Graph client)
  - [x] Actions: get_emails, send_email, calendar (+ reply, forward, markAsRead, createEvent, updateEvent, acceptEvent, etc.)
  - [x] Triggers: email_received (Graph subscriptions via OutlookTrigger)
  - [x] OAuth 2.0 with Microsoft (CLI flow via `marktoflow connect outlook`)

### Additional Integrations

- [x] **Linear** (`linear`)
  - GraphQL API client
  - Actions: getIssue, createIssue, updateIssue, searchIssues, addComment, archiveIssue
  - Team, project, and workflow state management
- [x] **Notion** (`notion`)
  - Actions: search, getPage, createPage, updatePage, queryDatabase
  - Block content management (append, delete)
  - Database queries with filters
- [x] **Discord** (`discord`)
  - Actions: sendMessage, editMessage, deleteMessage, getMessages
  - Thread creation, reactions, webhooks
  - Guild and channel management
- [x] **Airtable** (`airtable`)
  - Actions: listRecords, getRecord, createRecord, updateRecord, deleteRecord
  - Pagination support, formula filtering
  - Batch operations (up to 10 records)
- [x] **Confluence** (`confluence`)
  - Actions: listPages, getPage, createPage, updatePage, deletePage
  - Comments, search (CQL), child pages
  - Space management
- [x] **HTTP** (`http`)
  - Generic REST API client
  - Bearer/Basic/API-Key authentication
  - GraphQL client helper

### AI SDKs (Direct YAML Reference)

- [x] **Anthropic** (`@anthropic-ai/sdk` via Claude Code CLI wrapper)
  - Direct Claude API access
  - Streaming support
  - Tool use
- [x] **OpenCode** (`@opencode-ai/sdk`)
  - SDK + CLI support
  - Function calling
  - Streaming
- [x] **Ollama** (`ollama`)
  - Local model support
- [ ] **GitHub Copilot** (`@github/copilot-sdk`)
  - [x] Analysis and design (see `docs/COPILOT_SDK_ANALYSIS.md`)
  - [x] Basic adapter (chat.send, chat.stream) - **In Progress**
  - [ ] Advanced features (future enhancement):
    - [ ] Custom tool definitions in workflows
    - [ ] MCP server integration
    - [ ] Session persistence and resumption
    - [ ] Infinite sessions (context compaction)
    - [ ] File attachments support
    - [ ] System message customization
    - [ ] Multi-model support (GPT-5, Claude, etc.)
    - [ ] Streaming with reasoning traces
    - [ ] Event system (tool execution, compaction, etc.)

---

## Phase 3: Triggers & Events

### Trigger System

- [x] Unified trigger manager
- [x] Cron-based scheduling (node-cron/custom scheduler)
- [x] Webhook receiver (Express/Fastify/custom)
- [x] File system watcher (chokidar)

### External Triggers

- [x] Slack Socket Mode (real-time messages)
- [x] Gmail Pub/Sub (email notifications) (webhook endpoint + trigger handler)
- [x] GitHub webhooks (via webhook receiver)
- [x] Microsoft Graph subscriptions (validation + webhook trigger)
- [x] Webhook trigger support with Slack/GitHub signature verification

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

- [x] RBAC and permissions
- [x] Approval workflows
- [x] Audit logging
- [x] Cost tracking parity (alerts, limits, summaries, estimators, persistent tracker)
- [x] Plugin system (hooks, registry, lifecycle, metrics/logging plugins)
- [x] Workflow templates (registry, variables, built-ins, CLI integration)
- [x] Tool registry parity (MCP/OpenAPI/Custom implementations + compatibility matrix)
- [x] Tool bundle support (bundle build/validate/load)
- [x] OpenAPI tool loader + schema validation
- [x] Custom tool adapters + local tool discovery
- [x] Env-based config + CLI config defaults (marktoflow.yaml parity)

### New Features

- [ ] Prometheus metrics integration (Python v1.0 had this)
- [ ] Visual workflow editor (web UI) - **See Phase 7: GUI**
- [ ] Workflow marketplace
- [ ] Team collaboration
- [ ] Hosted webhook service

---

## Phase 7: Visual Workflow Designer (GUI)

A web-based visual workflow editor inspired by n8n. See `packages/gui/PLAN.md` for detailed specification.

### Package Setup

- [x] Initialize `packages/gui` with Vite + React + TypeScript
- [x] Configure Tailwind CSS and shadcn/ui components
- [x] Set up Express server with basic routing
- [x] Add to pnpm workspace configuration
- [x] Add `marktoflow gui` CLI command

### Workflow Canvas (React Flow)

- [x] Implement `workflowToGraph()` converter (Workflow -> React Flow nodes/edges)
- [x] Implement `graphToWorkflow()` converter (React Flow -> Workflow)
- [x] Create custom StepNode component with service icons
- [x] Create SubWorkflowNode with expand/collapse functionality
- [x] Create TriggerNode variants (schedule, webhook, file watcher)
- [x] Create OutputNode for workflow outputs
- [x] Implement DataFlowEdge with variable labels and animation
- [x] Implement SequenceEdge with conditional badges
- [x] Add auto-layout algorithm (dagre)
- [x] Add pan/zoom/minimap controls
- [x] Add multi-select and group operations
- [x] Add copy/paste functionality
- [x] Add undo/redo system

### Step Editor

- [x] Right-click context menu for steps
- [x] Right-click context menu for canvas
- [x] Step editor modal with tabs:
  - [x] Properties tab (ID, name, action selector)
  - [x] Inputs tab with dynamic form generation
  - [x] Output tab with variable configuration
  - [x] Error handling tab (retry, fallback)
  - [x] Conditions tab with expression builder
  - [x] YAML tab with Monaco editor
- [x] Template variable autocomplete (`{{ variable }}`)
- [x] Validation on save

### AI Prompt Interface

- [x] Prompt input component at bottom of screen
- [x] Prompt history panel
- [x] Claude API integration for workflow modifications
- [ ] Prompt engineering for:
  - [ ] Adding/removing steps
  - [ ] Modifying step inputs
  - [ ] Adding error handling
  - [ ] Creating sub-workflows
  - [ ] Adding conditions
- [x] Change preview with diff view
- [x] Accept/reject workflow changes
- [x] Real-time canvas refresh after changes

### Sub-workflow Visualization

- [x] Collapsed view showing step count
- [x] Expanded inline view with group box
- [x] Drill-down navigation to sub-workflow
- [x] Breadcrumb navigation for workflow hierarchy
- [ ] Tab-based multi-workflow editing

### Properties Panel (Sidebar)

- [x] Step properties view (inputs, outputs, status)
- [x] Workflow properties view (metadata, triggers, tools)
- [x] Variables panel showing scope
- [x] Execution history panel

### Execution View

- [x] Execute workflow from GUI
- [x] Real-time step status updates
- [x] Log viewer panel
- [x] Variable inspector at each step
- [x] Step-through debugging mode

### Real-time Updates

- [x] WebSocket server for live updates
- [x] File watcher integration
- [x] Real-time canvas updates on file change
- [x] Execution status streaming

### REST API

- [x] `GET /api/workflows` - List workflows
- [x] `GET /api/workflows/:path` - Get workflow
- [x] `POST /api/workflows` - Create workflow
- [x] `PUT /api/workflows/:path` - Update workflow
- [x] `DELETE /api/workflows/:path` - Delete workflow
- [x] `POST /api/workflows/:path/execute` - Execute workflow
- [x] `GET /api/workflows/:path/runs` - Execution history
- [x] `POST /api/ai/prompt` - AI prompt endpoint
- [x] `GET /api/tools` - List available tools/SDKs
- [x] `GET /api/tools/:sdk/schema` - Get SDK schemas

### UI/UX Polish

- [x] n8n-inspired dark theme
- [x] Light mode support
- [x] Responsive design (mobile/tablet/desktop breakpoints)
- [x] Keyboard shortcuts
- [ ] Accessibility (a11y)

### Agent Backend Abstraction

- [x] Abstract AgentProvider interface
- [x] Claude provider implementation
- [x] Ollama provider implementation (local LLM)
- [x] Demo provider for testing
- [x] Auto-detection of available providers
- [x] API endpoints for provider management

### Testing

- [x] Unit tests for React components
- [x] Integration tests for API endpoints
- [x] E2E tests with Playwright
- [x] Canvas interaction tests

### Documentation

- [ ] User guide for GUI
- [ ] Developer documentation
- [ ] API documentation

---

## Phase 6: Quality & Testing

### Test Coverage

- [ ] Expand test suite (current: 181 tests, Python had 615+, **29% progress**)
  - [x] Core package: 125 tests (+36 new) - 119 passing
  - [x] Integrations package: 48 tests
  - [x] CLI package: 8 tests
  - [x] Add integration tests for workflows (13 tests added)
  - [x] Add end-to-end tests (6 tests added)
  - [x] Add concurrent execution tests (8 tests added)
  - [x] Add multi-agent workflow tests (9 tests added)
  - [ ] Add performance/load tests
  - [ ] Add security tests
  - [ ] Fix 6 failing edge case tests

### Completed Test Coverage

- [x] Full workflow execution scenarios (multi-step, conditionals, error handling)
- [x] Multi-agent workflows (routing, collaboration, consensus)
- [x] Error handling and recovery paths (retry, continue, fail)
- [x] Concurrent execution (parallel steps, rate limiting, resource contention)
- [x] Multi-service integration (Slack, Jira, GitHub, Gmail, Linear, Notion)
- [x] Complex variable resolution (nested objects, arrays)
- [x] Workflow lifecycle events

### Missing Test Coverage

- [ ] Large-scale state management
- [ ] Plugin lifecycle edge cases
- [ ] Template instantiation edge cases
- [ ] Cost tracking accuracy
- [ ] RBAC edge cases
- [ ] Webhook signature verification edge cases
- [ ] Performance benchmarks
- [ ] Security penetration tests

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

**TypeScript v2.0 Status:**

- **Core Features**: ✅ Feature parity achieved
- **Tests**: 145 tests (89 core + 48 integrations + 8 CLI)
- **Service Integrations**: ✅ 11 native integrations (vs 0 in Python)
- **Missing from Python v1.0**:
  - Prometheus metrics integration (basic metrics interface exists)
  - Full test coverage (615 tests → 145 tests)
- **New in v2.0**:
  - Native MCP support (no subprocess bridging)
  - Direct SDK integration in YAML
  - OAuth flows for Gmail/Outlook
  - 6 additional service integrations (Linear, Notion, Discord, Airtable, Confluence, HTTP)

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
