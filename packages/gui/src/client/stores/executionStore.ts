import { create } from 'zustand';
import type { StepStatus, WorkflowStatus } from '@shared/types';

export interface ExecutionStepResult {
  stepId: string;
  stepName: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  inputs?: Record<string, unknown>;
  output?: unknown;
  outputVariable?: string;
  error?: string;
}

export interface ExecutionRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  startTime: string;
  endTime?: string;
  duration?: number;
  steps: ExecutionStepResult[];
  logs: string[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface DebugState {
  enabled: boolean;
  breakpoints: Set<string>;
  currentStepId: string | null;
  pausedAtBreakpoint: boolean;
  stepOverPending: boolean;
  watchExpressions: string[];
  callStack: string[];
}

interface ExecutionState {
  runs: ExecutionRun[];
  currentRunId: string | null;
  isExecuting: boolean;
  isPaused: boolean;
  isLoadingHistory: boolean;

  // Debug mode state
  debug: DebugState;

  // Existing methods
  startExecution: (workflowId: string, workflowName: string, inputs?: Record<string, unknown>) => string;
  updateStepStatus: (runId: string, stepId: string, status: StepStatus, output?: unknown, error?: string, outputVariable?: string, inputs?: Record<string, unknown>) => void;
  completeExecution: (runId: string, status: WorkflowStatus, outputs?: Record<string, unknown>) => void;
  addLog: (runId: string, message: string) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: (runId: string) => void;
  clearHistory: () => void;
  getRun: (runId: string) => ExecutionRun | undefined;

  // API sync methods
  loadHistory: (workflowId?: string) => Promise<void>;
  syncRunWithBackend: (runId: string) => Promise<void>;

  // Debug mode methods
  enableDebugMode: () => void;
  disableDebugMode: () => void;
  toggleBreakpoint: (stepId: string) => void;
  hasBreakpoint: (stepId: string) => boolean;
  clearAllBreakpoints: () => void;
  stepOver: () => void;
  stepInto: () => void;
  stepOut: () => void;
  setCurrentDebugStep: (stepId: string | null) => void;
  addWatchExpression: (expression: string) => void;
  removeWatchExpression: (expression: string) => void;
  updateCallStack: (stack: string[]) => void;
}

const initialDebugState: DebugState = {
  enabled: false,
  breakpoints: new Set(),
  currentStepId: null,
  pausedAtBreakpoint: false,
  stepOverPending: false,
  watchExpressions: [],
  callStack: [],
};

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  runs: [],
  currentRunId: null,
  isExecuting: false,
  isPaused: false,
  isLoadingHistory: false,
  debug: initialDebugState,

  startExecution: (workflowId, workflowName, inputs) => {
    const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const newRun: ExecutionRun = {
      id: runId,
      workflowId,
      workflowName,
      status: 'running',
      startTime: new Date().toISOString(),
      steps: [],
      logs: ['Starting workflow execution: ' + workflowName],
      inputs,
    };

    set({
      runs: [newRun, ...get().runs].slice(0, 50), // Keep last 50 runs
      currentRunId: runId,
      isExecuting: true,
      isPaused: false,
    });

    return runId;
  },

  updateStepStatus: (runId, stepId, status, output, error, outputVariable, inputs) => {
    const { debug } = get();

    // Check if we need to pause at breakpoint
    const shouldPauseAtBreakpoint = debug.enabled &&
      status === 'running' &&
      debug.breakpoints.has(stepId);

    set({
      runs: get().runs.map((run) => {
        if (run.id !== runId) return run;

        const existingStep = run.steps.find((s) => s.stepId === stepId);
        const now = new Date().toISOString();

        if (existingStep) {
          return {
            ...run,
            steps: run.steps.map((s) => {
              if (s.stepId !== stepId) return s;
              const endTime = status !== 'running' ? now : undefined;
              const duration = endTime && s.startTime
                ? new Date(endTime).getTime() - new Date(s.startTime).getTime()
                : undefined;
              return {
                ...s,
                status,
                endTime,
                duration,
                inputs: inputs ?? s.inputs,
                output: output ?? s.output,
                outputVariable: outputVariable ?? s.outputVariable,
                error: error ?? s.error,
              };
            }),
          };
        } else {
          return {
            ...run,
            steps: [
              ...run.steps,
              {
                stepId,
                stepName: stepId,
                status,
                startTime: now,
                inputs,
                output,
                outputVariable,
                error,
              },
            ],
          };
        }
      }),
      // Update debug state if pausing at breakpoint
      ...(shouldPauseAtBreakpoint ? {
        isPaused: true,
        debug: {
          ...get().debug,
          currentStepId: stepId,
          pausedAtBreakpoint: true,
          stepOverPending: false,
        },
      } : {
        debug: {
          ...get().debug,
          currentStepId: status === 'running' ? stepId : get().debug.currentStepId,
        },
      }),
    });

    // Log breakpoint pause
    if (shouldPauseAtBreakpoint) {
      get().addLog(runId, `⏸️ Paused at breakpoint: ${stepId}`);
    }
  },

  completeExecution: (runId, status, outputs) => {
    const now = new Date().toISOString();
    set({
      runs: get().runs.map((run) => {
        if (run.id !== runId) return run;
        const duration = new Date(now).getTime() - new Date(run.startTime).getTime();
        return {
          ...run,
          status,
          endTime: now,
          duration,
          outputs,
          logs: [
            ...run.logs,
            status === 'completed'
              ? 'Workflow completed successfully'
              : status === 'failed'
                ? 'Workflow execution failed'
                : 'Workflow execution cancelled',
          ],
        };
      }),
      currentRunId: null,
      isExecuting: false,
      isPaused: false,
    });
  },

  addLog: (runId, message) => {
    set({
      runs: get().runs.map((run) =>
        run.id === runId
          ? { ...run, logs: [...run.logs, '[' + new Date().toLocaleTimeString() + '] ' + message] }
          : run
      ),
    });
  },

  pauseExecution: () => {
    set({ isPaused: true });
    const { currentRunId, runs } = get();
    if (currentRunId) {
      const run = runs.find((r) => r.id === currentRunId);
      if (run) {
        get().addLog(currentRunId, 'Execution paused');
      }
    }
  },

  resumeExecution: () => {
    set({ isPaused: false });
    const { currentRunId } = get();
    if (currentRunId) {
      get().addLog(currentRunId, 'Execution resumed');
    }
  },

  cancelExecution: (runId) => {
    get().addLog(runId, 'Execution cancelled by user');
    get().completeExecution(runId, 'cancelled');
  },

  clearHistory: () => {
    set({ runs: [] });
  },

  getRun: (runId) => {
    return get().runs.find((r) => r.id === runId);
  },

  // Debug mode methods
  enableDebugMode: () => {
    set({
      debug: {
        ...get().debug,
        enabled: true,
      },
    });
    const { currentRunId } = get();
    if (currentRunId) {
      get().addLog(currentRunId, '🐛 Debug mode enabled');
    }
  },

  disableDebugMode: () => {
    set({
      debug: {
        ...initialDebugState,
        breakpoints: get().debug.breakpoints, // Preserve breakpoints
      },
    });
    const { currentRunId } = get();
    if (currentRunId) {
      get().addLog(currentRunId, '🐛 Debug mode disabled');
    }
  },

  toggleBreakpoint: (stepId) => {
    const { debug } = get();
    const newBreakpoints = new Set(debug.breakpoints);
    if (newBreakpoints.has(stepId)) {
      newBreakpoints.delete(stepId);
    } else {
      newBreakpoints.add(stepId);
    }
    set({
      debug: {
        ...debug,
        breakpoints: newBreakpoints,
      },
    });
  },

  hasBreakpoint: (stepId) => {
    return get().debug.breakpoints.has(stepId);
  },

  clearAllBreakpoints: () => {
    set({
      debug: {
        ...get().debug,
        breakpoints: new Set(),
      },
    });
    const { currentRunId } = get();
    if (currentRunId) {
      get().addLog(currentRunId, 'All breakpoints cleared');
    }
  },

  stepOver: () => {
    const { debug, currentRunId, isPaused } = get();
    if (!isPaused || !debug.enabled) return;

    set({
      isPaused: false,
      debug: {
        ...debug,
        stepOverPending: true,
        pausedAtBreakpoint: false,
      },
    });

    if (currentRunId) {
      get().addLog(currentRunId, '➡️ Step over');
    }
  },

  stepInto: () => {
    const { debug, currentRunId, isPaused } = get();
    if (!isPaused || !debug.enabled) return;

    set({
      isPaused: false,
      debug: {
        ...debug,
        stepOverPending: true,
        pausedAtBreakpoint: false,
      },
    });

    if (currentRunId) {
      get().addLog(currentRunId, '⬇️ Step into');
    }
  },

  stepOut: () => {
    const { debug, currentRunId, isPaused } = get();
    if (!isPaused || !debug.enabled) return;

    set({
      isPaused: false,
      debug: {
        ...debug,
        stepOverPending: false,
        pausedAtBreakpoint: false,
      },
    });

    if (currentRunId) {
      get().addLog(currentRunId, '⬆️ Step out');
    }
  },

  setCurrentDebugStep: (stepId) => {
    set({
      debug: {
        ...get().debug,
        currentStepId: stepId,
      },
    });
  },

  addWatchExpression: (expression) => {
    const { debug } = get();
    if (!debug.watchExpressions.includes(expression)) {
      set({
        debug: {
          ...debug,
          watchExpressions: [...debug.watchExpressions, expression],
        },
      });
    }
  },

  removeWatchExpression: (expression) => {
    const { debug } = get();
    set({
      debug: {
        ...debug,
        watchExpressions: debug.watchExpressions.filter((e) => e !== expression),
      },
    });
  },

  updateCallStack: (stack) => {
    set({
      debug: {
        ...get().debug,
        callStack: stack,
      },
    });
  },

  // API sync methods
  loadHistory: async (workflowId) => {
    set({ isLoadingHistory: true });
    try {
      const url = workflowId
        ? `/api/executions?workflowId=${encodeURIComponent(workflowId)}&limit=50`
        : '/api/executions?limit=50';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to load execution history');
      }

      const executions = await response.json();

      // Convert backend ExecutionRecord format to ExecutionRun format
      const runs: ExecutionRun[] = executions.map((exec: any) => ({
        id: exec.runId,
        workflowId: exec.workflowId,
        workflowName: exec.workflowPath.split('/').pop()?.replace('.md', '') || exec.workflowId,
        status: exec.status,
        startTime: exec.startedAt,
        endTime: exec.completedAt || undefined,
        duration: exec.completedAt
          ? new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()
          : undefined,
        steps: [],
        logs: [],
        inputs: exec.inputs || undefined,
        outputs: exec.outputs || undefined,
      }));

      // Merge with existing runs, avoiding duplicates
      const existingRunIds = new Set(get().runs.map((r) => r.id));
      const newRuns = runs.filter((r) => !existingRunIds.has(r.id));

      set({
        runs: [...get().runs, ...newRuns].slice(0, 50),
        isLoadingHistory: false,
      });
    } catch (error) {
      console.error('Error loading execution history:', error);
      set({ isLoadingHistory: false });
    }
  },

  syncRunWithBackend: async (runId) => {
    // This would be called to persist a run to the backend
    // For now, the backend integration will happen via WebSocket events
    // This is a placeholder for future direct API sync
    console.log('Syncing run with backend:', runId);
  },
}));

// Helper to format duration
export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes + 'm ' + seconds + 's';
}

// Helper to format relative time
export function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return diffMin + ' min ago';
  if (diffHour < 24) return diffHour + ' hour' + (diffHour > 1 ? 's' : '') + ' ago';
  if (diffDay < 7) return diffDay + ' day' + (diffDay > 1 ? 's' : '') + ' ago';
  return then.toLocaleDateString();
}
