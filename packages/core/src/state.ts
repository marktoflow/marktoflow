/**
 * State persistence for marktoflow v2.0
 *
 * Provides SQLite-based state storage for workflow checkpoints,
 * execution history, and recovery.
 */

import Database from 'better-sqlite3';
import { WorkflowStatus, StepStatus } from './models.js';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionRecord {
  runId: string;
  workflowId: string;
  workflowPath: string;
  status: WorkflowStatus;
  startedAt: Date;
  completedAt: Date | null;
  currentStep: number;
  totalSteps: number;
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

export interface StepCheckpoint {
  runId: string;
  stepIndex: number;
  stepName: string;
  status: StepStatus;
  startedAt: Date;
  completedAt: Date | null;
  inputs: Record<string, unknown> | null;
  outputs: unknown;
  error: string | null;
  retryCount: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  completed: number;
  failed: number;
  running: number;
  successRate: number;
  averageDuration: number | null;
}

// ============================================================================
// StateStore Implementation
// ============================================================================

const SCHEMA_VERSION = 1;

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS executions (
    run_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_path TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    inputs TEXT,
    outputs TEXT,
    error TEXT,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    inputs TEXT,
    outputs TEXT,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    FOREIGN KEY (run_id) REFERENCES executions(run_id),
    UNIQUE(run_id, step_index)
  );

  CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
  CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);
  CREATE INDEX IF NOT EXISTS idx_checkpoints_run_id ON checkpoints(run_id);
