# marktoflow - Universal Automation Framework

**Write once, run anywhere.**

A universal automation framework that enables markdown-based workflows with native MCP support, direct SDK integrations, and distributed execution.

**Version:** 2.0.0-alpha.7 (TypeScript)

## What's New in v2.0

marktoflow v2.0 brings powerful new capabilities and integrations:

- ✅ **Visual Workflow Designer** - Web-based drag-and-drop editor with AI assistance
- ✅ **Native SDK integrations** - Direct SDK method calls with full type safety
- ✅ **Native MCP support** - Import MCP servers as npm packages
- ✅ **Sub-workflow composition** - Build reusable workflow components
- ✅ **Command line tool execution** - Run bash, Python, Node.js scripts directly
- ✅ **20+ built-in integrations** - Slack, GitHub, Jira, Gmail, Outlook, Google Suite, Telegram, WhatsApp, databases, and more
- ✅ **Full TypeScript** - Type-safe workflows and integrations
- ✅ **Enterprise features** - RBAC, approvals, audit logging, cost tracking

## Key Features

- **Visual Workflow Designer**: Web-based drag-and-drop editor with AI-powered assistance
- **Workflow as Code**: Define workflows in Markdown + YAML
- **Sub-Workflows**: Compose reusable workflow components with unlimited nesting
- **Command Line Execution**: Run bash, Python, Node.js, and custom scripts directly
- **Native MCP Support**: Direct import of MCP server packages
- **Direct SDK Integration**: Built-in support for 20+ services with official SDKs
- **AI Agent Integration**: GitHub Copilot, Claude Code, OpenCode, Ollama
- **Enterprise Ready**: RBAC, Approval Workflows, Audit Logging, Cost Tracking
- **Distributed Execution**: Scalable queue system (Redis/RabbitMQ/InMemory)
- **Universal Triggering**: Webhooks, File Watchers, Cron Schedules

## Quick Start

### Installation

**Option 1: Install from npm (Recommended)**

```bash
# Install globally from npm
npm install -g @marktoflow/cli@alpha

# Verify installation
marktoflow version
```

After installation, the `marktoflow` command should be available globally. If you encounter a "command not found" error, see [PATH Setup](#path-setup) below.

**Option 2: Use npx (No Installation)**

```bash
# Run commands directly without installation
npx @marktoflow/cli@alpha init
npx @marktoflow/cli@alpha run workflow.md
```

**Option 3: Install from GitHub**

```bash
# Install globally from GitHub
npm install -g github:scottgl9/marktoflow#main

# Verify installation
marktoflow version
```

**Option 4: Install from Source**

```bash
# Clone repository
git clone https://github.com/scottgl9/marktoflow.git
cd marktoflow

# Install dependencies
pnpm install

# Build packages
pnpm build

# Link CLI globally
cd packages/cli
npm link

# Verify installation
marktoflow version
```

### Verifying Installation

After installation, run the verification script:

```bash
bash scripts/verify-install.sh
```

This checks if the `marktoflow` command is properly accessible and tests basic functionality.

### PATH Setup

If you see `command not found: marktoflow` after installation, you need to add npm's global bin directory to your PATH.

#### macOS / Linux

**1. Find npm's global bin directory:**

```bash
npm bin -g
```

This typically returns:

- `/usr/local/bin` (system-wide npm)
- `~/.npm-global/bin` (user-local npm)
- `~/.nvm/versions/node/vX.X.X/bin` (nvm users)

**2. Add to your shell profile:**

For **bash** (add to `~/.bashrc` or `~/.bash_profile`):

```bash
export PATH="$PATH:$(npm bin -g)"
```

For **zsh** (add to `~/.zshrc`):

```bash
export PATH="$PATH:$(npm bin -g)"
```

For **fish** (add to `~/.config/fish/config.fish`):

```fish
set -gx PATH $PATH (npm bin -g)
```

**3. Reload your shell:**

```bash
source ~/.bashrc  # or ~/.zshrc, ~/.bash_profile, etc.
```

**4. Verify:**

```bash
marktoflow version
```

#### Windows

**1. Find npm's global bin directory:**

```cmd
npm bin -g
```

This typically returns: `C:\Users\<username>\AppData\Roaming\npm`

**2. Add to PATH:**

- Open **System Properties** → **Environment Variables**
- Under **User variables**, select **Path** and click **Edit**
- Click **New** and add the path from step 1
- Click **OK** to save

**3. Restart your terminal and verify:**

```cmd
marktoflow version
```

#### Alternative: Use npx (No PATH Setup Needed)

If PATH setup is not working, you can always use `npx` to run marktoflow without installation:

```bash
npx @marktoflow/cli@alpha version
npx @marktoflow/cli@alpha run workflow.md
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

### Connect to Any REST API

```yaml
---
workflow:
  id: api-integration
  name: 'Custom API Integration'

tools:
  my_api:
    sdk: 'http'
    options:
      base_url: 'https://api.example.com'
    auth:
      type: 'bearer'
      token: '${API_TOKEN}'

steps:
  - id: fetch_data
    action: my_api.get
    inputs:
      path: '/users'
      query:
        status: 'active'
    output_variable: users

  - id: create_user
    action: my_api.post
    inputs:
      path: '/users'
      body:
        name: 'John Doe'
        email: 'john@example.com'
    output_variable: new_user
---
```

See [REST API Guide](docs/REST-API-GUIDE.md) for complete documentation.

### Sub-Workflows: Reusable Workflow Composition

Create modular, reusable workflows by calling other workflows as steps:

```yaml
---
workflow:
  id: user-onboarding
  name: 'User Onboarding'

steps:
  # Call validation sub-workflow
  - id: validate_email
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.email }}'
      min_length: 5
      max_length: 100
    output_variable: validation_result

  # Call notification sub-workflow
  - id: notify_team
    workflow: ./common/send-notification.md
    inputs:
      channel: '#onboarding'
      message: 'New user: {{ inputs.username }}'
      level: 'info'
