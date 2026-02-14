<p align="center">
  <img src="https://raw.githubusercontent.com/marktoflow/marktoflow/main/assets/marktoflow-logo.png" alt="marktoflow" width="200" />
</p>

<h1 align="center">marktoflow</h1>

<p align="center">
  <strong>Open-source workflow automation where your workflows are just markdown files.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@marktoflow/marktoflow"><img src="https://img.shields.io/npm/v/@marktoflow/marktoflow" alt="npm version" /></a>
  <a href="https://github.com/marktoflow/marktoflow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License" /></a>
  <a href="https://github.com/marktoflow/marktoflow/stargazers"><img src="https://img.shields.io/github/stars/marktoflow/marktoflow" alt="GitHub stars" /></a>
</p>

---

This is the all-in-one package that includes everything you need:

- **@marktoflow/cli** — Command-line interface and workflow runner
- **@marktoflow/core** — Parser, engine, state management
- **@marktoflow/gui** — Visual workflow designer
- **@marktoflow/integrations** — 30+ service integrations and AI adapters

## Install

```bash
npm install -g @marktoflow/marktoflow
```

## Usage

```bash
marktoflow init                          # Initialize project
marktoflow run workflow.md               # Run a workflow
marktoflow run workflow.md --agent copilot  # Use AI agent
marktoflow gui                           # Launch visual editor
marktoflow connect gmail                 # Setup OAuth
marktoflow serve --port 3000             # Start webhook server
```

## Why marktoflow?

- **Markdown-native** — Workflows are `.md` files, not proprietary JSON
- **30+ integrations** — Slack, GitHub, Jira, Gmail, Stripe, and more
- **AI agents** — Use your existing Copilot/Claude/Codex subscriptions
- **Visual editor** — Optional drag-and-drop GUI
- **Enterprise ready** — RBAC, audit logging, cost tracking, retry logic

## Learn More

Full documentation, examples, and source code:

**[github.com/marktoflow/marktoflow](https://github.com/marktoflow/marktoflow)**

## License

AGPL-3.0
