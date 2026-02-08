import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Bug,
  Circle,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';
import { TimelineView } from '../Execution/TimelineView';
import type { StepStatus, WorkflowStatus } from '@shared/types';
import type { DebugState } from '../../stores/executionStore';

interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: StepStatus;
  duration?: number;
  error?: string;
  inputs?: Record<string, unknown>;
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
  // Debug props
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
  // Debug props
  debug,
  onToggleDebugMode,
  onToggleBreakpoint,
  onStepInto,
  onStepOut,
  onClearBreakpoints,
  onAddWatchExpression,
  onRemoveWatchExpression,
}: ExecutionOverlayProps) {
  const { t } = useTranslation('gui');
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
            <div className="text-sm font-medium text-text-primary">
              {getStatusText(workflowStatus, t)}
            </div>
            <div className="text-xs text-text-secondary">
              {completedSteps}/{steps.length} {t('gui:execution.stepsCompleted')}
              {failedSteps > 0 && ` • ${failedSteps} ${t('gui:execution.failedCount')}`}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Debug mode toggle */}
          {onToggleDebugMode && (
            <Button
              variant={isDebugEnabled ? 'primary' : 'ghost'}
              size="sm"
              onClick={onToggleDebugMode}
              icon={<Bug className="w-4 h-4" />}
              title={isDebugEnabled ? 'Disable debug mode' : 'Enable debug mode'}
            >
              {t('gui:execution.debug')}
            </Button>
          )}

          {isExecuting && (
            <>
              {isPaused ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onResume}
                  icon={<Play className="w-4 h-4" />}
                >
                  {t('gui:execution.resume')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onPause}
                  icon={<Pause className="w-4 h-4" />}
                >
                  {t('gui:execution.pause')}
                </Button>
              )}

              {/* Debug stepping controls */}
              {isDebugEnabled && isPaused && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onStepOver}
                    icon={<ArrowRight className="w-4 h-4" />}
                    title={t('gui:execution.stepOverTooltip')}
                  >
                    {t('gui:execution.over')}
                  </Button>
                  {onStepInto && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onStepInto}
                      icon={<ArrowDown className="w-4 h-4" />}
                      title={t('gui:execution.stepIntoTooltip')}
                    >
                      {t('gui:execution.into')}
                    </Button>
                  )}
                  {onStepOut && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onStepOut}
                      icon={<ArrowUp className="w-4 h-4" />}
                      title={t('gui:execution.stepOutTooltip')}
                    >
                      {t('gui:execution.out')}
                    </Button>
                  )}
                </>
              )}

              {/* Regular step control when not in debug mode */}
              {!isDebugEnabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onStepOver}
                  icon={<SkipForward className="w-4 h-4" />}
                  disabled={!isPaused}
                >
                  {t('gui:execution.step')}
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                onClick={onStop}
                icon={<Square className="w-4 h-4" />}
              >
                {t('gui:execution.stop')}
              </Button>
            </>
          )}
          {!isExecuting && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('gui:execution.close')}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-bg-surface">
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
      <div className="flex border-b border-border-default">
        <button
          onClick={() => setActiveTab('steps')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'steps'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('gui:execution.tabs.steps')}
        </button>
        <button
          onClick={() => setActiveTab('variables')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'variables'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('gui:execution.tabs.variables')}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('gui:execution.tabs.logs')}
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'timeline'
              ? 'text-primary border-b-2 border-primary -mb-px'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {t('gui:execution.tabs.timeline')}
        </button>
        {isDebugEnabled && (
          <button
            onClick={() => setActiveTab('debug')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'debug'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Bug className="w-3 h-3" />
            {t('gui:execution.debug')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'steps' && (
          <StepsList
            steps={steps}
            currentStepId={currentStepId}
            debugEnabled={isDebugEnabled}
            breakpoints={debug?.breakpoints}
            onToggleBreakpoint={onToggleBreakpoint}
          />
        )}
        {activeTab === 'variables' && (
          <VariableInspector steps={steps} />
        )}
        {activeTab === 'logs' && (
          <LogsViewer logs={logs} />
        )}
        {activeTab === 'timeline' && (
          <TimelineView steps={steps.map((s) => ({ ...s, stepName: s.stepName || s.stepId }))} />
        )}
        {activeTab === 'debug' && isDebugEnabled && (
          <DebugPanel
            debug={debug!}
            onClearBreakpoints={onClearBreakpoints}
            onAddWatchExpression={onAddWatchExpression}
            onRemoveWatchExpression={onRemoveWatchExpression}
          />
        )}
      </div>
    </div>
  );
}

function StepsList({
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
  const { t } = useTranslation('gui');
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
            {/* Breakpoint indicator/toggle */}
            {debugEnabled && onToggleBreakpoint && (
              <button
                onClick={() => onToggleBreakpoint(step.stepId)}
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                  hasBreakpoint
                    ? 'bg-error'
                    : 'bg-transparent border border-gray-500 hover:border-error hover:bg-error/20'
                }`}
                title={hasBreakpoint ? t('gui:execution.removeBreakpoint') : t('gui:execution.addBreakpoint')}
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
                  {typeof step.error === 'string' ? step.error : step.error.message || JSON.stringify(step.error)}
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

function LogsViewer({ logs }: { logs: string[] }) {
  const { t } = useTranslation('gui');
  return (
    <div className="font-mono text-xs space-y-1">
      {logs.length === 0 ? (
        <div className="text-text-muted">{t('gui:execution.noLogsYet')}</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="text-text-primary">
            {log}
          </div>
        ))
      )}
    </div>
  );
}

function VariableInspector({ steps }: { steps: ExecutionStep[] }) {
  const { t } = useTranslation('gui');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter steps that have input or output data
  const stepsWithData = steps.filter(
    (step) => step.inputs !== undefined || (step.output !== undefined && step.outputVariable)
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

  const toggleSection = (sectionId: string) => {
    setExpandedSection((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
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

  if (stepsWithData.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        {t('gui:execution.noDataYet')}
        <br />
        <span className="text-xs">{t('gui:execution.dataHelp')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stepsWithData.map((step) => {
        const isExpanded = expandedSteps.has(step.stepId);
        const hasInputs = step.inputs && Object.keys(step.inputs).length > 0;
        const hasOutput = step.output !== undefined && step.outputVariable;

        return (
          <div
            key={step.stepId}
            className="border border-border-default rounded-lg overflow-hidden"
          >
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.stepId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-bg-surface hover:bg-white/5 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              )}
              <code className="text-sm text-text-primary font-mono">
                {step.stepName || step.stepId}
              </code>
              <span className="text-xs text-text-muted ml-auto">
                {hasInputs && `${Object.keys(step.inputs!).length} inputs`}
                {hasInputs && hasOutput && ' • '}
                {hasOutput && step.outputVariable}
              </span>
            </button>

            {/* Step Data */}
            {isExpanded && (
              <div className="bg-bg-panel border-t border-border-default">
                {/* Inputs Section */}
                {hasInputs && (
                  <div className="border-b border-border-default">
                    <button
                      onClick={() => toggleSection(`${step.stepId}-inputs`)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      {expandedSection.has(`${step.stepId}-inputs`) ? (
                        <ChevronDown className="w-3 h-3 text-text-secondary" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-secondary" />
                      )}
                      <span className="text-xs font-medium text-text-secondary">
                        {t('gui:execution.inputs')} ({Object.keys(step.inputs!).length})
                      </span>
                    </button>
                    {expandedSection.has(`${step.stepId}-inputs`) && (
                      <div className="px-3 pb-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 overflow-x-auto">
                            <ValueRenderer
                              value={step.inputs}
                              onCopy={(key, val) => copyValue(key, val)}
                              copiedKey={copiedKey}
                              path="inputs"
                            />
                          </div>
                          <button
                            onClick={() => copyValue(`${step.stepId}-inputs`, step.inputs)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title={t('gui:execution.copyInputs')}
                          >
                            {copiedKey === `${step.stepId}-inputs` ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 text-text-secondary" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Output Section */}
                {hasOutput && (
                  <div>
                    <button
                      onClick={() => toggleSection(`${step.stepId}-output`)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      {expandedSection.has(`${step.stepId}-output`) ? (
                        <ChevronDown className="w-3 h-3 text-text-secondary" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-text-secondary" />
                      )}
                      <span className="text-xs font-medium text-text-secondary">
                        {t('gui:execution.outputLabel')}
                      </span>
                      <code className="text-xs text-primary font-mono ml-auto">
                        {step.outputVariable}
                      </code>
                    </button>
                    {expandedSection.has(`${step.stepId}-output`) && (
                      <div className="px-3 pb-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 overflow-x-auto">
                            <ValueRenderer
                              value={step.output}
                              onCopy={(key, val) => copyValue(key, val)}
                              copiedKey={copiedKey}
                              path={step.outputVariable || 'output'}
                            />
                          </div>
                          <button
                            onClick={() => copyValue(step.outputVariable || '', step.output)}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            title={t('gui:execution.copyOutput')}
                          >
                            {copiedKey === step.outputVariable ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4 text-text-secondary" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
  const { t } = useTranslation('gui');
  const [expanded, setExpanded] = useState(depth < 2);

  if (value === null) {
    return <span className="text-text-muted font-mono text-xs">null</span>;
  }

  if (value === undefined) {
    return <span className="text-text-muted font-mono text-xs">undefined</span>;
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
      return <span className="text-text-secondary font-mono text-xs">[]</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-mono">{t('gui:execution.array')}({value.length})</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-border-default space-y-1">
            {value.slice(0, 20).map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-text-muted font-mono text-xs">[{index}]:</span>
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
              <div className="text-text-muted text-xs">
                {t('gui:execution.andMore', { count: value.length - 20 })}
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
      return <span className="text-text-secondary font-mono text-xs">{'{}'}</span>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span className="text-xs font-mono">{t('gui:execution.object')}({entries.length} keys)</span>
        </button>
        {expanded && (
          <div className="ml-4 pl-2 border-l border-border-default space-y-1">
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
              <div className="text-text-muted text-xs">
                {t('gui:execution.andMore', { count: entries.length - 30 })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-text-secondary font-mono text-xs">{String(value)}</span>;
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
      return <Square className="w-5 h-5 text-text-secondary" />;
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
      return <SkipForward className="w-4 h-4 text-text-secondary" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />;
  }
}

function getStatusText(status: WorkflowStatus, t: (key: string) => string): string {
  switch (status) {
    case 'pending':
      return t('common:status.pending');
    case 'running':
      return t('gui:execution.executing');
    case 'completed':
      return t('gui:execution.completed');
    case 'failed':
      return t('gui:execution.failed');
    case 'cancelled':
      return t('gui:execution.cancelled');
    default:
      return t('common:status.unknown');
  }
}

// Debug Panel Component
function DebugPanel({
  debug,
  onClearBreakpoints,
  onAddWatchExpression,
  onRemoveWatchExpression,
}: {
  debug: DebugState;
  onClearBreakpoints?: () => void;
  onAddWatchExpression?: (expression: string) => void;
  onRemoveWatchExpression?: (expression: string) => void;
}) {
  const { t } = useTranslation('gui');
  const [newWatchExpr, setNewWatchExpr] = useState('');

  const handleAddWatch = () => {
    if (newWatchExpr.trim() && onAddWatchExpression) {
      onAddWatchExpression(newWatchExpr.trim());
      setNewWatchExpr('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Breakpoints Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <Circle className="w-3 h-3 text-error" />
            Breakpoints ({debug.breakpoints.size})
          </h4>
          {debug.breakpoints.size > 0 && onClearBreakpoints && (
            <button
              onClick={onClearBreakpoints}
              className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>
        <div className="bg-bg-surface rounded-lg p-3">
          {debug.breakpoints.size === 0 ? (
            <div className="text-xs text-text-muted">
              {t('gui:execution.noBreakpointsHelp')}
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from(debug.breakpoints).map((stepId) => (
                <div
                  key={stepId}
                  className="flex items-center gap-2 text-xs text-text-primary"
                >
                  <Circle className="w-2 h-2 fill-current text-error" />
                  <span className="font-mono">{stepId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Call Stack Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">{t('gui:execution.callStack')}</h4>
        <div className="bg-bg-surface rounded-lg p-3">
          {debug.callStack.length === 0 ? (
            <div className="text-xs text-text-muted">{t('gui:execution.noCallStack')}</div>
          ) : (
            <div className="space-y-1">
              {debug.callStack.map((frame, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 text-xs ${
                    index === 0 ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-mono">{frame}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Watch Expressions Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">{t('gui:execution.watchExpressions')}</h4>
        <div className="bg-bg-surface rounded-lg p-3 space-y-2">
          {/* Add new watch expression */}
          {onAddWatchExpression && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWatchExpr}
                onChange={(e) => setNewWatchExpr(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                placeholder={t('gui:execution.addExpression')}
                className="flex-1 bg-transparent border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder-gray-500 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleAddWatch}
                disabled={!newWatchExpr.trim()}
                className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Watch list */}
          {debug.watchExpressions.length === 0 ? (
            <div className="text-xs text-text-muted">
              {t('gui:execution.noWatchHelp')}
            </div>
          ) : (
            <div className="space-y-1">
              {debug.watchExpressions.map((expr) => (
                <div
                  key={expr}
                  className="flex items-center justify-between gap-2 text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-primary font-mono truncate">{expr}</span>
                    <span className="text-text-muted">=</span>
                    <span className="text-text-primary font-mono truncate">
                      {t('gui:execution.notEvaluated')}
                    </span>
                  </div>
                  {onRemoveWatchExpression && (
                    <button
                      onClick={() => onRemoveWatchExpression(expr)}
                      className="p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Debug State Info */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-text-primary">{t('gui:execution.debugState')}</h4>
        <div className="bg-bg-surface rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t('gui:execution.currentStep')}</span>
            <span className="text-text-primary font-mono">
              {debug.currentStepId || t('gui:execution.noneStep')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t('gui:execution.pausedAtBreakpoint')}</span>
            <span className={debug.pausedAtBreakpoint ? 'text-error' : 'text-text-muted'}>
              {debug.pausedAtBreakpoint ? t('common:common.yes') : t('common:common.no')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{t('gui:execution.stepOverPending')}</span>
            <span className={debug.stepOverPending ? 'text-warning' : 'text-text-muted'}>
              {debug.stepOverPending ? t('common:common.yes') : t('common:common.no')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
