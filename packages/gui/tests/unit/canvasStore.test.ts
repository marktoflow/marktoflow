import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/client/stores/canvasStore';
import type { Node, Edge } from '@xyflow/react';

describe('canvasStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvasStore.setState({
      nodes: [],
      edges: [],
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
});
