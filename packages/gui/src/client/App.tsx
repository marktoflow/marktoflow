import { useEffect, useCallback, useState, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas/Canvas';
import { Toolbar } from './components/Canvas/Toolbar';
import { ExecutionOverlay } from './components/Canvas/ExecutionOverlay';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PropertiesPanel } from './components/Panels/PropertiesPanel';
import { PromptInput } from './components/Prompt/PromptInput';
import { ChangePreview } from './components/Prompt/ChangePreview';
import { NewStepWizard } from './components/Editor/NewStepWizard';
import {
  KeyboardShortcuts,
  KeyboardShortcutsButton,
  useKeyboardShortcuts,
} from './components/common/KeyboardShortcuts';
import { Breadcrumb, type BreadcrumbItem } from './components/common/Breadcrumb';
import { useWorkflow } from './hooks/useWorkflow';
import { useWebSocket } from './hooks/useWebSocket';
import { usePromptStore } from './stores/promptStore';
import { useEditorStore } from './stores/editorStore';
import { useNavigationStore } from './stores/navigationStore';
import { useWorkflowStore } from './stores/workflowStore';
import { useExecutionStore } from './stores/executionStore';
import type { WorkflowStep, StepStatus, WorkflowStatus } from '@shared/types';

export default function App() {
  // Workflow management
  const {
    currentWorkflow,
    selectedWorkflow,
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

  // Keyboard shortcuts
  const { isOpen: isShortcutsOpen, setIsOpen: setShortcutsOpen, openShortcuts } = useKeyboardShortcuts();

  // Navigation for sub-workflow drilling
  const { breadcrumbs, popToIndex, resetNavigation } = useNavigationStore();
  const { loadWorkflow } = useWorkflowStore();

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((item: BreadcrumbItem, index: number) => {
    // Navigate to the clicked breadcrumb
    popToIndex(index);
    loadWorkflow(item.path || '');
  }, [popToIndex, loadWorkflow]);

  // WebSocket for real-time updates
  const { connected } = useWebSocket({
    onWorkflowUpdated: () => {
      refreshWorkflows();
    },
  });

  // Execution store
  const {
    isExecuting,
    isPaused,
    currentRunId,
    runs,
    startExecution,
    updateStepStatus,
    completeExecution,
    addLog,
    pauseExecution,
    resumeExecution,
    cancelExecution,
  } = useExecutionStore();

  // Local execution state for overlay
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
  const runIdRef = useRef<string | null>(null);

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
      if (runIdRef.current) {
        cancelExecution(runIdRef.current);
      }
      setWorkflowStatus('cancelled');
      setExecutionLogs((prev) => [...prev, 'Execution cancelled by user']);
      return;
    }

    if (!currentWorkflow) return;

    // Start execution - store in history
    const workflowName = currentWorkflow.metadata?.name || 'Untitled Workflow';
    const runId = startExecution(
      selectedWorkflow || 'unknown',
      workflowName
    );
    runIdRef.current = runId;

    // Update local state for overlay
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
    simulateExecution(currentWorkflow.steps, runId);
  }, [isExecuting, currentWorkflow, selectedWorkflow, startExecution, cancelExecution]);

  // Simulate workflow execution
  const simulateExecution = useCallback(
    async (steps: WorkflowStep[], runId: string) => {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepName = step.name || step.id;

        // Update current step
        setCurrentStepId(step.id);
        setExecutionSteps((prev) =>
          prev.map((s) =>
            s.stepId === step.id ? { ...s, status: 'running' as StepStatus } : s
          )
        );
        setExecutionLogs((prev) => [
          ...prev,
          'Executing step: ' + stepName,
        ]);

        // Update execution store
        updateStepStatus(runId, step.id, 'running');
        addLog(runId, 'Executing step: ' + stepName);

        // Simulate step execution
        await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

        // Update step status
        const success = Math.random() > 0.1; // 90% success rate
        const duration = Math.floor(1000 + Math.random() * 1000);
        const error = success ? undefined : 'Simulated error';

        setExecutionSteps((prev) =>
          prev.map((s) =>
            s.stepId === step.id
              ? {
                  ...s,
                  status: success ? ('completed' as StepStatus) : ('failed' as StepStatus),
                  duration,
                  error,
                }
              : s
          )
        );

        const logMessage = success
          ? 'Step "' + stepName + '" completed'
          : 'Step "' + stepName + '" failed';
        setExecutionLogs((prev) => [...prev, logMessage]);

        // Update execution store
        updateStepStatus(runId, step.id, success ? 'completed' : 'failed', undefined, error);
        addLog(runId, logMessage);

        if (!success) {
          setWorkflowStatus('failed');
          completeExecution(runId, 'failed');
          runIdRef.current = null;
          return;
        }
      }

      setWorkflowStatus('completed');
      setExecutionLogs((prev) => [...prev, 'Workflow completed successfully!']);
      completeExecution(runId, 'completed');
      runIdRef.current = null;
    },
    [updateStepStatus, addLog, completeExecution]
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (currentWorkflow) {
      saveWorkflow(currentWorkflow);
    }
  }, [currentWorkflow, saveWorkflow]);

  // Handle navigating back to parent workflow
  const handleNavigateBack = useCallback(() => {
    if (breadcrumbs.length > 1) {
      const parentIndex = breadcrumbs.length - 2;
      const parentItem = breadcrumbs[parentIndex];
      popToIndex(parentIndex);
      loadWorkflow(parentItem.path);
    }
  }, [breadcrumbs, popToIndex, loadWorkflow]);

  // Handle navigating to root workflow
  const handleNavigateToRoot = useCallback(() => {
    if (breadcrumbs.length > 1) {
      const rootItem = breadcrumbs[0];
      popToIndex(0);
      loadWorkflow(rootItem.path);
    }
  }, [breadcrumbs, popToIndex, loadWorkflow]);

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

      // Cmd/Ctrl + Left Arrow: Navigate back to parent workflow
      if (isMeta && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateBack();
      }

      // Cmd/Ctrl + Up Arrow: Navigate to root workflow
      if (isMeta && e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigateToRoot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleExecute, handleAddStep, handleNavigateBack, handleNavigateToRoot]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas-bg">
        {/* Left Sidebar - Workflow List & Tools */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col relative">
          {/* Connection status & shortcuts */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <KeyboardShortcutsButton onClick={openShortcuts} />
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

          {/* Breadcrumb for sub-workflow navigation */}
          <Breadcrumb
            items={breadcrumbs}
            onNavigate={handleBreadcrumbNavigate}
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
              onPause={() => pauseExecution()}
              onResume={() => resumeExecution()}
              onStop={() => {
                if (runIdRef.current) {
                  cancelExecution(runIdRef.current);
                  runIdRef.current = null;
                }
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

        {/* Keyboard Shortcuts Modal */}
        <KeyboardShortcuts open={isShortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </ReactFlowProvider>
  );
}
