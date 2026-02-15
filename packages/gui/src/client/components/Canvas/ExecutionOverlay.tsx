/**
 * ExecutionOverlay — Main execution panel with controls, tabs, and sub-components.
 * Sub-components live in ./execution/.
 */

import { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Bug,
  ArrowRight,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { Button } from '../common/Button';
import { TimelineView } from '../Execution/TimelineView';
import type { WorkflowStatus } from '@shared/types';
import type { DebugState } from '../../stores/executionStore';

import {
  StatusIcon,
  getStatusText,
  StepsList,
  LogsViewer,
  VariableInspector,
  DebugPanel,
  type ExecutionStep,
} from './execution';

interface ExecutionOverlayProps {
  isExecuting: boolean;
  isPaused: boolean;
  workflowStatus: WorkflowStatus;
  currentStepId: string | null;
  steps: ExecutionStep[];
  logs: string[];
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStepOver: () => void;
  onClose: () => void;
  debug?: DebugState;
  onToggleDebugMode?: () => void;
  onToggleBreakpoint?: (stepId: string) => void;
  onStepInto?: () => void;
  onStepOut?: () => void;
  onClearBreakpoints?: () => void;
  onAddWatchExpression?: (expression: string) => void;
  onRemoveWatchExpression?: (expression: string) => void;
}

export function ExecutionOverlay({
  isExecuting,
  isPaused,
  workflowStatus,
  currentStepId,
  steps,
  logs,
  onPause,
  onResume,
  onStop,
  onStepOver,
  onClose,
  debug,
  onToggleDebugMode,
  onToggleBreakpoint,
  onStepInto,
  onStepOut,
  onClearBreakpoints,
  onAddWatchExpression,
  onRemoveWatchExpression,
}: ExecutionOverlayProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'variables' | 'logs' | 'timeline' | 'debug'>('steps');
  const isDebugEnabled = debug?.enabled ?? false;

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const failedSteps = steps.filter((s) => s.status === 'failed').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  if (!isExecuting && workflowStatus === 'pending') {
    return null;
  }

  return (
    <div className="absolute bottom-20 left-4 right-4 z-20 bg-bg-panel border border-border-default rounded-lg shadow-xl max-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-3">
          <StatusIcon status={workflowStatus} />
          <div>
            <div className="text-sm font-medium text-text-primary">{getStatusText(workflowStatus)}</div>
            <div className="text-xs text-text-secondary">
              {completedSteps}/{steps.length} steps completed
              {failedSteps > 0 && ` • ${failedSteps} failed`}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {onToggleDebugMode && (
            <Button variant={isDebugEnabled ? 'primary' : 'ghost'} size="sm" onClick={onToggleDebugMode} icon={<Bug className="w-4 h-4" />} title={isDebugEnabled ? 'Disable debug mode' : 'Enable debug mode'}>
              Debug
            </Button>
          )}

          {isExecuting && (
            <>
              {isPaused ? (
                <Button variant="secondary" size="sm" onClick={onResume} icon={<Play className="w-4 h-4" />}>Resume</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={onPause} icon={<Pause className="w-4 h-4" />}>Pause</Button>
              )}

              {isDebugEnabled && isPaused && (
                <>
                  <Button variant="secondary" size="sm" onClick={onStepOver} icon={<ArrowRight className="w-4 h-4" />} title="Step Over (F10)">Over</Button>
                  {onStepInto && <Button variant="secondary" size="sm" onClick={onStepInto} icon={<ArrowDown className="w-4 h-4" />} title="Step Into (F11)">Into</Button>}
                  {onStepOut && <Button variant="secondary" size="sm" onClick={onStepOut} icon={<ArrowUp className="w-4 h-4" />} title="Step Out (Shift+F11)">Out</Button>}
                </>
              )}

              {!isDebugEnabled && (
                <Button variant="secondary" size="sm" onClick={onStepOver} icon={<SkipForward className="w-4 h-4" />} disabled={!isPaused}>Step</Button>
              )}

              <Button variant="destructive" size="sm" onClick={onStop} icon={<Square className="w-4 h-4" />}>Stop</Button>
            </>
          )}
          {!isExecuting && <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-surface">
        <div
          className={`h-full transition-all duration-300 ${workflowStatus === 'failed' ? 'bg-error' : workflowStatus === 'completed' ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default">
        {(['steps', 'variables', 'logs', 'timeline'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'text-primary border-b-2 border-primary -mb-px' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {tab}
          </button>
        ))}
        {isDebugEnabled && (
          <button
            onClick={() => setActiveTab('debug')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'debug' ? 'text-primary border-b-2 border-primary -mb-px' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Bug className="w-3 h-3" /> Debug
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'steps' && <StepsList steps={steps} currentStepId={currentStepId} debugEnabled={isDebugEnabled} breakpoints={debug?.breakpoints} onToggleBreakpoint={onToggleBreakpoint} />}
        {activeTab === 'variables' && <VariableInspector steps={steps} />}
        {activeTab === 'logs' && <LogsViewer logs={logs} />}
        {activeTab === 'timeline' && <TimelineView steps={steps.map((s) => ({ ...s, stepName: s.stepName || s.stepId }))} />}
        {activeTab === 'debug' && isDebugEnabled && <DebugPanel debug={debug!} onClearBreakpoints={onClearBreakpoints} onAddWatchExpression={onAddWatchExpression} onRemoveWatchExpression={onRemoveWatchExpression} />}
      </div>
    </div>
  );
}
