# @marktoflow/cli

> **Author:** Scott Glover <scottgl@gmail.com>

Universal automation framework with native MCP support - Command Line Interface.

## Overview

`@marktoflow/cli` is the main package for marktoflow, providing the command-line interface for creating, running, and managing automation workflows.

## Features

- **Workflow Execution** - Run workflows from markdown files
- **Interactive Setup** - Initialize projects with guided prompts
- **OAuth Integration** - Easy OAuth setup for Gmail, Outlook
- **Scheduling** - Background workflow scheduling with cron
- **Webhooks** - HTTP webhook server for event-driven workflows
- **Queue Workers** - Process workflows from queues (Redis/RabbitMQ)
- **Dry Run Mode** - Test workflows without executing actions
- **Debug Mode** - Detailed execution logging
- **Doctor** - System health checks and diagnostics
- **Template Management** - Create workflows from templates

## Installation

### Install globally from npm

```bash
npm install -g @marktoflow/cli@alpha
```

### Use with npx (no installation)

```bash
npx @marktoflow/cli@alpha <command>
```

### Install from GitHub

```bash
npm install -g github:scottgl9/marktoflow#main
```

## Quick Start

### 1. Initialize a project

```bash
marktoflow init
```

This creates:

- `.marktoflow/` directory
- `workflows/` directory with example workflow
- `.marktoflow/config.yaml` configuration file

### 2. Create a workflow

Create `workflow.md`:

```markdown
---
workflow:
  id: hello-world
  name: Hello World

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  message:
    type: string
    default: 'Hello World!'
---

# Hello World Workflow

## Step 1: Send Message

\`\`\`yaml
action: slack.chat.postMessage
inputs:
channel: '#general'
text: '{{ inputs.message }}'
\`\`\`
```

### 3. Run the workflow

```bash
# Set environment variable
export SLACK_BOT_TOKEN=xoxb-your-token

# Run workflow
marktoflow run workflow.md

# With inputs
marktoflow run workflow.md --input message="Hello marktoflow!"
```

## CLI Commands

### Core Commands

#### `marktoflow run <workflow>`

Execute a workflow.

```bash
# Basic usage
marktoflow run workflow.md

# With inputs
marktoflow run workflow.md --input key=value --input another=value

# With config file
marktoflow run workflow.md --config .marktoflow/config.yaml

# Verbose output
marktoflow run workflow.md --verbose
```

#### `marktoflow init`

Initialize a new marktoflow project.

```bash
marktoflow init

# Skip prompts
marktoflow init --yes
```

#### `marktoflow version`

Show version information.

```bash
marktoflow version
```

#### `marktoflow doctor`

Run system diagnostics.

```bash
marktoflow doctor
```

### Scheduling

#### `marktoflow schedule <workflow>`

Schedule a workflow to run on a cron schedule.

```bash
# Schedule workflow
marktoflow schedule workflow.md --cron "0 9 * * 1-5"

# List scheduled workflows
marktoflow schedule list

# Remove schedule
marktoflow schedule remove <workflow-id>

# Start scheduler daemon
marktoflow schedule start

# Stop scheduler daemon
marktoflow schedule stop
```

### Webhooks

#### `marktoflow webhook <workflow>`

Create webhook endpoint for workflow.

```bash
# Start webhook server
marktoflow webhook workflow.md --path /github --port 3000

# With secret for signature verification
marktoflow webhook workflow.md --path /github --secret ${WEBHOOK_SECRET}

# List webhooks
marktoflow webhook list

# Stop webhook server
marktoflow webhook stop
```

### Queue Workers

#### `marktoflow worker`

Start a queue worker to process workflows.

```bash
# Start worker (Redis)
marktoflow worker --queue redis --redis-url redis://localhost:6379

# Start worker (RabbitMQ)
marktoflow worker --queue rabbitmq --rabbitmq-url amqp://localhost

# Multiple workers
marktoflow worker --concurrency 5
```

### Development

#### `marktoflow dry-run <workflow>`

Test workflow without executing actions.

```bash
marktoflow dry-run workflow.md

# With mocked responses
marktoflow dry-run workflow.md --mock slack.chat.postMessage=success
```

#### `marktoflow debug <workflow>`

Run workflow with detailed debug logging.

```bash
marktoflow debug workflow.md
```

### OAuth Setup

#### `marktoflow connect <service>`

Set up OAuth for email services.

```bash
# Gmail OAuth
marktoflow connect gmail

# Outlook OAuth
marktoflow connect outlook
```

This launches a browser for OAuth authentication and stores credentials securely.

### Visual Designer

#### `marktoflow gui`

Start the visual workflow designer.

```bash
# Start GUI server
marktoflow gui

# With options
marktoflow gui --port 3000        # Custom port
marktoflow gui --open             # Open browser automatically
```

### Templates

#### `marktoflow new <template>`

Create workflow from template.

```bash
# List available templates
marktoflow new --list

# Create from template
marktoflow new code-review --output workflows/code-review.md

# Interactive wizard
marktoflow new
```

