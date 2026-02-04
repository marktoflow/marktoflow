# marktoflow - Agent Automation Framework

**Write once, run anywhere.**

> A powerful CLI-first automation framework for developers and teams. Define workflows in Markdown + YAML, execute across 30+ services, and leverage AI agents you already pay for.

## Why marktoflow?

### 🖥️ CLI-First Design
Write workflows as code in your favorite editor. No GUI required. Version control with Git. Deploy with CI/CD.

### 📝 Workflows as Markdown
Human-readable, portable workflow files. Not proprietary JSON or locked-in platforms. Just Markdown + YAML.

### 🔌 Native SDK Integration
Direct method calls to official SDKs. Full TypeScript type safety. No wrapper APIs. No learning curve if you already know the SDK.

### 🤖 AI Agents Without Extra Cost
Use your **existing** GitHub Copilot, Claude Code, or OpenAI Codex subscriptions. No separate API keys. No duplicate charges.

### 🌐 Universal REST Client
Connect to **any REST API** without custom integrations. Bearer auth, Basic auth, API keys, GraphQL - all built-in.

### 🎨 Optional Visual Designer
Prefer visual editing? Launch the web UI with `marktoflow gui`. Drag-and-drop workflows. AI assistance. Live execution.

### 🏢 Enterprise Ready
RBAC, approval workflows, audit logging, cost tracking, distributed execution, retry logic, circuit breakers.

## What's Included

This complete installation package includes all marktoflow components:

- **@marktoflow/cli** - Command-line interface and workflow runner
- **@marktoflow/core** - Core engine (parser, executor, state management)
- **@marktoflow/gui** - Visual workflow designer (web UI)
- **@marktoflow/integrations** - 30+ service integrations and AI adapters

## Quick Start

### Installation

Install globally:

```bash
npm install -g @marktoflow/marktoflow
```

Verify installation:

```bash
marktoflow version
marktoflow gui --help
```

Or use with npx (no installation):

```bash
npx @marktoflow/marktoflow --help
```

### Initialize a Project

```bash
marktoflow init
```

### Create Your First Workflow

Create `.marktoflow/workflows/hello-world.md`:

```markdown
---
workflow:
  id: hello-world
  name: 'Hello World'

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

# Hello World

This workflow sends a message to Slack using the official SDK.
```

### Run the Workflow

```bash
# Run the workflow from the command line
marktoflow run hello-world.md

# With custom inputs
marktoflow run hello-world.md --input message="Custom message"

# Override AI agent at runtime
marktoflow run hello-world.md --agent copilot

# Override model name at runtime
marktoflow run hello-world.md --model claude-sonnet-4

# Verbose output
marktoflow run hello-world.md --verbose
```

**That's it!** marktoflow is CLI-first - create workflows as markdown files and run them from your terminal.

### Start Visual Designer (Optional)

```bash
marktoflow gui
```

Features:
- **Drag-and-Drop Editor** - Visual node-based workflow canvas
- **AI Assistance** - Natural language commands to modify workflows
- **Real-time Execution** - Run and debug workflows with live status
- **Live File Sync** - Changes sync automatically with workflow files

## Core Features

### 🚀 Powerful Workflow Engine

**Control Flow**
- ✅ If/Else conditionals
- ✅ Switch/Case branching
- ✅ For-each loops with break/continue
- ✅ While loops with conditions
- ✅ Parallel execution with throttling
- ✅ Map/Filter/Reduce operations
- ✅ Try/Catch error handling

**Template System**
- ✅ Jinja2-compatible pipeline syntax: `{{ value | split('/') | first }}`
- ✅ 50+ custom helpers (date, math, string, regex)
- ✅ Regex filters with capture groups
- ✅ Dynamic variable substitution
- ✅ Nested template expressions

**Workflow Composition**
- ✅ Sub-workflows with unlimited nesting
- ✅ Reusable workflow libraries
- ✅ Input/output parameter passing
- ✅ Shared state management
- ✅ Cross-workflow data flow

**Script Execution**
- ✅ Inline bash commands
- ✅ Python scripts
- ✅ Node.js scripts
- ✅ Custom script interpreters
- ✅ Environment variable injection

### 🔗 Integration Ecosystem

**30+ Native SDK Integrations**

All integrations use official SDKs with full TypeScript type safety:

**Communication** (7 integrations)
- Slack - Messages, channels, Socket Mode webhooks
- Microsoft Teams - Teams, channels, messages, meetings
- Discord - Messages, threads, webhooks, guild management
- Telegram - Bot API, inline keyboards, webhooks
- WhatsApp - Business API, templates, interactive messages
- Twilio - SMS, voice, WhatsApp messaging
- Email - Gmail, Outlook, SendGrid

**Productivity** (8 integrations)
- Google Sheets - CRUD, batch updates, formulas
- Google Calendar - Events, free/busy, webhooks
- Google Drive - Files, folders, permissions, search
- Google Docs - Document creation, formatting, images
- Notion - Pages, databases, blocks, search
- Confluence - Pages, spaces, CQL search
- Mailchimp - Campaign management, automation
- Airtable - Records, pagination, batch ops

