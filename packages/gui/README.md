# @marktoflow/gui

> **Author:** Scott Glover <scottgl@gmail.com>

Visual workflow designer for marktoflow - a web-based drag-and-drop editor with AI-powered assistance.

## Features

### Core Capabilities
- **Visual Workflow Editor** - Drag-and-drop interface for creating and editing workflows
- **Enterprise Design System** - Professional slate/blue color palette with comprehensive design tokens
- **Enhanced Control Flow Visualization** - Visual execution state indicators for loops, branches, and parallel execution
- **AI-Powered Assistance** - Natural language commands to modify workflows
- **Multiple AI Backends** - Support for Claude Code, GitHub Copilot, and more
- **Real-time Execution** - Run and debug workflows with live WebSocket updates
- **Workflow Validation** - Dry-run mode to validate workflows before execution
- **Template Library** - Quick-start templates for Slack, GitHub, HTTP, and scheduled workflows
- **Live File Sync** - Changes sync automatically with your workflow files

### New in v2.0
- **Input Collection Dialog** - Validates and collects required workflow inputs before execution
- **Validation Panel** - Comprehensive dry-run validation with warnings and step analysis
- **Template Selection** - Create workflows from pre-built templates (Blank, Slack, GitHub, HTTP, Scheduled)
- **Real Execution API** - Replaced simulation with actual workflow execution via REST API
- **Enhanced Search** - Filter workflows by name with improved empty states
- **Design Token System** - Seamless light/dark theme switching without CSS hacks

### Control Flow Visual Features

- **Early Exit Indicators** - See when loops exit before completion (break/error)
- **Skipped Branch Visualization** - Grayed-out branches that weren't executed
- **Progress Tracking** - Real-time iteration counters and progress bars
- **Rate Limiting Warnings** - Visual alerts for parallel execution throttling
- **Failed Branch Tracking** - Red highlighting for failed parallel branches
- **Execution State Badges** - Contextual icons showing loop exit reasons

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
marktoflow gui --workflow-dir ./workflows  # Custom workflow directory
```

The GUI will start at `http://localhost:3001` (or your specified port) and automatically watch your workflow directory for changes.

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

## Using the GUI

### Opening Workflows

1. **From File System**: The GUI automatically discovers workflows in your configured directory
2. **Create New**: Click "New Workflow" to start from scratch or use a template
3. **Import**: Drag and drop `.md` workflow files into the browser

### Editing Workflows

#### Visual Mode
- Drag tools from the sidebar onto the canvas
- Connect steps by dragging from output to input ports
- Edit step properties in the right panel
- Add conditions, loops, and error handling visually

#### Code Mode
- Switch to the Monaco editor for direct markdown editing
- Syntax highlighting for YAML and markdown
- Auto-completion for tool actions and inputs

#### AI-Assisted Mode
- Type natural language commands in the AI prompt box
- Examples:
  - "Add a step to send a Slack message when the build fails"
  - "Create a loop to process all GitHub PRs"
  - "Add error handling to retry failed API calls"

### Running Workflows

1. **Validate First** - Click "Validate" to run a dry-run check of your workflow
2. **Execute** - Click the "Execute" button in the toolbar
3. **Provide Inputs** - Fill in required workflow inputs in the dialog
4. **Monitor Progress** - Watch real-time execution status via WebSocket updates
5. **Review Results** - View execution results and history in the Properties panel
6. **Replay** - Re-run previous executions from the history tab

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
| OpenAI Codex | `openai-codex-sdk` | Codex CLI |
| OpenCode | `@opencode-ai/sdk` | OpenCode CLI (`opencode /connect`) |
| Claude API | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` |
| Ollama (beta) | REST API | Local server |
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

**OpenAI Codex**
```bash
# Authenticate with Codex CLI
# Follow Codex CLI documentation for setup

# The GUI will automatically detect and use Codex
```

**OpenCode**
```bash
# Configure OpenCode
opencode /connect

# The GUI will automatically detect and use OpenCode
```

**Claude API (Direct)**
```bash
# Set API key
export ANTHROPIC_API_KEY=sk-ant-your-key

# The GUI will use direct API access
```

**Ollama (Local)**
```bash
# Start Ollama server
ollama serve

# The GUI will automatically detect Ollama at localhost:11434
```

## API Reference

The GUI server exposes a comprehensive REST API for programmatic access:

### Workflow Operations

#### List All Workflows
```bash
GET /api/workflows

Response:
{
  "workflows": [
    {
      "path": "daily-standup/workflow.md",
      "id": "daily-standup",
      "name": "Daily Standup Report",
      "triggers": [...],
      "modified": "2026-01-31T10:00:00Z"
    }
  ]
}
```

#### Get Workflow
```bash
GET /api/workflows/:path

Response:
{
  "workflow": {
    "id": "daily-standup",
    "name": "Daily Standup Report",
    "tools": {...},
    "steps": [...],
    "content": "# Markdown content..."
  }
}
```

#### Create/Update Workflow
```bash
POST /api/workflows
Content-Type: application/json

{
  "path": "my-workflow/workflow.md",
  "content": "---\nworkflow:\n  id: my-workflow\n..."
}

Response:
{
  "success": true,
  "path": "my-workflow/workflow.md"
}
```

### AI Operations

#### List AI Providers
```bash
GET /api/ai/providers

