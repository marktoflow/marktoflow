/**
 * Store synchronization integration tests.
 *
 * Verifies that promptStore→canvasStore and stepSave→workflowStore
 * syncing works correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('PromptStore → WorkflowStore sync', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('should save pending changes to workflow store on acceptChanges', async () => {
    const { usePromptStore } = await import('../../src/client/stores/promptStore');
    const { useWorkflowStore } = await import('../../src/client/stores/workflowStore');

    // Set up a current workflow in workflow store
    const testWorkflow = {
      metadata: { id: 'test', name: 'Test' },
      steps: [{ id: 'step1', action: 'test.action', inputs: {} }],
    };
    useWorkflowStore.setState({
      currentWorkflow: testWorkflow as any,
      selectedWorkflow: 'test.md',
    });

    // Mock the save API call
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    // Set pending changes and accept
    const updatedWorkflow = {
      ...testWorkflow,
      steps: [
        ...testWorkflow.steps,
        { id: 'step2', action: 'new.action', inputs: {} },
      ],
    };
    usePromptStore.setState({ pendingChanges: updatedWorkflow });
    usePromptStore.getState().acceptChanges();

    // Verify pending changes are cleared
    expect(usePromptStore.getState().pendingChanges).toBeNull();

    // Wait for the async saveWorkflow to complete
    await vi.waitFor(() => {
      const savedWorkflow = useWorkflowStore.getState().currentWorkflow;
      expect(savedWorkflow?.steps).toHaveLength(2);
    });
  });

  it('should clear pending changes on rejectChanges', async () => {
    const { usePromptStore } = await import('../../src/client/stores/promptStore');

    usePromptStore.setState({ pendingChanges: { some: 'data' } });
    usePromptStore.getState().rejectChanges();

    expect(usePromptStore.getState().pendingChanges).toBeNull();
  });
});

describe('WorkflowStore save', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('should persist workflow via API on saveWorkflow', async () => {
    const { useWorkflowStore } = await import('../../src/client/stores/workflowStore');

    useWorkflowStore.setState({ selectedWorkflow: 'test.md' });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const workflow = {
      metadata: { id: 'test', name: 'Test' },
      steps: [{ id: 's1', action: 'a', inputs: {} }],
    };

    await useWorkflowStore.getState().saveWorkflow(workflow as any);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/workflows/'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