### Agent & Tool Management

#### `marktoflow agents list`

List available AI agents.

```bash
marktoflow agents list
```

#### `marktoflow tools list`

List available tools and integrations.

```bash
marktoflow tools list

# Show tool details
marktoflow tools show slack
```

#### `marktoflow bundles list`

List available tool bundles.

```bash
marktoflow bundles list

# Install bundle
marktoflow bundles install my-bundle.json
```

## Configuration

### Environment Variables

```bash
# Core
MARKTOFLOW_DB_PATH=.marktoflow/state.db

# Slack
SLACK_BOT_TOKEN=xoxb-your-token

# GitHub
GITHUB_TOKEN=ghp_your-token

# Jira
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-token

# Gmail
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# Outlook
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-secret
OUTLOOK_TENANT_ID=your-tenant-id
```

### Configuration File

`.marktoflow/config.yaml`:

```yaml
state:
  dbPath: .marktoflow/state.db

queue:
  type: redis
  redis:
    host: localhost
    port: 6379

security:
  rbac:
    enabled: true
  auditLog:
    enabled: true

costs:
  budget:
    daily: 100
    monthly: 3000

logging:
  level: info
  file: .marktoflow/logs/marktoflow.log
```

## Examples

### Daily Standup Report

```bash
# Create workflow
cat > workflows/daily-standup.md << 'EOF'
---
workflow:
  id: daily-standup
  name: Daily Standup Report

tools:
  jira:
    sdk: 'jira.js'
    auth:
      host: '${JIRA_HOST}'
      email: '${JIRA_EMAIL}'
      apiToken: '${JIRA_API_TOKEN}'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - action: jira.issues.searchIssues
    inputs:
      jql: 'assignee = currentUser() AND status = "In Progress"'
    output_variable: issues

  - action: slack.chat.postMessage
    inputs:
      channel: '#standup'
      text: 'Working on: {{ issues.issues[0].fields.summary }}'
EOF

# Schedule for weekdays at 9 AM
marktoflow schedule workflows/daily-standup.md --cron "0 9 * * 1-5"

# Start scheduler
marktoflow schedule start
```

### GitHub PR Webhook

```bash
# Create webhook workflow
cat > workflows/github-pr.md << 'EOF'
---
workflow:
  id: github-pr-review
  name: GitHub PR Review Notification

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  pr_url:
    type: string
  pr_title:
    type: string
  author:
    type: string

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#code-review'
      text: |
        🔍 New PR ready for review
        *{{ inputs.pr_title }}* by {{ inputs.author }}
        {{ inputs.pr_url }}
EOF

# Start webhook server
marktoflow webhook workflows/github-pr.md --path /github --port 3000
```

### Multi-Agent Workflow

```bash
cat > workflows/research-and-summarize.md << 'EOF'
---
workflow:
  id: research-summarize
  name: Research and Summarize

tools:
  ollama:
    adapter: ollama

agents:
  researcher:
    model: llama2
    role: research
  writer:
    model: llama2
    role: summarize

steps:
  - action: ollama.generate
    agent: researcher
    inputs:
      prompt: 'Research recent developments in {{ inputs.topic }}'
    output_variable: research

  - action: ollama.generate
    agent: writer
    inputs:
      prompt: 'Summarize this research: {{ research.response }}'
    output_variable: summary
EOF

marktoflow run workflows/research-and-summarize.md --input topic="quantum computing"
```

## Troubleshooting

### Command not found

If `marktoflow` command is not found after global installation:

```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH (macOS/Linux)
export PATH="$PATH:$(npm config get prefix)/bin"

# Or use npx
npx @marktoflow/cli@alpha version
```

### Permission errors

```bash
# Use npx instead of global install
npx @marktoflow/cli@alpha run workflow.md

# Or configure npm to use local directory
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm install -g @marktoflow/cli@alpha
```

### OAuth issues

```bash
# Re-run OAuth setup
marktoflow connect gmail --force

# Check stored credentials
ls -la .marktoflow/credentials/
```

## Development

### Install from source

```bash
git clone https://github.com/scottgl9/marktoflow.git
cd marktoflow
pnpm install
pnpm build
npm link packages/cli
```

### Run tests

```bash
pnpm test
```

## Links

- [Main Repository](https://github.com/scottgl9/marktoflow)
- [Documentation](https://github.com/scottgl9/marktoflow#readme)
- [Installation Guide](https://github.com/scottgl9/marktoflow/blob/main/docs/INSTALLATION.md)
- [Publishing Guide](https://github.com/scottgl9/marktoflow/blob/main/docs/PUBLISHING.md)
- [Core Package](@marktoflow/core)
- [Integrations Package](@marktoflow/integrations)

## Support

- [GitHub Issues](https://github.com/scottgl9/marktoflow/issues)
- [Discussions](https://github.com/scottgl9/marktoflow/discussions)

## License

Apache-2.0
