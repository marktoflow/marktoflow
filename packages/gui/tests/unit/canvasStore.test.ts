import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/client/stores/canvasStore';
import type { Node, Edge } from '@xyflow/react';

describe('canvasStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      past: [],
      future: [],
      clipboard: null,
    });
  });

  describe('setNodes', () => {
    it('should set nodes', () => {
      const { setNodes } = useCanvasStore.getState();

      const nodes: Node[] = [
        { id: 'node-1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
        { id: 'node-2', position: { x: 100, y: 100 }, data: { label: 'Node 2' } },
      ];

      setNodes(nodes);

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes[0].id).toBe('node-1');
      expect(state.nodes[1].id).toBe('node-2');
    });

    it('should replace existing nodes', () => {
      const { setNodes } = useCanvasStore.getState();

      setNodes([{ id: 'old-node', position: { x: 0, y: 0 }, data: {} }]);
      setNodes([{ id: 'new-node', position: { x: 0, y: 0 }, data: {} }]);

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('new-node');
    });
  });

  describe('setEdges', () => {
    it('should set edges', () => {
      const { setEdges } = useCanvasStore.getState();

      const edges: Edge[] = [
        { id: 'e-1-2', source: 'node-1', target: 'node-2' },
        { id: 'e-2-3', source: 'node-2', target: 'node-3' },
      ];

      setEdges(edges);

      const state = useCanvasStore.getState();
      expect(state.edges).toHaveLength(2);
      expect(state.edges[0].source).toBe('node-1');
      expect(state.edges[1].target).toBe('node-3');
    });
  });

  describe('updateNodeData', () => {
    it('should update data for a specific node', () => {
      const { setNodes, updateNodeData } = useCanvasStore.getState();

      setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: { status: 'pending', name: 'Test' } },
        { id: 'node-2', position: { x: 100, y: 100 }, data: { status: 'pending' } },
      ]);

      updateNodeData('node-1', { status: 'completed' });

      const state = useCanvasStore.getState();
      expect(state.nodes[0].data.status).toBe('completed');
      expect(state.nodes[0].data.name).toBe('Test'); // Should preserve other data
      expect(state.nodes[1].data.status).toBe('pending'); // Other nodes unchanged
    });

    it('should not affect non-existent nodes', () => {
      const { setNodes, updateNodeData } = useCanvasStore.getState();

      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: { value: 1 } }]);

      updateNodeData('non-existent', { value: 2 });

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].data.value).toBe(1);
    });
  });

  describe('clearCanvas', () => {
    it('should clear all nodes and edges', () => {
      const { setNodes, setEdges, clearCanvas } = useCanvasStore.getState();

      setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);
      setEdges([{ id: 'e-1-2', source: 'node-1', target: 'node-2' }]);

      clearCanvas();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
    });
  });

  describe('onNodesChange', () => {
    it('should apply position changes to nodes', () => {
      const { setNodes, onNodesChange } = useCanvasStore.getState();

      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      onNodesChange([
        {
          type: 'position',
          id: 'node-1',
          position: { x: 50, y: 75 },
          dragging: false,
        },
      ]);

      const state = useCanvasStore.getState();
      expect(state.nodes[0].position).toEqual({ x: 50, y: 75 });
    });

    it('should handle node selection changes', () => {
      const { setNodes, onNodesChange } = useCanvasStore.getState();

      setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: false },
      ]);

      onNodesChange([
        {
          type: 'select',
          id: 'node-1',
          selected: true,
        },
      ]);

      const state = useCanvasStore.getState();
      expect(state.nodes[0].selected).toBe(true);
    });

    it('should handle node removal', () => {
      const { setNodes, onNodesChange } = useCanvasStore.getState();

      setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      onNodesChange([
        {
          type: 'remove',
          id: 'node-1',
        },
      ]);

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-2');
    });
  });

  describe('onEdgesChange', () => {
    it('should handle edge removal', () => {
      const { setEdges, onEdgesChange } = useCanvasStore.getState();

      setEdges([
        { id: 'e-1', source: 'a', target: 'b' },
        { id: 'e-2', source: 'b', target: 'c' },
      ]);

      onEdgesChange([
        {
          type: 'remove',
          id: 'e-1',
        },
      ]);

      const state = useCanvasStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].id).toBe('e-2');
    });
  });

  describe('onConnect', () => {
    it('should add a new edge when connecting nodes', () => {
      const { setNodes, onConnect } = useCanvasStore.getState();

      setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      onConnect({
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
      });

      const state = useCanvasStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.edges[0].source).toBe('node-1');
      expect(state.edges[0].target).toBe('node-2');
      expect(state.edges[0].animated).toBe(true);
    });
  });

  describe('undo/redo', () => {
    it('should undo node changes', () => {
      const { setNodes, undo, canUndo } = useCanvasStore.getState();

      // Set initial nodes
      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      // Make a change
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      expect(useCanvasStore.getState().nodes).toHaveLength(2);
      expect(useCanvasStore.getState().canUndo()).toBe(true);

      // Undo
      useCanvasStore.getState().undo();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe('node-1');
    });

    it('should redo undone changes', () => {
      const { setNodes } = useCanvasStore.getState();

      // Set initial nodes
      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      // Make a change
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      // Undo
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
      expect(useCanvasStore.getState().canRedo()).toBe(true);

      // Redo
      useCanvasStore.getState().redo();

      const state = useCanvasStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes[1].id).toBe('node-2');
    });

    it('should clear future on new changes', () => {
      const { setNodes } = useCanvasStore.getState();

      // Set initial nodes
      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      // Make a change
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      // Undo
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().canRedo()).toBe(true);

      // Make a new change - should clear future
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-3', position: { x: 200, y: 200 }, data: {} },
      ]);

      expect(useCanvasStore.getState().canRedo()).toBe(false);
    });

    it('should handle multiple undo/redo steps', () => {
      const { setNodes } = useCanvasStore.getState();

      // Set initial nodes
      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      // Make change 2
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
      ]);

      // Make change 3
      useCanvasStore.getState().setNodes([
        { id: 'node-1', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', position: { x: 100, y: 100 }, data: {} },
        { id: 'node-3', position: { x: 200, y: 200 }, data: {} },
      ]);

      expect(useCanvasStore.getState().nodes).toHaveLength(3);

      // Undo twice
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(2);

      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);

      // Redo twice
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().nodes).toHaveLength(2);

      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().nodes).toHaveLength(3);
    });

    it('should not undo when history is empty', () => {
      const { setNodes } = useCanvasStore.getState();

      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      // Clear past to simulate empty history
      useCanvasStore.setState({ past: [] });

      expect(useCanvasStore.getState().canUndo()).toBe(false);

      // Undo should do nothing
      useCanvasStore.getState().undo();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
    });

    it('should not redo when future is empty', () => {
      const { setNodes } = useCanvasStore.getState();

      setNodes([{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }]);

      expect(useCanvasStore.getState().canRedo()).toBe(false);

      // Redo should do nothing
      useCanvasStore.getState().redo();
      expect(useCanvasStore.getState().nodes).toHaveLength(1);
    });
  });

  describe('copy/paste', () => {
    it('should copy selected nodes to clipboard', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: true },
          { id: 'node-2', position: { x: 100, y: 100 }, data: {}, selected: false },
        ],
        edges: [],
        past: [],
        future: [],
        clipboard: null,
      });

      useCanvasStore.getState().copySelected();

      const { clipboard } = useCanvasStore.getState();
      expect(clipboard).not.toBeNull();
      expect(clipboard?.nodes).toHaveLength(1);
      expect(clipboard?.nodes[0].id).toBe('node-1');
    });

    it('should copy edges between selected nodes', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: true },
          { id: 'node-2', position: { x: 100, y: 100 }, data: {}, selected: true },
          { id: 'node-3', position: { x: 200, y: 200 }, data: {}, selected: false },
        ],
        edges: [
          { id: 'e-1-2', source: 'node-1', target: 'node-2' },
          { id: 'e-2-3', source: 'node-2', target: 'node-3' },
        ],
        past: [],
        future: [],
        clipboard: null,
      });

      useCanvasStore.getState().copySelected();

      const { clipboard } = useCanvasStore.getState();
      expect(clipboard?.edges).toHaveLength(1);
      expect(clipboard?.edges[0].id).toBe('e-1-2');
    });

    it('should paste nodes with offset', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: { name: 'Test' }, selected: true }],
        edges: [],
        past: [],
        future: [],
        clipboard: null,
      });

      // Copy
      useCanvasStore.getState().copySelected();

      // Paste
      useCanvasStore.getState().paste({ x: 50, y: 50 });

      const { nodes } = useCanvasStore.getState();
      expect(nodes).toHaveLength(2);

      // Original node should be deselected
      expect(nodes[0].selected).toBe(false);

      // Pasted node should be selected and offset
      expect(nodes[1].selected).toBe(true);
      expect(nodes[1].position.x).toBe(50);
      expect(nodes[1].position.y).toBe(50);
      expect(nodes[1].id).not.toBe('node-1'); // New unique ID
    });

    it('should paste edges with updated references', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: true },
          { id: 'node-2', position: { x: 100, y: 100 }, data: {}, selected: true },
        ],
        edges: [{ id: 'e-1-2', source: 'node-1', target: 'node-2' }],
        past: [],
        future: [],
        clipboard: null,
      });

      // Copy
      useCanvasStore.getState().copySelected();

      // Paste
      useCanvasStore.getState().paste();

      const { nodes, edges } = useCanvasStore.getState();
      expect(nodes).toHaveLength(4);
      expect(edges).toHaveLength(2);

      // Find the pasted edge
      const pastedEdge = edges.find((e) => e.id.includes('-copy-'));
      expect(pastedEdge).toBeDefined();

      // Pasted edge should reference pasted nodes
      expect(pastedEdge?.source).not.toBe('node-1');
      expect(pastedEdge?.target).not.toBe('node-2');
    });

    it('should return true for canPaste when clipboard has nodes', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: true }],
        edges: [],
        past: [],
        future: [],
        clipboard: null,
      });

      expect(useCanvasStore.getState().canPaste()).toBe(false);

      useCanvasStore.getState().copySelected();

      expect(useCanvasStore.getState().canPaste()).toBe(true);
    });

    it('should do nothing when copying with no selection', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {}, selected: false }],
        edges: [],
        past: [],
        future: [],
        clipboard: null,
      });

      useCanvasStore.getState().copySelected();

      expect(useCanvasStore.getState().clipboard).toBeNull();
    });

    it('should do nothing when pasting with empty clipboard', () => {
      useCanvasStore.setState({
        nodes: [{ id: 'node-1', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
        past: [],
        future: [],
        clipboard: null,
      });

      useCanvasStore.getState().paste();

      expect(useCanvasStore.getState().nodes).toHaveLength(1);
    });
  });
});
