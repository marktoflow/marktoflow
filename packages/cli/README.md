# @marktoflow/cli

> Command-line interface for running AI-powered markdown workflow automations with tool calling, parallel agents, and 38 integrations.

[![npm](https://img.shields.io/npm/v/@marktoflow/cli)](https://www.npmjs.com/package/@marktoflow/cli)

Part of [marktoflow](https://github.com/marktoflow/marktoflow) — open-source AI workflow automation.

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
- **AI Agents** — OpenAI, Claude, Copilot, Ollama, llama.cpp, VLLM — any OpenAI-compatible endpoint
- **Tool Calling** — Agentic workflows where models decide which tools to invoke
- **Parallel Agents** — Run multiple AI models concurrently (`parallel.spawn`, `parallel.map`)
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
marktoflow run workflow.md --verbose
marktoflow run workflow.md --dry-run
```

### Run with AI agents

```bash
marktoflow run workflow.md --agent openai --model gpt-4o
marktoflow run workflow.md --agent claude --model sonnet
marktoflow run workflow.md --agent copilot
marktoflow run workflow.md --agent ollama --model llama3.2
marktoflow run workflow.md --agent vllm --model my-local-model  # llama.cpp, VLLM, etc.
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

## Example: AI-Powered Daily Standup

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

## Example: Local LLM with Tool Calling

```yaml
tools:
  ai:
    sdk: openai
    auth:
      base_url: http://localhost:8000/v1
      api_key: dummy
    options:
      model: auto  # Auto-detect from server

steps:
  - action: ai.chatWithTools
    inputs:
      messages:
        - role: user
          content: "{{ inputs.query }}"
      tools:
        - type: function
          function:
            name: search
            description: Search for information
            parameters:
              type: object
              properties:
                query: { type: string }
              required: [query]
      maxTurns: 5
```

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

[AGPL-3.0](https://github.com/marktoflow/marktoflow/blob/main/LICENSE)
