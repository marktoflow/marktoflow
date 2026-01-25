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

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<any>) => void;
  clearCanvas: () => void;
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

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, animated: true, style: { stroke: '#ff6d5a', strokeWidth: 2 } },
        get().edges
      ),
    });
  },

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  clearCanvas: () => set({ nodes: [], edges: [] }),
}));
