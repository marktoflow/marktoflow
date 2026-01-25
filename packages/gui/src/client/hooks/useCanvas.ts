import { useCallback, useMemo } from 'react';
import { useReactFlow, type Node, type Edge } from '@xyflow/react';
import { useCanvasStore } from '../stores/canvasStore';
import dagre from 'dagre';

export function useCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    updateNodeData,
    clearCanvas,
  } = useCanvasStore();

  const reactFlowInstance = useReactFlow();

  // Get selected nodes
  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes]
  );

  // Get selected edges
  const selectedEdges = useMemo(
    () => edges.filter((edge) => edge.selected),
    [edges]
  );

  // Get node by ID
  const getNode = useCallback(
    (id: string): Node | undefined => {
      return nodes.find((node) => node.id === id);
    },
    [nodes]
  );

  // Get edge by ID
  const getEdge = useCallback(
    (id: string): Edge | undefined => {
      return edges.find((edge) => edge.id === id);
    },
    [edges]
  );

  // Add a new node
  const addNode = useCallback(
    (node: Node) => {
      setNodes([...nodes, node]);
    },
    [nodes, setNodes]
  );

  // Remove a node
  const removeNode = useCallback(
    (id: string) => {
      setNodes(nodes.filter((node) => node.id !== id));
      // Also remove connected edges
      setEdges(edges.filter((edge) => edge.source !== id && edge.target !== id));
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Duplicate selected nodes
  const duplicateSelected = useCallback(() => {
    const newNodes: Node[] = [];
    const idMap = new Map<string, string>();

    for (const node of selectedNodes) {
      const newId = `${node.id}-copy-${Date.now()}`;
      idMap.set(node.id, newId);

      newNodes.push({
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
        data: {
          ...node.data,
          id: newId,
        },
      });
    }

    setNodes([...nodes, ...newNodes]);

    // Duplicate edges between selected nodes
    const newEdges: Edge[] = [];
    for (const edge of edges) {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        newEdges.push({
          ...edge,
          id: `${edge.id}-copy-${Date.now()}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        });
      }
    }

    if (newEdges.length > 0) {
      setEdges([...edges, ...newEdges]);
    }
  }, [selectedNodes, nodes, edges, setNodes, setEdges]);

  // Delete selected nodes and edges
  const deleteSelected = useCallback(() => {
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const selectedEdgeIds = new Set(selectedEdges.map((e) => e.id));

    setNodes(nodes.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges(
      edges.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );
  }, [selectedNodes, selectedEdges, nodes, edges, setNodes, setEdges]);

  // Auto-layout using dagre
  const autoLayout = useCallback(() => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    // Add nodes
    for (const node of nodes) {
      dagreGraph.setNode(node.id, { width: 200, height: 100 });
    }

    // Add edges
    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target);
    }

    // Run layout
    dagre.layout(dagreGraph);

    // Update node positions
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 100,
          y: nodeWithPosition.y - 50,
        },
      };
    });

    setNodes(layoutedNodes);

    // Fit view after layout
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [nodes, edges, setNodes, reactFlowInstance]);

  // Fit view
  const fitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  // Zoom to node
  const zoomToNode = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1.5,
          duration: 300,
        });
      }
    },
    [getNode, reactFlowInstance]
  );

  // Select node
  const selectNode = useCallback(
    (nodeId: string, addToSelection = false) => {
      setNodes(
        nodes.map((node) => ({
          ...node,
          selected: addToSelection
            ? node.selected || node.id === nodeId
            : node.id === nodeId,
        }))
      );
    },
    [nodes, setNodes]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setNodes(nodes.map((node) => ({ ...node, selected: false })));
    setEdges(edges.map((edge) => ({ ...edge, selected: false })));
  }, [nodes, edges, setNodes, setEdges]);

  return {
    // State
    nodes,
    edges,
    selectedNodes,
    selectedEdges,

    // Queries
    getNode,
    getEdge,

    // Mutations
    addNode,
    removeNode,
    updateNodeData,
    setNodes,
    setEdges,
    clearCanvas,

    // Selection
    selectNode,
    clearSelection,
    duplicateSelected,
    deleteSelected,

    // Layout
    autoLayout,
    fitView,
    zoomToNode,
  };
}
