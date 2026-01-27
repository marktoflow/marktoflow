# marktoflow - Agent Automation Framework

**Write once, run anywhere.**

An agent automation framework that enables markdown-based workflows with native MCP support, direct SDK integrations, and distributed execution.

**Version:** 2.0.0-alpha.8 (TypeScript)

---

## What is marktoflow?

marktoflow is a **CLI-first automation framework** that lets you define workflows in Markdown + YAML and execute them across 20+ services. Write workflows as code, run them from the terminal, and optionally use the visual designer for editing.

**Key Differentiators:**

- 🖥️ **CLI-First** - Design and run workflows from your terminal
- 📝 **Workflows as Markdown** - Human-readable, version-controlled automation
- 🔌 **Native SDK Integration** - Direct method calls with full type safety
- 🤖 **AI Agent Support** - Use your existing Copilot/Claude subscriptions, no extra API keys
- 🌐 **Universal REST Client** - Connect to any API without custom integrations
- 🎨 **Visual Designer (Optional)** - Web-based drag-and-drop editor with AI assistance
- 🏢 **Enterprise Ready** - RBAC, approvals, audit logging, cost tracking

---

## Key Features

- **CLI-First Design**: Create, edit, and run workflows from your terminal
- **Workflow as Code**: Define workflows in Markdown + YAML
- **Workflow Control Flow**: If/else, switch/case, for-each/while loops, parallel execution, map/filter/reduce, try/catch
- **Sub-Workflows**: Compose reusable workflow components with unlimited nesting
- **Command Line Execution**: Run bash, Python, Node.js, and custom scripts directly
- **Native MCP Support**: Direct import of MCP server packages
- **Direct SDK Integration**: Built-in support for 20+ services with official SDKs
- **AI Agent Integration**: GitHub Copilot, OpenAI Codex, Claude Code, OpenCode, Ollama (beta)
- **Visual Workflow Designer**: Web-based drag-and-drop editor with AI assistance
- **Enterprise Ready**: RBAC, Approval Workflows, Audit Logging, Cost Tracking
- **Distributed Execution**: Scalable queue system (Redis/RabbitMQ/InMemory)
- **Universal Triggering**: Webhooks, File Watchers, Cron Schedules

---

## Quick Start

### Installation

**Option 1: Install from npm (Recommended)**

```bash
# Install globally from npm
npm install -g @marktoflow/cli@alpha

# Verify installation
marktoflow version
```

**Option 2: Use npx (No Installation)**

```bash
# Run commands directly without installation
npx @marktoflow/cli@alpha init
npx @marktoflow/cli@alpha run workflow.md
```

See [Installation Guide](docs/INSTALLATION.md) for complete setup instructions including PATH configuration and troubleshooting.

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

# Or with custom inputs
marktoflow run hello-world.md --input message="Custom message"

