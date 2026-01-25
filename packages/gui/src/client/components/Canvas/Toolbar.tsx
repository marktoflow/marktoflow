import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Layout,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  Undo,
  Redo,
  Copy,
  Trash2,
  Settings,
} from 'lucide-react';
import { Button } from '../common/Button';
import { useCanvas } from '../../hooks/useCanvas';
import { useEditorStore } from '../../stores/editorStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useReactFlow } from '@xyflow/react';

interface ToolbarProps {
  onAddStep: () => void;
  onExecute?: () => void;
  onSave?: () => void;
  isExecuting?: boolean;
}

export function Toolbar({
  onAddStep,
  onExecute,
  onSave,
  isExecuting = false,
}: ToolbarProps) {
  const { autoLayout, fitView, selectedNodes, deleteSelected, duplicateSelected } =
    useCanvas();
  const { undo, redo, undoStack, redoStack } = useEditorStore();
  const { currentWorkflow } = useWorkflowStore();
  const { zoomIn, zoomOut } = useReactFlow();

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const hasSelection = selectedNodes.length > 0;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 bg-panel-bg/95 backdrop-blur border border-node-border rounded-lg shadow-lg">
      {/* Add Step */}
      <ToolbarButton
        icon={<Plus className="w-4 h-4" />}
        label="Add Step"
        onClick={onAddStep}
        shortcut="N"
      />

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        icon={<Undo className="w-4 h-4" />}
        label="Undo"
        onClick={() => undo()}
        disabled={!canUndo}
        shortcut="⌘Z"
      />
      <ToolbarButton
        icon={<Redo className="w-4 h-4" />}
        label="Redo"
        onClick={() => redo()}
        disabled={!canRedo}
        shortcut="⌘⇧Z"
      />

      <ToolbarDivider />

      {/* Selection actions */}
      <ToolbarButton
        icon={<Copy className="w-4 h-4" />}
        label="Duplicate"
        onClick={duplicateSelected}
        disabled={!hasSelection}
        shortcut="⌘D"
      />
      <ToolbarButton
        icon={<Trash2 className="w-4 h-4" />}
        label="Delete"
        onClick={deleteSelected}
        disabled={!hasSelection}
        shortcut="⌫"
      />

      <ToolbarDivider />

      {/* Layout & Zoom */}
      <ToolbarButton
        icon={<Layout className="w-4 h-4" />}
        label="Auto Layout"
        onClick={autoLayout}
        shortcut="⌘L"
      />
      <ToolbarButton
        icon={<ZoomIn className="w-4 h-4" />}
        label="Zoom In"
        onClick={() => zoomIn()}
        shortcut="⌘+"
      />
      <ToolbarButton
        icon={<ZoomOut className="w-4 h-4" />}
        label="Zoom Out"
        onClick={() => zoomOut()}
        shortcut="⌘-"
      />
      <ToolbarButton
        icon={<Maximize className="w-4 h-4" />}
        label="Fit View"
        onClick={fitView}
        shortcut="⌘0"
      />

      <ToolbarDivider />

      {/* Execute */}
      {onExecute && (
        <ToolbarButton
          icon={
            isExecuting ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )
          }
          label={isExecuting ? 'Stop' : 'Execute'}
          onClick={onExecute}
          variant={isExecuting ? 'destructive' : 'primary'}
          shortcut="⌘⏎"
        />
      )}

      {/* Save */}
      {onSave && (
        <ToolbarButton
          icon={<Save className="w-4 h-4" />}
          label="Save"
          onClick={onSave}
          shortcut="⌘S"
        />
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  variant?: 'default' | 'primary' | 'destructive';
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  shortcut,
  variant = 'default',
}: ToolbarButtonProps) {
  const variantClasses = {
    default: 'text-gray-300 hover:text-white hover:bg-white/10',
    primary: 'text-primary hover:text-primary-light hover:bg-primary/10',
    destructive: 'text-error hover:text-error hover:bg-error/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative group p-2 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]}`}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      {/* Tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/90 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {label}
        {shortcut && <span className="ml-2 text-gray-400">{shortcut}</span>}
      </div>
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-node-border mx-1" />;
}
