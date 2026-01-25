# Marktoflow GUI - Implementation Plan

## Overview

A web-based visual workflow designer for marktoflow, inspired by n8n's interface. The GUI provides an intuitive way to visualize, edit, and manage workflows using an AI-powered prompt interface.

---

## Goals

1. **Visual Workflow Editor** - n8n-style node graph for viewing/editing workflows
2. **AI-Powered Editing** - Natural language prompt to modify workflows
3. **Sub-workflow Support** - Visualize and navigate nested workflows
4. **Real-time Updates** - Live preview of workflow changes
5. **Right-click Edit** - Quick access to step YAML and documentation

---

## Technical Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **State Management**: Zustand (lightweight, TypeScript-friendly)
- **Workflow Canvas**: React Flow (formerly react-flow-renderer)
  - Most popular for n8n-style node graphs
  - Supports custom nodes, edges, mini-map, controls
  - Active development and good TypeScript support
- **Styling**: Tailwind CSS + shadcn/ui components
- **Code Editor**: Monaco Editor (VS Code's editor)
- **Markdown Preview**: react-markdown with rehype plugins

### Backend
- **Runtime**: Node.js with Express
- **API**: REST + WebSocket for real-time updates
- **AI Integration**: Direct Anthropic SDK for Claude
- **File Operations**: Core package's parser and models

### Build System
- **Bundler**: Vite
- **Testing**: Vitest + React Testing Library + Playwright (E2E)

---

## Architecture

```
packages/gui/
├── src/
│   ├── client/                 # React frontend
│   │   ├── components/
│   │   │   ├── Canvas/         # React Flow workflow canvas
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── StepNode.tsx
│   │   │   │   ├── SubWorkflowNode.tsx
│   │   │   │   ├── ConnectionEdge.tsx
│   │   │   │   └── MiniMap.tsx
│   │   │   ├── Sidebar/        # Workflow list, tools palette
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── WorkflowList.tsx
│   │   │   │   └── ToolsPalette.tsx
│   │   │   ├── Editor/         # Step/workflow editing
│   │   │   │   ├── StepEditor.tsx
│   │   │   │   ├── YamlEditor.tsx
│   │   │   │   ├── MarkdownEditor.tsx
│   │   │   │   └── InputsEditor.tsx
│   │   │   ├── Prompt/         # AI prompt interface
│   │   │   │   ├── PromptInput.tsx
│   │   │   │   ├── PromptHistory.tsx
│   │   │   │   └── SuggestionList.tsx
│   │   │   ├── Panels/         # Information panels
│   │   │   │   ├── PropertiesPanel.tsx
│   │   │   │   ├── VariablesPanel.tsx
│   │   │   │   └── ExecutionPanel.tsx
│   │   │   └── common/         # Shared components
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── ContextMenu.tsx
│   │   │       └── Tooltip.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useWorkflow.ts
│   │   │   ├── useCanvas.ts
│   │   │   ├── useAIPrompt.ts
│   │   │   └── useWebSocket.ts
│   │   ├── stores/             # Zustand stores
│   │   │   ├── workflowStore.ts
│   │   │   ├── canvasStore.ts
│   │   │   ├── editorStore.ts
│   │   │   └── promptStore.ts
│   │   ├── utils/              # Utility functions
│   │   │   ├── workflowToGraph.ts
│   │   │   ├── graphToWorkflow.ts
│   │   │   └── variableResolver.ts
│   │   ├── types/              # TypeScript types
│   │   │   ├── canvas.ts
│   │   │   ├── editor.ts
│   │   │   └── api.ts
│   │   ├── styles/             # Global styles
│   │   │   └── globals.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── server/                 # Express backend
│   │   ├── index.ts            # Server entry point
│   │   ├── routes/
│   │   │   ├── workflows.ts    # CRUD for workflows
│   │   │   ├── ai.ts           # AI prompt endpoint
│   │   │   └── execute.ts      # Workflow execution
│   │   ├── services/
│   │   │   ├── WorkflowService.ts
│   │   │   ├── AIService.ts
│   │   │   └── FileWatcher.ts
│   │   └── websocket/
│   │       └── index.ts        # Real-time updates
│   │
│   └── shared/                 # Shared types/utils
│       ├── types.ts
│       └── constants.ts
│
├── public/                     # Static assets
│   └── icons/                  # Node icons
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── PLAN.md
```

---

## Feature Specifications

### 1. Workflow Canvas (React Flow)

**Node Types:**

1. **StepNode** - Regular action step
   - Icon based on service (Slack, GitHub, etc.)
   - Step name/ID
   - Status indicator (pending/running/completed/failed)
   - Input/output handles
   - Badge for retry count

2. **SubWorkflowNode** - Sub-workflow reference
   - Folder icon with workflow name
   - Expandable to show nested steps
   - Click to drill down into sub-workflow
   - Badge showing step count

3. **TriggerNode** - Workflow triggers
   - Clock icon for schedule
   - Webhook icon for webhooks
   - Event icon for file watchers

4. **OutputNode** - Workflow outputs
   - Terminal icon
   - Shows output variables

**Edge Types:**

1. **DataFlowEdge** - Variable dependencies
   - Animated when data is flowing
   - Label showing variable name
   - Color-coded by data type

2. **SequenceEdge** - Execution order
   - Simple arrow showing step sequence
   - Conditional badge if step has conditions

**Canvas Features:**
- Pan and zoom with mouse/trackpad
- Mini-map for navigation
- Auto-layout (dagre algorithm)
- Snap to grid
- Multi-select and group operations
- Copy/paste nodes
- Undo/redo

### 2. Right-Click Context Menu

**Step Context Menu:**
- **Edit Step** - Open step editor modal
- **View YAML** - Show raw YAML in read-only viewer
- **Edit YAML** - Edit YAML directly
- **View Documentation** - Show markdown documentation
- **Duplicate Step** - Create a copy
- **Delete Step** - Remove with confirmation
- **Add Step Before/After** - Insert new step
- **Convert to Sub-workflow** - Extract step(s) to sub-workflow

**Canvas Context Menu:**
- **Add Step** - Open step creation wizard
- **Add Sub-workflow** - Reference existing workflow
- **Paste** - Paste copied nodes
- **Auto-layout** - Reorganize graph
- **Zoom to Fit** - Fit all nodes in view

### 3. Step Editor Modal

**Tabs:**
1. **Properties** - Basic step configuration
   - Step ID (auto-generated or custom)
   - Step name (human-readable)
   - Action selector (service.method dropdown)
   - Timeout configuration

2. **Inputs** - Input parameters
   - Dynamic form based on action schema
   - Template variable autocomplete (`{{ variable }}`)
   - Expression builder for complex inputs
   - JSON mode for advanced users

3. **Output** - Output configuration
   - Output variable name
   - Variable preview (if executed)
   - Type hints

4. **Error Handling** - Retry and failover
   - Error action (stop/continue/retry)
   - Max retries
   - Retry delay
   - Fallback step

5. **Conditions** - Conditional execution
   - Condition builder with variable picker
   - AND/OR logic
   - Preview of evaluation

6. **YAML** - Raw YAML view/edit
   - Monaco editor with YAML syntax
   - Validation on save
   - Format button

### 4. AI Prompt Interface

**Prompt Input:**
- Multi-line text input at bottom of screen (similar to chat)
- Auto-resize as user types
- Keyboard shortcuts (Cmd/Ctrl+Enter to submit)
- History navigation with up/down arrows

**Prompt Capabilities:**
- "Add a step to send a Slack message after the GitHub step"
- "Change the channel from #general to #engineering"
- "Add error handling to retry 3 times"
- "Convert steps 2-4 into a sub-workflow called validation"
- "Add a condition to skip this step if PR is draft"

**AI Processing:**
1. Send current workflow + user prompt to Claude
2. Claude responds with:
   - Explanation of changes
   - Modified workflow YAML
   - Diff highlighting
3. User can:
   - Accept changes (workflow updates, canvas refreshes)
   - Reject changes
   - Modify and re-submit
   - Ask follow-up questions

**Prompt History:**
- Collapsible panel showing recent prompts
- Click to re-run or edit previous prompt
- Shows associated workflow version

### 5. Sub-workflow Visualization

**Collapsed View:**
- Single node representing sub-workflow
- Shows: name, step count, status
- Double-click to expand inline
- Badge if sub-workflow has sub-workflows

**Expanded Inline View:**
- Group box containing sub-workflow steps
- Clearly delineated from parent workflow
- Collapse button to return to single node
- Border color indicates nesting level

**Drill-down View:**
- Click "Open in new tab" to view sub-workflow standalone
- Breadcrumb navigation showing workflow hierarchy
- Back button to return to parent
- Tab-based multi-workflow editing

### 6. Properties Panel (Right Sidebar)

**When Step Selected:**
- Step ID and name
- Action/workflow reference
- All inputs with current values
- Output variable and current value
- Error handling summary
- Last execution status and duration

**When Workflow Selected:**
- Workflow metadata (id, name, version)
- Author and description
- Tags
- Triggers list
- Global inputs
- Available tools/SDKs

**When Nothing Selected:**
- Workflow overview
- Execution history
- Variables in scope
- Quick actions

### 7. Execution View

**Execution Mode:**
- Toggle between edit and execution views
- Step-through debugging (pause at each step)
- Variable inspector at each step
- Real-time logs panel

**Execution Status:**
- Step status badges on nodes
- Duration on edges
- Error messages in popover
- Retry indicators

**Execution History:**
- List of past runs
- Click to view execution details
- Diff between runs
- Replay capability

---

## API Endpoints

### REST API

```
GET    /api/workflows              # List all workflows
GET    /api/workflows/:path        # Get workflow by path
POST   /api/workflows              # Create new workflow
PUT    /api/workflows/:path        # Update workflow
DELETE /api/workflows/:path        # Delete workflow

POST   /api/workflows/:path/execute    # Execute workflow
GET    /api/workflows/:path/runs       # Get execution history
GET    /api/workflows/:path/runs/:id   # Get specific run

POST   /api/ai/prompt              # Send AI prompt
GET    /api/ai/history             # Get prompt history

GET    /api/tools                  # List available tools/SDKs
GET    /api/tools/:sdk/schema      # Get SDK method schemas
```

### WebSocket Events

```
Server -> Client:
  workflow:updated     # Workflow file changed (file watcher)
  execution:started    # Workflow execution started
  execution:step       # Step execution update
  execution:completed  # Workflow execution finished
  ai:processing        # AI is processing prompt
  ai:response          # AI response ready

Client -> Server:
  workflow:subscribe   # Subscribe to workflow updates
  execution:subscribe  # Subscribe to execution updates
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

1. **Package Setup**
   - [ ] Initialize `packages/gui` with Vite + React + TypeScript
   - [ ] Configure Tailwind CSS and shadcn/ui
   - [ ] Set up Express server with basic routing
   - [ ] Add to pnpm workspace

2. **Core Data Flow**
   - [ ] Create `workflowToGraph()` converter (Workflow -> React Flow nodes/edges)
   - [ ] Create `graphToWorkflow()` converter (React Flow -> Workflow)
   - [ ] Integrate with `@marktoflow/core` parser
   - [ ] Create Zustand stores for state management

3. **Basic Canvas**
   - [ ] React Flow setup with custom theme (n8n-inspired)
   - [ ] Basic StepNode component
   - [ ] Basic edge rendering
   - [ ] Pan/zoom/minimap controls

### Phase 2: Workflow Visualization (Week 3-4)

1. **Node Components**
   - [ ] Complete StepNode with service icons
   - [ ] SubWorkflowNode with expand/collapse
   - [ ] TriggerNode variants
   - [ ] OutputNode
   - [ ] Status indicators and badges

2. **Edge Components**
   - [ ] DataFlowEdge with variable labels
   - [ ] SequenceEdge with conditions
   - [ ] Animation for active edges

3. **Layout and Navigation**
   - [ ] Auto-layout algorithm (dagre)
   - [ ] Breadcrumb navigation for sub-workflows
   - [ ] Multi-tab support

### Phase 3: Editing Capabilities (Week 5-6)

1. **Context Menus**
   - [ ] Step context menu
   - [ ] Canvas context menu
   - [ ] Keyboard shortcuts

2. **Step Editor Modal**
   - [ ] Properties tab
   - [ ] Inputs tab with form generation
   - [ ] Output tab
   - [ ] Error handling tab
   - [ ] Conditions tab
   - [ ] YAML tab with Monaco editor

3. **Workflow Operations**
   - [ ] Add/remove steps
   - [ ] Connect/disconnect nodes
   - [ ] Copy/paste
   - [ ] Undo/redo

### Phase 4: AI Integration (Week 7-8)

1. **Prompt Interface**
   - [ ] Prompt input component
   - [ ] Prompt history panel
   - [ ] Loading/processing states

2. **AI Service**
   - [ ] Claude API integration
   - [ ] Prompt engineering for workflow modifications
   - [ ] Response parsing and diff generation

3. **Change Preview**
   - [ ] Side-by-side diff view
   - [ ] Accept/reject controls
   - [ ] Animated canvas update

### Phase 5: Execution & Real-time (Week 9-10)

1. **WebSocket Integration**
   - [ ] Socket.io setup
   - [ ] File watcher for workflow changes
   - [ ] Real-time canvas updates

2. **Execution View**
   - [ ] Execute workflow from GUI
   - [ ] Step status updates
   - [ ] Log viewer
   - [ ] Variable inspector

3. **Properties Panel**
   - [ ] Step properties view
   - [ ] Workflow properties view
   - [ ] Execution history

### Phase 6: Polish & Testing (Week 11-12)

1. **UI Polish**
   - [ ] Responsive design
   - [ ] Dark mode support
   - [ ] Keyboard navigation
   - [ ] Accessibility (a11y)

2. **Testing**
   - [ ] Unit tests for components
   - [ ] Integration tests for API
   - [ ] E2E tests with Playwright

3. **Documentation**
   - [ ] User guide
   - [ ] Developer documentation
   - [ ] API documentation

---

## Design System (n8n-Inspired)

### Colors

```css
/* Primary */
--color-primary: #ff6d5a;          /* n8n signature coral */
--color-primary-light: #ff8a7a;
--color-primary-dark: #e55a48;

/* Background */
--color-canvas-bg: #1a1a2e;        /* Dark navy */
--color-panel-bg: #232340;
--color-node-bg: #2d2d4a;

/* Status */
--color-success: #5cb85c;
--color-warning: #f0ad4e;
--color-error: #d9534f;
--color-info: #5bc0de;

/* Text */
--color-text-primary: #ffffff;
--color-text-secondary: #a0a0c0;
--color-text-muted: #606080;
```

### Node Styling

```css
.step-node {
  min-width: 200px;
  border-radius: 8px;
  background: var(--color-node-bg);
  border: 2px solid transparent;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.step-node:hover {
  border-color: var(--color-primary);
}

.step-node.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(255, 109, 90, 0.2);
}

.step-node.running {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Typography

- **Font Family**: Inter, system-ui, sans-serif
- **Monospace**: JetBrains Mono, Consolas, monospace
- **Sizes**: 12px (small), 14px (body), 16px (large), 24px (heading)

---

## CLI Integration

Add GUI command to CLI:

```bash
# Start GUI server
marktoflow gui

# Options
marktoflow gui --port 3000        # Custom port
marktoflow gui --open             # Open browser automatically
marktoflow gui --readonly         # View-only mode
marktoflow gui --workflow ./path  # Open specific workflow
```

---

## Security Considerations

1. **File System Access**
   - Restrict to project directory
   - Validate file paths
   - No symlink traversal

2. **AI Prompts**
   - Rate limiting
   - Input sanitization
   - API key protection (server-side only)

3. **Execution**
   - Sandbox mode option
   - Credential masking in UI
   - Audit logging

---

## Success Metrics

1. **Usability**
   - Time to create first workflow < 5 minutes
   - User can visualize any existing workflow
   - AI prompt success rate > 80%

2. **Performance**
   - Canvas renders < 100ms for 50 nodes
   - AI response < 3 seconds
   - File save < 500ms

3. **Quality**
   - > 80% test coverage
   - Zero critical accessibility issues
   - Works in Chrome, Firefox, Safari, Edge

---

## Future Enhancements

1. **Collaboration**
   - Multi-user editing
   - Comments on steps
   - Change history/versioning

2. **Templates**
   - Template gallery
   - One-click workflow creation
   - Community sharing

3. **Advanced Visualization**
   - 3D view for complex workflows
   - Timeline view for scheduled workflows
   - Dependency graph view

4. **Integrations**
   - VS Code extension
   - GitHub integration for workflow PRs
   - Slack bot for workflow triggers
