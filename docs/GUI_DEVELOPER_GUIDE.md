# Marktoflow Visual Workflow Designer - Developer Guide

Technical documentation for developers who want to extend, customize, or contribute to the Marktoflow GUI.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [State Management](#state-management)
6. [Adding Custom Nodes](#adding-custom-nodes)
7. [Adding AI Providers](#adding-ai-providers)
8. [Adding Tools/Integrations](#adding-toolsintegrations)
9. [Testing](#testing)
10. [Building and Deployment](#building-and-deployment)

---

## Architecture Overview

The Marktoflow GUI is a full-stack TypeScript application with:

- **Frontend**: React 18 + Vite + React Flow for the visual editor
- **Backend**: Express + Socket.IO for real-time updates
- **State**: Zustand stores for reactive state management
- **AI**: Pluggable provider system supporting multiple backends

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Frontend)                        │
├──────────────────┬────────────────────┬────────────────────────┤
│     Sidebar      │      Canvas        │    Properties Panel    │
│  - Workflows     │  - React Flow      │  - Step details        │
│  - Tools         │  - Custom nodes    │  - Variables           │
│                  │  - Drag & drop     │  - Execution history   │
├──────────────────┴────────────────────┴────────────────────────┤
│                     Zustand State Stores                        │
│  workflowStore | canvasStore | editorStore | promptStore | ...  │
├─────────────────────────────────────────────────────────────────┤
│              WebSocket (Socket.IO) + REST API                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                      Express Server (Backend)                    │
├─────────────────────────────────────────────────────────────────┤
│  /api/workflows  │  /api/ai  │  /api/execute  │  /api/tools    │
├─────────────────────────────────────────────────────────────────┤
│               Services Layer                                     │
│  WorkflowService | AIService | AgentRegistry | FileWatcher      │
├─────────────────────────────────────────────────────────────────┤
│               AI Provider System                                 │
│  ClaudeProvider | CopilotProvider | OllamaProvider | Demo       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
packages/gui/
├── src/
│   ├── client/                    # React frontend
│   │   ├── components/
│   │   │   ├── Canvas/            # React Flow canvas
│   │   │   │   ├── Canvas.tsx
│   │   │   │   ├── StepNode.tsx
│   │   │   │   ├── SubWorkflowNode.tsx
│   │   │   │   ├── TriggerNode.tsx
│   │   │   │   ├── OutputNode.tsx
│   │   │   │   ├── NodeContextMenu.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   └── ExecutionOverlay.tsx
│   │   │   ├── Editor/            # Step editing
│   │   │   │   ├── StepEditor.tsx
│   │   │   │   ├── YamlEditor.tsx
│   │   │   │   ├── InputsEditor.tsx
│   │   │   │   └── NewStepWizard.tsx
│   │   │   ├── Panels/            # Information panels
│   │   │   │   └── PropertiesPanel.tsx
│   │   │   ├── Prompt/            # AI prompt interface
│   │   │   │   ├── PromptInput.tsx
│   │   │   │   ├── PromptHistoryPanel.tsx
│   │   │   │   └── ChangePreview.tsx
│   │   │   ├── Sidebar/           # Left sidebar
│   │   │   │   └── Sidebar.tsx
│   │   │   └── common/            # Shared components
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Tabs.tsx
│   │   │       ├── ContextMenu.tsx
│   │   │       ├── Breadcrumb.tsx
│   │   │       ├── ThemeToggle.tsx
│   │   │       └── KeyboardShortcuts.tsx
│   │   ├── stores/                # Zustand state stores
│   │   │   ├── workflowStore.ts
│   │   │   ├── canvasStore.ts
│   │   │   ├── editorStore.ts
│   │   │   ├── promptStore.ts
│   │   │   ├── navigationStore.ts
│   │   │   ├── executionStore.ts
│   │   │   ├── layoutStore.ts
│   │   │   ├── themeStore.ts
│   │   │   └── index.ts
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── utils/                 # Utility functions
│   │   ├── styles/                # CSS/Tailwind
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── server/                    # Express backend
│   │   ├── routes/
│   │   │   ├── workflows.ts
│   │   │   ├── ai.ts
│   │   │   ├── execute.ts
│   │   │   └── tools.ts
│   │   ├── services/
│   │   │   ├── WorkflowService.ts
│   │   │   ├── AIService.ts
│   │   │   ├── FileWatcher.ts
│   │   │   └── agents/            # AI provider system
│   │   │       ├── types.ts
│   │   │       ├── registry.ts
│   │   │       ├── prompts.ts
│   │   │       ├── claude-provider.ts
│   │   │       ├── copilot-provider.ts
│   │   │       ├── ollama-provider.ts
│   │   │       └── demo-provider.ts
│   │   ├── websocket/
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   └── shared/                    # Shared types
│       └── types.ts
│
├── tests/
│   ├── unit/                      # Vitest unit tests
│   └── e2e/                       # Playwright E2E tests
│
├── public/                        # Static assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.server.json
├── tailwind.config.ts
└── playwright.config.ts
```

---

## Frontend Architecture

### Technology Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| React Flow (@xyflow/react) | Node graph visualization |
| Zustand | State management |
| Tailwind CSS | Styling |
| Radix UI | Accessible UI primitives |
| Monaco Editor | Code editing |
| Socket.IO Client | Real-time updates |

### Component Hierarchy

```
App
├── MobileHeader (< 1024px)
├── Sidebar
│   ├── WorkflowList
│   └── ToolsPalette
├── Canvas
│   ├── ReactFlow
│   │   ├── StepNode
│   │   ├── SubWorkflowNode
│   │   ├── TriggerNode
│   │   └── OutputNode
│   ├── Toolbar
│   ├── NodeContextMenu
│   └── ExecutionOverlay
├── PropertiesPanel
│   ├── PropertiesTab
│   ├── VariablesTab
│   └── HistoryTab
├── PromptInput
├── StepEditor (Modal)
├── NewStepWizard (Modal)
└── KeyboardShortcuts
```

### Custom React Flow Nodes

The canvas uses custom nodes for different workflow elements:

```typescript
// StepNode - Regular action step
const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
  trigger: TriggerNode,
  output: OutputNode,
};

// Register with React Flow
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  ...
/>
```

---

## Backend Architecture

### Express Server

The server provides REST API endpoints and WebSocket support:

```typescript
// src/server/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// Routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/tools', toolsRoutes);

// WebSocket
setupWebSocket(io);
```

### Services

| Service | Responsibility |
|---------|----------------|
| `WorkflowService` | CRUD operations on workflow files |
| `AIService` | AI prompt processing and provider management |
| `FileWatcher` | Watch for file changes and emit updates |
| `AgentRegistry` | Manage AI provider instances |

---

## State Management

### Zustand Stores

The application uses multiple Zustand stores for different concerns:

#### workflowStore

Manages the current workflow data.

```typescript
interface WorkflowState {
  workflows: WorkflowSummary[];
  currentWorkflow: Workflow | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;

  loadWorkflows: () => Promise<void>;
  loadWorkflow: (path: string) => Promise<void>;
  updateWorkflow: (workflow: Workflow) => void;
  saveWorkflow: () => Promise<void>;
  createWorkflow: (name: string) => Promise<void>;
  deleteWorkflow: (path: string) => Promise<void>;
}
```

#### canvasStore

Manages React Flow canvas state.

```typescript
interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];
  zoom: number;
  viewport: { x: number; y: number };

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  selectNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: Position) => void;
  autoLayout: () => void;
}
```

#### editorStore

Manages step editing state.

```typescript
interface EditorState {
  isOpen: boolean;
  editingStep: Step | null;
  activeTab: string;

  openEditor: (step: Step) => void;
  closeEditor: () => void;
  updateStep: (step: Step) => void;
  setActiveTab: (tab: string) => void;
}
```

#### promptStore

Manages AI prompt interface.

```typescript
interface PromptState {
  prompt: string;
  history: PromptHistoryItem[];
  isProcessing: boolean;
  pendingChanges: PromptResult | null;

  setPrompt: (prompt: string) => void;
  submitPrompt: () => Promise<void>;
  acceptChanges: () => void;
  rejectChanges: () => void;
}
```

#### executionStore

Manages workflow execution state.

```typescript
interface ExecutionState {
  isExecuting: boolean;
  currentRunId: string | null;
  stepStatuses: Map<string, StepStatus>;
  logs: LogEntry[];
  history: ExecutionRun[];

  startExecution: (inputs?: Record<string, unknown>) => Promise<void>;
  cancelExecution: () => void;
  updateStepStatus: (stepId: string, status: StepStatus) => void;
}
```

#### layoutStore

Manages responsive layout and panel visibility.

```typescript
interface LayoutState {
  breakpoint: 'mobile' | 'tablet' | 'desktop';
  sidebarVisible: boolean;
  propertiesVisible: boolean;

  setBreakpoint: (width: number) => void;
  toggleSidebar: () => void;
  toggleProperties: () => void;
}
```

#### themeStore

Manages theme preferences.

```typescript
interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}
```

---

## Adding Custom Nodes

### 1. Create the Node Component

```typescript
// src/client/components/Canvas/CustomNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface CustomNodeData {
  label: string;
  customProperty: string;
}

