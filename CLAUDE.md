# CLAUDE.md - Claude Code Context

This file provides context for Claude Code when working on this project.

---

## Project Summary

**marktoflow v2.0** is a universal automation framework that enables markdown-based workflows with native MCP support and direct SDK integrations.

**Current Status:** TypeScript v2.0 - Feature parity achieved with Python v1.0

---

## Key Features

- **Native SDK Integration**: 11 built-in service integrations (Slack, GitHub, Jira, Gmail, Outlook, Linear, Notion, Discord, Airtable, Confluence, HTTP)
- **Native MCP Support**: Direct npm package imports, no subprocess bridging
- **Enterprise Ready**: RBAC, audit logging, cost tracking, approval workflows
- **Distributed Execution**: Queue system with Redis/RabbitMQ/InMemory
- **Universal Triggering**: Cron schedules, webhooks, file watchers

### TypeScript v2.0 Advantages

1. **Direct SDK References in Workflows**

```yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello!'
```

2. **Native MCP Support**

```typescript
// Direct import, no subprocess spawning
import { SlackServer } from '@modelcontextprotocol/server-slack';
```

3. **Simple CLI**

```bash
npx marktoflow init
npx marktoflow connect gmail  # OAuth flow
npx marktoflow run workflow.md
```

### Project Structure

```
packages/
  core/           # Parser, engine, state, security, costs, plugins
  cli/            # CLI commands, OAuth flows
  integrations/   # 11 service integrations + AI adapters
examples/         # 5 production-ready workflow templates
```

---

## Quick Reference

### Key Files

- `TODO.md` - v2.0 TypeScript roadmap (feature parity achieved)
- `PROGRESS.md` - Development history
- `AGENTS.md` - Detailed development guidelines
- `examples/` - Production workflows (code-review, daily-standup, incident-response, sprint-planning, dependency-update)

### Test Status

- **145 tests passing** (89 core + 48 integrations + 8 CLI)
- Goal: Expand to 615+ tests to match Python v1.0

---

## Common Tasks

### Running Tests

```bash
pnpm test                    # Run all tests
pnpm test --filter=@marktoflow/core         # Core only
pnpm test --filter=@marktoflow/integrations # Integrations only
```

### Building

```bash
pnpm build                   # Build all packages
pnpm build --filter=@marktoflow/core        # Core only
```

### Running Workflows

```bash
# Run a workflow
./marktoflow run examples/daily-standup/workflow.md

# With inputs
./marktoflow run examples/code-review/workflow.md \
  --input repo=owner/repo \
  --input pr_number=123

# Validate workflow
./marktoflow workflow validate examples/daily-standup/workflow.md
```

### Available Integrations

**Services (11):**

- `@slack/web-api` - Slack SDK
- `@octokit/rest` - GitHub SDK
- `jira.js` - Jira SDK
- `googleapis` - Gmail SDK
- `@microsoft/microsoft-graph-client` - Outlook/Calendar SDK
- `linear` - Linear SDK
- `notion` - Notion SDK
- `discord` - Discord SDK
- `airtable` - Airtable SDK
- `confluence` - Confluence SDK
- `http` - Generic HTTP client

**AI Agents (3):**

- `claude-code` - Claude CLI wrapper
- `opencode` - OpenCode SDK/CLI
- `ollama` - Local LLM

---

## Development Conventions

- Use TypeScript strict mode
- Use pnpm for package management
- Use Vitest for testing
- Keep modules focused and small
- Prefer composition over inheritance
- Set `exactOptionalPropertyTypes: false` for packages with external SDK types

---

## Example Workflow

See `examples/code-review/workflow.md` for a complete example using GitHub SDK and Claude AI to automatically review pull requests.

Key pattern:

```yaml
tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

steps:
  - action: github.pulls.get
    inputs:
      owner: "{{ inputs.repo.split('/')[0] }}"
      repo: "{{ inputs.repo.split('/')[1] }}"
      pull_number: '{{ inputs.pr_number }}'
    output_variable: pr_details
```

---

## Migration from Python v1.0

The Python implementation has been archived. All example workflows have been rewritten to use TypeScript v2.0 native SDK integrations.

**Old (Python):** Separate Python tool scripts
**New (TypeScript):** Direct SDK method calls in YAML

Benefits:

- No subprocess overhead
- Full TypeScript type safety
- Better error messages
- Easier debugging
- Direct access to all SDK features
