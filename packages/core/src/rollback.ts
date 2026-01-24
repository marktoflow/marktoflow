/**
 * Rollback capabilities for marktoflow.
 *
 * Provides step undo registry and transaction-like semantics for workflow execution.
 */

import { rmSync, existsSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export enum RollbackStrategy {
  NONE = 'none',
  COMPENSATE = 'compensate',
  RESTORE = 'restore',
  IDEMPOTENT = 'idempotent',
}

export enum RollbackStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface RollbackAction {
  stepName: string;
  stepIndex: number;
  strategy: RollbackStrategy;
  compensateAction?: string | undefined;
  compensateInputs: Record<string, unknown>;
  stateSnapshot: Record<string, unknown>;
  executedAt: Date;
  rollbackStatus: RollbackStatus;
  rollbackError?: string | undefined;
  metadata: Record<string, unknown>;
}

export interface RollbackResult {
  success: boolean;
  stepsRolledBack: number;
  stepsFailed: number;
  stepsSkipped: number;
  errors: string[];
  durationSeconds: number;
}

export interface CompensationHandler {
  actionType: string;
  compensate(action: RollbackAction, context: Record<string, unknown>): boolean;
  compensateAsync(action: RollbackAction, context: Record<string, unknown>): Promise<boolean>;
}

export class DefaultCompensationHandler implements CompensationHandler {
  actionType = '*';
  private handlers = new Map<string, (action: RollbackAction, context: Record<string, unknown>) => boolean>();
  private asyncHandlers = new Map<string, (action: RollbackAction, context: Record<string, unknown>) => unknown>();

  register(actionType: string, handler: (action: RollbackAction, context: Record<string, unknown>) => boolean): void {
    this.handlers.set(actionType, handler);
  }

  registerAsync(actionType: string, handler: (action: RollbackAction, context: Record<string, unknown>) => unknown): void {
    this.asyncHandlers.set(actionType, handler);
  }

  compensate(action: RollbackAction, context: Record<string, unknown>): boolean {
    if (action.compensateAction && this.handlers.has(action.compensateAction)) {
      return this.handlers.get(action.compensateAction)!(action, context);
    }
    return false;
  }

  async compensateAsync(action: RollbackAction, context: Record<string, unknown>): Promise<boolean> {
    if (action.compensateAction && this.asyncHandlers.has(action.compensateAction)) {
      const result = this.asyncHandlers.get(action.compensateAction)!(action, context);
      return await Promise.resolve(result as boolean);
    }
    return this.compensate(action, context);
  }
}

export class RollbackRegistry {
  private actions: RollbackAction[] = [];
  private compensationHandler = new DefaultCompensationHandler();
  private customHandlers = new Map<string, CompensationHandler>();

  constructor(public readonly maxHistory: number = 100) {}

  registerHandler(handler: CompensationHandler): void {
    this.customHandlers.set(handler.actionType, handler);
  }

  registerCompensation(
    actionType: string,
    handler: (action: RollbackAction, context: Record<string, unknown>) => boolean
  ): void {
    this.compensationHandler.register(actionType, handler);
  }

  registerCompensationAsync(
    actionType: string,
    handler: (action: RollbackAction, context: Record<string, unknown>) => unknown
  ): void {
    this.compensationHandler.registerAsync(actionType, handler);
  }

  record(params: {
    stepName: string;
    stepIndex: number;
    strategy?: RollbackStrategy;
    compensateAction?: string;
    compensateInputs?: Record<string, unknown>;
    stateSnapshot?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): RollbackAction {
    const action: RollbackAction = {
      stepName: params.stepName,
      stepIndex: params.stepIndex,
      strategy: params.strategy ?? RollbackStrategy.COMPENSATE,
      compensateAction: params.compensateAction,
      compensateInputs: params.compensateInputs ?? {},
      stateSnapshot: params.stateSnapshot ?? {},
      executedAt: new Date(),
      rollbackStatus: RollbackStatus.PENDING,
      metadata: params.metadata ?? {},
    };
    this.actions.push(action);
    if (this.actions.length > this.maxHistory) {
      this.actions = this.actions.slice(-this.maxHistory);
    }
    return action;
  }

  getActions(): RollbackAction[] {
    return [...this.actions];
  }

  getRollbackOrder(): RollbackAction[] {
    return [...this.actions].reverse();
  }

  clear(): void {
    this.actions = [];
  }

  rollbackAll(context: Record<string, unknown> = {}, stopOnError: boolean = false): RollbackResult {
    const start = Date.now();
    const errors: string[] = [];
    let rolledBack = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of this.getRollbackOrder()) {
      if (action.strategy === RollbackStrategy.NONE) {
        action.rollbackStatus = RollbackStatus.SKIPPED;
        skipped++;
        continue;
      }

      action.rollbackStatus = RollbackStatus.IN_PROGRESS;
      try {
        const success = this.executeCompensation(action, context);
        if (success) {
          action.rollbackStatus = RollbackStatus.COMPLETED;
          rolledBack++;
        } else {
          action.rollbackStatus = RollbackStatus.FAILED;
          action.rollbackError = 'Compensation returned false';
          failed++;
          errors.push(`Step ${action.stepName}: Compensation failed`);
          if (stopOnError) break;
        }
      } catch (error) {
        action.rollbackStatus = RollbackStatus.FAILED;
        action.rollbackError = String(error);
        failed++;
        errors.push(`Step ${action.stepName}: ${String(error)}`);
        if (stopOnError) break;
      }
    }

    return {
      success: failed === 0,
      stepsRolledBack: rolledBack,
      stepsFailed: failed,
      stepsSkipped: skipped,
      errors,
      durationSeconds: (Date.now() - start) / 1000,
    };
  }

  async rollbackAllAsync(context: Record<string, unknown> = {}, stopOnError: boolean = false): Promise<RollbackResult> {
    const start = Date.now();
    const errors: string[] = [];
    let rolledBack = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of this.getRollbackOrder()) {
      if (action.strategy === RollbackStrategy.NONE) {
        action.rollbackStatus = RollbackStatus.SKIPPED;
        skipped++;
        continue;
      }

      action.rollbackStatus = RollbackStatus.IN_PROGRESS;
      try {
        const success = await this.executeCompensationAsync(action, context);
        if (success) {
          action.rollbackStatus = RollbackStatus.COMPLETED;
          rolledBack++;
        } else {
          action.rollbackStatus = RollbackStatus.FAILED;
          action.rollbackError = 'Compensation returned false';
          failed++;
          errors.push(`Step ${action.stepName}: Compensation failed`);
          if (stopOnError) break;
        }
      } catch (error) {
        action.rollbackStatus = RollbackStatus.FAILED;
        action.rollbackError = String(error);
        failed++;
        errors.push(`Step ${action.stepName}: ${String(error)}`);
        if (stopOnError) break;
      }
    }

    return {
      success: failed === 0,
      stepsRolledBack: rolledBack,
      stepsFailed: failed,
      stepsSkipped: skipped,
      errors,
      durationSeconds: (Date.now() - start) / 1000,
    };
  }

  rollbackTo(stepIndex: number, context: Record<string, unknown> = {}): RollbackResult {
    const actionsToRollback = this.actions.filter((a) => a.stepIndex > stepIndex);
    if (actionsToRollback.length === 0) {
      return { success: true, stepsRolledBack: 0, stepsFailed: 0, stepsSkipped: 0, errors: [], durationSeconds: 0 };
    }
    const original = this.actions;
    this.actions = actionsToRollback;
    try {
      return this.rollbackAll(context);
    } finally {
      this.actions = original.filter((a) => a.stepIndex <= stepIndex);
    }
  }

  async rollbackToAsync(stepIndex: number, context: Record<string, unknown> = {}): Promise<RollbackResult> {
    const actionsToRollback = this.actions.filter((a) => a.stepIndex > stepIndex);
    if (actionsToRollback.length === 0) {
      return { success: true, stepsRolledBack: 0, stepsFailed: 0, stepsSkipped: 0, errors: [], durationSeconds: 0 };
    }
    const original = this.actions;
    this.actions = actionsToRollback;
    try {
      return await this.rollbackAllAsync(context);
    } finally {
      this.actions = original.filter((a) => a.stepIndex <= stepIndex);
    }
  }

  private executeCompensation(action: RollbackAction, context: Record<string, unknown>): boolean {
    if (action.compensateAction && this.customHandlers.has(action.compensateAction)) {
      return this.customHandlers.get(action.compensateAction)!.compensate(action, context);
    }
    if (action.strategy === RollbackStrategy.RESTORE) {
      Object.assign(context, action.stateSnapshot);
      return true;
    }
    if (action.strategy === RollbackStrategy.IDEMPOTENT) {
      return true;
    }
    if (action.compensateAction) {
      return this.compensationHandler.compensate(action, context);
    }
    return true;
  }

  private async executeCompensationAsync(action: RollbackAction, context: Record<string, unknown>): Promise<boolean> {
    if (action.compensateAction && this.customHandlers.has(action.compensateAction)) {
      return await this.customHandlers.get(action.compensateAction)!.compensateAsync(action, context);
    }
    if (action.strategy === RollbackStrategy.RESTORE) {
      Object.assign(context, action.stateSnapshot);
      return true;
    }
    if (action.strategy === RollbackStrategy.IDEMPOTENT) {
      return true;
    }
    if (action.compensateAction) {
      return await this.compensationHandler.compensateAsync(action, context);
    }
    return true;
  }
}

