import { memo, useState, useEffect } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';

export interface GroupContainerNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  branchType: 'then' | 'else' | 'try' | 'catch' | 'finally' | 'case' | 'default' | 'branch' | 'iteration';
  parentId: string;
  stepCount: number;
  collapsed?: boolean;
}

export type GroupContainerNodeType = Node<GroupContainerNodeData, 'group'>;

// Branch colors for visual distinction
const BRANCH_COLORS = {
  then: '#10b981',      // green
  else: '#ef4444',      // red
  try: '#3b82f6',       // blue
  catch: '#f59e0b',     // orange
  finally: '#8b5cf6',   // purple
  case: '#06b6d4',      // cyan
  default: '#64748b',   // slate
  branch: '#06b6d4',    // cyan
  iteration: '#a855f7', // purple
} as const;

function GroupContainerNodeComponent({ data, selected, id }: NodeProps<GroupContainerNodeType>) {
  const toggleGroupCollapsed = useCanvasStore(state => state.toggleGroupCollapsed);
  const groupCollapsedState = useCanvasStore(state => state.groupCollapsedState);
  const [collapsed, setCollapsed] = useState(data.collapsed || false);
  const color = BRANCH_COLORS[data.branchType];

  // Sync with store state
  useEffect(() => {
    if (groupCollapsedState[id] !== undefined) {
      setCollapsed(groupCollapsedState[id]);
    }
  }, [groupCollapsedState, id]);

  const handleToggle = () => {
    toggleGroupCollapsed(id);
  };

  return (
    <div
      className={`group-container group-container-node ${collapsed ? 'collapsed' : 'expanded'} ${selected ? 'selected' : ''}`}
      style={{
        border: `2px solid ${color}`,
        borderRadius: '12px',
        background: 'rgba(26, 26, 46, 0.5)',
        backdropFilter: 'blur(8px)',
        minWidth: '280px',
        minHeight: collapsed ? '60px' : '100px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !border-2 !border-node-bg"
        style={{ background: color }}
      />

      {/* Group header */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer select-none"
        onClick={handleToggle}
        style={{
          borderBottom: collapsed ? 'none' : `1px solid ${color}40`,
        }}
      >
        <button
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
          style={{ color }}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Package className="w-4 h-4" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white/90">
            {data.label}
          </div>
        </div>

        {collapsed && (
          <div
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {data.stepCount} step{data.stepCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Group body - shown when expanded */}
      {!collapsed && (
        <div className="p-2 min-h-[40px]">
          {/* Child nodes will be positioned here via ReactFlow parent-child relationships */}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !border-2 !border-node-bg"
        style={{ background: color }}
      />
    </div>
  );
}

export const GroupContainerNode = memo(GroupContainerNodeComponent);
