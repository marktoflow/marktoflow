import { useCallback, useState, useRef, type DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeMouseHandler,
  type Node,
} from '@xyflow/react';
import { Edit, Copy, Trash2, Code, Play } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { StepNode } from './StepNode';
import { SubWorkflowNode } from './SubWorkflowNode';
import { TriggerNode } from './TriggerNode';
import { OutputNode } from './OutputNode';
import { StepEditor } from '../Editor/StepEditor';
import { YamlViewer } from '../Editor/YamlEditor';
import { Modal } from '../common/Modal';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '../common/ContextMenu';
import { useCanvas } from '../../hooks/useCanvas';
import { type ToolDefinition } from '../Sidebar/Sidebar';
import type { WorkflowStep } from '@shared/types';

// Custom node types
const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
  trigger: TriggerNode,
  output: OutputNode,
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setNodes } =
    useCanvasStore();
  const { autoLayout, deleteSelected, duplicateSelected } = useCanvas();
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const { screenToFlowPosition } = useReactFlow();

  // Editor state
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [yamlViewStep, setYamlViewStep] = useState<WorkflowStep | null>(null);
  const [isYamlViewOpen, setIsYamlViewOpen] = useState(false);

  // Context menu state
  const [contextMenuNode, setContextMenuNode] = useState<Node | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Handle node double-click to open editor or drill down
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();

      // Sub-workflow nodes handle their own double-click via the drill-down button
      // Don't open editor for special node types
      if (node.type === 'subworkflow' || node.type === 'trigger' || node.type === 'output') {
        return;
      }

      const step = currentWorkflow?.steps.find((s) => s.id === node.data.id);
      if (step) {
        setEditingStep(step);
        setIsEditorOpen(true);
      }
    },
    [currentWorkflow]
  );

  // Get the currently selected step node
  const getSelectedStep = useCallback((): WorkflowStep | null => {
    if (!currentWorkflow) return null;
    const selectedNode = nodes.find((n) => n.selected && n.type === 'step');
    if (!selectedNode) return null;
    return currentWorkflow.steps.find((s) => s.id === selectedNode.data.id) || null;
  }, [currentWorkflow, nodes]);

  // Get undo/redo and copy/paste functions from canvas store
  const { undo, redo, canUndo, canRedo, copySelected, paste, canPaste } = useCanvasStore();

  // Handle keyboard shortcuts
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;

      // Delete selected nodes
      if (event.key === 'Backspace' || event.key === 'Delete') {
        deleteSelected();
      }
      // Duplicate selected nodes
      if (isMeta && event.key === 'd') {
        event.preventDefault();
        duplicateSelected();
      }
      // Auto-layout
      if (isMeta && event.key === 'l') {
        event.preventDefault();
        autoLayout();
      }
      // Undo (Cmd/Ctrl + Z)
      if (isMeta && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo()) {
          undo();
        }
      }
      // Redo (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y)
      if ((isMeta && event.shiftKey && event.key === 'z') || (isMeta && event.key === 'y')) {
        event.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
      // Copy (Cmd/Ctrl + C)
      if (isMeta && event.key === 'c') {
        event.preventDefault();
        copySelected();
      }
      // Paste (Cmd/Ctrl + V)
      if (isMeta && event.key === 'v') {
        event.preventDefault();
        if (canPaste()) {
          paste();
        }
      }
      // Edit selected step (E key without modifiers)
      if (event.key === 'e' && !isMeta && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const step = getSelectedStep();
        if (step) {
          setEditingStep(step);
          setIsEditorOpen(true);
        }
      }
      // View YAML (Y key without modifiers)
      if (event.key === 'y' && !isMeta && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        const step = getSelectedStep();
        if (step) {
          setYamlViewStep(step);
          setIsYamlViewOpen(true);
        }
      }
    },
    [deleteSelected, duplicateSelected, autoLayout, getSelectedStep, undo, redo, canUndo, canRedo, copySelected, paste, canPaste]
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
      // Select the node first, then duplicate
      duplicateSelected();
    }
    setContextMenuNode(null);
  }, [contextMenuNode, duplicateSelected]);

  const handleContextDelete = useCallback(() => {
    if (contextMenuNode) {
      deleteSelected();
    }
    setContextMenuNode(null);
  }, [contextMenuNode, deleteSelected]);

  const handleContextExecute = useCallback(() => {
    if (contextMenuNode) {
      console.log('Execute step:', contextMenuNode.data.id);
      // TODO: Implement single step execution
    }
    setContextMenuNode(null);
  }, [contextMenuNode]);

  // Handle right-click on node
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // Only show context menu for step nodes
      if (node.type === 'step') {
        setContextMenuNode(node);
      }
    },
    []
  );

  // Handle drag over for drop target
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop from tools palette
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const toolData = event.dataTransfer.getData('application/marktoflow-tool');
      if (!toolData) return;

      try {
        const tool: ToolDefinition = JSON.parse(toolData);

        // Get the position where the node was dropped
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Create a new node
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

        // Add the node to the canvas
        setNodes([...nodes, newNode]);
      } catch (e) {
        console.error('Failed to parse dropped tool data:', e);
      }
    },
    [nodes, setNodes, screenToFlowPosition]
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={contextMenuRef}
          className="w-full h-full"
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDrop={onDrop}
          tabIndex={0}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
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
        </div>
      </ContextMenuTrigger>

      {/* Node Context Menu */}
      <ContextMenuContent>
        <ContextMenuItem onClick={handleContextEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Step
          <ContextMenuShortcut>E</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleContextViewYaml}>
          <Code className="w-4 h-4 mr-2" />
          View YAML
          <ContextMenuShortcut>Y</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleContextExecute}>
          <Play className="w-4 h-4 mr-2" />
          Execute Step
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleContextDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleContextDelete} destructive>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>

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
    </ContextMenu>
  );
}