---
```

**Benefits:**

- ✅ Reusable workflow components
- ✅ Unlimited nesting depth
- ✅ Clean separation of concerns
- ✅ Easy testing and maintenance

See [Sub-Workflows Example](examples/sub-workflows/) for complete guide.

### Execute Command Line Tools

Run any command line tool directly from workflows:

```yaml
---
workflow:
  id: run-scripts
  name: 'Command Line Execution'

tools:
  script:
    sdk: 'script'

steps:
  # Run shell commands
  - id: run_bash
    action: script.execute
    inputs:
      code: |
        #!/bin/bash
        echo "Hello from bash!"
        ls -la
        git status
    output_variable: bash_result

  # Run Python scripts
  - id: run_python
    action: script.execute
    inputs:
      code: |
        import sys
        print(f"Python {sys.version}")
        result = {"status": "success", "data": [1, 2, 3]}
        print(result)
      interpreter: python3
    output_variable: python_result

  # Run Node.js scripts
  - id: run_node
    action: script.execute
    inputs:
      code: |
        console.log("Hello from Node.js!");
        const data = { message: "Success" };
        console.log(JSON.stringify(data));
      interpreter: node
    output_variable: node_result
---
```

**Supported:**

- ✅ Shell scripts (bash, zsh, sh)
- ✅ Python scripts
- ✅ Node.js scripts
- ✅ Any executable with custom interpreter
- ✅ Capture stdout/stderr/exit code
- ✅ Environment variable support

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

- **GitHub Copilot** (`@github/copilot-sdk`) - GitHub Copilot CLI integration with OAuth authentication
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

- **[sub-workflows](examples/sub-workflows/)** - Reusable workflow composition with sub-workflows
- **[copilot-code-review](examples/copilot-code-review/)** - AI code review with GitHub Copilot
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

# Visual Designer
marktoflow gui                     # Start visual workflow designer
marktoflow gui --port 3000         # Custom port
marktoflow gui --open              # Open browser automatically

# Workflow operations
marktoflow new                     # Create workflow from template (interactive)
marktoflow update <workflow.md>    # Update workflow with AI coding agents
marktoflow run <workflow.md>       # Run a workflow
marktoflow run --dry-run           # Simulate workflow without executing
marktoflow debug <workflow.md>     # Debug workflow step-by-step
marktoflow workflow list           # List available workflows

# Service connections
marktoflow connect <service>       # Set up OAuth for services (gmail, outlook)

# Distributed execution
marktoflow worker                  # Start a workflow worker
marktoflow trigger                 # Start trigger service (Scheduler)

# Developer tools
marktoflow agent list              # List available AI agents
marktoflow tools list              # List registered tools
marktoflow bundle list             # List workflow bundles
```

