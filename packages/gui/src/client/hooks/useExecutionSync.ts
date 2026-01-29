import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { useExecutionStore } from '../stores/executionStore';

/**
 * Syncs execution state with canvas visualization
 * - Updates node status based on step execution
 * - Auto-expands active branches in control flow
 * - Highlights active nested steps
 * - Shows loop iteration progress
 */
export function useExecutionSync() {
  const nodes = useCanvasStore((state) => state.nodes);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const toggleGroupCollapsed = useCanvasStore((state) => state.toggleGroupCollapsed);
  const groupCollapsedState = useCanvasStore((state) => state.groupCollapsedState);

  const currentRunId = useExecutionStore((state) => state.currentRunId);
  const currentRun = useExecutionStore((state) =>
    state.currentRunId ? state.getRun(state.currentRunId) : undefined
  );
  const controlFlow = useExecutionStore((state) => state.controlFlow);
  const isExecuting = useExecutionStore((state) => state.isExecuting);

  // Sync step status with nodes
  useEffect(() => {
    if (!currentRun || !isExecuting) return;

    // Update each node with its execution status
    currentRun.steps.forEach((step) => {
      const node = nodes.find((n) => n.id === step.stepId);
      if (node && node.data.status !== step.status) {
        updateNodeData(step.stepId, {
          status: step.status,
          duration: step.duration,
          error: step.error,
        });
      }
    });
  }, [currentRun, nodes, updateNodeData, isExecuting]);

  // Sync active branches and auto-expand groups
  useEffect(() => {
    if (!isExecuting) return;

    Object.entries(controlFlow.activeBranches).forEach(([controlFlowId, branchName]) => {
      // Update control flow node with active branch
      updateNodeData(controlFlowId, {
        activeBranch: branchName,
        status: 'running',
      });

      // Auto-expand the active branch group
      const groupId = `${controlFlowId}-${branchName}-group`;
      const groupNode = nodes.find((n) => n.id === groupId);
      if (groupNode && groupCollapsedState[groupId] === true) {
        // Group is collapsed, expand it
        toggleGroupCollapsed(groupId);
      }
    });
  }, [
    controlFlow.activeBranches,
    nodes,
    updateNodeData,
    toggleGroupCollapsed,
    groupCollapsedState,
    isExecuting,
  ]);

  // Sync skipped branches
  useEffect(() => {
    if (!isExecuting) return;

    Object.entries(controlFlow.skippedBranches).forEach(([controlFlowId, branchNames]) => {
      updateNodeData(controlFlowId, {
        skippedBranches: branchNames,
      });
    });
  }, [controlFlow.skippedBranches, updateNodeData, isExecuting]);

  // Sync loop iterations
  useEffect(() => {
    if (!isExecuting) return;

    Object.entries(controlFlow.loopIterations).forEach(([loopId, { current, total }]) => {
      updateNodeData(loopId, {
        currentIteration: current,
        totalIterations: total,
        status: 'running',
      });
    });
  }, [controlFlow.loopIterations, updateNodeData, isExecuting]);

  // Sync active nested steps
  useEffect(() => {
    if (!isExecuting) return;

    // Mark nested steps as active/running
    controlFlow.activeNestedSteps.forEach((stepId) => {
      const node = nodes.find((n) => n.id === stepId);
      if (node && node.data.status !== 'running') {
        updateNodeData(stepId, {
          status: 'running',
        });
      }
    });
  }, [controlFlow.activeNestedSteps, nodes, updateNodeData, isExecuting]);

  // Clear execution state when execution completes
  useEffect(() => {
    if (!isExecuting && currentRun?.status === 'completed') {
      // Mark all nodes as completed or failed based on final status
      nodes.forEach((node) => {
        if (node.type !== 'trigger' && node.type !== 'output') {
          const step = currentRun.steps.find((s) => s.stepId === node.id);
          if (step) {
            updateNodeData(node.id, {
              status: step.status,
            });
          }
        }
      });
    }
  }, [isExecuting, currentRun, nodes, updateNodeData]);
}

/**
 * Hook to get execution state for a specific node
 */
export function useNodeExecutionState(nodeId: string) {
  const currentRun = useExecutionStore((state) =>
    state.currentRunId ? state.getRun(state.currentRunId) : undefined
  );
  const controlFlow = useExecutionStore((state) => state.controlFlow);

  const step = currentRun?.steps.find((s) => s.stepId === nodeId);
  const activeBranch = controlFlow.activeBranches[nodeId];
  const skippedBranches = controlFlow.skippedBranches[nodeId];
  const loopIteration = controlFlow.loopIterations[nodeId];
  const isActiveNested = controlFlow.activeNestedSteps.has(nodeId);

  return {
    step,
    activeBranch,
    skippedBranches,
    loopIteration,
    isActiveNested,
    status: step?.status || 'pending',
    duration: step?.duration,
    error: step?.error,
  };
}
