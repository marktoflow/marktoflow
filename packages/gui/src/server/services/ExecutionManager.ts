/**
 * ExecutionManager service for managing workflow executions in the GUI
 *
 * Tracks active executions, provides cancellation support, and integrates
 * with StateStore for persistence and Socket.IO for real-time updates.
 */

import {
  parseFile,
  WorkflowEngine,
  SDKRegistry,
  createSDKStepExecutor,
  WorkflowStatus,
  StepStatus,
  StateStore,
  CoreInitializer,
  WorkflowInitializer,
} from '@marktoflow/core';

// ============================================================================
// Types
// ============================================================================

export interface ActiveExecution {
  runId: string;
  workflowPath: string;
  workflowId: string;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  abortController: AbortController;
  engine: WorkflowEngine;
}

export interface ExecutionStatus {
  runId: string;
  workflowPath: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found';
  currentStep: number;
  totalSteps: number;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  stepResults: Array<{
    stepId: string;
    status: string;
    duration: number | null;
    output?: unknown;
    error?: string;
  }>;
}

export interface WsEmitter {
  emitExecutionStarted(runId: string, data: unknown): void;
  emitExecutionStep(runId: string, data: unknown): void;
  emitExecutionCompleted(runId: string, data: unknown): void;
}

// ============================================================================
// ExecutionManager Implementation
// ============================================================================

export class ExecutionManager {
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private stateStore: StateStore;
  private wsEmitter: WsEmitter | null;

  constructor(
    stateStore: StateStore,
    wsEmitter: WsEmitter | null = null,
    _workflowDir: string = process.cwd() // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {
    this.stateStore = stateStore;
    this.wsEmitter = wsEmitter;
  }

  /**
   * Start a new workflow execution
   */
  async startExecution(
    workflowPath: string,
    inputs: Record<string, unknown> = {}
  ): Promise<string> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const abortController = new AbortController();

    // Parse the workflow
    const { workflow } = await parseFile(workflowPath);

    // Create execution record in state store
    this.stateStore.createExecution({
      runId,
      workflowId: workflow.metadata.id,
      workflowPath,
      status: WorkflowStatus.RUNNING,
      startedAt: new Date(),
      completedAt: null,
      currentStep: 0,
      totalSteps: workflow.steps.length,
      inputs,
      outputs: null,
      error: null,
      metadata: null,
    });

    // Create workflow engine with callbacks
    const engine = new WorkflowEngine(
      {},
      {
        onStepStart: (step) => {
          const active = this.activeExecutions.get(runId);
          if (active) {
            const stepIndex = workflow.steps.findIndex(s => s.id === step.id);
            active.currentStep = stepIndex + 1;

            // Update state store (protected in case db is closed during cleanup)
            try {
              this.stateStore.updateExecution(runId, {
                currentStep: stepIndex + 1,
              });

              // Save checkpoint
              this.stateStore.saveCheckpoint({
                runId,
                stepIndex,
                stepName: step.id,
                status: StepStatus.RUNNING,
                startedAt: new Date(),
                completedAt: null,
                inputs: step.inputs as Record<string, unknown> | null,
                outputs: null,
                error: null,
                retryCount: 0,
              });
            } catch {
              // Database may be closed during test cleanup, ignore
            }

            // Emit via WebSocket
            if (this.wsEmitter) {
              this.wsEmitter.emitExecutionStep(runId, {
                stepId: step.id,
                stepIndex,
                status: 'running',
                action: step.action,
              });
            }
          }
        },
        onStepComplete: (step, result) => {
          const active = this.activeExecutions.get(runId);
          if (active) {
            const stepIndex = workflow.steps.findIndex(s => s.id === step.id);

            // Update checkpoint (protected in case db is closed during cleanup)
            try {
              this.stateStore.saveCheckpoint({
                runId,
                stepIndex,
                stepName: step.id,
                status: result.status,
                startedAt: new Date(Date.now() - (result.duration || 0)),
                completedAt: new Date(),
                inputs: step.inputs as Record<string, unknown> | null,
                outputs: result.output,
                error: result.error ? String(result.error) : null,
                retryCount: result.retryCount || 0,
              });
            } catch {
              // Database may be closed during test cleanup, ignore
            }

            // Emit via WebSocket
            if (this.wsEmitter) {
              this.wsEmitter.emitExecutionStep(runId, {
                stepId: step.id,
                stepIndex,
                status: result.status,
                duration: result.duration,
                output: result.output,
                error: result.error,
              });
            }
          }
        },
      }
    );

