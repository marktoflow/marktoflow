# @marktoflow/gui

> **Author:** Scott Glover <scottgl@gmail.com>

Visual workflow designer for marktoflow - a web-based drag-and-drop editor with AI-powered assistance.

## Features

- **Visual Workflow Editor** - Drag-and-drop interface for creating and editing workflows
- **AI-Powered Assistance** - Natural language commands to modify workflows
- **Multiple AI Backends** - Support for Claude Code, GitHub Copilot, and more
- **Real-time Execution** - Run and debug workflows directly from the UI
- **Live File Sync** - Changes sync automatically with your workflow files

## Installation

```bash
npm install @marktoflow/gui
```

Or use via the CLI:

```bash
npx @marktoflow/cli gui
```

## Quick Start

### Via CLI (Recommended)

```bash
# Start the GUI server
marktoflow gui

# With options
marktoflow gui --port 3000        # Custom port
marktoflow gui --open             # Open browser automatically
```

### Programmatic Usage

```typescript
import { startServer } from '@marktoflow/gui';

// Start the GUI server
const server = await startServer({
  port: 3001,
  workflowDir: './workflows',
});

console.log('GUI available at http://localhost:3001');
```

## Interface Overview

```
+------------------+------------------------+------------------+
|                  |                        |                  |
|    Sidebar       |        Canvas          |   Properties     |
|   (Workflows     |    (Visual Editor)     |     Panel        |
|    & Tools)      |                        |                  |
|                  |                        |                  |
+------------------+------------------------+------------------+
|                     AI Prompt Input                          |
+--------------------------------------------------------------+
```

### Components

- **Left Sidebar** - Browse workflows and drag tools onto the canvas
- **Canvas** - Visual node-based workflow editor with pan/zoom
- **Properties Panel** - Edit step properties, view variables, execution history
- **AI Prompt** - Natural language input for AI-assisted editing

## AI Providers

The GUI supports multiple AI backends for workflow assistance:

| Provider | SDK | Authentication |
|----------|-----|----------------|
| Claude Code | `@anthropic-ai/claude-agent-sdk` | Claude CLI (`claude`) |
| GitHub Copilot | `@github/copilot-sdk` | Copilot CLI (`copilot auth`) |
| Claude API | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` |
| Ollama | REST API | Local server |
| Demo Mode | - | Always available |

### Setting Up AI Providers

**Claude Code (Recommended)**
```bash
# Authenticate with Claude CLI first
claude

# The GUI will automatically detect and use Claude Code
```

**GitHub Copilot**
```bash
# Authenticate with Copilot CLI
copilot auth

# The GUI will automatically detect and use Copilot
```

## API Endpoints

The GUI server exposes a REST API:

```bash
# Workflow operations
GET  /api/workflows              # List all workflows
GET  /api/workflows/:path        # Get workflow by path
POST /api/workflows              # Create/update workflow

# AI operations
GET  /api/ai/providers           # List AI providers and status
POST /api/ai/providers/:id       # Set active AI provider
POST /api/ai/prompt              # Send prompt to AI

# Execution
POST /api/execute/:path          # Execute a workflow
GET  /api/execute/status/:runId  # Get execution status
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Delete/Backspace` | Delete selected |
| `Ctrl/Cmd + A` | Select all |
| `Escape` | Deselect all |
| `Ctrl/Cmd + D` | Duplicate selected |

## Configuration

Environment variables:

```bash
# Server configuration
PORT=3001                  # Server port (default: 3001)
WORKFLOW_DIR=./workflows   # Workflow directory

# AI provider configuration
ANTHROPIC_API_KEY=...      # For Claude API provider
OLLAMA_BASE_URL=...        # For Ollama provider
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- Screen resolution: 1280x720 minimum

## Documentation

- [User Guide](../../docs/GUI_USER_GUIDE.md)
- [API Reference](../../docs/GUI_API_REFERENCE.md)
- [Developer Guide](../../docs/GUI_DEVELOPER_GUIDE.md)

## License

Apache-2.0
