# marktoflow - Universal Automation Framework

**Write once, run anywhere.**

A universal automation framework that enables markdown-based workflows with native MCP support, direct SDK integrations, and distributed execution.

**Version:** 2.0.0-alpha.4 (TypeScript)

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

# Workflow operations
marktoflow new                     # Create workflow from template (interactive)
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

- [Installation Guide](docs/INSTALLATION.md) - Complete installation guide with troubleshooting
- [REST API Guide](docs/REST-API-GUIDE.md) - Connect to any REST API
- [AGENTS.md](AGENTS.md) - Development guidance
- [GEMINI.md](GEMINI.md) - Port status tracking
- [PROGRESS.md](PROGRESS.md) - Development history

## Publishing to npm

To publish marktoflow to the npm registry:

### Prerequisites

1. **npm account**: Create at https://www.npmjs.com/signup
2. **Login**: `npm login`
3. **Package name availability**: Check if `marktoflow` is available

### Publishing Steps

```bash
# 1. Ensure all packages are built
pnpm build

# 2. Update version (if needed)
npm version patch  # or minor, major

# 3. Publish core package
cd packages/core
npm publish --access public

# 4. Publish integrations package
cd ../integrations
npm publish --access public

# 5. Publish CLI package (main package)
cd ../cli
npm publish --access public
```

### Package Configuration

The CLI package (`packages/cli/package.json`) is configured with:

- **bin**: Points to `./dist/index.js` for the `marktoflow` command
- **files**: Includes only the `dist/` directory
- **dependencies**: Uses `workspace:*` for internal packages (converted to versions on publish)

### Publishing Checklist

- [ ] All tests passing (181/181)
- [ ] Version bumped in all package.json files
- [ ] CHANGELOG.md updated
- [ ] Git tag created (`git tag v2.0.0-alpha.4`)
- [ ] Built with `pnpm build`
- [ ] Published to npm registry
- [ ] Installation tested: `npm install -g marktoflow`

## License

Apache License 2.0
