import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { getServiceIcon } from '../../utils/serviceIcons';

export interface StepNodeData {
  id: string;
  name?: string;
  action: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  retryCount?: number;
  error?: string;
}

function StepNodeComponent({ data, selected }: NodeProps<StepNodeData>) {
  const serviceName = data.action?.split('.')[0] || 'unknown';
  const methodName = data.action?.split('.').slice(1).join('.') || data.action;
  const ServiceIcon = getServiceIcon(serviceName);

  const statusConfig = {
    pending: { icon: Clock, color: 'text-gray-400', bgColor: 'bg-gray-400/10' },
    running: {
      icon: Play,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      animate: true,
    },
    completed: {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    failed: { icon: XCircle, color: 'text-error', bgColor: 'bg-error/10' },
    skipped: {
      icon: AlertCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
    },
  };

  const status = data.status || 'pending';
  const StatusIcon = statusConfig[status].icon;

  return (
    <div
      className={`step-node p-0 ${selected ? 'selected' : ''} ${status === 'running' ? 'running' : ''} ${status === 'completed' ? 'completed' : ''} ${status === 'failed' ? 'failed' : ''}`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-node-bg"
      />

      {/* Node header */}
      <div className="flex items-center gap-3 p-3 border-b border-node-border">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <ServiceIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {data.name || data.id}
          </div>
          <div className="text-xs text-gray-400 truncate">{serviceName}</div>
        </div>
        <div
          className={`w-6 h-6 rounded-full ${statusConfig[status].bgColor} flex items-center justify-center`}
        >
          <StatusIcon
            className={`w-4 h-4 ${statusConfig[status].color} ${statusConfig[status].animate ? 'animate-pulse' : ''}`}
          />
        </div>
      </div>

      {/* Node body */}
      <div className="p-3">
        <div className="text-xs text-gray-300 font-mono truncate">
          {methodName}
        </div>
        {data.retryCount && data.retryCount > 0 && (
          <div className="mt-2 text-xs text-warning">
            Retry #{data.retryCount}
          </div>
        )}
        {data.error && (
          <div className="mt-2 text-xs text-error truncate">{data.error}</div>
        )}
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

export const StepNode = memo(StepNodeComponent);
