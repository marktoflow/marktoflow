/**
 * StepsList — Displays execution steps with breakpoint support.
 */

import { Circle } from 'lucide-react';
import { StepStatusIcon } from './StatusIcons';
import type { StepStatus } from '@shared/types';

export interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: StepStatus;
  duration?: number;
  error?: string;
  inputs?: Record<string, unknown>;
  output?: unknown;
  outputVariable?: string;
}

export function StepsList({
  steps,
  currentStepId,
  debugEnabled,
  breakpoints,
  onToggleBreakpoint,
}: {
  steps: ExecutionStep[];
  currentStepId: string | null;
  debugEnabled?: boolean;
  breakpoints?: Set<string>;
  onToggleBreakpoint?: (stepId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const hasBreakpoint = breakpoints?.has(step.stepId);

        return (
          <div
            key={step.stepId}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              step.stepId === currentStepId
                ? 'bg-primary/10 border-primary'
                : hasBreakpoint
                  ? 'bg-error/10 border-error/50'
                  : 'bg-bg-surface border-border-default'
            }`}
          >
            {debugEnabled && onToggleBreakpoint && (
              <button
                onClick={() => onToggleBreakpoint(step.stepId)}
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  hasBreakpoint
                    ? 'bg-error'
                    : 'bg-transparent border border-gray-500 hover:border-error hover:bg-error/20'
                }`}
                title={hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint'}
              >
                {hasBreakpoint && <Circle className="w-2 h-2 fill-current text-text-primary" />}
              </button>
            )}

            <StepStatusIcon status={step.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">
                {step.stepName || step.stepId}
              </div>
              {step.error && (
                <div className="text-xs text-error mt-1 truncate">
                  {typeof step.error === 'string' ? step.error : (step.error as any).message || JSON.stringify(step.error)}
                </div>
              )}
            </div>
            {step.duration !== undefined && (
              <div className="text-xs text-text-secondary">{step.duration}ms</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
