import { memo, useCallback } from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  GripHorizontal,
  GripVertical,
} from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { Node } from '@xyflow/react';
import { cn } from '../../utils/cn';

interface AlignmentToolsProps {
  className?: string;
}

function AlignmentToolsComponent({ className }: AlignmentToolsProps) {
  const { nodes, setNodes, saveCheckpoint } = useCanvasStore();
  const selectedNodes = nodes.filter((n) => n.selected);
  const hasSelection = selectedNodes.length >= 2;

  const alignNodes = useCallback(
    (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
      if (selectedNodes.length < 2) return;
      saveCheckpoint();

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const bounds = getSelectionBounds(selectedNodes);

      const updatedNodes = nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;

        let newPosition = { ...node.position };
        const width = node.measured?.width || node.width || 200;
        const height = node.measured?.height || node.height || 80;

        switch (alignment) {
          case 'left':
            newPosition.x = bounds.minX;
            break;
          case 'center-h':
            newPosition.x = bounds.minX + (bounds.maxX - bounds.minX) / 2 - width / 2;
            break;
          case 'right':
            newPosition.x = bounds.maxX - width;
            break;
          case 'top':
            newPosition.y = bounds.minY;
            break;
          case 'center-v':
            newPosition.y = bounds.minY + (bounds.maxY - bounds.minY) / 2 - height / 2;
            break;
          case 'bottom':
            newPosition.y = bounds.maxY - height;
            break;
        }

        return { ...node, position: newPosition };
      });

      setNodes(updatedNodes);
    },
    [nodes, selectedNodes, setNodes, saveCheckpoint]
  );

  const distributeNodes = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (selectedNodes.length < 3) return;
      saveCheckpoint();

      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const sorted = [...selectedNodes].sort((a, b) =>
        direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
      );

      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const totalSpace =
        direction === 'horizontal'
          ? last.position.x - first.position.x
          : last.position.y - first.position.y;

      const gap = totalSpace / (sorted.length - 1);

      const positionMap = new Map<string, { x: number; y: number }>();
      sorted.forEach((node, index) => {
        const pos = { ...node.position };
        if (direction === 'horizontal') {
          pos.x = first.position.x + gap * index;
        } else {
          pos.y = first.position.y + gap * index;
        }
        positionMap.set(node.id, pos);
      });

      const updatedNodes = nodes.map((node) => {
        if (!selectedIds.has(node.id)) return node;
        const newPos = positionMap.get(node.id);
        return newPos ? { ...node, position: newPos } : node;
      });

      setNodes(updatedNodes);
    },
    [nodes, selectedNodes, setNodes, saveCheckpoint]
  );

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <AlignButton
        icon={<AlignStartVertical className="w-4 h-4" />}
        label="Align Left"
        onClick={() => alignNodes('left')}
        disabled={!hasSelection}
      />
      <AlignButton
        icon={<AlignCenterVertical className="w-4 h-4" />}
        label="Align Center Horizontally"
        onClick={() => alignNodes('center-h')}
        disabled={!hasSelection}
      />
      <AlignButton
        icon={<AlignEndVertical className="w-4 h-4" />}
        label="Align Right"
        onClick={() => alignNodes('right')}
        disabled={!hasSelection}
      />
      <div className="w-px h-5 bg-border-default mx-0.5" />
      <AlignButton
        icon={<AlignStartHorizontal className="w-4 h-4" />}
        label="Align Top"
        onClick={() => alignNodes('top')}
        disabled={!hasSelection}
      />
      <AlignButton
        icon={<AlignCenterHorizontal className="w-4 h-4" />}
        label="Align Center Vertically"
        onClick={() => alignNodes('center-v')}
        disabled={!hasSelection}
      />
      <AlignButton
        icon={<AlignEndHorizontal className="w-4 h-4" />}
        label="Align Bottom"
        onClick={() => alignNodes('bottom')}
        disabled={!hasSelection}
      />
      <div className="w-px h-5 bg-border-default mx-0.5" />
      <AlignButton
        icon={<GripHorizontal className="w-4 h-4" />}
        label="Distribute Horizontally"
        onClick={() => distributeNodes('horizontal')}
        disabled={selectedNodes.length < 3}
      />
      <AlignButton
        icon={<GripVertical className="w-4 h-4" />}
        label="Distribute Vertically"
        onClick={() => distributeNodes('vertical')}
        disabled={selectedNodes.length < 3}
      />
    </div>
  );
}

function AlignButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      title={label}
    >
      {icon}
    </button>
  );
}

function getSelectionBounds(nodes: Node[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const w = node.measured?.width || node.width || 200;
    const h = node.measured?.height || node.height || 80;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }
  return { minX, minY, maxX, maxY };
}

export const AlignmentTools = memo(AlignmentToolsComponent);
