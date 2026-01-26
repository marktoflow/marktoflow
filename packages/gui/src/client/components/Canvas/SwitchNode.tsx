import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { GitFork, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface SwitchNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  expression: string;
  cases: Record<string, unknown>;
  hasDefault?: boolean;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  activeCase?: string | null;
}

export type SwitchNodeType = Node<SwitchNodeData, 'switch'>;

function SwitchNodeComponent({ data, selected }: NodeProps<SwitchNodeType>) {
  const statusConfig: Record<
    NonNullable<SwitchNodeData['status']>,
    { icon: typeof Clock; color: string; bgColor: string; animate?: boolean }
  > = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: GitFork,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
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

  const caseKeys = Object.keys(data.cases || {});
  const displayCases = caseKeys.slice(0, 4); // Show up to 4 cases
  const hasMore = caseKeys.length > 4;

  return (
    <div
      className={`control-flow-node switch-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''}`}
      style={{
        background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
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
          <GitFork className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {data.name || 'Switch'}
          </div>
          <div className="text-xs text-white/70">Multi-Branch Router</div>
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
          <span className="text-white/60">Expression:</span>{' '}
          <span className="font-mono">{data.expression || 'Not set'}</span>
        </div>

        {/* Case list */}
        <div className="space-y-2">
          <div className="text-xs text-white/70 font-medium mb-1">Cases:</div>
          {displayCases.map((caseKey, index) => {
            const isActive = data.activeCase === caseKey;
            const handlePosition = ((index + 1) / (displayCases.length + (data.hasDefault ? 2 : 1))) * 100;

            return (
              <div key={caseKey} className="relative">
                <div
                  className={`text-xs px-2 py-1.5 rounded font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50'
                      : 'bg-white/5 text-white/70'
                  }`}
                >
                  {caseKey}
                </div>
                {/* Output handle for this case */}
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={`case-${caseKey}`}
                  style={{ left: `${handlePosition}%` }}
                  className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-node-bg"
                />
              </div>
            );
          })}

          {hasMore && (
            <div className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 text-center">
              +{caseKeys.length - 4} more cases
            </div>
          )}

          {/* Default case */}
          {data.hasDefault && (
            <div className="relative">
              <div
                className={`text-xs px-2 py-1.5 rounded font-medium transition-colors ${
                  data.activeCase === 'default'
                    ? 'bg-gray-500/30 text-gray-200 ring-1 ring-gray-400/50'
                    : 'bg-white/5 text-white/70'
                }`}
              >
                default
              </div>
              {/* Output handle for default */}
              <Handle
                type="source"
                position={Position.Bottom}
                id="case-default"
                style={{ left: '95%' }}
                className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-node-bg"
              />
            </div>
          )}
        </div>

        {/* Case count */}
        <div className="mt-3 text-xs text-white/50 flex items-center gap-2">
          <span>ℹ️</span>
          <span>
            {caseKeys.length} case{caseKeys.length !== 1 ? 's' : ''}
            {data.hasDefault ? ' + default' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export const SwitchNode = memo(SwitchNodeComponent);
