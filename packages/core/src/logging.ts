/**
 * Execution logging for marktoflow v2.0
 *
 * Provides structured markdown logging for workflow executions.
 */

import { writeFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  stepName: string | undefined;
  stepIndex: number | undefined;
  details: Record<string, unknown> | undefined;
}

export interface ExecutionLog {
  runId: string;
  workflowId: string;
  workflowName: string;
  startedAt: Date;
  completedAt: Date | null;
  entries: LogEntry[];
  success: boolean | null;
  error: string | null;
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
}

// ============================================================================
// Log Entry Formatting
// ============================================================================

const LEVEL_ICONS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARNING]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.CRITICAL]: '🔥',
};

function formatLogEntry(entry: LogEntry): string {
  const timeStr = entry.timestamp.toTimeString().slice(0, 8);
  const icon = LEVEL_ICONS[entry.level] || '•';

  let line = `- \`${timeStr}\` ${icon} `;

  if (entry.stepName) {
    line += `**[${entry.stepName}]** `;
  }

  line += entry.message;

  if (entry.details) {
    line += '\n';
    for (const [key, value] of Object.entries(entry.details)) {
      line += `  - ${key}: \`${JSON.stringify(value)}\`\n`;
    }
  }

  return line;
}

// ============================================================================
// ExecutionLog Implementation
// ============================================================================

export function createExecutionLog(
  runId: string,
  workflowId: string,
  workflowName: string,
  inputs?: Record<string, unknown>
): ExecutionLog {
  return {
    runId,
    workflowId,
    workflowName,
    startedAt: new Date(),
    completedAt: null,
    entries: [],
    success: null,
    error: null,
    inputs: inputs || null,
    outputs: null,
  };
}

export function addLogEntry(
  log: ExecutionLog,
  level: LogLevel,
  message: string,
  options?: {
    stepName?: string;
    stepIndex?: number;
    details?: Record<string, unknown>;
  }
): void {
  log.entries.push({
    timestamp: new Date(),
    level,
    message,
    stepName: options?.stepName,
    stepIndex: options?.stepIndex,
    details: options?.details,
  });
}

export function completeLog(
  log: ExecutionLog,
  success: boolean,
  outputs?: Record<string, unknown>,
  error?: string
): void {
  log.completedAt = new Date();
  log.success = success;
  log.outputs = outputs || null;
  log.error = error || null;
}

export function logToMarkdown(log: ExecutionLog): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Execution Log: ${log.workflowName}`);
  lines.push('');
  lines.push(`**Run ID:** \`${log.runId}\``);
  lines.push(`**Workflow:** \`${log.workflowId}\``);
  lines.push(`**Started:** ${log.startedAt.toISOString()}`);

  if (log.completedAt) {
    lines.push(`**Completed:** ${log.completedAt.toISOString()}`);
    const duration = log.completedAt.getTime() - log.startedAt.getTime();
    lines.push(`**Duration:** ${duration}ms`);
  }

  if (log.success !== null) {
    lines.push(`**Status:** ${log.success ? '✅ Success' : '❌ Failed'}`);
  }

  if (log.error) {
    lines.push(`**Error:** ${log.error}`);
  }

  lines.push('');

  // Inputs
  if (log.inputs && Object.keys(log.inputs).length > 0) {
    lines.push('## Inputs');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(log.inputs, null, 2));
    lines.push('```');
    lines.push('');
  }

  // Log entries
  lines.push('## Execution Log');
  lines.push('');

  for (const entry of log.entries) {
    lines.push(formatLogEntry(entry));
  }

  lines.push('');

  // Outputs
  if (log.outputs && Object.keys(log.outputs).length > 0) {
    lines.push('## Outputs');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(log.outputs, null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// ExecutionLogger (File-based)
// ============================================================================

export class ExecutionLogger {
  private logsDir: string;
  private activeLogs: Map<string, ExecutionLog> = new Map();

  constructor(logsDir: string = '.marktoflow/state/execution-logs') {
    this.logsDir = logsDir;
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.logsDir)) {
      await mkdir(this.logsDir, { recursive: true });
    }
  }

  startLog(
    runId: string,
    workflowId: string,
    workflowName: string,
    inputs?: Record<string, unknown>
  ): ExecutionLog {
    const log = createExecutionLog(runId, workflowId, workflowName, inputs);
    this.activeLogs.set(runId, log);

    addLogEntry(log, LogLevel.INFO, 'Workflow execution started');

    return log;
  }

  getLog(runId: string): ExecutionLog | undefined {
    return this.activeLogs.get(runId);
  }

  log(
    runId: string,
    level: LogLevel,
    message: string,
    options?: {
      stepName?: string;
      stepIndex?: number;
      details?: Record<string, unknown>;
    }
  ): void {
    const log = this.activeLogs.get(runId);
    if (log) {
      addLogEntry(log, level, message, options);
    }
  }

  async finishLog(
    runId: string,
    success: boolean,
    outputs?: Record<string, unknown>,
    error?: string
  ): Promise<string | null> {
    const log = this.activeLogs.get(runId);
    if (!log) {
      return null;
    }

    addLogEntry(
      log,
      success ? LogLevel.INFO : LogLevel.ERROR,
      success ? 'Workflow execution completed successfully' : `Workflow execution failed: ${error}`
    );

    completeLog(log, success, outputs, error);

    // Save to file
    await this.ensureDir();
    const filename = `${log.workflowId}_${runId}_${log.startedAt.toISOString().replace(/[:.]/g, '-')}.md`;
    const filepath = join(this.logsDir, filename);

    const markdown = logToMarkdown(log);
    await writeFile(filepath, markdown, 'utf-8');

    this.activeLogs.delete(runId);

    return filepath;
  }

  async listLogs(options?: {
    workflowId?: string;
    limit?: number;
  }): Promise<string[]> {
    await this.ensureDir();

    let files = await readdir(this.logsDir);
    files = files.filter((f) => f.endsWith('.md'));

    if (options?.workflowId) {
      files = files.filter((f) => f.startsWith(options.workflowId + '_'));
    }

    // Sort by date (newest first)
    files.sort().reverse();

    if (options?.limit) {
      files = files.slice(0, options.limit);
    }

    return files.map((f) => join(this.logsDir, f));
  }

  async readLog(filepath: string): Promise<string> {
    return readFile(filepath, 'utf-8');
  }

  async cleanupLogs(retentionDays: number = 30): Promise<number> {
    await this.ensureDir();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = await readdir(this.logsDir);
    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filepath = join(this.logsDir, file);
      const content = await readFile(filepath, 'utf-8');

      // Extract started date from content
      const match = content.match(/\*\*Started:\*\* (.+)/);
      if (match) {
        const startedAt = new Date(match[1]);
        if (startedAt < cutoffDate) {
          await unlink(filepath);
          deleted++;
        }
      }
    }

    return deleted;
  }
}