export class TransactionContext {
  private committed = false;
  private rolledBack = false;
  private context: Record<string, unknown> = {};
  private savepoints = new Map<string, number>();

  constructor(
    public readonly registry: RollbackRegistry = new RollbackRegistry(),
    public readonly autoRollbackOnError: boolean = true
  ) {}

  get isActive(): boolean {
    return !this.committed && !this.rolledBack;
  }

  recordStep(params: {
    stepName: string;
    stepIndex: number;
    compensateAction?: string;
    compensateInputs?: Record<string, unknown>;
    stateSnapshot?: Record<string, unknown>;
    strategy?: RollbackStrategy;
  }): RollbackAction {
    if (!this.isActive) throw new Error('Transaction is not active');
    return this.registry.record({
      stepName: params.stepName,
      stepIndex: params.stepIndex,
      compensateAction: params.compensateAction,
      compensateInputs: params.compensateInputs,
      stateSnapshot: params.stateSnapshot,
      strategy: params.strategy,
    });
  }

  savepoint(name: string): void {
    if (!this.isActive) throw new Error('Transaction is not active');
    const actions = this.registry.getActions();
    this.savepoints.set(name, actions.length ? actions.length - 1 : -1);
  }

  rollbackToSavepoint(name: string): RollbackResult {
    const index = this.savepoints.get(name);
    if (index === undefined) throw new Error(`Savepoint not found: ${name}`);
    return this.registry.rollbackTo(index, this.context);
  }

