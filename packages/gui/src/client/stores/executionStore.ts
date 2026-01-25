import { create } from 'zustand';
import type { StepStatus, WorkflowStatus } from '@shared/types';

export interface ExecutionStepResult {
  stepId: string;
  stepName: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
  duration?: number;
  output?: unknown;
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

interface ExecutionState {
  runs: ExecutionRun[];
  currentRunId: string | null;
  isExecuting: boolean;
  isPaused: boolean;

  startExecution: (workflowId: string, workflowName: string, inputs?: Record<string, unknown>) => string;
  updateStepStatus: (runId: string, stepId: string, status: StepStatus, output?: unknown, error?: string) => void;
  completeExecution: (runId: string, status: WorkflowStatus, outputs?: Record<string, unknown>) => void;
  addLog: (runId: string, message: string) => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: (runId: string) => void;
  clearHistory: () => void;
  getRun: (runId: string) => ExecutionRun | undefined;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  runs: [],
  currentRunId: null,
  isExecuting: false,
  isPaused: false,

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

  updateStepStatus: (runId, stepId, status, output, error) => {
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
                output: output ?? s.output,
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
                output,
                error,
              },
            ],
          };
        }
      }),
    });
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
