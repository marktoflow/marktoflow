import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface ClipboardState {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  // History for undo/redo
  past: HistoryState[];
  future: HistoryState[];
  maxHistorySize: number;
  // Clipboard for copy/paste
  clipboard: ClipboardState | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  clearCanvas: () => void;
  // Undo/redo methods
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  // Save checkpoint for history
  saveCheckpoint: () => void;
  // Copy/paste methods
  copySelected: () => void;
  paste: (offset?: { x: number; y: number }) => void;
  canPaste: () => boolean;
}

// Demo data for initial view
const initialNodes: Node[] = [
  {
    id: 'trigger',
    type: 'step',
    position: { x: 250, y: 0 },
    data: {
      id: 'trigger',
      name: 'PR Opened',
      action: 'github.webhook',
      status: 'completed',
    },
  },
  {
    id: 'fetch_pr',
    type: 'step',
    position: { x: 250, y: 120 },
    data: {
      id: 'fetch_pr',
      name: 'Fetch PR Details',
      action: 'github.pulls.get',
      status: 'completed',
    },
  },
  {
    id: 'get_files',
    type: 'step',
    position: { x: 250, y: 240 },
    data: {
      id: 'get_files',
      name: 'Get Changed Files',
      action: 'github.pulls.listFiles',
      status: 'running',
    },
  },
  {
    id: 'analyze',
    type: 'step',
    position: { x: 250, y: 360 },
    data: {
      id: 'analyze',
      name: 'Analyze Changes',
      action: 'claude.analyze',
      status: 'pending',
    },
  },
  {
    id: 'post_review',
    type: 'step',
    position: { x: 250, y: 480 },
    data: {
      id: 'post_review',
      name: 'Post Review',
      action: 'github.pulls.createReview',
      status: 'pending',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'trigger', target: 'fetch_pr', animated: true },
  { id: 'e2', source: 'fetch_pr', target: 'get_files', animated: true },
  { id: 'e3', source: 'get_files', target: 'analyze' },
  { id: 'e4', source: 'analyze', target: 'post_review' },
];

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  past: [],
  future: [],
  maxHistorySize: 50,
  clipboard: null,

  onNodesChange: (changes) => {
    // Filter out position changes for smoother dragging (don't create history for every pixel)
    const isSignificantChange = changes.some(
      (change) => change.type !== 'position' && change.type !== 'select' && change.type !== 'dimensions'
    );

    if (isSignificantChange) {
      get().saveCheckpoint();
    }

    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    // Check for significant changes (not just selection)
    const isSignificantChange = changes.some(
      (change) => change.type !== 'select'
    );

    if (isSignificantChange) {
      get().saveCheckpoint();
    }

    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    get().saveCheckpoint();
    set({
      edges: addEdge(
        { ...connection, animated: true, style: { stroke: '#ff6d5a', strokeWidth: 2 } },
        get().edges
      ),
    });
  },

  setNodes: (nodes) => {
    get().saveCheckpoint();
    set({ nodes, future: [] });
  },

  setEdges: (edges) => {
    get().saveCheckpoint();
    set({ edges, future: [] });
  },

  updateNodeData: (nodeId, data) => {
    get().saveCheckpoint();
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      future: [],
    });
  },

  clearCanvas: () => {
    get().saveCheckpoint();
    set({ nodes: [], edges: [], future: [] });
  },

  saveCheckpoint: () => {
    const { nodes, edges, past, maxHistorySize } = get();

    // Don't save if there's no change from the last checkpoint
    if (past.length > 0) {
      const lastState = past[past.length - 1];
      if (
        JSON.stringify(lastState.nodes) === JSON.stringify(nodes) &&
        JSON.stringify(lastState.edges) === JSON.stringify(edges)
      ) {
        return;
      }
    }

    // Deep clone to avoid reference issues
    const checkpoint: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    const newPast = [...past, checkpoint];

    // Limit history size
    if (newPast.length > maxHistorySize) {
      newPast.shift();
    }

    set({ past: newPast });
  },

  undo: () => {
    const { nodes, edges, past, future } = get();

    if (past.length === 0) return;

    // Save current state to future
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    // Get the last state from past
    const previousState = past[past.length - 1];
    const newPast = past.slice(0, -1);

    set({
      nodes: previousState.nodes,
      edges: previousState.edges,
      past: newPast,
      future: [currentState, ...future],
    });
  },

  redo: () => {
    const { nodes, edges, past, future } = get();

    if (future.length === 0) return;

    // Save current state to past
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    // Get the first state from future
    const nextState = future[0];
    const newFuture = future.slice(1);

    set({
      nodes: nextState.nodes,
      edges: nextState.edges,
      past: [...past, currentState],
      future: newFuture,
    });
  },

  canUndo: () => get().past.length > 0,

  canRedo: () => get().future.length > 0,

  copySelected: () => {
    const { nodes } = get();
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) return;

    // Get the IDs of selected nodes
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // Get edges that connect selected nodes
    const { edges } = get();
    const selectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    // Deep clone to avoid reference issues
    const clipboard: ClipboardState = {
      nodes: JSON.parse(JSON.stringify(selectedNodes)),
      edges: JSON.parse(JSON.stringify(selectedEdges)),
    };

    set({ clipboard });
  },

  paste: (offset = { x: 50, y: 50 }) => {
    const { clipboard, nodes, edges } = get();

    if (!clipboard || clipboard.nodes.length === 0) return;

    get().saveCheckpoint();

    // Create ID mapping for new nodes
    const idMap = new Map<string, string>();
    const timestamp = Date.now().toString(36);

    // Create new nodes with unique IDs and offset positions
    const newNodes: Node[] = clipboard.nodes.map((node, index) => {
      const newId = `${node.id.split('-copy')[0]}-copy-${timestamp}-${index}`;
      idMap.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true, // Select pasted nodes
        data: {
          ...node.data,
          id: newId,
        },
      };
    });

    // Create new edges with updated source/target IDs
    const newEdges: Edge[] = clipboard.edges.map((edge, index) => ({
      ...edge,
      id: `${edge.id.split('-copy')[0]}-copy-${timestamp}-${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }));

    // Deselect existing nodes
    const updatedNodes = nodes.map((node) => ({ ...node, selected: false }));

    set({
      nodes: [...updatedNodes, ...newNodes],
      edges: [...edges, ...newEdges],
      future: [],
    });
  },

  canPaste: () => {
    const { clipboard } = get();
    return clipboard !== null && clipboard.nodes.length > 0;
  },
}));
