import { useExecutionStore } from '../stores/executionStore';
import { useCanvasStore } from '../stores/canvasStore';

/**
 * Simulates workflow execution for testing control flow animations
 * This is a mock executor that demonstrates the execution flow visualization
 */
export class ExecutionSimulator {
  private runId: string | null = null;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private workflowId: string,
    private workflowName: string
  ) {}

  /**
   * Start simulated execution
   */
  start(inputs?: Record<string, unknown>): void {
    const { startExecution } = useExecutionStore.getState();
    this.runId = startExecution(this.workflowId, this.workflowName, inputs);

    // Get all nodes from canvas
    const { nodes } = useCanvasStore.getState();

    // Start executing steps
    this.executeSteps(nodes);
  }

  /**
   * Execute steps in sequence with delays
   */
  private async executeSteps(nodes: any[]): Promise<void> {
    const {
      updateStepStatus,
      completeExecution,
      setActiveBranch,
      clearActiveBranch,
      setSkippedBranches,
      updateLoopIteration,
      clearLoopIteration,
      addActiveNestedStep,
      removeActiveNestedStep,
      clearControlFlowState,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    // Filter to main workflow steps (not nested, not trigger/output)
    const workflowSteps = nodes.filter(
      (n) =>
        !n.parentNode &&
        n.type !== 'trigger' &&
        n.type !== 'output' &&
        n.type !== 'group'
    );

    for (const node of workflowSteps) {
      // Start step
      updateStepStatus(this.runId, node.id, 'running');
      await this.delay(500);

      // Handle control flow types
      if (node.type === 'if') {
        await this.simulateIfElse(node);
      } else if (node.type === 'for_each') {
        await this.simulateForEach(node);
      } else if (node.type === 'while') {
        await this.simulateWhile(node);
      } else if (node.type === 'switch') {
        await this.simulateSwitch(node);
      } else if (node.type === 'try') {
        await this.simulateTryCatch(node);
      } else if (node.type === 'parallel') {
        await this.simulateParallel(node);
      } else {
        // Regular step
        await this.delay(1000);
      }

      // Complete step
      updateStepStatus(this.runId, node.id, 'completed', { success: true });
      await this.delay(300);
    }

    // Complete execution
    clearControlFlowState();
    completeExecution(this.runId, 'completed', {});
  }

  /**
   * Simulate if/else execution
   */
  private async simulateIfElse(node: any): Promise<void> {
    const {
      updateStepStatus,
      setActiveBranch,
      clearActiveBranch,
      setSkippedBranches,
      addActiveNestedStep,
      removeActiveNestedStep,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    // Randomly choose then or else branch
    const chooseThen = Math.random() > 0.5;
    const activeBranch = chooseThen ? 'then' : 'else';
    const skippedBranch = chooseThen ? 'else' : 'then';

    // Set active branch
    setActiveBranch(node.id, activeBranch);
    setSkippedBranches(node.id, [skippedBranch]);
    await this.delay(500);

    // Execute nested steps in active branch
    const nestedSteps = chooseThen ? node.data.thenSteps : node.data.elseSteps;
    if (nestedSteps && nestedSteps.length > 0) {
      for (const step of nestedSteps) {
        addActiveNestedStep(step.id);
        updateStepStatus(this.runId, step.id, 'running');
        await this.delay(800);
        updateStepStatus(this.runId, step.id, 'completed');
        removeActiveNestedStep(step.id);
        await this.delay(200);
      }
    }

    clearActiveBranch(node.id);
  }

  /**
   * Simulate for_each loop execution
   */
  private async simulateForEach(node: any): Promise<void> {
    const {
      updateStepStatus,
      updateLoopIteration,
      clearLoopIteration,
      addActiveNestedStep,
      removeActiveNestedStep,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    const totalIterations = 3; // Simulate 3 iterations

    for (let i = 1; i <= totalIterations; i++) {
      updateLoopIteration(node.id, i, totalIterations);
      await this.delay(300);

      // Execute nested steps for this iteration
      const nestedSteps = node.data.nestedSteps;
      if (nestedSteps && nestedSteps.length > 0) {
        for (const step of nestedSteps) {
          addActiveNestedStep(step.id);
          updateStepStatus(this.runId, step.id, 'running');
          await this.delay(600);
          updateStepStatus(this.runId, step.id, 'completed');
          removeActiveNestedStep(step.id);
          await this.delay(200);
        }
      }

      await this.delay(300);
    }

    clearLoopIteration(node.id);
  }

  /**
   * Simulate while loop execution
   */
  private async simulateWhile(node: any): Promise<void> {
    // Similar to for_each but with condition checking
    await this.simulateForEach(node);
  }

  /**
   * Simulate switch/case execution
   */
  private async simulateSwitch(node: any): Promise<void> {
    const {
      updateStepStatus,
      setActiveBranch,
      clearActiveBranch,
      setSkippedBranches,
      addActiveNestedStep,
      removeActiveNestedStep,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    // Get case keys
    const caseKeys = Object.keys(node.data.cases || {});
    if (caseKeys.length === 0) return;

    // Randomly select a case
    const selectedCase = caseKeys[Math.floor(Math.random() * caseKeys.length)];
    const skippedCases = caseKeys.filter((k) => k !== selectedCase);

    setActiveBranch(node.id, `case:${selectedCase}`);
    setSkippedBranches(node.id, skippedCases.map((k) => `case:${k}`));
    await this.delay(500);

    // Execute nested steps in selected case
    const caseSteps = node.data.cases[selectedCase];
    if (caseSteps && caseSteps.length > 0) {
      for (const step of caseSteps) {
        addActiveNestedStep(step.id);
        updateStepStatus(this.runId, step.id, 'running');
        await this.delay(800);
        updateStepStatus(this.runId, step.id, 'completed');
        removeActiveNestedStep(step.id);
        await this.delay(200);
      }
    }

    clearActiveBranch(node.id);
  }

  /**
   * Simulate try/catch execution
   */
  private async simulateTryCatch(node: any): Promise<void> {
    const {
      updateStepStatus,
      setActiveBranch,
      clearActiveBranch,
      addActiveNestedStep,
      removeActiveNestedStep,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    // Execute try block
    setActiveBranch(node.id, 'try');
    await this.delay(300);

    const trySteps = node.data.trySteps;
    const shouldFail = Math.random() > 0.7; // 30% chance of error

    if (trySteps && trySteps.length > 0) {
      for (let i = 0; i < trySteps.length; i++) {
        const step = trySteps[i];
        addActiveNestedStep(step.id);
        updateStepStatus(this.runId, step.id, 'running');
        await this.delay(600);

        // Simulate error on last step sometimes
        if (shouldFail && i === trySteps.length - 1) {
          updateStepStatus(this.runId, step.id, 'failed', undefined, 'Simulated error');
          removeActiveNestedStep(step.id);
          break;
        }

        updateStepStatus(this.runId, step.id, 'completed');
        removeActiveNestedStep(step.id);
        await this.delay(200);
      }
    }

    clearActiveBranch(node.id);

    // Execute catch block if error occurred
    if (shouldFail) {
      setActiveBranch(node.id, 'catch');
      await this.delay(300);

      const catchSteps = node.data.catchSteps;
      if (catchSteps && catchSteps.length > 0) {
        for (const step of catchSteps) {
          addActiveNestedStep(step.id);
          updateStepStatus(this.runId, step.id, 'running');
          await this.delay(600);
          updateStepStatus(this.runId, step.id, 'completed');
          removeActiveNestedStep(step.id);
          await this.delay(200);
        }
      }

      clearActiveBranch(node.id);
    }

    // Always execute finally block
    const finallySteps = node.data.finallySteps;
    if (finallySteps && finallySteps.length > 0) {
      setActiveBranch(node.id, 'finally');
      await this.delay(300);

      for (const step of finallySteps) {
        addActiveNestedStep(step.id);
        updateStepStatus(this.runId, step.id, 'running');
        await this.delay(600);
        updateStepStatus(this.runId, step.id, 'completed');
        removeActiveNestedStep(step.id);
        await this.delay(200);
      }

      clearActiveBranch(node.id);
    }
  }

  /**
   * Simulate parallel execution
   */
  private async simulateParallel(node: any): Promise<void> {
    const {
      updateStepStatus,
      setActiveBranch,
      clearActiveBranch,
      addActiveNestedStep,
      removeActiveNestedStep,
    } = useExecutionStore.getState();

    if (!this.runId) return;

    const branches = node.data.branches || [];

    // Execute all branches in "parallel" (simulated with small delays)
    const promises = branches.map(async (branch: any, index: number) => {
      setActiveBranch(node.id, `branch-${index}`);
      await this.delay(100 * index); // Stagger starts

      if (branch.steps && branch.steps.length > 0) {
        for (const step of branch.steps) {
          addActiveNestedStep(step.id);
          updateStepStatus(this.runId!, step.id, 'running');
          await this.delay(800);
          updateStepStatus(this.runId!, step.id, 'completed');
          removeActiveNestedStep(step.id);
          await this.delay(200);
        }
      }

      clearActiveBranch(node.id);
    });

    await Promise.all(promises);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.timers.push(timer);
    });
  }

  /**
   * Stop execution and clean up
   */
  stop(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];

    if (this.runId) {
      const { cancelExecution, clearControlFlowState } = useExecutionStore.getState();
      cancelExecution(this.runId);
      clearControlFlowState();
      this.runId = null;
    }
  }
}
