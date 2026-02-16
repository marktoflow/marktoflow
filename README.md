<p align="center">
  <img src="assets/marktoflow-logo.png" alt="marktoflow" width="200" />
</p>

<h1 align="center">marktoflow</h1>

<p align="center">
  <strong>Open-source AI workflow automation — your workflows are just markdown files.</strong>
</p>

<p align="center">
  Use your Copilot/Claude/Codex subscriptions · 39 integrations · Tool calling · Local LLMs · Self-hosted

</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@marktoflow/marktoflow"><img src="https://img.shields.io/npm/v/@marktoflow/marktoflow" alt="npm version" /></a>
  <a href="https://github.com/marktoflow/marktoflow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://github.com/marktoflow/marktoflow/stargazers"><img src="https://img.shields.io/github/stars/marktoflow/marktoflow" alt="GitHub stars" /></a>
  <a href="https://github.com/marktoflow/marktoflow/actions"><img src="https://img.shields.io/github/actions/workflow/status/marktoflow/marktoflow/ci.yml?branch=main" alt="Build" /></a>
  <a href="https://www.npmjs.com/package/@marktoflow/marktoflow"><img src="https://img.shields.io/npm/dm/@marktoflow/marktoflow" alt="Downloads" /></a>
</p>

<p align="center">
  <img src="assets/gui-screenshot.png" alt="marktoflow visual workflow designer" width="900" />
</p>

<p align="center">
  <em>Visual workflow designer — drag-and-drop nodes, AI-assisted editing, one-click execution</em>
</p>

---

## Quick Start

```bash
npm install -g @marktoflow/marktoflow

marktoflow init

marktoflow run workflow.md
```

That's it. Your workflow is a markdown file with YAML frontmatter:

```yaml
---
workflow:
  id: hello-world
  name: Hello World

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: '#general'
      text: 'Hello from marktoflow!'
---
```

Already have a GitHub Copilot, Claude, or Codex subscription? Use it directly — no API keys:

```bash
marktoflow run workflow.md --agent copilot   # GitHub Copilot subscription
marktoflow run workflow.md --agent claude     # Claude CLI login
marktoflow run workflow.md --agent codex      # Codex CLI
marktoflow run workflow.md --agent ollama     # Free, runs locally
```

## Why marktoflow?

| | What you get |
|---|---|
| **Markdown-native** | Workflows are `.md` files — readable, auditable, diffable, version-controlled |
| **Use your existing AI** | Copilot, Claude, Codex subscriptions — no extra API keys needed |
| **AI tool calling** | Agentic loops — models call tools, get results, and reason autonomously |
| **Local LLMs too** | Optional llama.cpp, VLLM, Ollama support for air-gapped or offline use |
| **Secure by design** | Self-hosted, no telemetry, your data never leaves your infrastructure |
| **Structured output** | JSON mode and JSON Schema validation for reliable AI responses |
| **MCP-first** | Native Model Context Protocol support with zero config |
| **Direct SDK calls** | Official SDKs, full TypeScript types, no wrapper APIs |
| **Parallel execution** | Run multiple AI agents concurrently — 3x faster code reviews, batch processing |
| **Visual editor** | Optional drag-and-drop GUI with `marktoflow gui` |
| **Cost tracking** | Know exactly what each workflow run costs |

## Security & Privacy

marktoflow is designed for teams and individuals who care about where their data goes.

| | marktoflow | Cloud agent platforms |
|---|---|---|
| **Data residency** | Your infrastructure — nothing leaves unless you send it | Data processed on vendor servers |
| **Local LLM support** | First-class — llama.cpp, VLLM, Ollama | Typically cloud-only |
| **Air-gapped operation** | ✅ Full offline support with local models | ❌ Requires internet |
| **Audit trail** | Git history + SQLite execution logs — fully inspectable | Vendor-controlled logs |
| **Workflow transparency** | Plain markdown — read every step before it runs | Opaque agent behavior |
| **Telemetry** | None — zero phone-home, zero tracking | Varies |
| **Credential storage** | Local encryption (AES-256-GCM) or your vault (HashiCorp, AWS, Azure) | Vendor-managed |
| **Source available** | AGPL-3.0 — inspect, modify, self-host | Often proprietary |

**Use case:** You want AI-powered automation but your company policy (or common sense) says sensitive data — code, credentials, customer info, internal docs — shouldn't flow through third-party agent platforms. marktoflow runs entirely on your machine or your servers with your choice of LLM.

## How it compares

### vs. Workflow Platforms

| Feature | marktoflow | Zapier | n8n | GitHub Actions |
|---------|:----------:|:------:|:---:|:--------------:|
| Open source | Yes | No | Yes | No |
| Workflow format | Markdown | Proprietary | JSON | YAML |
| Version control | Git-native | No | Limited | Git-native |
| AI agent support | Built-in | Add-on | Plugin | Limited |
| AI tool calling | Built-in | No | Plugin | No |
| Local LLMs | Yes | No | Via plugin | No |
| Direct SDK access | Yes | No | No | Via actions |
| Visual editor | Yes | Yes | Yes | No |
| Self-hosted | Yes | No | Yes | Runners only |
| Per-task pricing | Free | Yes | Free (self-host) | Minutes-based |

