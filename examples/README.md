# Example Workflows

> **Author:** Scott Glover <scottgl@gmail.com>

This directory contains example workflows demonstrating the marktoflow v2.0 TypeScript framework with native SDK integrations.

## What's New in v2.0

All examples have been updated to use **native SDK integrations** instead of Python tool scripts:

- **@slack/web-api** - Official Slack SDK
- **@octokit/rest** - Official GitHub SDK
- **jira.js** - Official Jira SDK
- **googleapis** - Official Google APIs
- **confluence** - Confluence REST API client
- **claude-code** / **opencode** - AI agent integrations

No more subprocess bridging or wrapper scripts! Workflows now call SDK methods directly with full type safety.

## Bundle Structure

Each workflow is self-contained with:

```
workflow-name/
├── workflow.md      # Workflow definition with YAML frontmatter
└── config.yaml      # Optional: Bundle configuration
```

## Available Examples

### 1. Code Review (`code-review/`)

Automated code review using GitHub API and Claude AI.

**Integrations:** GitHub, Claude Code

**Features:**

- Fetches PR details and changed files via GitHub SDK
- AI-powered code analysis for security, performance, quality issues
- Posts review comments with severity classification
- Approves or requests changes automatically

```bash
marktoflow run examples/code-review \
  --input repo=owner/repo \
  --input pr_number=123
```

### 2. AI Code Review with Copilot (`copilot-code-review/`)

**NEW!** Advanced code review using GitHub Copilot SDK for comprehensive analysis.

**Integrations:** GitHub, GitHub Copilot

**Features:**

- Powered by GitHub Copilot's production-tested agent runtime
- Deep analysis for security vulnerabilities (OWASP Top 10)
- Performance optimization recommendations
- Code quality and best practices review
- Automatic PR labeling and team notifications
- Support for multiple models (GPT-5, Claude, etc.)

```bash
marktoflow run examples/copilot-code-review \
  --input repository=owner/repo \
  --input pull_number=123
```

**Requirements:** GitHub Copilot subscription + CLI installed

### 3. Daily Standup (`daily-standup/`)

Aggregates team updates from Jira and Slack into an AI-generated standup summary.

**Integrations:** Jira, Slack, Claude Code

**Features:**

- Fetches recent Jira updates and in-progress work
- Analyzes Slack channel activity
- Generates formatted standup summary with AI
- Posts to team channel with rich formatting

```bash
marktoflow run examples/daily-standup \
  --input jira_project=PROJ \
  --input team_channel=#engineering
```

**Scheduled:** Runs automatically at 9 AM weekdays

### 4. Dependency Update (`dependency-update/`)

Automated dependency updates with AI-powered changelog generation.

**Integrations:** GitHub, Claude Code, Slack

**Features:**

- Analyzes outdated npm packages
- AI-assisted package update selection
- Creates update branch and commits changes
- Generates comprehensive changelog
- Opens PR with detailed description

```bash
marktoflow run examples/dependency-update \
  --input repo=owner/repo \
  --input package_manager=npm
```

**Scheduled:** Runs automatically every Monday at 10 AM

### 5. Incident Response (`incident-response/`)

Automated incident detection and response coordination.

**Integrations:** Slack, GitHub, Jira, HTTP (PagerDuty API)

**Features:**

- Creates dedicated incident Slack channel
- Fetches on-call responders from PagerDuty
- Searches for related GitHub issues
- Creates Jira incident ticket
- Posts formatted incident summary with action buttons

```bash
marktoflow run examples/incident-response \
  --input incident_id=INC-001 \
  --input severity=high \
  --input service=api-gateway \
  --input description="API latency spike"
```

**Triggered by:** PagerDuty webhooks, monitoring alert webhooks

### 6. Sprint Planning (`sprint-planning/`)

Automates sprint planning with velocity analysis and story selection.

**Integrations:** Jira, Confluence, Slack, Claude Code

**Features:**

- Analyzes team velocity from past sprints
- AI-powered story selection based on capacity
- Creates new sprint in Jira
- Moves selected stories to sprint
- Documents sprint plan in Confluence
- Notifies team in Slack

```bash
marktoflow run examples/sprint-planning \
  --input project_key=PROJ \
  --input team_members='["alice", "bob", "carol"]'
```

**Scheduled:** Runs automatically every Friday at 2 PM

## Running Workflows

### Basic Usage

```bash
# Run a workflow
marktoflow run examples/code-review

# With inputs
marktoflow run examples/code-review --input repo=owner/repo --input pr_number=42

# Dry run (show execution plan)
marktoflow run examples/code-review --dry-run

# With custom config
marktoflow run examples/code-review --config custom-config.yaml
```

### Workflow Commands

```bash
# Validate workflow
marktoflow workflow validate examples/code-review/workflow.md

# Show workflow info
marktoflow workflow show examples/code-review/workflow.md

# List all workflows
marktoflow workflow list examples/
```

## Environment Variables

Each workflow requires specific environment variables for SDK authentication:

### GitHub

```bash
export GITHUB_TOKEN="ghp_..."
```

### Slack

```bash
export SLACK_BOT_TOKEN="xoxb-..."
```

### Jira

```bash
export JIRA_HOST="your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="..."
```

### Confluence

```bash
export CONFLUENCE_HOST="your-company.atlassian.net"
export CONFLUENCE_EMAIL="your-email@company.com"
export CONFLUENCE_API_TOKEN="..."
```

### Claude / OpenCode

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export OPENCODE_API_KEY="..."
```

### PagerDuty (for incident-response)

```bash
export PAGERDUTY_API_KEY="..."
export PAGERDUTY_SCHEDULE_ID="..."
```

## Creating Your Own Workflow

1. Create a workflow file with YAML frontmatter:

````markdown
---
workflow:
  id: my-workflow
  name: 'My Workflow'
  version: '2.0.0'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  message:
    type: string
    required: true
---

# My Workflow

## Step 1: Post Message

```yaml
action: slack.chat.postMessage
inputs:
  channel: '#general'
  text: '{{ inputs.message }}'
output_variable: result
```
````

\```

````

2. Run it:

```bash
marktoflow run my-workflow.md --input message="Hello World"
````

## Key Differences from v1.0 (Python)

### Old Way (Python v1.0)

```yaml
# Required separate Python tool scripts
action: slack.post_message
inputs:
  channel: '#general'
  text: 'Hello'
```

### New Way (TypeScript v2.0)

```yaml
# Direct SDK method calls
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

action: slack.chat.postMessage
inputs:
  channel: '#general'
  text: 'Hello'
```

**Benefits:**

- No Python tool scripts needed
- Type-safe SDK methods
- Full SDK feature access
- Better error messages
- Easier debugging

## Notes

- All workflows use official SDKs and native integrations
- No subprocess spawning or bridge layers
- Full TypeScript type safety
- Examples are production-ready patterns
- Modify inputs and logic to fit your needs

## Learn More

- [Workflow YAML Reference](../docs/WORKFLOW_YAML.md)
- [Available Integrations](../docs/INTEGRATIONS.md)
- [CLI Commands](../docs/CLI.md)
- [Agent Configuration](../docs/AGENTS.md)
