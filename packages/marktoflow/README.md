<p align="center">
  <img src="https://raw.githubusercontent.com/marktoflow/marktoflow/main/assets/marktoflow-logo.png" alt="marktoflow" width="200" />
</p>

<h1 align="center">marktoflow</h1>

<p align="center">
  <strong>Open-source AI workflow automation — your workflows are just markdown files.</strong>
</p>

<p align="center">
  Use your Copilot/Claude/Codex subscriptions · 38 integrations · Tool calling · Visual editor · Self-hosted
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@marktoflow/marktoflow"><img src="https://img.shields.io/npm/v/@marktoflow/marktoflow" alt="npm version" /></a>
  <a href="https://github.com/marktoflow/marktoflow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://github.com/marktoflow/marktoflow/stargazers"><img src="https://img.shields.io/github/stars/marktoflow/marktoflow" alt="GitHub stars" /></a>
</p>

---

This is the all-in-one package that includes everything you need:

- **@marktoflow/cli** — Command-line interface and workflow runner
- **@marktoflow/core** — Workflow engine, parser, state management, plugin system
- **@marktoflow/gui** — Visual drag-and-drop workflow designer
- **@marktoflow/integrations** — 38 service integrations and AI agent adapters

## Install

```bash
npm install -g @marktoflow/marktoflow
```

## Usage

```bash
marktoflow init                              # Initialize project
marktoflow run workflow.md                   # Run a workflow
marktoflow run workflow.md --agent copilot   # Use your GitHub Copilot subscription
marktoflow run workflow.md --agent claude    # Use your Claude subscription (CLI login)
marktoflow run workflow.md --agent codex     # Use your Codex subscription
marktoflow run workflow.md --agent ollama    # Use Ollama (free, local)
marktoflow run workflow.md --agent vllm      # Use local llama.cpp / VLLM
marktoflow gui                               # Launch visual editor
marktoflow connect gmail                     # Setup OAuth
marktoflow serve --port 3000                 # Start webhook server
```

## Why marktoflow?

- **Use your existing AI subscriptions** — Copilot, Claude, Codex — no extra API keys needed
- **Markdown-native** — Workflows are `.md` files — readable, auditable, version-controlled
- **AI agents with tool calling** — Agentic loops where models decide which tools to invoke
- **38 integrations** — Slack, GitHub, Jira, Gmail, Stripe, Google Sheets, and more
- **Local LLMs too** — Optional llama.cpp, VLLM, Ollama for air-gapped or offline use
- **Secure by default** — Self-hosted, no telemetry, your data never leaves
- **Visual editor** — Optional drag-and-drop GUI with real-time execution
- **Parallel execution** — Run multiple AI agents concurrently for faster results
- **MCP support** — Native Model Context Protocol integration
- **Structured output** — JSON mode and JSON Schema validation for reliable AI responses
- **Enterprise ready** — RBAC, audit logging, cost tracking, AES-256 credential encryption

## AI Agent Tool Calling

Build agentic workflows where the AI decides which tools to call:

```yaml
steps:
  - action: ai.chatWithTools
    inputs:
      messages:
        - role: user
          content: "Research {{ inputs.topic }} and summarize findings"
      tools:
        - type: function
          function:
            name: search
            description: Search the web
            parameters:
              type: object
              properties:
                query: { type: string }
              required: [query]
      maxTurns: 5
```

Works with OpenAI, local llama.cpp, VLLM, LM Studio, and any OpenAI-compatible endpoint.

## Learn More

Full documentation, examples, and source code:

**[github.com/marktoflow/marktoflow](https://github.com/marktoflow/marktoflow)**

## License

[AGPL-3.0](https://github.com/marktoflow/marktoflow/blob/main/LICENSE) — Free for personal and open source use. Commercial licensing available — contact [scottgl@gmail.com](mailto:scottgl@gmail.com).
