import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  nodesep?: number;
  ranksep?: number;
  edgesep?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  rankdir: 'TB',
  nodesep: 80,
  ranksep: 120,
  edgesep: 40,
};

/**
 * Layout nodes hierarchically with support for parent-child relationships
 * Uses dagre's compound graph features for nested structures
 */
export function hierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create compound graph for hierarchical layout
  const dagreGraph = new dagre.graphlib.Graph({ compound: true });
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: opts.rankdir,
    nodesep: opts.nodesep,
    ranksep: opts.ranksep,
    edgesep: opts.edgesep,
  });

  // Separate nodes by hierarchy
  const rootNodes: Node[] = [];
  const childNodes: Node[] = [];
  const groupNodes: Node[] = [];

  for (const node of nodes) {
    if (node.type === 'group') {
      groupNodes.push(node);
    } else if (node.parentNode) {
      childNodes.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // Add root-level nodes first
  for (const node of rootNodes) {
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);
    dagreGraph.setNode(node.id, { width, height });
  }

  // Add group nodes and set parent relationships
  for (const groupNode of groupNodes) {
    const width = groupNode.style?.width as number || 300;
    const height = groupNode.style?.minHeight as number || 150;
    dagreGraph.setNode(groupNode.id, { width, height });

    // Set parent if the group itself has a parent (nested control flow)
    if (groupNode.parentNode) {
      dagreGraph.setParent(groupNode.id, groupNode.parentNode);
    }
  }

  // Add child nodes and link to parents
  for (const node of childNodes) {
    const width = node.style?.width as number || 240;
    const height = 80;
    dagreGraph.setNode(node.id, { width, height });

    if (node.parentNode) {
      dagreGraph.setParent(node.id, node.parentNode);
    }
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

    if (!nodeWithPosition) {
      console.warn(`No layout position for node ${node.id}`);
      return node;
    }

    // For child nodes, positions are relative to parent
    if (node.parentNode) {
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (nodeWithPosition.width / 2),
          y: nodeWithPosition.y - (nodeWithPosition.height / 2),
        },
      };
    }

    // For root nodes and groups, use absolute positions
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (nodeWithPosition.width / 2),
        y: nodeWithPosition.y - (nodeWithPosition.height / 2),
      },
    };
  });

  return layoutedNodes;
}

/**
 * Get node width based on type
 */
function getNodeWidth(node: Node): number {
  if (node.style?.width) {
    return node.style.width as number;
  }

  switch (node.type) {
    case 'trigger':
      return 200;
    case 'output':
      return 200;
    case 'if':
    case 'for_each':
    case 'while':
    case 'switch':
    case 'parallel':
    case 'try':
      return 240;
    case 'group':
      return 300;
    case 'step':
    case 'subworkflow':
    default:
      return 200;
  }
}

/**
 * Get node height based on type
 */
function getNodeHeight(node: Node): number {
  if (node.style?.height) {
    return node.style.height as number;
  }

  switch (node.type) {
    case 'trigger':
      return 80;
    case 'output':
      return 100;
    case 'if':
      return 160;
    case 'for_each':
    case 'while':
      return 180;
    case 'switch':
      return 200;
    case 'parallel':
      return 160;
    case 'try':
      return 180;
    case 'group':
      return 150;
    case 'step':
    case 'subworkflow':
    default:
      return 100;
  }
}

/**
 * Calculate appropriate spacing for nested structures
 */
export function calculateGroupSpacing(depth: number): number {
  const baseSpacing = 120;
  const depthMultiplier = 1.3;
  return baseSpacing * Math.pow(depthMultiplier, depth);
}

/**
 * Get nesting depth of a node
 */
export function getNodeDepth(node: Node, allNodes: Node[]): number {
  let depth = 0;
  let currentNode = node;

  while (currentNode.parentNode) {
    depth++;
    const parent = allNodes.find(n => n.id === currentNode.parentNode);
    if (!parent) break;
    currentNode = parent;
  }

  return depth;
}
