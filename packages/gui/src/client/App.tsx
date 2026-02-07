import { useEffect, useCallback, useState, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Menu, PanelRight, X } from 'lucide-react';
import { Canvas } from './components/Canvas/Canvas';
import { Toolbar } from './components/Canvas/Toolbar';
import { ExecutionOverlay } from './components/Canvas/ExecutionOverlay';
import { ExecutionInputDialog } from './components/Canvas/ExecutionInputDialog';
import { ValidationPanel } from './components/Panels/ValidationPanel';
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
import { ThemeToggle } from './components/common/ThemeToggle';
import { Breadcrumb, type BreadcrumbItem } from './components/common/Breadcrumb';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { OnboardingTour } from './components/Onboarding/OnboardingTour';
import { SkipNav } from './components/Accessibility/SkipNav';
import { LiveRegion } from './components/Accessibility/LiveRegion';
import { useWorkflow } from './hooks/useWorkflow';
import { useWebSocket } from './hooks/useWebSocket';
import { usePromptStore } from './stores/promptStore';
import { useEditorStore } from './stores/editorStore';
import { useNavigationStore } from './stores/navigationStore';
import { useWorkflowStore } from './stores/workflowStore';
import { useExecutionStore } from './stores/executionStore';
import { useLayoutStore, getBreakpoint } from './stores/layoutStore';
import { useCommandStore, type Command } from './stores/commandStore';
import { useThemeStore } from './stores/themeStore';
import { useOnboardingStore } from './stores/onboardingStore';
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
  const { connected, subscribeToExecution, unsubscribeFromExecution } = useWebSocket({
    onWorkflowUpdated: () => {
      refreshWorkflows();
    },
    onExecutionStep: (event) => {
      // Update execution state from WebSocket events
      setCurrentStepId(event.stepId);
      setExecutionSteps((prev) =>
        prev.map((s) =>
          s.stepId === event.stepId
            ? { ...s, status: event.status, duration: event.duration, error: event.error }
            : s
        )
      );
      setExecutionLogs((prev) => [
        ...prev,
        `Step "${event.stepName || event.stepId}": ${event.status}${event.error ? ` - ${event.error}` : ''}`,
      ]);

      // Update execution store
      if (runIdRef.current) {
        updateStepStatus(runIdRef.current, event.stepId, event.status, event.output, event.error);
        addLog(runIdRef.current, `Step "${event.stepName || event.stepId}": ${event.status}`);
      }
    },
    onExecutionCompleted: (event) => {
      setWorkflowStatus(event.status);
      setCurrentStepId(null);
      setExecutionLogs((prev) => [
        ...prev,
        event.status === 'completed'
          ? 'Workflow completed successfully!'
          : event.error || 'Workflow execution failed',
      ]);

      // Update execution store
      if (runIdRef.current) {
        completeExecution(runIdRef.current, event.status);
        if (event.error) {
          addLog(runIdRef.current, `Error: ${event.error}`);
        }
      }

      // Unsubscribe from WebSocket
      if (event.runId) {
        unsubscribeFromExecution(event.runId);
      }
      runIdRef.current = null;
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
    // Debug methods
    debug,
    enableDebugMode,
    disableDebugMode,
    toggleBreakpoint,
    clearAllBreakpoints,
    stepOver,
    stepInto,
    stepOut,
    addWatchExpression,
    removeWatchExpression,
  } = useExecutionStore();

  // Layout store for responsive behavior
  const {
    breakpoint,
    setBreakpoint,
    sidebarOpen,
    setSidebarOpen,
    propertiesPanelOpen,
    setPropertiesPanelOpen,
  } = useLayoutStore();

  // Command palette
  const { open: openCommandPalette, registerCommands } = useCommandStore();
  const { toggleTheme } = useThemeStore();
  const { workflows } = useWorkflowStore();

  // Status message for accessibility live region
  const [liveMessage, setLiveMessage] = useState('');

  // Register commands on mount and when dependencies change
  useEffect(() => {
    const commands: Command[] = [
      // Actions
      { id: 'save', label: 'Save Workflow', category: 'action', shortcut: `${breakpoint === 'mobile' ? 'Ctrl' : '⌘'} + S`, execute: () => handleSave(), keywords: ['save', 'persist'] },
      { id: 'execute', label: 'Execute Workflow', category: 'action', shortcut: `${breakpoint === 'mobile' ? 'Ctrl' : '⌘'} + Enter`, execute: () => handleExecute(), keywords: ['run', 'start'] },
      { id: 'validate', label: 'Validate Workflow', category: 'action', execute: () => handleValidate(), keywords: ['check', 'lint'] },
      { id: 'add-step', label: 'Add New Step', category: 'action', shortcut: 'N', execute: () => handleAddStep(), keywords: ['create', 'new'] },
      // Settings
      { id: 'toggle-theme', label: 'Toggle Theme', category: 'setting', shortcut: `${breakpoint === 'mobile' ? 'Ctrl' : '⌘'} + Shift + T`, execute: () => toggleTheme(), keywords: ['dark', 'light', 'mode'] },
      { id: 'show-shortcuts', label: 'Show Keyboard Shortcuts', category: 'setting', shortcut: `${breakpoint === 'mobile' ? 'Ctrl' : '⌘'} + /`, execute: () => setShortcutsOpen(true), keywords: ['keys', 'hotkeys'] },
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'setting', execute: () => setSidebarOpen(!sidebarOpen), keywords: ['panel', 'left'] },
      { id: 'toggle-properties', label: 'Toggle Properties Panel', category: 'setting', execute: () => setPropertiesPanelOpen(!propertiesPanelOpen), keywords: ['panel', 'right'] },
      // Navigation
      { id: 'nav-back', label: 'Navigate Back', category: 'navigation', execute: () => handleNavigateBack(), keywords: ['parent', 'up'] },
      { id: 'nav-root', label: 'Navigate to Root', category: 'navigation', execute: () => handleNavigateToRoot(), keywords: ['home', 'top'] },
      // Debug
      { id: 'toggle-debug', label: 'Toggle Debug Mode', category: 'action', shortcut: 'F9', execute: () => debug.enabled ? disableDebugMode() : enableDebugMode(), keywords: ['breakpoint', 'inspect'] },
      // Workflows
      ...workflows.map((w) => ({
        id: `workflow-${w.path}`,
        label: w.name,
        description: w.path,
        category: 'workflow' as const,
        execute: () => { useWorkflowStore.getState().selectWorkflow(w.path); },
        keywords: [w.name.toLowerCase()],
      })),
    ];
    registerCommands(commands);
  }, [workflows, sidebarOpen, propertiesPanelOpen, breakpoint, debug.enabled]);

  // Breakpoint detection on resize
  useEffect(() => {
    const handleResize = () => {
      const newBreakpoint = getBreakpoint(window.innerWidth);
      if (newBreakpoint !== breakpoint) {
        setBreakpoint(newBreakpoint);
      }
    };

    // Set initial breakpoint
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint, setBreakpoint]);

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

  // Input collection dialog state
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [pendingInputs, setPendingInputs] = useState<Record<string, any>>({});

  // Validation panel state
  const [showValidationPanel, setShowValidationPanel] = useState(false);

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

  // Handle workflow execution with input collection
  const handleExecute = useCallback(async (inputs?: Record<string, any>) => {
    if (isExecuting) {
      // Stop execution via API
      if (runIdRef.current) {
        try {
          const response = await fetch(`/api/execute/cancel/${runIdRef.current}`, {
            method: 'POST',
          });
          if (response.ok) {
            cancelExecution(runIdRef.current);
            setWorkflowStatus('cancelled');
            setExecutionLogs((prev) => [...prev, 'Execution cancelled by user']);
            runIdRef.current = null;
          }
        } catch (error) {
          console.error('Failed to cancel execution:', error);
          setExecutionLogs((prev) => [...prev, 'Failed to cancel execution']);
        }
      }
      return;
    }

    if (!currentWorkflow || !selectedWorkflow) return;

    // If inputs are not provided and workflow has inputs, show dialog
    if (!inputs && currentWorkflow.inputs && Object.keys(currentWorkflow.inputs).length > 0) {
      setShowInputDialog(true);
      return;
    }

    try {
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

      // Call API to start execution - this returns the actual runId
      const response = await fetch(`/api/execute/${encodeURIComponent(selectedWorkflow)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: inputs || {},
          dryRun: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start execution');
      }

      // Get the actual runId from the backend response
      const apiResult = await response.json();
      const runId = apiResult.runId;

      // Store in history and subscribe to the correct runId
      const workflowName = currentWorkflow.metadata?.name || 'Untitled Workflow';
      startExecution(selectedWorkflow, workflowName, {}, runId);
      runIdRef.current = runId;

      // Subscribe to WebSocket for real-time updates with the correct runId
      subscribeToExecution(runId);

      setExecutionLogs((prev) => [...prev, `Execution started: ${runId}`]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to execute workflow:', error);
      setWorkflowStatus('failed');
      setExecutionLogs((prev) => [...prev, `Error: ${errorMessage}`]);
      if (runIdRef.current) {
        completeExecution(runIdRef.current, 'failed');
        runIdRef.current = null;
      }
    }
  }, [
    isExecuting,
    currentWorkflow,
    selectedWorkflow,
    startExecution,
    cancelExecution,
    subscribeToExecution,
    updateStepStatus,
    addLog,
    completeExecution,
  ]);


  // Handle save
  const handleSave = useCallback(() => {
    if (currentWorkflow) {
      saveWorkflow(currentWorkflow);
    }
  }, [currentWorkflow, saveWorkflow]);

  // Handle validate
  const handleValidate = useCallback(() => {
    if (selectedWorkflow) {
      setShowValidationPanel(true);
    }
  }, [selectedWorkflow]);

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

      // Cmd/Ctrl + K: Command palette
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        openCommandPalette('commands');
        return;
      }

      // Cmd/Ctrl + P: Quick workflow switcher
      if (isMeta && e.key === 'p') {
        e.preventDefault();
        openCommandPalette('workflows');
        return;
      }

      // Cmd/Ctrl + Shift + T: Toggle theme
      if (isMeta && e.shiftKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
        return;
      }

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

      // Debug keyboard shortcuts
      // F9: Toggle debug mode
      if (e.key === 'F9') {
        e.preventDefault();
        if (debug.enabled) {
          disableDebugMode();
        } else {
          enableDebugMode();
        }
      }

      // F10: Step over (when paused in debug mode)
      if (e.key === 'F10' && debug.enabled && isPaused) {
        e.preventDefault();
        stepOver();
      }

      // F11: Step into (when paused in debug mode)
      if (e.key === 'F11' && !e.shiftKey && debug.enabled && isPaused) {
        e.preventDefault();
        stepInto();
      }

      // Shift+F11: Step out (when paused in debug mode)
      if (e.key === 'F11' && e.shiftKey && debug.enabled && isPaused) {
        e.preventDefault();
        stepOut();
      }

      // F5: Continue execution (when paused)
      if (e.key === 'F5' && isPaused) {
        e.preventDefault();
        resumeExecution();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleExecute, handleAddStep, handleNavigateBack, handleNavigateToRoot, debug.enabled, isPaused, enableDebugMode, disableDebugMode, stepOver, stepInto, stepOut, resumeExecution, openCommandPalette, toggleTheme]);

  return (
    <ReactFlowProvider>
      <SkipNav />
      <LiveRegion message={liveMessage} />
      <CommandPalette />
      <OnboardingTour />
      <div className="flex h-screen w-screen overflow-hidden bg-bg-canvas" id="main-content">
        {/* Left Sidebar - Workflow List & Tools */}
        <Sidebar />

        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col relative">
          {/* Mobile Header */}
          {breakpoint === 'mobile' && (
            <div className="flex items-center justify-between p-3 border-b border-border-default bg-bg-panel">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5 text-text-secondary" />
              </button>
              <h1 className="text-sm font-medium text-text-primary">Marktoflow</h1>
              <button
                onClick={() => setPropertiesPanelOpen(true)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-bg-hover transition-colors"
                aria-label="Open properties"
              >
                <PanelRight className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          )}

          {/* Desktop: Connection status, theme toggle & shortcuts */}
          {breakpoint !== 'mobile' && (
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <ThemeToggle showLabel />
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
          )}

          {/* Toolbar */}
          <Toolbar
            onAddStep={handleAddStep}
            onExecute={handleExecute}
            onSave={handleSave}
            onValidate={handleValidate}
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
              onStepOver={() => stepOver()}
              onClose={() => {
                setWorkflowStatus('pending');
                setExecutionSteps([]);
                setExecutionLogs([]);
              }}
              // Debug props
              debug={debug}
              onToggleDebugMode={() => {
                if (debug.enabled) {
                  disableDebugMode();
                } else {
                  enableDebugMode();
                }
              }}
              onToggleBreakpoint={(stepId) => toggleBreakpoint(stepId)}
              onStepInto={() => stepInto()}
              onStepOut={() => stepOut()}
              onClearBreakpoints={() => clearAllBreakpoints()}
              onAddWatchExpression={(expr) => addWatchExpression(expr)}
              onRemoveWatchExpression={(expr) => removeWatchExpression(expr)}
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

        {/* Execution Input Dialog */}
        {currentWorkflow?.inputs && (
          <ExecutionInputDialog
            open={showInputDialog}
            onOpenChange={setShowInputDialog}
            inputs={currentWorkflow.inputs}
            onExecute={handleExecute}
            workflowName={currentWorkflow.metadata?.name}
          />
        )}

        {/* Validation Panel */}
        <ValidationPanel
          workflowPath={showValidationPanel ? selectedWorkflow : null}
          onClose={() => setShowValidationPanel(false)}
        />

        {/* Keyboard Shortcuts Modal */}
        <KeyboardShortcuts open={isShortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </ReactFlowProvider>
  );
}
