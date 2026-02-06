# @marktoflow/cli

> Command-line interface for running markdown-based workflow automations.

[![npm](https://img.shields.io/npm/v/@marktoflow/cli)](https://www.npmjs.com/package/@marktoflow/cli)

Part of [marktoflow](../../README.md) — open-source markdown workflow automation.

## Quick Start

```bash
npm install -g @marktoflow/cli

marktoflow init
marktoflow run workflow.md
```

Or without installing:

```bash
npx @marktoflow/cli run workflow.md
```

## Features

- **Workflow Execution** — Run markdown workflows from the terminal
- **Dry Run Mode** — Test workflows without executing actions
- **OAuth Integration** — Easy OAuth setup for Gmail, Outlook, Google services
- **Scheduling** — Background cron-based workflow scheduling
- **Webhooks** — Built-in HTTP server for event-driven workflows
- **Templates** — Create workflows from built-in templates
- **Diagnostics** — `marktoflow doctor` for system health checks
- **Visual Designer** — Launch the GUI with `marktoflow gui`

## Key Commands

### Run a workflow

```bash
marktoflow run workflow.md
marktoflow run workflow.md --input key=value
marktoflow run workflow.md --agent copilot --model gpt-4o
marktoflow run workflow.md --verbose
marktoflow run workflow.md --dry-run
```

### Validate before running

```bash
marktoflow workflow validate workflow.md
```

### Connect services

```bash
marktoflow connect gmail
marktoflow connect outlook
```

### Schedule workflows

```bash
marktoflow schedule workflow.md --cron "0 9 * * 1-5"
marktoflow schedule start
```

### Start webhook server

```bash
marktoflow serve --port 3000
marktoflow serve --socket  # Slack Socket Mode
```

### Launch visual editor

```bash
marktoflow gui
marktoflow gui --port 3000 --open
```

### Create from template

```bash
marktoflow new --list
marktoflow new code-review --output workflows/code-review.md
```

### Other commands

```bash
marktoflow init              # Initialize project
marktoflow version           # Show version
marktoflow doctor            # System diagnostics
marktoflow agents list       # List available AI agents
marktoflow tools list        # List available integrations
marktoflow history           # View execution history
```

## Example: Daily Standup

```bash
cat > workflows/standup.md << 'EOF'
---
workflow:
  id: daily-standup
  name: Daily Standup

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

marktoflow schedule workflows/standup.md --cron "0 9 * * 1-5"
marktoflow schedule start
```

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

Apache-2.0