  async rollbackToSavepointAsync(name: string): Promise<RollbackResult> {
    const index = this.savepoints.get(name);
    if (index === undefined) throw new Error(`Savepoint not found: ${name}`);
    return await this.registry.rollbackToAsync(index, this.context);
  }

  commit(): void {
    if (!this.isActive) throw new Error('Transaction is not active');
    this.committed = true;
    this.registry.clear();
    this.savepoints.clear();
  }

  rollback(): RollbackResult {
    if (!this.isActive) throw new Error('Transaction is not active');
    const result = this.registry.rollbackAll(this.context);
    this.rolledBack = true;
    this.registry.clear();
    this.savepoints.clear();
    return result;
  }

  async rollbackAsync(): Promise<RollbackResult> {
    if (!this.isActive) throw new Error('Transaction is not active');
    const result = await this.registry.rollbackAllAsync(this.context);
    this.rolledBack = true;
    this.registry.clear();
    this.savepoints.clear();
    return result;
  }

  setContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  getContext(key: string, defaultValue: unknown = undefined): unknown {
    return key in this.context ? this.context[key] : defaultValue;
  }
}

export class FileCompensationHandler implements CompensationHandler {
  actionType = 'file';

  compensate(action: RollbackAction): boolean {
    const operation = action.compensateInputs.operation as string | undefined;
    const path = action.compensateInputs.path as string | undefined;

    if (operation === 'delete' && path) {
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
      return true;
    }

    if (operation === 'restore' && path) {
      const backupPath = action.compensateInputs.backup_path as string | undefined;
      if (backupPath && existsSync(backupPath)) {
        copyFileSync(backupPath, path);
        return true;
      }
    }

    return false;
  }

  async compensateAsync(action: RollbackAction): Promise<boolean> {
    return this.compensate(action);
  }
}

export class GitCompensationHandler implements CompensationHandler {
  actionType = 'git';

  compensate(action: RollbackAction): boolean {
    const operation = action.compensateInputs.operation as string | undefined;
    const repoPath = (action.compensateInputs.repo_path as string | undefined) ?? '.';

    if (operation === 'reset_hard') {
      const commit = (action.compensateInputs.commit as string | undefined) ?? 'HEAD~1';
      const result = spawnSync('git', ['reset', '--hard', commit], { cwd: repoPath, encoding: 'utf8' });
      return result.status === 0;
    }

    if (operation === 'delete_branch') {
      const branch = action.compensateInputs.branch as string | undefined;
      if (!branch) return false;
      const result = spawnSync('git', ['branch', '-D', branch], { cwd: repoPath, encoding: 'utf8' });
      return result.status === 0;
    }

    if (operation === 'revert_commit') {
      const commit = action.compensateInputs.commit as string | undefined;
      if (!commit) return false;
      const result = spawnSync('git', ['revert', '--no-commit', commit], { cwd: repoPath, encoding: 'utf8' });
      return result.status === 0;
    }

    return false;
  }

  async compensateAsync(action: RollbackAction): Promise<boolean> {
    return this.compensate(action);
  }
}
