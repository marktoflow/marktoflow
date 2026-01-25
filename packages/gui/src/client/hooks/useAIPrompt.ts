import { useCallback } from 'react';
import { usePromptStore } from '../stores/promptStore';
import { useWorkflowStore } from '../stores/workflowStore';

export function useAIPrompt() {
  const {
    isProcessing,
    history,
    lastError,
    pendingChanges,
    sendPrompt,
    acceptChanges,
    rejectChanges,
    clearHistory,
  } = usePromptStore();

  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);

  // Send a prompt with the current workflow context
  const submitPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      await sendPrompt(prompt);
    },
    [sendPrompt]
  );

  // Quick action helpers
  const addStep = useCallback(
    async (service: string, description?: string) => {
      const prompt = description
        ? `Add a ${service} step: ${description}`
        : `Add a ${service} step at the end of the workflow`;
      await submitPrompt(prompt);
    },
    [submitPrompt]
  );

  const modifyStep = useCallback(
    async (stepId: string, modification: string) => {
      const prompt = `Modify step "${stepId}": ${modification}`;
      await submitPrompt(prompt);
    },
    [submitPrompt]
  );

  const addErrorHandling = useCallback(
    async (stepId?: string, retries = 3) => {
      const prompt = stepId
        ? `Add error handling with ${retries} retries to step "${stepId}"`
        : `Add error handling with ${retries} retries to all steps`;
      await submitPrompt(prompt);
    },
    [submitPrompt]
  );

  const addCondition = useCallback(
    async (stepId: string, condition: string) => {
      const prompt = `Add a condition to step "${stepId}": only run if ${condition}`;
      await submitPrompt(prompt);
    },
    [submitPrompt]
  );

  const convertToSubworkflow = useCallback(
    async (stepIds: string[], name: string) => {
      const prompt = `Convert steps ${stepIds.join(', ')} into a sub-workflow called "${name}"`;
      await submitPrompt(prompt);
    },
    [submitPrompt]
  );

  const explainWorkflow = useCallback(async () => {
    const prompt =
      'Explain what this workflow does, step by step, in simple terms';
    await submitPrompt(prompt);
  }, [submitPrompt]);

  const suggestImprovements = useCallback(async () => {
    const prompt =
      'Analyze this workflow and suggest improvements for error handling, efficiency, or reliability';
    await submitPrompt(prompt);
  }, [submitPrompt]);

  return {
    // State
    isProcessing,
    history,
    lastError,
    pendingChanges,
    currentWorkflow,

    // Core actions
    submitPrompt,
    acceptChanges,
    rejectChanges,
    clearHistory,

    // Quick actions
    addStep,
    modifyStep,
    addErrorHandling,
    addCondition,
    convertToSubworkflow,
    explainWorkflow,
    suggestImprovements,
  };
}
