/**
 * Canvas interaction handlers extracted from Canvas.tsx.
 *
 * Manages node double-click, context menu, drag-over, and drop events.
 */

import { useCallback, useState, type DragEvent } from 'react';
import { useReactFlow, type NodeMouseHandler, type Node } from '@xyflow/react';
import { toast } from 'sonner';
import { useCanvasStore } from '../stores/canvasStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { useCanvas } from './useCanvas';
import { type ToolDefinition } from '../components/Sidebar/Sidebar';
import type { WorkflowStep } from '@shared/types';

const CONTROL_FLOW_TYPES = [
  'step', 'if', 'for_each', 'while', 'switch',
  'parallel', 'try', 'map', 'filter', 'reduce', 'subworkflow',
];

export interface CanvasInteractionState {
  editingStep: WorkflowStep | null;
  isEditorOpen: boolean;
  yamlViewStep: WorkflowStep | null;
  isYamlViewOpen: boolean;
  contextMenuNode: Node | null;
}

export function useCanvasInteractions() {
  const { nodes, setNodes, updateNodeData } = useCanvasStore();
  const { deleteSelected, duplicateSelected } = useCanvas();
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const selectedWorkflow = useWorkflowStore((s) => s.selectedWorkflow);
  const saveWorkflow = useWorkflowStore((s) => s.saveWorkflow);
  const { screenToFlowPosition } = useReactFlow();

  // Editor state
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [yamlViewStep, setYamlViewStep] = useState<WorkflowStep | null>(null);
  const [isYamlViewOpen, setIsYamlViewOpen] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState<Node | null>(null);

  // Double-click to open editor
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      if (node.type === 'trigger' || node.type === 'output') return;

      const step = currentWorkflow?.steps.find((s) => s.id === node.data.id);
      if (step) {
        setEditingStep(step);
        setIsEditorOpen(true);
      }
    },
    [currentWorkflow],
  );

  // Right-click context menu
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (CONTROL_FLOW_TYPES.includes(node.type || '')) {
        setContextMenuNode(node);
      }
    },
    [],
  );

  // Context menu handlers
  const handleContextEdit = useCallback(() => {
    if (!contextMenuNode || !currentWorkflow) return;
    const step = currentWorkflow.steps.find((s) => s.id === contextMenuNode.data.id);
    if (step) {
      setEditingStep(step);
      setIsEditorOpen(true);
    }
    setContextMenuNode(null);
  }, [contextMenuNode, currentWorkflow]);

  const handleContextViewYaml = useCallback(() => {
    if (!contextMenuNode || !currentWorkflow) return;
    const step = currentWorkflow.steps.find((s) => s.id === contextMenuNode.data.id);
    if (step) {
      setYamlViewStep(step);
      setIsYamlViewOpen(true);
    }
    setContextMenuNode(null);
  }, [contextMenuNode, currentWorkflow]);

  const handleContextDuplicate = useCallback(() => {
    if (contextMenuNode) {
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === contextMenuNode.id,
      }));
      setNodes(updatedNodes);
      setTimeout(() => duplicateSelected(), 0);
    }
    setContextMenuNode(null);
  }, [contextMenuNode, nodes, setNodes, duplicateSelected]);

  const handleContextDelete = useCallback(() => {
    if (contextMenuNode) {
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === contextMenuNode.id,
      }));
      setNodes(updatedNodes);
      setTimeout(() => deleteSelected(), 0);
    }
    setContextMenuNode(null);
  }, [contextMenuNode, nodes, setNodes, deleteSelected]);

  const handleContextExecute = useCallback(async () => {
    if (contextMenuNode && selectedWorkflow) {
      const stepId = contextMenuNode.data.id as string;
      try {
        updateNodeData(stepId, { status: 'running' });
        const response = await fetch(`/api/execute/${encodeURIComponent(selectedWorkflow)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: {}, stepId }),
        });
        if (!response.ok) {
          throw new Error('Execution failed');
        }
        const data = await response.json();
        updateNodeData(stepId, { status: data.status === 'started' ? 'running' : 'completed' });
        toast.success(`Step "${stepId}" execution started`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        toast.error(`Step execution failed: ${msg}`);
        updateNodeData(stepId, { status: 'failed' });
      }
    }
    setContextMenuNode(null);
  }, [contextMenuNode, selectedWorkflow, updateNodeData]);

  // Step save handler
  const handleStepSave = useCallback(
    (updatedStep: WorkflowStep) => {
      if (currentWorkflow) {
        const updatedSteps = currentWorkflow.steps.map((s) =>
          s.id === updatedStep.id ? updatedStep : s,
        );
        saveWorkflow({ ...currentWorkflow, steps: updatedSteps });
        updateNodeData(updatedStep.id, {
          name: updatedStep.name,
          action: updatedStep.action,
          inputs: updatedStep.inputs,
          outputVariable: updatedStep.outputVariable,
        });
      }
      setIsEditorOpen(false);
      setEditingStep(null);
    },
    [currentWorkflow, saveWorkflow, updateNodeData],
  );

  // Drag-over for drop target
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Drop from tools palette
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const toolData = event.dataTransfer.getData('application/marktoflow-tool');
      if (!toolData) return;

      try {
        const tool: ToolDefinition = JSON.parse(toolData);
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newId = tool.id + '-' + Date.now().toString(36);
        const newNode: Node = {
          id: newId,
          type: 'step',
          position,
          data: {
            id: newId,
            name: tool.name + ' Action',
            action: tool.id + '.' + (tool.actions?.[0] || 'action'),
            status: 'pending',
          },
        };

        setNodes([...nodes, newNode]);

        if (currentWorkflow) {
          const newStep: WorkflowStep = {
            id: newId,
            name: tool.name + ' Action',
            action: tool.id + '.' + (tool.actions?.[0] || 'action'),
            inputs: {},
          };
          saveWorkflow({
            ...currentWorkflow,
            steps: [...currentWorkflow.steps, newStep],
          });
        }

        toast.success(`Added "${tool.name}" step`);
      } catch (e) {
        toast.error('Failed to add step from drop');
      }
    },
    [nodes, setNodes, screenToFlowPosition, currentWorkflow, saveWorkflow],
  );

  // Available variables for step editor
  const getAvailableVariables = useCallback((): string[] => {
    if (!currentWorkflow || !editingStep) return [];
    const variables: string[] = [];

    if (currentWorkflow.inputs) {
      for (const key of Object.keys(currentWorkflow.inputs)) {
        variables.push(`inputs.${key}`);
      }
    }

    const stepIndex = currentWorkflow.steps.findIndex((s) => s.id === editingStep.id);
    for (let i = 0; i < stepIndex; i++) {
      const step = currentWorkflow.steps[i];
      if (step.outputVariable) {
        variables.push(step.outputVariable);
      }
    }

    return variables;
  }, [currentWorkflow, editingStep]);

  // Open editor for a given step (used by keyboard shortcuts)
  const openEditor = useCallback((step: WorkflowStep) => {
    setEditingStep(step);
    setIsEditorOpen(true);
  }, []);

  const openYamlView = useCallback((step: WorkflowStep) => {
    setYamlViewStep(step);
    setIsYamlViewOpen(true);
  }, []);

  return {
    // State
    editingStep,
    isEditorOpen,
    setIsEditorOpen,
    yamlViewStep,
    isYamlViewOpen,
    setIsYamlViewOpen,
    contextMenuNode,
    // Event handlers
    onNodeDoubleClick,
    onNodeContextMenu,
    onDragOver,
    onDrop,
    // Context menu actions
    handleContextEdit,
    handleContextViewYaml,
    handleContextDuplicate,
    handleContextDelete,
    handleContextExecute,
    // Step editor
    handleStepSave,
    getAvailableVariables,
    // Direct open (for keyboard shortcuts)
    openEditor,
    openYamlView,
  };
}