`;

export class StateStore {
  private db: Database.Database;

  constructor(dbPath: string = '.marktoflow/state/workflow-state.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(CREATE_TABLES_SQL);

    // Check schema version
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      | { version: number }
      | undefined;

    if (!versionRow) {
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }
  }

  // ============================================================================
  // Execution Records
  // ============================================================================

  createExecution(record: ExecutionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO executions (
        run_id, workflow_id, workflow_path, status, started_at, completed_at,
        current_step, total_steps, inputs, outputs, error, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.runId,
      record.workflowId,
      record.workflowPath,
      record.status,
      record.startedAt.toISOString(),
      record.completedAt?.toISOString() ?? null,
      record.currentStep,
      record.totalSteps,
      record.inputs ? JSON.stringify(record.inputs) : null,
      record.outputs ? JSON.stringify(record.outputs) : null,
      record.error,
      record.metadata ? JSON.stringify(record.metadata) : null
    );
  }

  updateExecution(
    runId: string,
    updates: Partial<Omit<ExecutionRecord, 'runId'>>
  ): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt?.toISOString() ?? null);
    }
    if (updates.currentStep !== undefined) {
      fields.push('current_step = ?');
      values.push(updates.currentStep);
    }
    if (updates.totalSteps !== undefined) {
      fields.push('total_steps = ?');
      values.push(updates.totalSteps);
    }
    if (updates.outputs !== undefined) {
      fields.push('outputs = ?');
      values.push(updates.outputs ? JSON.stringify(updates.outputs) : null);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }

    if (fields.length === 0) return;

    values.push(runId);
    const sql = `UPDATE executions SET ${fields.join(', ')} WHERE run_id = ?`;
    this.db.prepare(sql).run(...values);
  }

  getExecution(runId: string): ExecutionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM executions WHERE run_id = ?')
      .get(runId) as Record<string, unknown> | undefined;

    return row ? this.rowToExecution(row) : null;
  }

  listExecutions(options: {
    workflowId?: string;
    status?: WorkflowStatus;
    limit?: number;
    offset?: number;
  } = {}): ExecutionRecord[] {
    let sql = 'SELECT * FROM executions WHERE 1=1';
    const params: unknown[] = [];

    if (options.workflowId) {
      sql += ' AND workflow_id = ?';
      params.push(options.workflowId);
    }
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY started_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.rowToExecution(row));
  }

  getRunningExecutions(): ExecutionRecord[] {
    return this.listExecutions({ status: WorkflowStatus.RUNNING });
  }

  getFailedExecutions(limit = 10): ExecutionRecord[] {
    return this.listExecutions({ status: WorkflowStatus.FAILED, limit });
  }

  private rowToExecution(row: Record<string, unknown>): ExecutionRecord {
    return {
      runId: row['run_id'] as string,
      workflowId: row['workflow_id'] as string,
      workflowPath: row['workflow_path'] as string,
      status: row['status'] as WorkflowStatus,
      startedAt: new Date(row['started_at'] as string),
      completedAt: row['completed_at'] ? new Date(row['completed_at'] as string) : null,
      currentStep: row['current_step'] as number,
      totalSteps: row['total_steps'] as number,
      inputs: row['inputs'] ? JSON.parse(row['inputs'] as string) : null,
      outputs: row['outputs'] ? JSON.parse(row['outputs'] as string) : null,
      error: row['error'] as string | null,
      metadata: row['metadata'] ? JSON.parse(row['metadata'] as string) : null,
    };
  }

  // ============================================================================
  // Step Checkpoints
  // ============================================================================

  saveCheckpoint(checkpoint: StepCheckpoint): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO checkpoints (
        run_id, step_index, step_name, status, started_at, completed_at,
        inputs, outputs, error, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      checkpoint.runId,
      checkpoint.stepIndex,
      checkpoint.stepName,
      checkpoint.status,
      checkpoint.startedAt.toISOString(),
      checkpoint.completedAt?.toISOString() ?? null,
      checkpoint.inputs ? JSON.stringify(checkpoint.inputs) : null,
      checkpoint.outputs !== undefined ? JSON.stringify(checkpoint.outputs) : null,
      checkpoint.error,
      checkpoint.retryCount
    );
  }

  getCheckpoints(runId: string): StepCheckpoint[] {
    const rows = this.db
      .prepare('SELECT * FROM checkpoints WHERE run_id = ? ORDER BY step_index')
      .all(runId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToCheckpoint(row));
  }

  getLastCheckpoint(runId: string): StepCheckpoint | null {
    const row = this.db
      .prepare('SELECT * FROM checkpoints WHERE run_id = ? ORDER BY step_index DESC LIMIT 1')
      .get(runId) as Record<string, unknown> | undefined;

    return row ? this.rowToCheckpoint(row) : null;
  }

  getResumePoint(runId: string): number {
    const lastCheckpoint = this.getLastCheckpoint(runId);
    if (!lastCheckpoint) return 0;

    // If last step completed, resume from next step
    if (lastCheckpoint.status === StepStatus.COMPLETED) {
      return lastCheckpoint.stepIndex + 1;
    }

    // Otherwise resume from the failed/pending step
    return lastCheckpoint.stepIndex;
  }

  private rowToCheckpoint(row: Record<string, unknown>): StepCheckpoint {
    return {
      runId: row['run_id'] as string,
      stepIndex: row['step_index'] as number,
      stepName: row['step_name'] as string,
      status: row['status'] as StepStatus,
      startedAt: new Date(row['started_at'] as string),
      completedAt: row['completed_at'] ? new Date(row['completed_at'] as string) : null,
      inputs: row['inputs'] ? JSON.parse(row['inputs'] as string) : null,
      outputs: row['outputs'] ? JSON.parse(row['outputs'] as string) : null,
      error: row['error'] as string | null,
      retryCount: row['retry_count'] as number,
    };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(workflowId?: string): ExecutionStats {
    let whereClause = '';
    const params: unknown[] = [];

    if (workflowId) {
      whereClause = 'WHERE workflow_id = ?';
      params.push(workflowId);
    }

    const countRow = this.db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
        FROM executions ${whereClause}`
      )
      .get(...params) as Record<string, number>;

    const durationRow = this.db
      .prepare(
        `SELECT AVG(
          (julianday(completed_at) - julianday(started_at)) * 86400000
        ) as avg_duration
        FROM executions
        ${whereClause ? whereClause + ' AND' : 'WHERE'} completed_at IS NOT NULL`
      )
      .get(...params) as { avg_duration: number | null };

    const total = countRow['total'] || 0;
    const completed = countRow['completed'] || 0;

    return {
      totalExecutions: total,
      completed,
      failed: countRow['failed'] || 0,
      running: countRow['running'] || 0,
      successRate: total > 0 ? completed / total : 0,
      averageDuration: durationRow.avg_duration,
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup(retentionDays: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old checkpoints first (foreign key)
    this.db
      .prepare(
        `DELETE FROM checkpoints WHERE run_id IN (
          SELECT run_id FROM executions WHERE started_at < ?
        )`
      )
      .run(cutoffDate.toISOString());

    // Delete old executions
    const result = this.db
      .prepare('DELETE FROM executions WHERE started_at < ?')
      .run(cutoffDate.toISOString());

    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