**Project Management** (4 integrations)
- Jira - Issues, sprints, JQL search, transitions
- Linear - Issues, projects, GraphQL API
- Asana - Tasks, projects, workspaces, portfolios
- Trello - Boards, lists, cards, automation

**Developer Tools** (2 integrations)
- GitHub - PRs, issues, repos, webhooks
- Zendesk - Tickets, users, organizations

**Commerce** (2 integrations)
- Stripe - Payments, subscriptions, customers
- Shopify - Products, orders, inventory

**Storage & Data** (5 integrations)
- Dropbox - Files, folders, sharing
- AWS S3 - Object storage, buckets
- Supabase - Database, auth, storage, RPC
- PostgreSQL - Direct SQL queries, transactions
- MySQL - Direct SQL queries, connection pooling

**Universal** (1 integration)
- HTTP Client - Connect to **any REST API**
  - All HTTP methods (GET, POST, PUT, PATCH, DELETE)
  - Multiple auth types (Bearer, Basic, API Key)
  - GraphQL query support
  - Custom headers and query params

### 🤖 AI Agent Integration

**Use Your Existing Subscriptions - No Extra API Costs**

If you already pay for GitHub Copilot, Claude Code, or OpenAI in your IDE, use them in workflows for free:

| Agent | Setup | Cost |
|-------|-------|------|
| **GitHub Copilot** | `copilot auth` | Use existing subscription |
| **Claude Code** | Claude CLI | Use existing subscription |
| **OpenAI Codex** | OpenAI CLI | Use existing subscription |
| **OpenCode** | SDK install | 75+ backends (GPT-4, Claude, Gemini) |
| **Ollama** | Local install | 100% free (runs locally) |

**Runtime Flexibility**

Switch AI providers without editing workflow files:

```bash
# Test with different AI providers
marktoflow run workflow.md --agent claude
marktoflow run workflow.md --agent copilot
marktoflow run workflow.md --agent ollama

# Override model at runtime
marktoflow run workflow.md --model claude-sonnet-4
marktoflow run workflow.md --model gpt-4o

# Combine overrides
marktoflow run workflow.md --agent copilot --model gpt-4o
marktoflow run workflow.md --agent claude --model claude-opus-4
```

**Capabilities**
- ✅ Natural language task execution
- ✅ Code generation and review
- ✅ Data analysis and transformation
- ✅ Content creation and summarization
- ✅ Tool use and function calling
- ✅ Multi-turn conversations

### 🏢 Enterprise & Production Features

**Security & Compliance**
- ✅ **RBAC** - Role-based access control for teams
- ✅ **Approval Workflows** - Multi-stage approval chains
- ✅ **Audit Logging** - Complete execution history with timestamps
- ✅ **Credential Encryption** - Secure storage for API keys and tokens
- ✅ **Secret Management** - Environment-based credential injection

**Scalability & Reliability**
- ✅ **Distributed Execution** - Scale with Redis/RabbitMQ/InMemory queues
- ✅ **Automatic Retry** - Configurable retry policies with exponential backoff
- ✅ **Circuit Breakers** - Prevent cascade failures
- ✅ **Rate Limiting** - Respect API rate limits automatically
- ✅ **Parallel Execution** - Run steps concurrently with throttling

**Monitoring & Observability**
- ✅ **Cost Tracking** - Monitor API usage and costs per workflow
- ✅ **Execution History** - SQLite persistence for all workflow runs
- ✅ **Error Handling** - Try/catch blocks with detailed error context
- ✅ **Metrics & Prometheus** - Export workflow metrics
- ✅ **Logging** - Structured JSON logs with Pino

**Triggering & Automation**
- ✅ **Webhook Server** - Built-in HTTP server for external events
- ✅ **Slack Socket Mode** - Receive Slack events without public URLs
- ✅ **File Watchers** - Auto-trigger workflows on file changes
- ✅ **Cron Schedules** - Schedule recurring workflows
- ✅ **Manual Triggers** - CLI-based execution

**Developer Experience**
- ✅ **Full TypeScript Support** - End-to-end type safety
- ✅ **Hot Reload** - Live workflow updates during development
- ✅ **Dry Run Mode** - Test workflows without executing actions
- ✅ **Debug Mode** - Detailed output with stack traces
- ✅ **Validation** - Syntax checking before execution

## Example Workflows

### AI Agent Workflows

**Codebase Q&A** - Answer questions about codebases via Slack/Telegram webhooks
```bash
marktoflow run examples/codebase-qa/workflow.md
```

**Agent Task Executor** - Execute agent tasks from messages with pass/fail reporting
```bash
marktoflow run examples/agent-task-executor/workflow.md
```

**Copilot Code Review** - AI code review with GitHub Copilot
```bash
marktoflow run examples/copilot-code-review/workflow.md
```

