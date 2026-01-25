import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { useCanvasStore } from '../../stores/canvasStore';
import { StepNode } from './StepNode';
import { SubWorkflowNode } from './SubWorkflowNode';

// Custom node types
const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useCanvasStore();

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#ff6d5a', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#3d3d5c"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.data?.status) {
              case 'running':
                return '#f0ad4e';
              case 'completed':
                return '#5cb85c';
              case 'failed':
                return '#d9534f';
              default:
                return '#2d2d4a';
            }
          }}
          maskColor="rgba(26, 26, 46, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
