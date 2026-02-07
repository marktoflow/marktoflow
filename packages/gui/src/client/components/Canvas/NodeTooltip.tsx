import { memo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { StepStatus } from '@shared/types';
import { cn } from '../../utils/cn';

interface NodeTooltipProps {
  children: React.ReactNode;
  name: string;
  action?: string;
  status?: StepStatus;
  duration?: number;
  error?: string;
  disabled?: boolean;
}

function NodeTooltipComponent({
  children,
  name,
  action,
  status = 'pending',
  duration,
  error,
  disabled = false,
}: NodeTooltipProps) {
  if (disabled) return <>{children}</>;

  const statusConfig: Record<StepStatus, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-gray-400', label: 'Pending' },
    running: { icon: Clock, color: 'text-warning', label: 'Running' },
    completed: { icon: CheckCircle, color: 'text-success', label: 'Completed' },
    failed: { icon: XCircle, color: 'text-error', label: 'Failed' },
    skipped: { icon: AlertCircle, color: 'text-gray-500', label: 'Skipped' },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            className="z-50 bg-bg-elevated border border-border-default rounded-lg shadow-xl px-3 py-2 max-w-[280px] animate-in fade-in-0 zoom-in-95"
          >
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-text-primary">{name}</div>
              {action && (
                <div className="text-xs font-mono text-text-secondary">{action}</div>
              )}
              <div className="flex items-center gap-2">
                <StatusIcon className={cn('w-3.5 h-3.5', config.color)} />
                <span className={cn('text-xs', config.color)}>{config.label}</span>
                {duration !== undefined && (
                  <span className="text-xs text-text-muted ml-auto">
                    {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              {error && (
                <div className="text-xs text-error bg-error/10 rounded px-2 py-1 truncate">
                  {error}
                </div>
              )}
            </div>
            <Tooltip.Arrow className="fill-bg-elevated" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export const NodeTooltip = memo(NodeTooltipComponent);