export function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div className={`custom-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="custom-node-content">
        <span className="icon">🔧</span>
        <span className="label">{data.label}</span>
        <span className="custom">{data.customProperty}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

### 2. Register the Node Type

```typescript
// src/client/components/Canvas/Canvas.tsx
import { CustomNode } from './CustomNode';

const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
  trigger: TriggerNode,
  output: OutputNode,
  custom: CustomNode,  // Add your custom node
};
```

### 3. Add Styles

```css
/* src/client/styles/globals.css */
.custom-node {
  min-width: 180px;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-node-bg);
  border: 2px solid transparent;
}

.custom-node.selected {
  border-color: var(--color-primary);
}
```

### 4. Create Nodes from Workflow Data

```typescript
// src/client/utils/workflowToGraph.ts
function createCustomNode(step: Step): Node {
  return {
    id: step.id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: step.name,
      customProperty: step.custom_field,
    },
  };
}
```

---

## Control Flow Node Components

marktoflow v2.0.0-alpha.8 includes 7 built-in control flow node components for the visual workflow designer.

### Node Component Architecture

All control flow nodes follow a consistent pattern:

```typescript
import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { IconName, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface NodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  // ... type-specific properties
}

export type NodeType = Node<NodeData, 'node_type'>;

function NodeComponent({ data, selected }: NodeProps<NodeType>) {
  // Status configuration
  const statusConfig: Record<NonNullable<NodeData['status']>, Config> = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: { icon: IconName, color: 'text-color', bgColor: 'bg-color/10', animate: true },
    completed: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10' },
    failed: { icon: XCircle, color: 'text-error', bgColor: 'bg-error/10' },
    skipped: { icon: XCircle, color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
  };

  return (
    <div className={`control-flow-node ${selected ? 'selected' : ''}`}
         style={{ background: 'linear-gradient(...)' }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} />

      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-lg bg-white/20">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{data.name}</div>
          <div className="text-xs text-white/70">Type Description</div>
        </div>
        <StatusIcon className={animate ? 'animate-pulse' : ''} />
      </div>

      {/* Body */}
      <div className="p-3 bg-white/10">
        {/* Type-specific content */}
      </div>

      {/* Output handle(s) */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const NodeName = memo(NodeComponent);
```

### Control Flow Nodes Reference

#### 1. IfElseNode

**File:** `src/client/components/Canvas/IfElseNode.tsx`

**Features:**
- Dual output handles (then/else) at 33% and 67% positions
- Condition display with monospace font
- Active branch highlighting (green for then, red for else)
- Purple gradient design (#667eea → #764ba2)

**Data Interface:**
```typescript
interface IfElseNodeData {
  id: string;
  name?: string;
  condition: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranch?: 'then' | 'else' | null;
}
```

**Usage:**
```typescript
const ifNode: Node<IfElseNodeData, 'if'> = {
  id: 'if-1',
  type: 'if',
  position: { x: 100, y: 100 },
  data: {
    id: 'if-1',
    name: 'Check Count',
    condition: '{{ count > 0 }}',
    status: 'running',
    activeBranch: 'then',
  },
};
```

#### 2. ForEachNode

**File:** `src/client/components/Canvas/ForEachNode.tsx`

**Features:**
- Iteration progress bar with percentage
- Current/total iterations display
- Loop metadata info (index, first, last, length)
- Pink/red gradient design (#f093fb → #f5576c)

**Data Interface:**
```typescript
interface ForEachNodeData {
  id: string;
  name?: string;
  items: string;
  itemVariable?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  currentIteration?: number;
  totalIterations?: number;
}
```

#### 3. WhileNode

**File:** `src/client/components/Canvas/WhileNode.tsx`

**Features:**
- Condition and max iterations display
- Current iteration progress bar
- Warning message about exit condition
- Orange gradient design (#fb923c → #f97316)

**Data Interface:**
```typescript
interface WhileNodeData {
  id: string;
  name?: string;
  condition: string;
  maxIterations?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  currentIteration?: number;
}
```

#### 4. SwitchNode

**File:** `src/client/components/Canvas/SwitchNode.tsx`

**Features:**
- Dynamic case list (shows up to 4 cases, then "+N more")
- Multiple output handles (one per case + default)
- Expression display
- Active case highlighting with ring effect
- Purple/magenta gradient design (#a855f7 → #ec4899)

**Data Interface:**
```typescript
interface SwitchNodeData {
  id: string;
  name?: string;
  expression: string;
  cases: Record<string, unknown>;
  hasDefault?: boolean;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeCase?: string | null;
}
```

#### 5. ParallelNode

**File:** `src/client/components/Canvas/ParallelNode.tsx`

**Features:**
- Branch status indicators (active/completed)
- Shows up to 6 branches, then "+N more"
- Max concurrent limit badge
- On-error policy display
- Blue/cyan gradient design (#4facfe → #00f2fe)

**Data Interface:**
```typescript
interface ParallelNodeData {
  id: string;
  name?: string;
  branches: Array<{ id: string; name?: string }>;
  maxConcurrent?: number;
  onError?: 'stop' | 'continue';
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranches?: string[];
  completedBranches?: string[];
}
```

#### 6. TryCatchNode

**File:** `src/client/components/Canvas/TryCatchNode.tsx`

**Features:**
- Three branch indicators (try/catch/finally)
- Error indicator with AlertTriangle icon
- Three output handles at 25%, 50%, 75%
- Info note that finally always executes
- Yellow/orange gradient design (#fbbf24 → #f59e0b)

**Data Interface:**
```typescript
interface TryCatchNodeData {
  id: string;
  name?: string;
  hasCatch?: boolean;
  hasFinally?: boolean;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranch?: 'try' | 'catch' | 'finally' | null;
  errorOccurred?: boolean;
}
```

#### 7. TransformNode

**File:** `src/client/components/Canvas/TransformNode.tsx`

**Features:**
- Unified component for map/filter/reduce
- Type-specific icons (ArrowRight, Filter, Minimize2)
- Expression/condition preview
- Input/output count display
- Teal/cyan gradient design (#14b8a6 → #06b6d4)

**Data Interface:**
```typescript
interface TransformNodeData {
  id: string;
  name?: string;
  transformType: 'map' | 'filter' | 'reduce';
  items: string;
  itemVariable?: string;
  expression?: string;
  condition?: string;
  accumulatorVariable?: string;
  initialValue?: unknown;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  inputCount?: number;
  outputCount?: number;
}
```

### Node Registration

Control flow nodes are registered in `Canvas.tsx`:

```typescript
import { IfElseNode, ForEachNode, WhileNode, SwitchNode,
         ParallelNode, TryCatchNode, TransformNode } from './Canvas';

const nodeTypes = {
  // Standard nodes
  step: StepNode,
  subworkflow: SubWorkflowNode,
  trigger: TriggerNode,
  output: OutputNode,

  // Control flow nodes
  if: IfElseNode,
  for_each: ForEachNode,
  while: WhileNode,
  switch: SwitchNode,
  parallel: ParallelNode,
  try: TryCatchNode,

  // Transform nodes (all use TransformNode component)
  map: TransformNode,
  filter: TransformNode,
  reduce: TransformNode,
};
```

### Design System

All control flow nodes follow a consistent design system:

**Color Scheme:**
```typescript
const controlFlowColors = {
  if: { gradient: '#667eea → #764ba2', name: 'Purple' },
  switch: { gradient: '#a855f7 → #ec4899', name: 'Purple/Magenta' },
  for_each: { gradient: '#f093fb → #f5576c', name: 'Pink/Red' },
  while: { gradient: '#fb923c → #f97316', name: 'Orange' },
  parallel: { gradient: '#4facfe → #00f2fe', name: 'Blue/Cyan' },
  try: { gradient: '#fbbf24 → #f59e0b', name: 'Yellow/Orange' },
  transform: { gradient: '#14b8a6 → #06b6d4', name: 'Teal/Cyan' },
};
```

**Status Indicators:**
- Pending: Clock icon, gray
- Running: Type-specific icon, animated pulse
- Completed: CheckCircle, green
- Failed: XCircle, red
- Skipped: XCircle, gray

**Common Styling:**
- Header: Icon + name + type + status indicator
- Body: White/10 opacity background with type-specific content
- Borders: 2px solid border on selection
- Rounded corners: 8px border radius
- Glass-morphism effect with backdrop blur

### Execution Visualization

To update node state during execution:

```typescript
// Update active branch
updateNode(nodeId, {
  data: {
    ...existingData,
    status: 'running',
    activeBranch: 'then', // or 'else', 'catch', etc.
  },
});

// Update iteration progress
updateNode(nodeId, {
  data: {
    ...existingData,
    currentIteration: 5,
    totalIterations: 10,
  },
});

// Update parallel branch status
updateNode(nodeId, {
  data: {
    ...existingData,
    activeBranches: ['branch-1', 'branch-2'],
    completedBranches: ['branch-3'],
  },
});
```

### Testing Control Flow Nodes

Example test for a control flow node:

```typescript
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { IfElseNode } from './IfElseNode';

test('renders if/else node with condition', () => {
  const mockNode = {
    id: 'if-1',
    type: 'if',
    position: { x: 0, y: 0 },
    data: {
      id: 'if-1',
      name: 'Check Count',
      condition: '{{ count > 0 }}',
      status: 'pending' as const,
    },
  };

  render(
    <ReactFlowProvider>
      <IfElseNode {...mockNode} selected={false} />
    </ReactFlowProvider>
  );

  expect(screen.getByText('Check Count')).toBeInTheDocument();
  expect(screen.getByText('{{ count > 0 }}')).toBeInTheDocument();
});
```

---

## Adding AI Providers

The AI system uses a pluggable provider architecture.

### 1. Implement the Provider Interface

```typescript
// src/server/services/agents/my-provider.ts
import type { AgentProvider, AgentCapabilities, AgentConfig, PromptResult, Workflow } from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

export class MyProvider implements AgentProvider {
  readonly id = 'my-provider';
  readonly name = 'My AI Provider';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: false,
    codeExecution: false,
    systemPrompts: true,
    models: ['model-v1', 'model-v2'],
  };

  private ready = false;
  private model = 'model-v1';
  private error?: string;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Initialize your provider
      // e.g., validate API key, connect to service
      this.ready = true;
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { ready: boolean; model?: string; error?: string } {
    return {
      ready: this.ready,
      model: this.model,
      error: this.error,
    };
  }

  async processPrompt(
    prompt: string,
    workflow: Workflow,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.ready) {
      return { explanation: '', error: this.error || 'Provider not ready' };
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

    // Call your AI service
    const response = await this.callMyService(systemPrompt, userPrompt);

    return this.parseResponse(response, workflow);
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    return generateSuggestions(workflow, selectedStepId);
  }

  // Optional: streaming support
  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    // Implement streaming if your provider supports it
    return this.processPrompt(prompt, workflow, context);
  }

  async cancel(): Promise<void> {
    // Cancel any ongoing requests
  }

  private async callMyService(system: string, user: string): Promise<string> {
    // Your API call logic
  }

  private parseResponse(response: string, workflow: Workflow): PromptResult {
    // Parse the AI response and extract workflow changes
  }
}

export function createMyProvider(config?: AgentConfig): MyProvider {
  const provider = new MyProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
```

### 2. Register the Provider

```typescript
// src/server/services/agents/registry.ts
import { MyProvider, createMyProvider } from './my-provider.js';

export class AgentRegistry {
  private providers: Map<string, AgentProvider> = new Map();

  constructor() {
    // Register your provider
    this.providers.set('my-provider', createMyProvider());
  }

  async autoDetectProvider(): Promise<string | null> {
    // Add detection logic for your provider
    const myProvider = this.providers.get('my-provider');
    if (myProvider && myProvider.isReady()) {
      this.activeProviderId = 'my-provider';
      return 'my-provider';
    }
    // ... rest of detection
  }
}
```

### 3. Export the Provider

```typescript
// src/server/services/agents/index.ts
export { MyProvider, createMyProvider } from './my-provider.js';
```

---

## Adding Tools/Integrations

### 1. Define the Tool

```typescript
// src/server/routes/tools.ts
const tools: ToolDefinition[] = [
  // ... existing tools
  {
    id: 'my-service',
    name: 'My Service',
    icon: '🔧',
    category: 'Custom',
    description: 'Integration with My Service',
    sdk: 'my-service-sdk',
    authType: 'token',
    docsUrl: 'https://docs.myservice.com',
    actions: [
      {
        id: 'action.do',
        name: 'Do Action',
        description: 'Perform an action',
        inputs: [
          {
            name: 'param1',
            type: 'string',
            required: true,
            description: 'First parameter',
          },
          {
            name: 'param2',
            type: 'number',
            required: false,
            description: 'Optional second parameter',
            default: 10,
          },
        ],
        output: {
          type: 'object',
          description: 'Action result',
        },
      },
    ],
  },
];
```

### 2. Add to Tools Palette

The tool will automatically appear in the sidebar's Tools tab and be available for drag-and-drop.

### 3. Create Integration Package (Optional)

For full SDK integration, create an integration in `packages/integrations/`:

```typescript
// packages/integrations/src/my-service/index.ts
import MyServiceSDK from 'my-service-sdk';

export interface MyServiceConfig {
  token: string;
  baseUrl?: string;
}

export function createMyServiceIntegration(config: MyServiceConfig) {
  const client = new MyServiceSDK({
    token: config.token,
    baseUrl: config.baseUrl,
  });

  return {
    action: {
      do: async (param1: string, param2?: number) => {
        return client.doAction(param1, param2);
      },
    },
  };
}
```

---

## Testing

### Unit Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm test src/client/stores/workflowStore.test.ts
```

Example test:

```typescript
// src/client/stores/workflowStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkflowStore } from './workflowStore';

describe('workflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.getState().reset();
  });

  it('should load workflows', async () => {
    const store = useWorkflowStore.getState();
    await store.loadWorkflows();
    expect(store.workflows.length).toBeGreaterThan(0);
  });

  it('should mark as dirty after changes', () => {
    const store = useWorkflowStore.getState();
    store.updateWorkflow({ ...store.currentWorkflow, name: 'Changed' });
    expect(store.isDirty).toBe(true);
  });
});
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# Run in headed mode
pnpm test:e2e --headed

# Run specific test
pnpm test:e2e tests/e2e/workflow-editing.spec.ts
```

Example E2E test:

```typescript
// tests/e2e/workflow-editing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Workflow Editing', () => {
  test('should create a new workflow', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Click new workflow button
    await page.click('[data-testid="new-workflow-btn"]');

    // Enter name
    await page.fill('[data-testid="workflow-name-input"]', 'test-workflow');
    await page.click('[data-testid="create-btn"]');

    // Verify workflow created
    await expect(page.locator('.workflow-name')).toHaveText('test-workflow');
  });

  test('should add a step via drag and drop', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Drag Slack tool to canvas
    const slackTool = page.locator('[data-tool-id="slack"]');
    const canvas = page.locator('.react-flow__pane');

    await slackTool.dragTo(canvas);

    // Verify step added
    await expect(page.locator('.step-node')).toBeVisible();
  });
});
```

---

## Building and Deployment

### Development

```bash
# Start dev servers (client + server)
pnpm dev

# Start only client
pnpm dev:client

# Start only server
pnpm dev:server
```

### Production Build

```bash
# Build both client and server
pnpm build

# Build client only (outputs to dist/)
pnpm build:client

# Build server only (outputs to dist/server/)
pnpm build:server
```

### Running Production Build

```bash
# Set environment variables
export WORKFLOW_DIR=/path/to/workflows
export STATIC_DIR=./dist
export PORT=3001

# Start server
node dist/server/index.js
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV STATIC_DIR=/app/dist
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/server/index.js"]
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `WORKFLOW_DIR` | Workflow files directory | `process.cwd()` |
| `STATIC_DIR` | Built client files | - |
| `ANTHROPIC_API_KEY` | Claude API key | - |

---

## Contributing

### Code Style

- Use TypeScript strict mode
- Use ESLint + Prettier for formatting
- Follow React best practices (hooks, functional components)
- Keep components small and focused

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes with tests
4. Run `pnpm test` and `pnpm lint`
5. Submit a PR to the `main` branch

### Commit Messages

Use conventional commits:

```
feat: add new AI provider support
fix: resolve canvas zoom issues
docs: update developer guide
test: add E2E tests for step editing
```

---

## Related Documentation

- [User Guide](./GUI_USER_GUIDE.md) - Using the visual workflow designer
- [API Reference](./GUI_API_REFERENCE.md) - REST API and WebSocket documentation
- [Main README](../README.md) - Project overview
