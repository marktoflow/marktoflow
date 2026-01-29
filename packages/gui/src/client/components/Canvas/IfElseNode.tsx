import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { GitBranch, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface IfElseNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  condition: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeBranch?: 'then' | 'else' | null;
  skippedBranch?: 'then' | 'else' | null;
  thenSteps?: unknown[];
  elseSteps?: unknown[];
  thenCollapsed?: boolean;
  elseCollapsed?: boolean;
}

export type IfElseNodeType = Node<IfElseNodeData, 'if'>;

function IfElseNodeComponent({ data, selected }: NodeProps<IfElseNodeType>) {
  const statusConfig: Record<
    NonNullable<IfElseNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: GitBranch,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
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
      className={`control-flow-node if-else-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running running-control-flow' : ''} ${status === 'completed' ? 'completed step-completed' : ''} ${status === 'failed' ? 'failed step-failed' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
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
          <GitBranch className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || 'If/Else'}
          </div>
          <div className="text-xs text-white/70">Conditional</div>
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
        <div className="text-xs text-white/90 font-mono mb-3">
          {data.condition || 'No condition set'}
        </div>

        {/* Branch outputs */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className={`text-center p-2 rounded text-xs font-medium transition-colors relative ${
              data.activeBranch === 'then'
                ? 'bg-green-500/30 text-green-200 ring-1 ring-green-400/50 active-branch'
                : data.skippedBranch === 'then'
                  ? 'bg-gray-500/20 text-gray-400 branch-skipped'
                  : 'bg-white/5 text-white/60'
            }`}
          >
            <div>✓ Then</div>
            {data.thenSteps && data.thenSteps.length > 0 && (
              <div className="text-[9px] mt-0.5 opacity-70">
                {data.thenSteps.length} step{data.thenSteps.length !== 1 ? 's' : ''}
              </div>
            )}
            {data.skippedBranch === 'then' && (
              <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0.5 rounded bg-gray-500/50 text-gray-300">
                SKIP
              </span>
            )}
          </div>
          <div
            className={`text-center p-2 rounded text-xs font-medium transition-colors relative ${
              data.activeBranch === 'else'
                ? 'bg-red-500/30 text-red-200 ring-1 ring-red-400/50 active-branch'
                : data.skippedBranch === 'else'
                  ? 'bg-gray-500/20 text-gray-400 branch-skipped'
                  : 'bg-white/5 text-white/60'
            }`}
          >
            <div>✗ Else</div>
            {data.elseSteps && data.elseSteps.length > 0 && (
              <div className="text-[9px] mt-0.5 opacity-70">
                {data.elseSteps.length} step{data.elseSteps.length !== 1 ? 's' : ''}
              </div>
            )}
            {data.skippedBranch === 'else' && (
              <span className="absolute -top-1 -right-1 text-[8px] px-1 py-0.5 rounded bg-gray-500/50 text-gray-300">
                SKIP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Output handles - one for then path, one for else path */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="then"
        style={{ left: '33%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-node-bg"
        title="Then path"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="else"
        style={{ left: '67%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-node-bg"
        title="Else path"
      />
    </div>
  );
}

export const IfElseNode = memo(IfElseNodeComponent);
