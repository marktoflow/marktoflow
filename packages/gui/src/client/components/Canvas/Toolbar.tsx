import { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  Pause,
  Layout,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  Undo,
  Redo,
  Copy,
  Trash2,
  Bot,
  ChevronDown,
} from 'lucide-react';
import { useCanvas } from '../../hooks/useCanvas';
import { useEditorStore } from '../../stores/editorStore';
import { useReactFlow } from '@xyflow/react';
import { getModKey } from '../../utils/platform';
import { useAgentStore } from '../../stores/agentStore';
import { ProviderSwitcher } from '../Settings/ProviderSwitcher';

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
  const { zoomIn, zoomOut } = useReactFlow();
  const modKey = getModKey();
  const { providers, activeProviderId, loadProviders } = useAgentStore();
  const [showProviderSwitcher, setShowProviderSwitcher] = useState(false);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const hasSelection = selectedNodes.length > 0;

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

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
        shortcut={`${modKey}Z`}
      />
      <ToolbarButton
        icon={<Redo className="w-4 h-4" />}
        label="Redo"
        onClick={() => redo()}
        disabled={!canRedo}
        shortcut={`${modKey}⇧Z`}
      />

      <ToolbarDivider />

      {/* Selection actions */}
      <ToolbarButton
        icon={<Copy className="w-4 h-4" />}
        label="Duplicate"
        onClick={duplicateSelected}
        disabled={!hasSelection}
        shortcut={`${modKey}D`}
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
        shortcut={`${modKey}L`}
      />
      <ToolbarButton
        icon={<ZoomIn className="w-4 h-4" />}
        label="Zoom In"
        onClick={() => zoomIn()}
        shortcut={`${modKey}+`}
      />
      <ToolbarButton
        icon={<ZoomOut className="w-4 h-4" />}
        label="Zoom Out"
        onClick={() => zoomOut()}
        shortcut={`${modKey}-`}
      />
      <ToolbarButton
        icon={<Maximize className="w-4 h-4" />}
        label="Fit View"
        onClick={fitView}
        shortcut={`${modKey}0`}
      />

      <ToolbarDivider />

      {/* AI Provider */}
      <button
        onClick={() => setShowProviderSwitcher(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
        title="Select AI Provider"
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">
          {activeProvider?.name || 'No Provider'}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Execute */}
      {onExecute && (
        <>
          <ToolbarDivider />
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
            shortcut={`${modKey}⏎`}
          />
        </>
      )}

      {/* Save */}
      {onSave && (
        <ToolbarButton
          icon={<Save className="w-4 h-4" />}
          label="Save"
          onClick={onSave}
          shortcut={`${modKey}S`}
        />
      )}

      {/* Provider Switcher Modal */}
      <ProviderSwitcher
        open={showProviderSwitcher}
        onOpenChange={setShowProviderSwitcher}
      />
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
