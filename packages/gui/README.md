# @marktoflow/gui

> Visual workflow designer — drag-and-drop editor with AI-powered assistance.

[![npm](https://img.shields.io/npm/v/@marktoflow/gui)](https://www.npmjs.com/package/@marktoflow/gui)

Part of [marktoflow](../../README.md) — open-source markdown workflow automation.

<!-- TODO: screenshot of the workflow designer -->

## Quick Start

```bash
marktoflow gui
```

Opens the visual editor at `http://localhost:3001`. Create, edit, and run workflows with a drag-and-drop interface.

```bash
marktoflow gui --port 3000        # Custom port
marktoflow gui --open             # Open browser automatically
marktoflow gui --workflow-dir ./workflows
```

### Programmatic Usage

```typescript
import { startServer } from '@marktoflow/gui';

const server = await startServer({
  port: 3001,
  workflowDir: './workflows',
});
```

## Features

- **Drag-and-Drop Editor** — Visual node-based workflow canvas with pan/zoom
- **Auto-Layout** — Dagre-based auto-layout on workflow load with per-node-type sizing; also available via Cmd+L
- **AI Assistance** — Natural language commands to modify workflows (Claude, Copilot, Ollama)
- **Command Palette (Cmd+K)** — Fuzzy search across actions, workflows, nodes, and settings
- **Real-time Execution** — Run workflows and watch live status via WebSocket
- **Validation Panel** — Dry-run checks before execution
- **Version Control & History** — Snapshots, side-by-side diff, and non-destructive restore
- **Collaboration** — Workflow locking (5-min auto-release), threaded node comments, presence indicators
- **Template Gallery & Onboarding** — Browse templates seeded from examples/, 6-step interactive tour
- **Canvas Enhancements** — Sticky notes (6 colors, markdown), group nodes (collapse/expand/lock), alignment and distribute tools
- **Enterprise Governance** — RBAC roles (admin/editor/viewer/operator), environment management, secrets with masked values, audit trail
- **Accessibility (WCAG 2.1 AA)** — SkipNav, ARIA live regions, @axe-core/react dev auditing
- **Live File Sync** — Changes sync automatically with your `.md` workflow files
- **Input Collection** — Validates and collects required inputs before execution
- **User Settings Panel** — Centralized preferences (theme, canvas, editor, execution, AI, notifications) persisted to `~/.marktoflow/settings.json`
- **Enterprise Design System** — Professional light/dark theming with design tokens

## AI Providers

| Provider | Auth Type | Authentication |
|----------|-----------|----------------|
| Claude Agent | SDK | Claude CLI — `claude login` |
| GitHub Copilot | SDK | Copilot CLI — `copilot login` |
| OpenAI Codex | SDK | `OPENAI_API_KEY` env var (auto-detected) |
| Claude API | API Key | `ANTHROPIC_API_KEY` env var |
| Ollama | Local | `ollama serve` on `localhost:11434` |
| Demo Mode | — | Always available |

**SDK Provider Status:**
- 🟢 **Ready** (green) — Connected and active
- 🔵 **Available** (blue) — SDK installed, click to connect
- 🟡 **Needs Config** (yellow) — Configuration required
- 🔴 **Unavailable** (red) — SDK not installed

SDK-based providers detect availability automatically and show "Available" status when ready to connect. Codex auto-activates when `OPENAI_API_KEY` is set. Copilot dynamically fetches available models from the SDK.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save workflow |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + K` | Open Command Palette |
| `Cmd/Ctrl + P` | Quick Workflow Switcher |
| `Cmd/Ctrl + ,` | Open Settings |
| `Cmd/Ctrl + Shift + T` | Toggle theme |
| `Delete` | Delete selected |
| `Cmd/Ctrl + D` | Duplicate selected |

## Documentation

- [GUI User Guide](../../docs/GUI_USER_GUIDE.md)
- [GUI Developer Guide](../../docs/GUI_DEVELOPER_GUIDE.md)

## Contributing

See the [contributing guide](https://github.com/marktoflow/marktoflow/blob/main/CONTRIBUTING.md).

## License

Apache-2.0