Response:
{
  "activeProvider": "claude-code",
  "providers": [
    {
      "id": "claude-code",
      "name": "Claude Code (SDK)",
      "status": "ready",
      "isActive": true,
      "description": "Model: claude-sonnet-4-20250514"
    },
    {
      "id": "copilot",
      "name": "GitHub Copilot",
      "status": "needs_config",
      "isActive": false
    },
    {
      "id": "demo",
      "name": "Demo Mode (No API)",
      "status": "ready",
      "isActive": false
    }
  ]
}
```

**Status values:**
- `ready` - Provider is configured and available
- `needs_config` - Provider requires configuration (API key, etc.)
- `unavailable` - Provider failed to initialize

#### Set Active Provider
```bash
POST /api/ai/providers/:id
Content-Type: application/json

{
  "apiKey": "optional-api-key",
  "baseUrl": "optional-base-url",
  "model": "optional-model-name"
}

Response:
{
  "success": true,
  "status": {
    "activeProvider": "claude-code",
    "providers": [...]
  }
}
```

#### Send AI Prompt
```bash
POST /api/ai/prompt
Content-Type: application/json

{
  "prompt": "Add a step to send Slack notification",
  "workflowId": "daily-standup",
  "context": {...}
}

Response:
{
  "success": true,
  "changes": {
    "steps": [...],
    "description": "Added Slack notification step"
  }
}
```

### Workflow Execution

#### Execute Workflow
```bash
POST /api/execute/:path
Content-Type: application/json

{
  "inputs": {
    "message": "Hello World"
  },
  "dryRun": false
}

Response:
{
  "success": true,
  "runId": "run_abc123",
  "status": "running"
}
```

#### Get Execution Status
```bash
GET /api/execute/status/:runId

Response:
{
  "runId": "run_abc123",
  "status": "completed",
  "startTime": "2026-01-31T10:00:00Z",
  "endTime": "2026-01-31T10:00:15Z",
  "steps": [
    {
      "action": "slack.chat.postMessage",
      "status": "completed",
      "output": {...}
    }
  ]
}
```

### WebSocket Events

Connect to `ws://localhost:3001` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001');

// Listen for execution updates
ws.on('execution:start', (data) => {
  console.log('Workflow started:', data.runId);
});

ws.on('execution:step', (data) => {
  console.log('Step completed:', data.step);
});

ws.on('execution:complete', (data) => {
  console.log('Workflow completed:', data.result);
});

ws.on('execution:error', (data) => {
  console.error('Workflow error:', data.error);
});
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

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/marktoflow/marktoflow.git
cd marktoflow

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start GUI in development mode
cd packages/gui
pnpm dev
```

The development server will start:
- **Frontend**: `http://localhost:5173` (Vite dev server with HMR)
- **Backend API**: `http://localhost:3001` (Express server)
- **WebSocket**: `ws://localhost:3001` (Real-time updates)

### Development Commands

```bash
# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### Project Structure

```
packages/gui/
├── src/
│   ├── components/          # React components
│   │   ├── Canvas/         # Workflow canvas (React Flow)
│   │   ├── Sidebar/        # Workflow and tool browser
│   │   ├── Properties/     # Step properties editor
│   │   └── AIPrompt/       # AI assistance interface
│   ├── server/             # Express + Socket.IO backend
│   │   ├── api/            # REST API routes
│   │   ├── websocket/      # WebSocket handlers
│   │   └── workflow/       # Workflow execution
│   ├── stores/             # Zustand state management
│   ├── hooks/              # React hooks
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── dist/                   # Production build
```

### Adding New Features

1. **New Tool Integration**: Add to `src/components/Sidebar/ToolPalette.tsx`
2. **New API Endpoint**: Add to `src/server/api/routes.ts`
3. **New AI Provider**: Add to `src/server/ai/providers/`
4. **New Canvas Node**: Add to `src/components/Canvas/nodes/`

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Radix UI, Tailwind CSS
- **State Management**: Zustand
- **Canvas**: React Flow
- **Code Editor**: Monaco Editor
- **Backend**: Express, Socket.IO
- **File Watching**: Chokidar
- **Testing**: Vitest, React Testing Library

## Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- Screen resolution: 1280x720 minimum

## Troubleshooting

### GUI Not Starting

```bash
# Check if port is already in use
lsof -i :3001

# Use a different port
marktoflow gui --port 3002
```

### AI Provider Not Available

```bash
# For Claude Code
claude  # Verify Claude CLI is authenticated

# For GitHub Copilot
copilot auth login  # Re-authenticate

# For Ollama
ollama serve  # Ensure Ollama is running
```

### Workflows Not Appearing

```bash
# Check workflow directory
marktoflow gui --workflow-dir ./workflows

# Verify workflow files are valid markdown
marktoflow workflow validate workflow.md
```

### WebSocket Connection Issues

If real-time updates aren't working:
1. Check browser console for WebSocket errors
2. Verify firewall isn't blocking WebSocket connections
3. Try restarting the GUI server

### Build Issues

```bash
# Clean and rebuild
pnpm clean
pnpm build

# Clear node_modules
rm -rf node_modules
pnpm install
```

## Examples

Load any workflow from the [examples/](https://github.com/marktoflow/marktoflow/tree/main/examples) directory:

```bash
# Start GUI with examples
marktoflow gui --workflow-dir ./examples

# Open specific example
marktoflow gui --open examples/daily-standup/workflow.md
```

Try these workflows in the GUI:
- **daily-standup** - See AI-generated summaries in action
- **code-review** - Visualize multi-step PR review flow
- **web-automation** - Watch browser automation steps execute
- **copilot-code-review** - See GitHub Copilot SDK integration

## Documentation

- [User Guide](../../docs/GUI_USER_GUIDE.md)
- [API Reference](../../docs/GUI_API_REFERENCE.md)
- [Developer Guide](../../docs/GUI_DEVELOPER_GUIDE.md)
- [Examples](https://github.com/marktoflow/marktoflow/tree/main/examples)

## License

Apache-2.0
