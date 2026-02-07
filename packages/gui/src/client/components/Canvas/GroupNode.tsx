import { memo, useState } from 'react';
import { type Node, type NodeProps, NodeResizer } from '@xyflow/react';
import { ChevronDown, ChevronRight, FolderOpen, Folder, Lock } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface GroupNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  color: 'default' | 'blue' | 'green' | 'red' | 'purple';
  collapsed: boolean;
  locked: boolean;
  childNodeIds: string[];
}

export type GroupNodeType = Node<GroupNodeData, 'group'>;

const groupColors: Record<GroupNodeData['color'], { bg: string; border: string; header: string }> = {
  default: { bg: 'bg-gray-500/5', border: 'border-gray-500/30', header: 'bg-gray-500/10' },
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', header: 'bg-blue-500/10' },
  green: { bg: 'bg-green-500/5', border: 'border-green-500/30', header: 'bg-green-500/10' },
  red: { bg: 'bg-red-500/5', border: 'border-red-500/30', header: 'bg-red-500/10' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/30', header: 'bg-purple-500/10' },
};

function GroupNodeComponent({ data, selected }: NodeProps<GroupNodeType>) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const color = data.color || 'default';
  const colors = groupColors[color];
  const collapsed = data.collapsed ?? false;
  const locked = data.locked ?? false;

  return (
    <>
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={200}
        minHeight={150}
        lineClassName="!border-primary"
        handleClassName="!bg-primary !border-primary !w-2 !h-2"
      />
      <div
        className={cn(
          'rounded-xl border-2 border-dashed transition-all',
          colors.bg,
          colors.border,
          selected && 'ring-2 ring-primary/30',
          collapsed ? 'min-w-[200px] min-h-[48px]' : 'min-w-[300px] min-h-[200px]'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-pointer',
            colors.header
          )}
        >
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-secondary" />
            )}
          </button>
          {collapsed ? (
            <Folder className="w-4 h-4 text-text-secondary" />
          ) : (
            <FolderOpen className="w-4 h-4 text-text-secondary" />
          )}
          {isEditingLabel ? (
            <input
              defaultValue={data.label || 'Group'}
              autoFocus
              onBlur={() => setIsEditingLabel(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingLabel(false); }}
              className="flex-1 bg-transparent text-sm font-medium text-text-primary focus:outline-none border-b border-primary"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={(e) => { e.stopPropagation(); if (!locked) setIsEditingLabel(true); }}
              className="flex-1 text-sm font-medium text-text-primary truncate"
            >
              {data.label || 'Group'}
            </span>
          )}
          {locked && <Lock className="w-3.5 h-3.5 text-warning" />}
          {data.childNodeIds && data.childNodeIds.length > 0 && (
            <span className="text-xs text-text-muted">
              {data.childNodeIds.length} nodes
            </span>
          )}
        </div>

        {/* Body placeholder - child nodes are positioned inside by React Flow */}
        {!collapsed && (
          <div className="p-4 min-h-[150px]">
            {(!data.childNodeIds || data.childNodeIds.length === 0) && (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Drag nodes here to group them
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
