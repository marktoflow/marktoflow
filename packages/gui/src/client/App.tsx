import { useEffect, useCallback, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas/Canvas';
import { Toolbar } from './components/Canvas/Toolbar';
import { ExecutionOverlay } from './components/Canvas/ExecutionOverlay';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PropertiesPanel } from './components/Panels/PropertiesPanel';
import { PromptInput } from './components/Prompt/PromptInput';
import { ChangePreview } from './components/Prompt/ChangePreview';
import { NewStepWizard } from './components/Editor/NewStepWizard';
import { useWorkflow } from './hooks/useWorkflow';
import { useWebSocket } from './hooks/useWebSocket';
import { usePromptStore } from './stores/promptStore';
import { useEditorStore } from './stores/editorStore';
import type { WorkflowStep, StepStatus, WorkflowStatus } from '@shared/types';

export default function App() {
  // Workflow management
  const {
    currentWorkflow,
    saveWorkflow,
    refreshWorkflows,
  } = useWorkflow();

  // Editor state
  const {
    isNewStepOpen,
    newStepPosition,
    openNewStepWizard,
    closeNewStepWizard,
  } = useEditorStore();

  // Prompt state
  const { pendingChanges, acceptChanges, rejectChanges } = usePromptStore();

  // WebSocket for real-time updates
  const { connected } = useWebSocket({
    onWorkflowUpdated: () => {
      refreshWorkflows();
    },
  });

  // Execution state (mock for now)
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('pending');
  const [executionSteps, setExecutionSteps] = useState<Array<{
    stepId: string;
    stepName: string;
    status: StepStatus;
    duration?: number;
    error?: string;
  }>>([]);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);

  // Handle adding a new step
  const handleAddStep = useCallback(() => {
    openNewStepWizard();
  }, [openNewStepWizard]);

  // Handle step creation
  const handleCreateStep = useCallback(
    (step: WorkflowStep) => {
      if (!currentWorkflow) return;

      // Add step to workflow
      const updatedWorkflow = {
        ...currentWorkflow,
        steps: [...currentWorkflow.steps, step],
      };

      saveWorkflow(updatedWorkflow);
      console.log('Created step:', step);
    },
    [currentWorkflow, saveWorkflow]
  );

  // Handle workflow execution
  const handleExecute = useCallback(() => {
    if (isExecuting) {
      // Stop execution
      setIsExecuting(false);
      setWorkflowStatus('cancelled');
      setExecutionLogs((prev) => [...prev, 'Execution cancelled by user']);
      return;
    }

    if (!currentWorkflow) return;

    // Start execution
    setIsExecuting(true);
    setIsPaused(false);
    setWorkflowStatus('running');
    setCurrentStepId(null);
    setExecutionLogs(['Starting workflow execution...']);

    // Initialize steps
    setExecutionSteps(
      currentWorkflow.steps.map((step) => ({
        stepId: step.id,
        stepName: step.name || step.id,
        status: 'pending' as StepStatus,
      }))
    );

    // Simulate execution (replace with actual execution via API)
    simulateExecution(currentWorkflow.steps);
  }, [isExecuting, currentWorkflow]);

  // Simulate workflow execution
  const simulateExecution = useCallback(
    async (steps: WorkflowStep[]) => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Update current step
        setCurrentStepId(step.id);
        setExecutionSteps((prev) =>
          prev.map((s) =>
            s.stepId === step.id ? { ...s, status: 'running' as StepStatus } : s
          )
        );
        setExecutionLogs((prev) => [
          ...prev,
          `Executing step: ${step.name || step.id}`,
        ]);

        // Simulate step execution
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Update step status
        const success = Math.random() > 0.1; // 90% success rate
        setExecutionSteps((prev) =>
          prev.map((s) =>
            s.stepId === step.id
              ? {
                  ...s,
                  status: success ? ('completed' as StepStatus) : ('failed' as StepStatus),
                  duration: Math.floor(1000 + Math.random() * 1000),
                  error: success ? undefined : 'Simulated error',
                }
              : s
          )
        );
        setExecutionLogs((prev) => [
          ...prev,
          success
            ? `✓ Step "${step.name || step.id}" completed`
            : `✗ Step "${step.name || step.id}" failed`,
        ]);

        if (!success) {
          setWorkflowStatus('failed');
          setIsExecuting(false);
          return;
        }
      }

      setWorkflowStatus('completed');
      setIsExecuting(false);
      setExecutionLogs((prev) => [...prev, 'Workflow completed successfully!']);
    },
    []
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (currentWorkflow) {
      saveWorkflow(currentWorkflow);
    }
  }, [currentWorkflow, saveWorkflow]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + S: Save
      if (isMeta && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Cmd/Ctrl + Enter: Execute
      if (isMeta && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }

      // N: New step (when no modifier)
      if (e.key === 'n' && !isMeta && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleAddStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleExecute, handleAddStep]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas-bg">
        {/* Left Sidebar - Workflow List & Tools */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col relative">
          {/* Connection status */}
          <div className="absolute top-4 right-4 z-10">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                connected
                  ? 'bg-success/10 text-success'
                  : 'bg-error/10 text-error'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-success' : 'bg-error'
                }`}
              />
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          {/* Toolbar */}
          <Toolbar
            onAddStep={handleAddStep}
            onExecute={handleExecute}
            onSave={handleSave}
            isExecuting={isExecuting}
          />

          {/* Canvas */}
          <div className="flex-1 relative">
            <Canvas />

            {/* Execution Overlay */}
            <ExecutionOverlay
              isExecuting={isExecuting}
              isPaused={isPaused}
              workflowStatus={workflowStatus}
              currentStepId={currentStepId}
              steps={executionSteps}
              logs={executionLogs}
              onPause={() => setIsPaused(true)}
              onResume={() => setIsPaused(false)}
              onStop={() => {
                setIsExecuting(false);
                setWorkflowStatus('cancelled');
              }}
              onStepOver={() => {
                // TODO: Implement step-over debugging
              }}
              onClose={() => {
                setWorkflowStatus('pending');
                setExecutionSteps([]);
                setExecutionLogs([]);
              }}
            />
          </div>

          {/* AI Prompt Input */}
          <PromptInput />
        </div>

        {/* Right Panel - Properties */}
        <PropertiesPanel />

        {/* New Step Wizard */}
        <NewStepWizard
          open={isNewStepOpen}
          onOpenChange={(open) => {
            if (!open) closeNewStepWizard();
          }}
          onCreateStep={handleCreateStep}
          position={newStepPosition || undefined}
        />

        {/* Change Preview Modal */}
        {pendingChanges && (
          <ChangePreview
            open={!!pendingChanges}
            onOpenChange={() => rejectChanges()}
            originalWorkflow={currentWorkflow}
            modifiedWorkflow={pendingChanges}
            explanation="AI has suggested the following changes to your workflow."
            onAccept={acceptChanges}
            onReject={rejectChanges}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}