    // Track active execution
    const activeExecution: ActiveExecution = {
      runId,
      workflowPath,
      workflowId: workflow.metadata.id,
      startedAt: new Date(),
      status: 'running',
      currentStep: 0,
      totalSteps: workflow.steps.length,
      abortController,
      engine,
    };
    this.activeExecutions.set(runId, activeExecution);

    // Emit execution started
    if (this.wsEmitter) {
      this.wsEmitter.emitExecutionStarted(runId, {
        workflowPath,
        workflowId: workflow.metadata.id,
        workflowName: workflow.metadata.name,
        totalSteps: workflow.steps.length,
        inputs,
      });
    }

    // Execute workflow asynchronously
    this.executeWorkflowAsync(runId, workflow, inputs, engine);

    return runId;
  }

  /**
   * Execute workflow asynchronously (non-blocking)
   */
  private async executeWorkflowAsync(
    runId: string,
    workflow: Awaited<ReturnType<typeof parseFile>>['workflow'],
    inputs: Record<string, unknown>,
    engine: WorkflowEngine
  ): Promise<void> {
    console.log(`[ExecutionManager] Starting async execution for ${runId}`);
    console.log(`[ExecutionManager] Workflow: ${workflow.metadata.name} (${workflow.steps.length} steps)`);
    console.log(`[ExecutionManager] Inputs:`, JSON.stringify(inputs, null, 2));

    try {
      // Set up SDK registry
      const registry = new SDKRegistry();

      // Always register core built-in tools (they don't require external dependencies)
      registry.registerInitializer('core', CoreInitializer);
      registry.registerInitializer('workflow', WorkflowInitializer);

      // Dynamically import and register integrations
      try {
        console.log('[ExecutionManager] Loading integrations...');
        // Use direct dynamic import - works better with tsx and TypeScript
        const integrationsModule = await import('@marktoflow/integrations');
        if (integrationsModule.registerIntegrations) {
          integrationsModule.registerIntegrations(registry);
          console.log('[ExecutionManager] Integrations registered');
        }
      } catch (error) {
        // @marktoflow/integrations may not be available in all environments
        // Continue without it - core tools will still work
        console.error('[ExecutionManager] Failed to load integrations:', error);
        console.log('[ExecutionManager] Continuing with core tools only');
      }

      console.log('[ExecutionManager] Registering workflow tools:', Object.keys(workflow.tools || {}));
      registry.registerTools(workflow.tools);

      console.log('[ExecutionManager] Starting workflow execution...');
      // Execute workflow
      const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());
      console.log('[ExecutionManager] Workflow execution completed:', result.status);
      if (result.error) {
        console.error('[ExecutionManager] Workflow error:', result.error);
      }

      // Update state store first (before marking as complete, to avoid race condition with waitForAll)
      try {
        this.stateStore.updateExecution(runId, {
          status: result.status,
          completedAt: new Date(),
          outputs: result.output || null,
          error: result.error || null,
        });
      } catch {
        // Database may be closed during test cleanup, ignore
      }

      // Update active execution status (this signals waitForAll that we're done)
      const active = this.activeExecutions.get(runId);
      if (active) {
        active.status = result.status === WorkflowStatus.COMPLETED ? 'completed' : 'failed';
      }

      // Emit completion via WebSocket
      if (this.wsEmitter) {
        this.wsEmitter.emitExecutionCompleted(runId, {
          status: result.status,
          duration: result.duration,
          stepResults: result.stepResults,
          outputs: result.output,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log the error for debugging
      console.error(`[ExecutionManager] Workflow execution failed (${runId}):`, errorMessage);
      if (errorStack) {
        console.error('[ExecutionManager] Stack trace:', errorStack);
      }

      // Update state store first (before marking as failed, to avoid race condition with waitForAll)
      try {
        this.stateStore.updateExecution(runId, {
          status: WorkflowStatus.FAILED,
          completedAt: new Date(),
          error: errorMessage,
        });
      } catch {
        // Database may be closed during test cleanup, ignore
      }

      // Update active execution status (this signals waitForAll that we're done)
      const active = this.activeExecutions.get(runId);
      if (active) {
        active.status = 'failed';
      }

      // Emit failure via WebSocket
      if (this.wsEmitter) {
        this.wsEmitter.emitExecutionCompleted(runId, {
          status: 'failed',
          error: errorMessage,
        });
      }
    } finally {
      // Clean up active execution after a delay (keep for status queries)
      setTimeout(() => {
        this.activeExecutions.delete(runId);
      }, 60000); // Keep for 1 minute after completion
    }
  }

  /**
   * Cancel an active execution
   */
  async cancelExecution(runId: string): Promise<boolean> {
    const active = this.activeExecutions.get(runId);

    if (!active) {
      // Check if it exists in state store
      const execution = this.stateStore.getExecution(runId);
      if (!execution) {
        return false;
      }

      // Already completed
      if (execution.status !== WorkflowStatus.RUNNING) {
        return false;
      }

      // Update as cancelled (execution might be orphaned)
      this.stateStore.updateExecution(runId, {
        status: WorkflowStatus.CANCELLED,
        completedAt: new Date(),
        error: 'Execution cancelled by user',
      });

      return true;
    }

    // Abort the execution
    active.abortController.abort();
    active.status = 'cancelled';

    // Update state store
    this.stateStore.updateExecution(runId, {
      status: WorkflowStatus.CANCELLED,
      completedAt: new Date(),
      error: 'Execution cancelled by user',
    });

    // Emit cancellation via WebSocket
    if (this.wsEmitter) {
      this.wsEmitter.emitExecutionCompleted(runId, {
        status: 'cancelled',
        error: 'Execution cancelled by user',
      });
    }

    return true;
  }

  /**
   * Resume a paused execution (e.g., after form submission)
   */
  async resumeExecution(
    runId: string,
    stepId: string,
    resumeData: Record<string, unknown>
  ): Promise<void> {
    // Check if execution exists
    const execution = this.stateStore.getExecution(runId);
    if (!execution) {
      throw new Error(`Execution ${runId} not found`);
    }

    if (execution.status !== WorkflowStatus.RUNNING) {
      throw new Error(`Cannot resume execution ${runId}: status is ${execution.status}`);
    }

    // Create new engine instance for resumption
    const abortController = new AbortController();
    const { workflow } = await parseFile(execution.workflowPath);

    const engine = new WorkflowEngine(
      {},
      {
        onStepStart: (step) => {
          const stepIndex = workflow.steps.findIndex(s => s.id === step.id);
          if (this.wsEmitter) {
            this.wsEmitter.emitExecutionStep(runId, {
              stepId: step.id,
              stepIndex,
              status: 'running',
              action: step.action,
            });
          }
        },
        onStepComplete: (step, result) => {
          const stepIndex = workflow.steps.findIndex(s => s.id === step.id);
          if (this.wsEmitter) {
            this.wsEmitter.emitExecutionStep(runId, {
              stepId: step.id,
              stepIndex,
              status: result.status,
              duration: result.duration,
              output: result.output,
              error: result.error,
            });
          }
        },
      },
      this.stateStore
    );

    engine.workflowPath = execution.workflowPath;

    // Track active execution
    const activeExecution: ActiveExecution = {
      runId,
      workflowPath: execution.workflowPath,
      workflowId: workflow.metadata.id,
      startedAt: execution.startedAt,
      status: 'running',
      currentStep: execution.currentStep,
      totalSteps: workflow.steps.length,
      abortController,
      engine,
    };
    this.activeExecutions.set(runId, activeExecution);

    // Emit resumption event
    if (this.wsEmitter) {
      this.wsEmitter.emitExecutionStep(runId, {
        stepId,
        status: 'resumed',
        resumeData,
      });
    }

    // Set up SDK registry
    const registry = new SDKRegistry();
    registry.registerInitializer('core', CoreInitializer);
    registry.registerInitializer('workflow', WorkflowInitializer);

    // Register integrations
    try {
      const moduleName = '@marktoflow/integrations';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const integrationsModule = await (Function('moduleName', 'return import(moduleName)')(moduleName) as Promise<any>);
      if (integrationsModule.registerIntegrations) {
        integrationsModule.registerIntegrations(registry);
      }
    } catch {
      // Continue without integrations
    }

    registry.registerTools(workflow.tools);

    // Resume execution asynchronously
    try {
      const result = await engine.resumeExecution(
        runId,
        stepId,
        resumeData,
        registry,
        createSDKStepExecutor()
      );

      // Update state store
      this.stateStore.updateExecution(runId, {
        status: result.status,
        completedAt: new Date(),
        outputs: result.output || null,
        error: result.error || null,
      });

      // Update active execution
      const active = this.activeExecutions.get(runId);
      if (active) {
        active.status = result.status === WorkflowStatus.COMPLETED ? 'completed' : 'failed';
      }

      // Emit completion
      if (this.wsEmitter) {
        this.wsEmitter.emitExecutionCompleted(runId, {
          status: result.status,
          duration: result.duration,
          stepResults: result.stepResults,
          outputs: result.output,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.stateStore.updateExecution(runId, {
        status: WorkflowStatus.FAILED,
        completedAt: new Date(),
        error: errorMessage,
      });

      const active = this.activeExecutions.get(runId);
      if (active) {
        active.status = 'failed';
      }

      if (this.wsEmitter) {
        this.wsEmitter.emitExecutionCompleted(runId, {
          status: WorkflowStatus.FAILED,
          error: errorMessage,
        });
      }

      throw error;
    }
  }

  /**
   * Get execution status
   */
  getExecutionStatus(runId: string): ExecutionStatus | null {
    // Check active executions first
    const active = this.activeExecutions.get(runId);
    if (active) {
      return {
        runId: active.runId,
        workflowPath: active.workflowPath,
        workflowId: active.workflowId,
        status: active.status,
        currentStep: active.currentStep,
        totalSteps: active.totalSteps,
        startedAt: active.startedAt,
        completedAt: null,
        error: null,
        stepResults: this.getStepResults(runId),
      };
    }

    // Check state store
    const execution = this.stateStore.getExecution(runId);
    if (!execution) {
      return null;
    }

    // Map WorkflowStatus to our status type
    let status: ExecutionStatus['status'];
    switch (execution.status) {
      case WorkflowStatus.COMPLETED:
        status = 'completed';
        break;
      case WorkflowStatus.FAILED:
        status = 'failed';
        break;
      case WorkflowStatus.CANCELLED:
        status = 'cancelled';
        break;
      case WorkflowStatus.RUNNING:
        status = 'running';
        break;
      default:
        status = 'not_found';
    }

    return {
      runId: execution.runId,
      workflowPath: execution.workflowPath,
      workflowId: execution.workflowId,
      status,
      currentStep: execution.currentStep,
      totalSteps: execution.totalSteps,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      error: execution.error,
      stepResults: this.getStepResults(runId),
    };
  }

  /**
   * Get step results for an execution
   */
  private getStepResults(runId: string): ExecutionStatus['stepResults'] {
    const checkpoints = this.stateStore.getCheckpoints(runId);
    return checkpoints.map(cp => ({
      stepId: cp.stepName,
      status: cp.status,
      duration: cp.completedAt
        ? cp.completedAt.getTime() - cp.startedAt.getTime()
        : null,
      output: cp.outputs,
      error: cp.error || undefined,
    }));
  }

  /**
   * List recent executions
   */
  listExecutions(options: { limit?: number; status?: string } = {}): ExecutionStatus[] {
    const workflowStatus = options.status
      ? (options.status as WorkflowStatus)
      : undefined;

    const executions = this.stateStore.listExecutions({
      status: workflowStatus,
      limit: options.limit || 50,
    });

    return executions.map(exec => {
      let status: ExecutionStatus['status'];
      switch (exec.status) {
        case WorkflowStatus.COMPLETED:
          status = 'completed';
          break;
        case WorkflowStatus.FAILED:
          status = 'failed';
          break;
        case WorkflowStatus.CANCELLED:
          status = 'cancelled';
          break;
        case WorkflowStatus.RUNNING:
          status = 'running';
          break;
        default:
          status = 'not_found';
      }

      return {
        runId: exec.runId,
        workflowPath: exec.workflowPath,
        workflowId: exec.workflowId,
        status,
        currentStep: exec.currentStep,
        totalSteps: exec.totalSteps,
        startedAt: exec.startedAt,
        completedAt: exec.completedAt,
        error: exec.error,
        stepResults: [],
      };
    });
  }

  /**
   * Get count of active executions
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Check if an execution is currently active
   */
  isActive(runId: string): boolean {
    return this.activeExecutions.has(runId);
  }

  /**
   * Wait for all active executions to complete
   * Useful for testing cleanup to ensure DB isn't closed while executions are in progress
   */
  async waitForAll(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    while (this.hasRunningExecutions()) {
      if (Date.now() - startTime > timeoutMs) {
        // Timeout reached, force clear
        this.activeExecutions.clear();
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Check if any executions are still running (not completed/failed/cancelled)
   */
  private hasRunningExecutions(): boolean {
    for (const execution of this.activeExecutions.values()) {
      if (execution.status === 'running') {
        return true;
      }
    }
    return false;
  }
}
