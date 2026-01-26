import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

export interface TryCatchNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  hasCatch?: boolean;
  hasFinally?: boolean;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranch?: 'try' | 'catch' | 'finally' | null;
  errorOccurred?: boolean;
}

export type TryCatchNodeType = Node<TryCatchNodeData, 'try'>;

function TryCatchNodeComponent({ data, selected }: NodeProps<TryCatchNodeType>) {
  const statusConfig: Record<
    NonNullable<TryCatchNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: Shield,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
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
      className={`control-flow-node try-catch-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
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
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || 'Try/Catch'}
          </div>
          <div className="text-xs text-white/70">Error Handling</div>
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
        {/* Error indicator */}
        {data.errorOccurred && (
          <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-200" />
            <span className="text-xs text-red-200 font-medium">Error occurred</span>
          </div>
        )}

        {/* Branch indicators */}
        <div className="space-y-2">
          <div
            className={`text-center p-2 rounded text-xs font-medium transition-colors ${
              data.activeBranch === 'try'
                ? 'bg-blue-500/30 text-blue-200 ring-1 ring-blue-400/50'
                : 'bg-white/5 text-white/60'
            }`}
          >
            ✓ Try
          </div>

          {data.hasCatch && (
            <div
              className={`text-center p-2 rounded text-xs font-medium transition-colors ${
                data.activeBranch === 'catch'
                  ? 'bg-red-500/30 text-red-200 ring-1 ring-red-400/50'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              ⚠ Catch
            </div>
          )}

          {data.hasFinally && (
            <div
              className={`text-center p-2 rounded text-xs font-medium transition-colors ${
                data.activeBranch === 'finally'
                  ? 'bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              ⟳ Finally
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-3 text-xs text-white/50 flex items-center gap-2">
          <span>ℹ️</span>
          <span>Finally always executes</span>
        </div>
      </div>

      {/* Output handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="try"
        style={{ left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-node-bg"
      />
      {data.hasCatch && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="catch"
          style={{ left: '50%' }}
          className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-node-bg"
        />
      )}
      {data.hasFinally && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="finally"
          style={{ left: '75%' }}
          className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-node-bg"
        />
      )}
    </div>
  );
}

export const TryCatchNode = memo(TryCatchNodeComponent);
