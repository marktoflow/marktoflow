/**
 * Shared dagre layout utility for auto-positioning workflow nodes
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

/** Per-node-type dimensions so dagre accounts for actual rendered sizes */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  step: { width: 240, height: 110 },
  trigger: { width: 220, height: 90 },
  'control-flow': { width: 260, height: 130 },
  switch: { width: 280, height: 140 },
  parallel: { width: 280, height: 140 },
  output: { width: 200, height: 80 },
};

const DEFAULT_DIMENSIONS = { width: 240, height: 110 };

export interface DagreLayoutOptions {
  rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep?: number;
  ranksep?: number;
}

/**
 * Apply dagre auto-layout to a set of nodes and edges.
 * Returns a new array of nodes with updated positions.
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options?: DagreLayoutOptions
): Node[] {
  if (nodes.length === 0) return nodes;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: options?.rankdir ?? 'TB',
    nodesep: options?.nodesep ?? 80,
    ranksep: options?.ranksep ?? 100,
  });

  for (const node of nodes) {
    const dims = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIMENSIONS;
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  }

  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    const dims = NODE_DIMENSIONS[node.type ?? ''] ?? DEFAULT_DIMENSIONS;
    return {
      ...node,
      position: {
        x: pos.x - dims.width / 2,
        y: pos.y - dims.height / 2,
      },
    };
  });
}
