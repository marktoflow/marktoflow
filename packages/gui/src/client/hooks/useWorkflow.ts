import { useCallback, useEffect } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { useCanvasStore } from '../stores/canvasStore';
import { useWebSocket } from './useWebSocket';
import { workflowToGraph } from '../utils/workflowToGraph';

export function useWorkflow() {
  const {
    workflows,
    selectedWorkflow,
    currentWorkflow,
    isLoading,
    error,
    loadWorkflows,
    selectWorkflow,
    loadWorkflow,
    saveWorkflow,
    createWorkflow,
    deleteWorkflow,
  } = useWorkflowStore();

  const { setNodes, setEdges } = useCanvasStore();

  // Subscribe to workflow updates via WebSocket
  const { subscribeToWorkflow, unsubscribeFromWorkflow, connected } = useWebSocket({
    onWorkflowUpdated: (event) => {
      if (event.path === selectedWorkflow) {
        // Reload workflow when it changes
        loadWorkflow(event.path);
      }
      // Refresh workflow list for add/remove events
      if (event.event === 'add' || event.event === 'remove') {
        loadWorkflows();
      }
    },
  });

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // Subscribe to selected workflow
  useEffect(() => {
    if (connected && selectedWorkflow) {
      subscribeToWorkflow(selectedWorkflow);
      return () => {
        unsubscribeFromWorkflow(selectedWorkflow);
      };
    }
  }, [connected, selectedWorkflow, subscribeToWorkflow, unsubscribeFromWorkflow]);

  // Update canvas when workflow changes
  useEffect(() => {
    if (currentWorkflow) {
      const { nodes, edges } = workflowToGraph(currentWorkflow as any);
      setNodes(nodes);
      setEdges(edges);
    }
  }, [currentWorkflow, setNodes, setEdges]);

  // Select workflow and update canvas
  const handleSelectWorkflow = useCallback(
    (path: string) => {
      selectWorkflow(path);
    },
    [selectWorkflow]
  );

  // Save workflow and refresh canvas
  const handleSaveWorkflow = useCallback(
    async (workflow: typeof currentWorkflow) => {
      if (!workflow) return;
      await saveWorkflow(workflow);
    },
    [saveWorkflow]
  );

  // Create new workflow
  const handleCreateWorkflow = useCallback(
    async (name: string) => {
      await createWorkflow(name);
    },
    [createWorkflow]
  );

  // Delete workflow
  const handleDeleteWorkflow = useCallback(
    async (path: string) => {
      await deleteWorkflow(path);
    },
    [deleteWorkflow]
  );

  // Get available variables at a given step index
  const getAvailableVariables = useCallback(
    (stepIndex: number): string[] => {
      if (!currentWorkflow) return [];

      const variables: string[] = [];

      // Add input variables
      if (currentWorkflow.inputs) {
        for (const key of Object.keys(currentWorkflow.inputs)) {
          variables.push(`inputs.${key}`);
        }
      }

      // Add output variables from previous steps
      for (let i = 0; i < stepIndex && i < currentWorkflow.steps.length; i++) {
        const step = currentWorkflow.steps[i];
        if (step.outputVariable) {
          variables.push(step.outputVariable);
        }
      }

      return variables;
    },
    [currentWorkflow]
  );

  return {
    // State
    workflows,
    selectedWorkflow,
    currentWorkflow,
    isLoading,
    error,

    // Actions
    selectWorkflow: handleSelectWorkflow,
    saveWorkflow: handleSaveWorkflow,
    createWorkflow: handleCreateWorkflow,
    deleteWorkflow: handleDeleteWorkflow,
    refreshWorkflows: loadWorkflows,
    getAvailableVariables,
  };
}
