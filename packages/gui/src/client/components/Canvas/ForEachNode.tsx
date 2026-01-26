import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Repeat, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface ForEachNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  items: string;
  itemVariable?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  currentIteration?: number;
  totalIterations?: number;
}

export type ForEachNodeType = Node<ForEachNodeData, 'for_each'>;

function ForEachNodeComponent({ data, selected }: NodeProps<ForEachNodeType>) {
  const statusConfig: Record<
    NonNullable<ForEachNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: Repeat,
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10',
      animate: true,
    },
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    failed: { icon: XCircle, color: 'text-error', bgColor: 'bg-error/10' },
    skipped: {
      icon: XCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
    },
  };

  const status = data.status || 'pending';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`control-flow-node for-each-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      }}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-node-bg"
      />

      {/* Node header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/20">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Repeat className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || 'For Each'}
          </div>
          <div className="text-xs text-white/70">Loop</div>
        </div>
        <div
          className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center`}
        >
          <StatusIcon
            className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-pulse' : ''}`}
          />
        </div>
      </div>

      {/* Node body */}
      <div className="p-3 bg-white/10">
        <div className="text-xs text-white/90 mb-2">
          <span className="text-white/60">Items:</span>{' '}
          <span className="font-mono">{data.items || 'Not set'}</span>
        </div>
        <div className="text-xs text-white/90 mb-3">
          <span className="text-white/60">Variable:</span>{' '}
          <span className="font-mono">{data.itemVariable || 'item'}</span>
        </div>

        {/* Iteration progress */}
        {data.totalIterations !== undefined && (
          <div className="mt-2 p-2 bg-white/5 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/70">Progress</span>
              <span className="text-xs text-white font-medium">
                {data.currentIteration || 0} / {data.totalIterations}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className="bg-orange-400 h-1.5 rounded-full transition-all"
                style={{
                  width: `${((data.currentIteration || 0) / data.totalIterations) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Loop metadata */}
        <div className="mt-3 text-xs text-white/50 flex items-center gap-2">
          <span>ℹ️</span>
          <span>Access: loop.index, loop.first, loop.last</span>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-node-bg"
      />
    </div>
  );
}

export const ForEachNode = memo(ForEachNodeComponent);
