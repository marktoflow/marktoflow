import { memo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useCanvas } from '../../hooks/useCanvas';

function CanvasToolbarComponent() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const { collapseAllGroups, expandAllGroups, nodes } = useCanvasStore();
  const { autoLayout } = useCanvas();

  // Check if there are any group nodes
  const hasGroups = nodes.some((n) => n.type === 'group');

  // Check if any groups are collapsed
  const hasCollapsedGroups = nodes.some(
    (n) => n.type === 'group' && n.data.collapsed
  );

  const handleZoomIn = () => {
    zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 300 });
  };

  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 300 });
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-node-bg/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 border-r border-border pr-2">
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-text-secondary" />
        </button>
        <span className="text-xs text-text-secondary font-mono min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* View controls */}
      <div className="flex items-center gap-1 border-r border-border pr-2">
        <button
          onClick={handleFitView}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Fit View"
        >
          <Maximize className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={autoLayout}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Auto Layout"
        >
          <LayoutGrid className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Group controls */}
      {hasGroups && (
        <div className="flex items-center gap-1">
          <button
            onClick={collapseAllGroups}
            className="p-2 hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Collapse All Groups"
            disabled={!hasCollapsedGroups}
          >
            <ChevronRight className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={expandAllGroups}
            className="p-2 hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Expand All Groups"
            disabled={hasCollapsedGroups === false}
          >
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      )}
    </div>
  );
}

export const CanvasToolbar = memo(CanvasToolbarComponent);