### vs. AI Agent Platforms

| Feature | marktoflow | OpenClaw | LangChain | CrewAI |
|---------|:----------:|:--------:|:---------:|:------:|
| Self-hosted | Yes | Gateway only | Yes | Yes |
| Local LLM support | First-class | Limited | Yes | Yes |
| Air-gapped / offline | Yes | No | Partial | Partial |
| No telemetry | Yes | No | Opt-out | Opt-out |
| Workflow format | Markdown (auditable) | Opaque | Python code | Python code |
| Visual editor | Yes | No | No | No |
| 39 native integrations | Yes | No | Community | Community |
| Non-AI workflows | Yes | No | No | No |
| Data stays local | Always | Routed through gateway | Depends on LLM | Depends on LLM |

## Integrations

39 native SDK integrations — all with TypeScript types, retry logic, and input validation.

| Category | Services |
|----------|----------|
| **Communication** | Slack, Teams, Discord, Telegram, WhatsApp, Twilio |
| **Email** | Gmail, Outlook, SendGrid, Mailchimp |
| **Google Workspace** | Sheets, Calendar, Drive, Docs |
| **Project Management** | Jira, Linear, Asana, Trello |
| **Knowledge** | Notion, Confluence |
| **Developer** | GitHub, Airtable |
| **Payments** | Stripe, Shopify |
| **Support** | Zendesk |
| **Storage** | Dropbox, AWS S3 |
| **Databases** | Supabase, PostgreSQL, MySQL |
| **Universal** | HTTP client (any REST API), RSS/Atom feeds |
| **AI Agents** | GitHub Copilot, Claude, Codex — use your existing subscriptions, no API keys — plus OpenAI, Ollama, llama.cpp, VLLM for local/custom setups — [control via Slack/Telegram](examples/agent-task-executor/) |

## Packages

| Package | Description |
|---------|-------------|
| [`@marktoflow/marktoflow`](packages/marktoflow) | All-in-one install (CLI + GUI + integrations) |
| [`@marktoflow/core`](packages/core) | Parser, engine, state management, plugin system |
| [`@marktoflow/cli`](packages/cli) | Command-line interface and workflow runner |
| [`@marktoflow/gui`](packages/gui) | Visual workflow designer (web UI) |
| [`@marktoflow/integrations`](packages/integrations) | 39 service integrations and AI adapters |

## Examples

Production-ready workflow templates in [`examples/`](examples/):

- **[agent-task-executor](examples/agent-task-executor/)** — Control AI agents (Claude, Copilot, OpenCode, Ollama) via Slack/Telegram. Send task instructions, get structured results with pass/fail status.

  Example: Send "Create a React component called UserProfile with email validation" → Agent executes with safe permissions → Returns structured results (3/3 tasks passed ✅)

  ```bash
  # Run the Slack version
  marktoflow run examples/agent-task-executor/workflow-slack.md

  # Or use Telegram
  marktoflow run examples/agent-task-executor/workflow-telegram.md
  ```
- **[parallel-agents](examples/parallel-agents/)** — ⚡ NEW: Run multiple AI agents concurrently
  - [multi-agent-code-review](examples/parallel-agents/multi-agent-code-review.md) — Security + Performance + Quality reviews in parallel (3x faster)
  - [batch-pr-processing](examples/parallel-agents/batch-pr-processing.md) — Review 50 PRs in 5 minutes instead of 25
  - [consensus-decision](examples/parallel-agents/consensus-decision.md) — Gather diverse AI perspectives for better decisions
- **[codebase-qa](examples/codebase-qa/)** — AI-powered Q&A via Slack/Telegram
- **[copilot-code-review](examples/copilot-code-review/)** — PR review with GitHub Copilot
- **[daily-standup](examples/daily-standup/)** — Jira + Slack standup automation
- **[incident-response](examples/incident-response/)** — Multi-service incident coordination
- **[approval-workflow](examples/approval-workflow/)** — Human-in-the-loop with web forms
- **[sprint-planning](examples/sprint-planning/)** — AI-assisted sprint planning

## Documentation

**[📋 CHANGELOG](CHANGELOG.md)** — Version history, new features, security fixes, breaking changes

- [Installation Guide](docs/INSTALLATION.md)
- [Detailed Guide](docs/DETAILED-GUIDE.md)
- [YAML API Reference](docs/YAML-API.md) — Complete API including ⚡ parallel execution
- [REST API Guide](docs/REST-API-GUIDE.md)
- [Template Expressions](docs/TEMPLATE-EXPRESSIONS.md)
- [Control Flow](docs/CONTROL-FLOW-GUIDE.md)
- [GUI User Guide](docs/GUI_USER_GUIDE.md)

## Community

- [GitHub Discussions](https://github.com/marktoflow/marktoflow/discussions) — Questions, ideas, show & tell
- [Contributing](CONTRIBUTING.md) — PRs welcome
- [Issues](https://github.com/marktoflow/marktoflow/issues) — Bug reports and feature requests

## License

[AGPL-3.0](LICENSE) — Free for personal and open source use. Commercial licensing available for organizations that cannot comply with AGPL terms. Contact [scottgl@gmail.com](mailto:scottgl@gmail.com) for details.