# Dry run (simulate without executing)
marktoflow run hello-world.md --dry-run
```

**That's it!** marktoflow is CLI-first - create workflows as markdown files and run them from your terminal.

---

## Supported Integrations

marktoflow v2.0 includes native SDK integrations for 20+ services:

### Communication & Collaboration

- **Slack** (`@slack/web-api`) - Messages, channels, Socket Mode triggers
- **Discord** (`discord`) - Messages, threads, webhooks, guild management
- **Telegram** (`telegram`) - Bot API, messages, photos, documents, inline keyboards, webhooks
- **WhatsApp** (`whatsapp`) - Business API, text, templates, media, interactive messages, locations

### Email

- **Gmail** (`googleapis`) - Send/receive emails, Pub/Sub triggers, labels
- **Outlook** (`@microsoft/microsoft-graph-client`) - Emails, calendar, Graph subscriptions

### Google Workspace

- **Google Sheets** (`googleapis`) - Spreadsheet CRUD, read/write values, formatting, batch updates
- **Google Calendar** (`googleapis`) - Event management, free/busy queries, conference data, webhooks
- **Google Drive** (`googleapis`) - File/folder operations, sharing, permissions, search
- **Google Docs** (`googleapis`) - Document creation/editing, text formatting, tables, images

### Project Management

- **Jira** (`jira.js`) - Issues, sprints, transitions, search (JQL)
- **Linear** (`linear`) - Issues, projects, GraphQL API

### Documentation & Knowledge

- **Notion** (`notion`) - Pages, databases, blocks, search
- **Confluence** (`confluence`) - Pages, spaces, comments, CQL search

### Developer Tools

- **GitHub** (`@octokit/rest`) - PRs, issues, repos, webhooks
- **Airtable** (`airtable`) - Records, pagination, batch operations

### Databases

- **Supabase** (`supabase`) - Database CRUD via REST, authentication, file storage, RPC functions
- **PostgreSQL** (`pg`) - Direct database connection, query execution, transactions, connection pooling
- **MySQL** (`mysql2`) - Direct database connection, query execution, transactions, connection pooling

### Universal REST API Client

- **HTTP Client** (`http`) - Connect to **any REST API** with full support for:
  - All HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD)
  - Multiple auth types (Bearer Token, Basic Auth, API Key)
  - GraphQL queries
  - Custom headers and query parameters
  - See [REST API Guide](docs/REST-API-GUIDE.md) for complete documentation

### AI Agents

Use your **existing AI coding agents without extra API keys** - authenticate once via CLI tools and leverage them in workflows:

- **GitHub Copilot** (`@github/copilot-sdk`) - Use your existing GitHub Copilot subscription via `copilot auth`
- **OpenAI Codex** (`openai-codex-sdk`) - Leverage OpenAI Codex via existing CLI authentication
- **Claude Code** - Use your existing Claude subscription via Claude CLI
- **OpenCode** - SDK + CLI supporting 75+ AI backends including GPT-4, Claude, Gemini
- **Ollama (beta)** - Run local LLMs without any API keys or subscriptions

**No extra costs**: If you already use these AI coding assistants in your IDE, you can use them in marktoflow workflows without paying for separate API access.

### MCP Protocol

- **Native MCP Support** - Import any MCP server as npm package

All integrations support:

- ✅ Full TypeScript type safety
- ✅ Automatic retry with circuit breakers
- ✅ Built-in error handling
- ✅ Credential encryption
- ✅ Cost tracking

---

## Visual Workflow Designer

While marktoflow is CLI-first, it also includes an optional web-based visual editor for those who prefer a graphical interface:

```bash
marktoflow gui
```

Features:

- **Drag-and-Drop Editor** - Visual node-based workflow canvas
- **AI Assistance** - Natural language commands to modify workflows
- **Multiple AI Backends** - Claude Code, GitHub Copilot, Claude API, Ollama
- **Real-time Execution** - Run and debug workflows from the UI
- **Live File Sync** - Changes sync automatically with workflow files

**Note**: The visual designer is completely optional. All workflows can be created and managed via CLI and text editor.

See [GUI User Guide](docs/GUI_USER_GUIDE.md) for detailed documentation.

---

## Example Workflows

See `examples/` directory for production-ready workflow templates:

- **[sub-workflows](examples/sub-workflows/)** - Reusable workflow composition
- **[copilot-code-review](examples/copilot-code-review/)** - AI code review with GitHub Copilot
- **[daily-standup](examples/daily-standup/)** - Team update aggregation (scheduled)
- **[incident-response](examples/incident-response/)** - Incident coordination (webhook-triggered)
- **[sprint-planning](examples/sprint-planning/)** - AI-powered sprint planning

---

## Documentation

### Getting Started

- [Installation Guide](docs/INSTALLATION.md) - Complete installation with troubleshooting
- [Detailed Guide](docs/DETAILED-GUIDE.md) - Comprehensive feature documentation
- [REST API Guide](docs/REST-API-GUIDE.md) - Connect to any REST API

### Visual Designer

- [GUI User Guide](docs/GUI_USER_GUIDE.md) - Using the visual workflow editor
- [GUI Developer Guide](docs/GUI_DEVELOPER_GUIDE.md) - Extending the GUI

### Advanced Topics

- [Control Flow Guide](docs/CONTROL-FLOW-GUIDE.md) - If/else, loops, parallel execution
- [Playwright Guide](docs/PLAYWRIGHT-GUIDE.md) - Browser automation
- [Setup Guides](docs/) - GitHub Copilot, Claude Code, Ollama setup

### Development

- [AGENTS.md](AGENTS.md) - Development guidance for AI coding agents
- [Publishing Guide](docs/PUBLISHING.md) - Publishing packages to npm

---

## Development

This project is a monorepo managed with `pnpm` and `turborepo`.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start visual designer
marktoflow gui
```

---

## Publishing

For information on publishing marktoflow packages to npm, see [docs/PUBLISHING.md](docs/PUBLISHING.md).

---

## Author

**Scott Glover** <scottgl@gmail.com>

---

## License

Apache License 2.0