### AI-Powered Workflow Updates

The `marktoflow update` command uses AI coding agents to automatically update your workflow files based on natural language descriptions:

```bash
# Interactive mode (recommended)
marktoflow update workflow.md

# With prompt
marktoflow update workflow.md --prompt "Add error handling to all steps"

# Specify agent
marktoflow update workflow.md --agent opencode --prompt "Refactor to use async/await"

# List available agents
marktoflow update --list-agents
```

**Supported Coding Agents:**

- **OpenCode** - Best for general-purpose updates and refactoring
- **Claude Code** - Great for complex logic changes
- **Cursor** - IDE integration for visual updates
- **Aider** - Specialized for code transformations

**Features:**

- ✅ Automatic backup creation before updates
- ✅ Interactive preview of current workflow
- ✅ Auto-detects available coding agents on your system
- ✅ Validates and confirms changes before applying
- ✅ Shows diff and next steps after update

**Example workflow:**

1. Run `marktoflow update my-workflow.md`
2. Describe desired changes in natural language
3. Select from available coding agents
4. Review and confirm changes
5. Agent updates the workflow file
6. Review diff and test the updated workflow

## Visual Workflow Designer

marktoflow includes a web-based visual workflow editor with AI-powered assistance.

### Starting the GUI

```bash
# Start the visual designer
marktoflow gui

# With options
marktoflow gui --port 3000    # Custom port
marktoflow gui --open         # Open browser automatically
```

### Features

- **Drag-and-Drop Editor** - Visual node-based workflow canvas
- **AI Assistance** - Natural language commands to modify workflows
- **Multiple AI Backends** - Claude Code, GitHub Copilot, Claude API, Ollama
- **Real-time Execution** - Run and debug workflows from the UI
- **Live File Sync** - Changes sync automatically with workflow files

### AI Providers

The GUI supports multiple AI backends:

| Provider | Authentication |
|----------|----------------|
| Claude Code | Claude CLI (automatic) |
| GitHub Copilot | `copilot auth` |
| Claude API | `ANTHROPIC_API_KEY` |
| Ollama | Local server |

### Interface

```
+------------------+------------------------+------------------+
|                  |                        |                  |
|    Sidebar       |        Canvas          |   Properties     |
|   (Workflows     |    (Visual Editor)     |     Panel        |
|    & Tools)      |                        |                  |
+------------------+------------------------+------------------+
|                     AI Prompt Input                          |
+--------------------------------------------------------------+
```

For detailed documentation, see:
- [GUI User Guide](docs/GUI_USER_GUIDE.md)
- [GUI API Reference](docs/GUI_API_REFERENCE.md)
- [GUI Developer Guide](docs/GUI_DEVELOPER_GUIDE.md)

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
│   ├── gui/                  # Visual Workflow Designer (Web UI)
│   └── integrations/         # Service Integrations
├── .marktoflow/              # User configuration
├── package.json
└── pnpm-workspace.yaml
```

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - Complete installation guide with troubleshooting
- [REST API Guide](docs/REST-API-GUIDE.md) - Connect to any REST API
- [AGENTS.md](AGENTS.md) - Development guidance
- [GEMINI.md](GEMINI.md) - Port status tracking
- [PROGRESS.md](PROGRESS.md) - Development history

## Publishing

For information on publishing marktoflow packages to npm, see [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Author

**Scott Glover** <scottgl@gmail.com>

## License

Apache License 2.0
