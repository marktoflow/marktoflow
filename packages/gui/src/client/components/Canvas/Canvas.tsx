import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { StepNode } from './StepNode';
import { SubWorkflowNode } from './SubWorkflowNode';
import { StepEditor } from '../Editor/StepEditor';
import { YamlViewer } from '../Editor/YamlEditor';
import { Modal } from '../common/Modal';
import { useCanvas } from '../../hooks/useCanvas';
import type { WorkflowStep } from '@shared/types';

// Custom node types
const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useCanvasStore();
  const { autoLayout, deleteSelected, duplicateSelected } = useCanvas();
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);

  // Editor state
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [yamlViewStep] = useState<WorkflowStep | null>(null);
  const [isYamlViewOpen, setIsYamlViewOpen] = useState(false);

  // Handle node double-click to open editor
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const step = currentWorkflow?.steps.find((s) => s.id === node.data.id);
      if (step) {
        setEditingStep(step);
        setIsEditorOpen(true);
      }
    },
    [currentWorkflow]
  );

  // Handle keyboard shortcuts
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Delete selected nodes
      if (event.key === 'Backspace' || event.key === 'Delete') {
        deleteSelected();
      }
      // Duplicate selected nodes
      if ((event.metaKey || event.ctrlKey) && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
      }
      // Auto-layout
      if ((event.metaKey || event.ctrlKey) && event.key === 'l') {
        event.preventDefault();
        autoLayout();
      }
    },
    [deleteSelected, duplicateSelected, autoLayout]
  );

  // Handle step save
  const handleStepSave = useCallback(
    (updatedStep: WorkflowStep) => {
      // TODO: Update workflow through store
      console.log('Saving step:', updatedStep);
      setIsEditorOpen(false);
      setEditingStep(null);
    },
    []
  );

  // Get available variables for the editing step
  const getAvailableVariables = useCallback((): string[] => {
    if (!currentWorkflow || !editingStep) return [];

    const variables: string[] = [];

    // Add input variables
    if (currentWorkflow.inputs) {
      for (const key of Object.keys(currentWorkflow.inputs)) {
        variables.push(`inputs.${key}`);
      }
    }

    // Add output variables from steps before the editing step
    const stepIndex = currentWorkflow.steps.findIndex(
      (s) => s.id === editingStep.id
    );
    for (let i = 0; i < stepIndex; i++) {
      const step = currentWorkflow.steps[i];
      if (step.outputVariable) {
        variables.push(step.outputVariable);
      }
    }

    return variables;
  }, [currentWorkflow, editingStep]);

  return (
    <div className="w-full h-full" onKeyDown={onKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#ff6d5a', strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
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

      {/* Step Editor Modal */}
      <StepEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        step={editingStep}
        onSave={handleStepSave}
        availableVariables={getAvailableVariables()}
      />

      {/* YAML Viewer Modal */}
      <Modal
        open={isYamlViewOpen}
        onOpenChange={setIsYamlViewOpen}
        title={`YAML: ${yamlViewStep?.name || yamlViewStep?.id}`}
        size="lg"
      >
        <div className="p-4">
          <YamlViewer value={yamlViewStep} />
        </div>
      </Modal>
    </div>
  );
}
