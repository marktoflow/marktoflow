import { memo, useMemo } from 'react';
import { cn } from '../../utils/cn';
import type { StepStatus } from '@shared/types';

interface TimelineStep {
  stepId: string;
  stepName: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

interface TimelineViewProps {
  steps: TimelineStep[];
  totalDuration?: number;
  className?: string;
}

const statusColors: Record<StepStatus, string> = {
  pending: 'bg-gray-500',
  running: 'bg-warning animate-pulse',
  completed: 'bg-success',
  failed: 'bg-error',
  skipped: 'bg-gray-400',
};

function TimelineViewComponent({ steps, totalDuration, className }: TimelineViewProps) {
  const { bars, maxDuration } = useMemo(() => {
    const total = totalDuration || steps.reduce((acc, s) => acc + (s.duration || 0), 0) || 1;
    let cumOffset = 0;

    const bars = steps.map((step) => {
      const duration = step.duration || 0;
      const offset = cumOffset;
      cumOffset += duration;
      return {
        ...step,
        offset,
        duration,
        widthPercent: Math.max((duration / total) * 100, 1),
        offsetPercent: (offset / total) * 100,
      };
    });

    return { bars, maxDuration: total };
  }, [steps, totalDuration]);

  if (steps.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-text-muted">
        No execution data available
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Execution Timeline</span>
        <span>{formatMs(maxDuration)}</span>
      </div>

      {/* Timeline bars */}
      <div className="space-y-1.5">
        {bars.map((bar) => (
          <div key={bar.stepId} className="flex items-center gap-2">
            <div className="w-28 text-xs text-text-secondary truncate flex-shrink-0" title={bar.stepName}>
              {bar.stepName}
            </div>
            <div className="flex-1 h-5 bg-bg-surface rounded overflow-hidden relative">
              <div
                className={cn(
                  'absolute top-0 h-full rounded transition-all duration-300',
                  statusColors[bar.status]
                )}
                style={{
                  left: `${bar.offsetPercent}%`,
                  width: `${bar.widthPercent}%`,
                  minWidth: '4px',
                }}
                title={`${bar.stepName}: ${formatMs(bar.duration)}`}
              />
            </div>
            <div className="w-16 text-xs text-text-muted text-right flex-shrink-0">
              {bar.duration > 0 ? formatMs(bar.duration) : '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export const TimelineView = memo(TimelineViewComponent);