**Sprint Planning** - AI-powered sprint planning
```bash
marktoflow run examples/sprint-planning/workflow.md
```

### Automation Workflows

**Sub-Workflows** - Reusable workflow composition
```bash
marktoflow run examples/sub-workflows/main.md
```

**Daily Standup** - Team update aggregation (scheduled)
```bash
marktoflow run examples/daily-standup/workflow.md
```

**Incident Response** - Incident coordination (webhook-triggered)
```bash
marktoflow run examples/incident-response/workflow.md
```

All examples are production-ready templates you can customize for your needs.

## Documentation

### Getting Started
- [Main Repository](https://github.com/marktoflow/marktoflow)
- [Installation Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/INSTALLATION.md)
- [Detailed Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/DETAILED-GUIDE.md)
- [REST API Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/REST-API-GUIDE.md)

### Core Concepts
- [Template Expressions Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/TEMPLATE-EXPRESSIONS.md)
- [Control Flow Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/CONTROL-FLOW-GUIDE.md)

### Visual Designer
- [GUI User Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/GUI_USER_GUIDE.md)
- [GUI Developer Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/GUI_DEVELOPER_GUIDE.md)

### Advanced Topics
- [Playwright Guide](https://github.com/marktoflow/marktoflow/blob/main/docs/PLAYWRIGHT-GUIDE.md)
- [Setup Guides](https://github.com/marktoflow/marktoflow/tree/main/docs)

## Commands

Once installed, you have access to both CLI commands:

```bash
# Initialize project
marktoflow init

# Run workflows
marktoflow run workflow.md
marktoflow run workflow.md --input key=value
marktoflow run workflow.md --agent copilot
marktoflow run workflow.md --verbose

# Validate workflow syntax
marktoflow workflow validate workflow.md

# Start webhook server
marktoflow serve --port 3000
marktoflow serve --socket  # Slack Socket Mode

# Start visual designer
marktoflow gui

# Or use the direct GUI command
marktoflow-gui
```

## What Makes marktoflow Different?

### vs. Zapier/Make.com/n8n

| Feature | marktoflow | Cloud Platforms |
|---------|------------|-----------------|
| **Workflow Format** | Markdown + YAML (portable) | Proprietary JSON (locked-in) |
| **Version Control** | Git-native | External versioning |
| **AI Integration** | Use existing subscriptions | Pay extra for AI features |
| **SDK Access** | Direct method calls | Wrapper APIs only |
| **TypeScript Support** | Full type safety | Limited/none |
| **Local Development** | CLI-first | Web-based only |
| **Cost** | Open source | Per-task pricing |
| **Self-Hosted** | Built-in | Enterprise plans only |

### vs. GitHub Actions/GitLab CI

| Feature | marktoflow | CI/CD Platforms |
|---------|------------|-----------------|
| **Use Case** | General automation | CI/CD focused |
| **AI Agents** | First-class support | Limited |
| **Visual Editor** | Optional GUI | YAML only |
| **Integrations** | 30+ native SDKs | Marketplace actions |
| **Triggering** | Webhooks, cron, files, CLI | Git events primarily |
| **Execution** | Distributed queues | Runner-based |
| **State Management** | Built-in SQLite | External storage |

### vs. Custom Scripts

| Feature | marktoflow | Custom Scripts |
|---------|------------|-----------------|
| **Learning Curve** | Markdown + YAML | Full programming |
| **Error Handling** | Built-in retry/circuit breaker | Manual implementation |
| **Monitoring** | Audit logs, cost tracking | DIY |
| **Integrations** | 30+ SDKs ready | Install/configure each |
| **Visual Debugging** | Optional GUI | None |
| **Team Collaboration** | Workflow libraries | Copy/paste |

## Who Should Use marktoflow?

### ✅ Individual Developers

- **Quick automation** - Write workflows in minutes, not hours
- **No vendor lock-in** - Portable markdown files, not proprietary formats
- **Use what you have** - Leverage existing AI subscriptions and SDKs
- **Version control** - Git-friendly workflow files
- **Free visual editor** - Optional GUI for visual workflow design

### ✅ Development Teams

- **Collaboration** - Share workflows as code in your repository
- **Code review** - Standard PR process for workflow changes
- **Reusability** - Build libraries of sub-workflows
- **Observability** - Audit logs and execution history
- **Cost control** - Track API usage across workflows

### ✅ Enterprises

- **Security** - RBAC, approval workflows, credential encryption
- **Compliance** - Complete audit trail of all executions
- **Scalability** - Distributed execution with queue systems
- **Reliability** - Automatic retries, circuit breakers, error handling
- **Integration** - Connect to existing systems via REST APIs

## Author

**Scott Glover** <scottgl@gmail.com>

## License

Apache License 2.0

## Support

- [GitHub Issues](https://github.com/marktoflow/marktoflow/issues)
- [Documentation](https://github.com/marktoflow/marktoflow)
- [Examples](https://github.com/marktoflow/marktoflow/tree/main/examples)
