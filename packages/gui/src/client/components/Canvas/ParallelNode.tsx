import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Layers, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface ParallelNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  branches: Array<{ id: string; name?: string }>;
  maxConcurrent?: number;
  onError?: 'stop' | 'continue';
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranches?: string[];
  completedBranches?: string[];
}

export type ParallelNodeType = Node<ParallelNodeData, 'parallel'>;

function ParallelNodeComponent({ data, selected }: NodeProps<ParallelNodeType>) {
  const statusConfig: Record<
    NonNullable<ParallelNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: Layers,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
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
      className={`control-flow-node parallel-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
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
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || 'Parallel'}
          </div>
          <div className="text-xs text-white/70">Concurrent Execution</div>
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
        <div className="text-xs text-white/90 mb-3">
          <span className="text-white/60">Branches:</span>{' '}
          <span className="font-medium">{data.branches?.length || 0}</span>
          {data.maxConcurrent && (
            <>
              {' '}
              <span className="text-white/60">• Max Concurrent:</span>{' '}
              <span className="font-medium">{data.maxConcurrent}</span>
            </>
          )}
        </div>

        {/* Branch indicators */}
        <div className="flex flex-wrap gap-2 mb-3">
          {data.branches?.slice(0, 6).map((branch) => {
            const isActive = data.activeBranches?.includes(branch.id);
            const isCompleted = data.completedBranches?.includes(branch.id);
            return (
              <div
                key={branch.id}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-green-500/30 text-green-200'
                    : isActive
                      ? 'bg-blue-500/30 text-blue-200 animate-pulse'
                      : 'bg-white/10 text-white/60'
                }`}
                title={branch.name || branch.id}
              >
                {branch.name || `B${branch.id.slice(-2)}`}
              </div>
            );
          })}
          {data.branches && data.branches.length > 6 && (
            <div className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/60">
              +{data.branches.length - 6}
            </div>
          )}
        </div>

        {/* Error handling */}
        <div className="text-xs text-white/50 flex items-center gap-1">
          <span>On Error:</span>
          <span className="font-medium">{data.onError || 'stop'}</span>
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

export const ParallelNode = memo(ParallelNodeComponent);
