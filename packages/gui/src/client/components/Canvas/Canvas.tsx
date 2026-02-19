import { useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import { Edit, Copy, Trash2, Code, Play, Plus, FolderOpen, AlertTriangle } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { getModKey } from '../../utils/platform';
import { StepNode } from './StepNode';
import { SubWorkflowNode } from './SubWorkflowNode';
import { TriggerNode } from './TriggerNode';
import { OutputNode } from './OutputNode';
import { IfElseNode } from './IfElseNode';
import { ForEachNode } from './ForEachNode';
import { WhileNode } from './WhileNode';
import { SwitchNode } from './SwitchNode';
import { ParallelNode } from './ParallelNode';
import { TryCatchNode } from './TryCatchNode';
import { TransformNode } from './TransformNode';
import { StickyNoteNode } from './StickyNoteNode';
import { GroupNode } from './GroupNode';
import { StepEditor } from '../Editor/StepEditor';
import { YamlViewer } from '../Editor/YamlEditor';
import { Modal } from '../common/Modal';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../common/ContextMenu';
import { useCanvasInteractions } from '../../hooks/useCanvasInteractions';
import { useCanvasShortcuts } from '../../hooks/useCanvasShortcuts';

// Custom node types
const nodeTypes = {
  step: StepNode,
  subworkflow: SubWorkflowNode,
  trigger: TriggerNode,
  output: OutputNode,
  if: IfElseNode,
  for_each: ForEachNode,
  while: WhileNode,
  switch: SwitchNode,
  parallel: ParallelNode,
  try: TryCatchNode,
  map: TransformNode,
  filter: TransformNode,
  reduce: TransformNode,
  sticky: StickyNoteNode,
  group: GroupNode,
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore();
  const modKey = getModKey();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Extracted interaction logic
  const {
    editingStep,
    isEditorOpen,
    setIsEditorOpen,
    yamlViewStep,
    isYamlViewOpen,
    setIsYamlViewOpen,
    onNodeDoubleClick,
    onNodeContextMenu,
    onDragOver,
    onDrop,
    contextMenuNode,
    handleContextEdit,
    handleContextViewYaml,
    handleContextDuplicate,
    handleContextDelete,
    handleContextExecute,
    handleContextAddStepBefore,
    handleContextAddStepAfter,
    handleContextConvertToSubworkflow,
    handleContextViewError,
    handleStepSave,
    getAvailableVariables,
    openEditor,
    openYamlView,
  } = useCanvasInteractions();

  // Extracted keyboard shortcuts
  const { onKeyDown } = useCanvasShortcuts({
    onEditStep: openEditor,
    onViewYaml: openYamlView,
  });

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
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus className="w-4 h-4 mr-2" />
            Add Step
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={handleContextAddStepBefore}>
              Before this step
            </ContextMenuItem>
            <ContextMenuItem onClick={handleContextAddStepAfter}>
              After this step
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={handleContextConvertToSubworkflow}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Convert to Sub-workflow
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleContextExecute}>
          <Play className="w-4 h-4 mr-2" />
          Execute from here
        </ContextMenuItem>
        {contextMenuNode?.data?.status === 'failed' && (
          <ContextMenuItem onClick={handleContextViewError}>
            <AlertTriangle className="w-4 h-4 mr-2 text-error" />
            View Error Details
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleContextDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
          <ContextMenuShortcut>{modKey}D</ContextMenuShortcut>
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
