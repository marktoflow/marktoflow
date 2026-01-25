import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Webhook, FolderOpen, Play, Zap, Calendar } from 'lucide-react';

export interface TriggerNodeData extends Record<string, unknown> {
  id: string;
  name?: string;
  type: 'manual' | 'schedule' | 'webhook' | 'file' | 'event';
  // Schedule trigger
  cron?: string;
  // Webhook trigger
  path?: string;
  method?: string;
  // File watcher trigger
  pattern?: string;
  // Event trigger
  events?: string[];
  // Status
  active?: boolean;
  lastTriggered?: string;
}

export type TriggerNodeType = Node<TriggerNodeData, 'trigger'>;

const triggerConfig = {
  manual: {
    icon: Play,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary',
    label: 'Manual Trigger',
  },
  schedule: {
    icon: Calendar,
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info',
    label: 'Schedule',
  },
  webhook: {
    icon: Webhook,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success',
    label: 'Webhook',
  },
  file: {
    icon: FolderOpen,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning',
    label: 'File Watcher',
  },
  event: {
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400',
    label: 'Event',
  },
};

function TriggerNodeComponent({ data, selected }: NodeProps<TriggerNodeType>) {
  const config = triggerConfig[data.type] || triggerConfig.manual;
  const Icon = config.icon;

  const getSubtitle = () => {
    switch (data.type) {
      case 'schedule':
        return data.cron || 'No schedule set';
      case 'webhook':
        return `${data.method || 'POST'} ${data.path || '/webhook'}`;
      case 'file':
        return data.pattern || '**/*';
      case 'event':
        return data.events?.join(', ') || 'No events';
      default:
        return 'Click to run';
    }
  };

  return (
    <div
      className={`min-w-[180px] rounded-lg border-2 ${config.borderColor} ${config.bgColor} ${
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas-bg' : ''
      } transition-all duration-200`}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {config.label}
          </div>
          <div className="text-sm font-medium text-white truncate">
            {data.name || 'Trigger'}
          </div>
        </div>
        {data.active !== false && (
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Active" />
        )}
      </div>

      {/* Details */}
      <div className="px-3 py-2 border-t border-white/10">
        <div className="text-xs text-gray-400 font-mono truncate" title={getSubtitle()}>
          {getSubtitle()}
        </div>
        {data.lastTriggered && (
          <div className="text-xs text-gray-500 mt-1">
            Last: {new Date(data.lastTriggered).toLocaleString()}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-canvas-bg"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
