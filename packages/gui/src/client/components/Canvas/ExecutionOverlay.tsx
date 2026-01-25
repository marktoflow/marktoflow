import { useState } from 'react';
import { Play, Pause, SkipForward, Square, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '../common/Button';
import type { StepStatus, WorkflowStatus } from '@shared/types';

interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: StepStatus;
  duration?: number;
  error?: string;
  output?: unknown;
  outputVariable?: string;
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
  const [activeTab, setActiveTab] = useState<'steps' | 'variables' | 'logs'>('steps');

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
          onClick={() => setActiveTab('variables')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'variables'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Variables
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
        {activeTab === 'steps' && (
          <StepsList steps={steps} currentStepId={currentStepId} />
        )}
        {activeTab === 'variables' && (
          <VariableInspector steps={steps} />
        )}
        {activeTab === 'logs' && (
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

function VariableInspector({ steps }: { steps: ExecutionStep[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter steps that have output data
  const stepsWithOutput = steps.filter(
    (step) => step.output !== undefined && step.outputVariable
  );

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const copyValue = async (key: string, value: unknown) => {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (stepsWithOutput.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No variables available yet.
        <br />
        <span className="text-xs">Variables will appear as steps complete.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stepsWithOutput.map((step) => {
        const isExpanded = expandedSteps.has(step.stepId);
        return (
          <div
            key={step.stepId}
            className="border border-node-border rounded-lg overflow-hidden"
          >
            {/* Variable Header */}
            <button
              onClick={() => toggleStep(step.stepId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-node-bg hover:bg-white/5 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <code className="text-sm text-primary font-mono">
                {step.outputVariable}
              </code>
              <span className="text-xs text-gray-500 ml-auto">
                {getTypeLabel(step.output)}
              </span>
            </button>

            {/* Variable Value */}
            {isExpanded && (
              <div className="p-3 bg-panel-bg border-t border-node-border">
                <div className="flex items-start gap-2">
                  <div className="flex-1 overflow-x-auto">
                    <ValueRenderer
                      value={step.output}
                      onCopy={(key, val) => copyValue(key, val)}
                      copiedKey={copiedKey}
                      path={step.outputVariable || ''}
                    />
                  </div>
                  <button
                    onClick={() => copyValue(step.outputVariable || '', step.output)}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Copy entire value"
                  >
                    {copiedKey === step.outputVariable ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ValueRenderer({
  value,
  onCopy,
  copiedKey,
  path,
  depth = 0,
}: {
  value: unknown;
  onCopy: (key: string, value: unknown) => void;
  copiedKey: string | null;
  path: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null) {
    return <span className="text-gray-500 font-mono text-xs">null</span>;
  }

  if (value === undefined) {
    return <span className="text-gray-500 font-mono text-xs">undefined</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`font-mono text-xs ${value ? 'text-success' : 'text-error'}`}>
        {String(value)}
      </span>
    );
  }

  if (typeof value === 'number') {
    return <span className="text-warning font-mono text-xs">{value}</span>;
  }

  if (typeof value === 'string') {
    // Truncate long strings
    const displayValue = value.length > 200 ? value.substring(0, 200) + '...' : value;
    return (
      <span className="text-success font-mono text-xs">
        &quot;{displayValue}&quot;
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 font-mono text-xs">[]</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-mono">Array({value.length})</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-node-border space-y-1">
            {value.slice(0, 20).map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-500 font-mono text-xs">[{index}]:</span>
                <ValueRenderer
                  value={item}
                  onCopy={onCopy}
                  copiedKey={copiedKey}
                  path={`${path}[${index}]`}
                  depth={depth + 1}
                />
              </div>
            ))}
            {value.length > 20 && (
              <div className="text-gray-500 text-xs">
                ... and {value.length - 20} more items
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400 font-mono text-xs">{'{}'}</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-mono">Object({entries.length} keys)</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-node-border space-y-1">
            {entries.slice(0, 30).map(([key, val]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-primary font-mono text-xs">{key}:</span>
                <ValueRenderer
                  value={val}
                  onCopy={onCopy}
                  copiedKey={copiedKey}
                  path={`${path}.${key}`}
                  depth={depth + 1}
                />
              </div>
            ))}
            {entries.length > 30 && (
              <div className="text-gray-500 text-xs">
                ... and {entries.length - 30} more keys
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-gray-400 font-mono text-xs">{String(value)}</span>;
}

function getTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === 'object') return `object`;
  return typeof value;
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
