import { useState, useEffect, useRef, useCallback } from 'react';
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
  CheckCircle,
  GripVertical,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCanvas } from '../../hooks/useCanvas';
import { useEditorStore } from '../../stores/editorStore';
import { useReactFlow } from '@xyflow/react';
import { getModKey } from '../../utils/platform';
import { useAgentStore } from '../../stores/agentStore';
import { ProviderSwitcher } from '../Settings/ProviderSwitcher';
import { AlignmentTools } from './AlignmentTools';
import { useLayoutStore } from '../../stores/layoutStore';

interface ToolbarProps {
  onAddStep: () => void;
  onExecute?: () => void;
  onSave?: () => void;
  onValidate?: () => void;
  isExecuting?: boolean;
}

export function Toolbar({
  onAddStep,
  onExecute,
  onSave,
  onValidate,
  isExecuting = false,
}: ToolbarProps) {
  const { t } = useTranslation('gui');
  const { autoLayout, fitView, selectedNodes, deleteSelected, duplicateSelected } =
    useCanvas();
  const { undo, redo, undoStack, redoStack } = useEditorStore();
  const { zoomIn, zoomOut } = useReactFlow();
  const modKey = getModKey();
  const { providers, activeProviderId, loadProviders } = useAgentStore();
  const [showProviderSwitcher, setShowProviderSwitcher] = useState(false);
  const { toolbarVisible, toolbarPosition, setToolbarPosition, setToolbarVisible } = useLayoutStore();

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const hasSelection = selectedNodes.length > 0;

  // Drag state
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!toolbarRef.current) return;
    isDragging.current = true;
    const rect = toolbarRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const x = e.clientX - dragOffset.current.x;
    const y = e.clientY - dragOffset.current.y;
    setToolbarPosition({ x, y });
  }, [setToolbarPosition]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  if (!toolbarVisible) return null;

  // Determine positioning style
  const isDefaultPosition = toolbarPosition.x === 0 && toolbarPosition.y === 0;
  const positionStyle: React.CSSProperties = isDefaultPosition
    ? {}
    : { left: toolbarPosition.x, top: toolbarPosition.y, transform: 'none' };
  const positionClass = isDefaultPosition
    ? 'absolute top-4 left-1/2 -translate-x-1/2'
    : 'fixed';

  return (
    <div
      ref={toolbarRef}
      className={`${positionClass} z-10 flex items-center gap-1 px-2 py-1.5 bg-bg-panel/95 backdrop-blur border border-border-default rounded-lg shadow-lg`}
      style={positionStyle}
    >
      {/* Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-bg-hover text-text-muted"
        title={t('gui:toolbar.dragToReposition')}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <ToolbarDivider />

      {/* Add Step */}
      <ToolbarButton
        icon={<Plus className="w-4 h-4" />}
        label={t('gui:toolbar.addStep')}
        onClick={onAddStep}
        shortcut="N"
      />

      <ToolbarDivider />

      {/* Undo/Redo */}
      <ToolbarButton
        icon={<Undo className="w-4 h-4" />}
        label={t('gui:toolbar.undo')}
        onClick={() => undo()}
        disabled={!canUndo}
        shortcut={`${modKey}Z`}
      />
      <ToolbarButton
        icon={<Redo className="w-4 h-4" />}
        label={t('gui:toolbar.redo')}
        onClick={() => redo()}
        disabled={!canRedo}
        shortcut={`${modKey}⇧Z`}
      />

      <ToolbarDivider />

      {/* Selection actions */}
      <ToolbarButton
        icon={<Copy className="w-4 h-4" />}
        label={t('gui:toolbar.duplicate')}
        onClick={duplicateSelected}
        disabled={!hasSelection}
        shortcut={`${modKey}D`}
      />
      <ToolbarButton
        icon={<Trash2 className="w-4 h-4" />}
        label={t('gui:toolbar.delete')}
        onClick={deleteSelected}
        disabled={!hasSelection}
        shortcut="⌫"
      />

      <ToolbarDivider />

      {/* Alignment Tools */}
      <AlignmentTools />

      <ToolbarDivider />

      {/* Layout & Zoom */}
      <ToolbarButton
        icon={<Layout className="w-4 h-4" />}
        label={t('gui:toolbar.autoLayout')}
        onClick={autoLayout}
        shortcut={`${modKey}L`}
      />
      <ToolbarButton
        icon={<ZoomIn className="w-4 h-4" />}
        label={t('gui:toolbar.zoomIn')}
        onClick={() => zoomIn()}
        shortcut={`${modKey}+`}
      />
      <ToolbarButton
        icon={<ZoomOut className="w-4 h-4" />}
        label={t('gui:toolbar.zoomOut')}
        onClick={() => zoomOut()}
        shortcut={`${modKey}-`}
      />
      <ToolbarButton
        icon={<Maximize className="w-4 h-4" />}
        label={t('gui:toolbar.fitView')}
        onClick={fitView}
        shortcut={`${modKey}0`}
      />

      <ToolbarDivider />

      {/* AI Provider */}
      <button
        onClick={() => setShowProviderSwitcher(true)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        title={t('gui:toolbar.selectAIProvider')}
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">
          {activeProvider?.name || t('gui:toolbar.noProvider')}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      <ToolbarDivider />

      {/* Validate */}
      {onValidate && (
        <ToolbarButton
          icon={<CheckCircle className="w-4 h-4" />}
          label={t('gui:toolbar.validate')}
          onClick={onValidate}
          shortcut={`${modKey}T`}
        />
      )}

      {/* Execute */}
      {onExecute && (
        <button
          onClick={() => onExecute()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isExecuting
              ? 'bg-error hover:bg-error/90 text-text-inverse'
              : 'bg-accent hover:bg-accent-hover text-text-inverse'
          }`}
          title={`${isExecuting ? t('gui:toolbar.stop') : t('gui:toolbar.execute')} (${modKey}⏎)`}
        >
          {isExecuting ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{isExecuting ? t('gui:toolbar.stop') : t('gui:toolbar.execute')}</span>
        </button>
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

      <ToolbarDivider />

      {/* Hide Toolbar */}
      <button
        onClick={() => setToolbarVisible(false)}
        className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors"
        title={t('gui:toolbar.hideToolbar')}
      >
        <X className="w-3.5 h-3.5" />
      </button>

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
    default: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
    primary: 'text-accent hover:text-accent-hover hover:bg-accent-muted',
    destructive: 'text-error hover:text-error hover:bg-error-bg',
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
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-bg-elevated border border-border-default rounded text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-tooltip shadow-lg">
        {label}
        {shortcut && <span className="ml-2 text-text-muted">{shortcut}</span>}
      </div>
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border-default mx-1" />;
}
