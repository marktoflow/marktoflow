import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Square, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import type { StepStatus, WorkflowStatus } from '@shared/types';

interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: StepStatus;
  duration?: number;
  error?: string;
}

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
}: ExecutionOverlayProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'logs'>('steps');

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const failedSteps = steps.filter((s) => s.status === 'failed').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  if (!isExecuting && workflowStatus === 'pending') {
    return null;
  }

  return (
    <div className="absolute bottom-20 left-4 right-4 z-20 bg-panel-bg border border-node-border rounded-lg shadow-xl max-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-node-border">
        <div className="flex items-center gap-3">
          <StatusIcon status={workflowStatus} />
          <div>
            <div className="text-sm font-medium text-white">
              {getStatusText(workflowStatus)}
            </div>
            <div className="text-xs text-gray-400">
              {completedSteps}/{steps.length} steps completed
              {failedSteps > 0 && ` • ${failedSteps} failed`}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isExecuting && (
            <>
              {isPaused ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onResume}
                  icon={<Play className="w-4 h-4" />}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onPause}
                  icon={<Pause className="w-4 h-4" />}
                >
                  Pause
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={onStepOver}
                icon={<SkipForward className="w-4 h-4" />}
                disabled={!isPaused}
              >
                Step
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onStop}
                icon={<Square className="w-4 h-4" />}
              >
                Stop
              </Button>
            </>
          )}
          {!isExecuting && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-node-bg">
        <div
          className={`h-full transition-all duration-300 ${
            workflowStatus === 'failed'
              ? 'bg-error'
              : workflowStatus === 'completed'
                ? 'bg-success'
                : 'bg-primary'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-node-border">
        <button
          onClick={() => setActiveTab('steps')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'steps'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Steps
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Logs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'steps' ? (
          <StepsList steps={steps} currentStepId={currentStepId} />
        ) : (
          <LogsViewer logs={logs} />
        )}
      </div>
    </div>
  );
}

function StepsList({
  steps,
  currentStepId,
}: {
  steps: ExecutionStep[];
  currentStepId: string | null;
}) {
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div
          key={step.stepId}
          className={`flex items-center gap-3 p-3 rounded-lg border ${
            step.stepId === currentStepId
              ? 'bg-primary/10 border-primary'
              : 'bg-node-bg border-node-border'
          }`}
        >
          <StepStatusIcon status={step.status} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {step.stepName || step.stepId}
            </div>
            {step.error && (
              <div className="text-xs text-error mt-1 truncate">{step.error}</div>
            )}
          </div>
          {step.duration !== undefined && (
            <div className="text-xs text-gray-400">{step.duration}ms</div>
          )}
        </div>
      ))}
    </div>
  );
}

function LogsViewer({ logs }: { logs: string[] }) {
  return (
    <div className="font-mono text-xs space-y-1">
      {logs.length === 0 ? (
        <div className="text-gray-500">No logs yet...</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="text-gray-300">
            {log}
          </div>
        ))
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: WorkflowStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-success" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-error" />;
    case 'cancelled':
      return <Square className="w-5 h-5 text-gray-400" />;
    default:
      return <div className="w-5 h-5 rounded-full bg-gray-500" />;
  }
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-success" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-error" />;
    case 'skipped':
      return <SkipForward className="w-4 h-4 text-gray-400" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
  }
}

function getStatusText(status: WorkflowStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Executing Workflow...';
    case 'completed':
      return 'Workflow Completed';
    case 'failed':
      return 'Workflow Failed';
    case 'cancelled':
      return 'Workflow Cancelled';
    default:
      return 'Unknown';
  }
}
