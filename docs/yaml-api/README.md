# YAML API Reference

Complete API reference for marktoflow v2.0 workflow YAML syntax.

## Sections

| Section | Description |
|---------|-------------|
| [Workflow Structure](./workflow-structure.md) | File format, metadata, and frontmatter |
| [Tool Configuration](./tools.md) | MCP servers, SDK packages, auth, and secrets |
| [Inputs & Outputs](./inputs-outputs.md) | Input parameters and workflow outputs |
| [Triggers](./triggers.md) | Schedule, webhook, file watch, and manual triggers |
| [Steps](./steps.md) | Action steps, workflow steps, tool calling, structured output |
| [Built-in Actions](./built-in-actions.md) | Workflow control, utilities, file I/O, parallel execution |
| [Control Flow](./control-flow.md) | If/else, switch, for-each, while, map, filter, reduce, parallel, try/catch |
| [Variable Resolution](./variables.md) | Template syntax, filters, environment variables |
| [Error Handling](./error-handling.md) | Retries, circuit breaker, failover, try/catch |
| [Permissions](./permissions.md) | File, command, network, and directory restrictions |
| [External Prompts](./external-prompts.md) | Reusable prompt templates with variable support |
| [Event-Driven Workflows](./event-driven.md) | WebSocket, Discord, Slack, cron, and SSE event sources |
| [Service Integrations](./services.md) | Reference for all 39 service integrations |
| [AI Agent Integrations](./ai-agents.md) | Copilot, Claude, OpenAI, OpenCode, Ollama |

## Quick Example

```yaml
---
workflow:
  id: notify-slack
  name: 'Slack Notification'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

triggers:
  - type: schedule
    cron: '0 9 * * 1-5'

inputs:
  message:
    type: string
    required: true
---

# Slack Notification

## Step 1: Post Message

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "{{ inputs.message }}"
output_variable: result
```
```
