import { describe, it, expect, beforeEach } from 'vitest';
import { useExecutionStore, formatDuration, formatRelativeTime } from '../../src/client/stores/executionStore';

describe('executionStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useExecutionStore.setState({
      runs: [],
      currentRunId: null,
      isExecuting: false,
      isPaused: false,
    });
  });

  describe('startExecution', () => {
    it('should create a new execution run', () => {
      const { startExecution } = useExecutionStore.getState();

      const runId = startExecution('workflow-1', 'Test Workflow');

      const state = useExecutionStore.getState();
      expect(runId).toBeDefined();
      expect(state.currentRunId).toBe(runId);
      expect(state.isExecuting).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.runs).toHaveLength(1);
      expect(state.runs[0].workflowId).toBe('workflow-1');
      expect(state.runs[0].workflowName).toBe('Test Workflow');
      expect(state.runs[0].status).toBe('running');
    });

    it('should include inputs in the run', () => {
      const { startExecution } = useExecutionStore.getState();

      const inputs = { repo: 'owner/repo', pr: 123 };
      const runId = startExecution('workflow-1', 'Test', inputs);

      const state = useExecutionStore.getState();
      expect(state.runs[0].inputs).toEqual(inputs);
    });

    it('should limit runs to 50', () => {
      const { startExecution } = useExecutionStore.getState();

      // Create 55 runs
      for (let i = 0; i < 55; i++) {
        startExecution('wf-' + i, 'Workflow ' + i);
        // Manually complete each run so we can start another
        useExecutionStore.setState({ isExecuting: false, currentRunId: null });
      }

      const state = useExecutionStore.getState();
      expect(state.runs).toHaveLength(50);
    });
  });

  describe('updateStepStatus', () => {
    it('should add a new step when it does not exist', () => {
      const { startExecution, updateStepStatus } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      updateStepStatus(runId, 'step-1', 'running');

      const state = useExecutionStore.getState();
      const run = state.runs.find(r => r.id === runId);
      expect(run?.steps).toHaveLength(1);
      expect(run?.steps[0].stepId).toBe('step-1');
      expect(run?.steps[0].status).toBe('running');
    });

    it('should update an existing step', () => {
      const { startExecution, updateStepStatus } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      updateStepStatus(runId, 'step-1', 'running');
      updateStepStatus(runId, 'step-1', 'completed');

      const state = useExecutionStore.getState();
      const run = state.runs.find(r => r.id === runId);
      expect(run?.steps).toHaveLength(1);
      expect(run?.steps[0].status).toBe('completed');
    });

    it('should record error on failed step', () => {
      const { startExecution, updateStepStatus } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      updateStepStatus(runId, 'step-1', 'running');
      updateStepStatus(runId, 'step-1', 'failed', undefined, 'Something went wrong');

      const state = useExecutionStore.getState();
      const run = state.runs.find(r => r.id === runId);
      expect(run?.steps[0].error).toBe('Something went wrong');
    });
  });

  describe('completeExecution', () => {
    it('should mark execution as completed', () => {
      const { startExecution, completeExecution } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      completeExecution(runId, 'completed', { result: 'success' });

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);
      expect(state.currentRunId).toBeNull();

      const run = state.runs.find(r => r.id === runId);
      expect(run?.status).toBe('completed');
      expect(run?.outputs).toEqual({ result: 'success' });
      expect(run?.endTime).toBeDefined();
      expect(run?.duration).toBeDefined();
    });

    it('should mark execution as failed', () => {
      const { startExecution, completeExecution } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      completeExecution(runId, 'failed');

      const state = useExecutionStore.getState();
      const run = state.runs.find(r => r.id === runId);
      expect(run?.status).toBe('failed');
    });
  });

  describe('addLog', () => {
    it('should add a log message to the run', () => {
      const { startExecution, addLog } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      addLog(runId, 'Test message');

      const state = useExecutionStore.getState();
      const run = state.runs.find(r => r.id === runId);
      const hasMessage = run?.logs.some(log => log.includes('Test message'));
      expect(hasMessage).toBe(true);
    });
  });

  describe('pauseExecution / resumeExecution', () => {
    it('should pause execution', () => {
      const { startExecution, pauseExecution } = useExecutionStore.getState();

      startExecution('wf-1', 'Test');
      pauseExecution();

      const state = useExecutionStore.getState();
      expect(state.isPaused).toBe(true);
    });

    it('should resume execution', () => {
      const { startExecution, pauseExecution, resumeExecution } = useExecutionStore.getState();

      startExecution('wf-1', 'Test');
      pauseExecution();
      resumeExecution();

      const state = useExecutionStore.getState();
      expect(state.isPaused).toBe(false);
    });
  });

  describe('cancelExecution', () => {
    it('should cancel and complete execution', () => {
      const { startExecution, cancelExecution } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      cancelExecution(runId);

      const state = useExecutionStore.getState();
      expect(state.isExecuting).toBe(false);

      const run = state.runs.find(r => r.id === runId);
      expect(run?.status).toBe('cancelled');
    });
  });

  describe('clearHistory', () => {
    it('should clear all runs', () => {
      const { startExecution, clearHistory, completeExecution } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      completeExecution(runId, 'completed');

      clearHistory();

      const state = useExecutionStore.getState();
      expect(state.runs).toHaveLength(0);
    });
  });

  describe('getRun', () => {
    it('should return a run by ID', () => {
      const { startExecution, getRun } = useExecutionStore.getState();

      const runId = startExecution('wf-1', 'Test');
      const run = getRun(runId);

      expect(run).toBeDefined();
      expect(run?.id).toBe(runId);
    });

    it('should return undefined for non-existent run', () => {
      const { getRun } = useExecutionStore.getState();

      const run = getRun('non-existent');
      expect(run).toBeUndefined();
    });
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(59999)).toBe('60.0s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});

describe('formatRelativeTime', () => {
  it('should format just now', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should format minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 min ago');
  });

  it('should format hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
  });

  it('should format days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });
});
