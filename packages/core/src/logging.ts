/**
 * Execution logging for marktoflow v2.0
 *
 * Provides structured logging using Pino with markdown export for human-readable logs.
 */

import { writeFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import pino, { type Logger, type DestinationStream } from 'pino';

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

// Map our log levels to Pino levels
const PINO_LEVELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARNING]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.CRITICAL]: 'fatal',
};

export interface ExecutionLoggerOptions {
  /** Directory for markdown log files */
  logsDir?: string;
  /** Enable JSON log file output alongside markdown */
  jsonLogs?: boolean;
  /** Custom Pino destination stream */
  destination?: DestinationStream;
  /** Minimum log level (default: 'debug') */
  level?: LogLevel;
}

export class ExecutionLogger {
  private logsDir: string;
  private activeLogs: Map<string, ExecutionLog> = new Map();
  private activeLoggers: Map<string, Logger> = new Map();
  private jsonLogs: boolean;
  private baseLogger: Logger;

  constructor(options: ExecutionLoggerOptions | string = '.marktoflow/state/execution-logs') {
    // Support legacy string argument
    if (typeof options === 'string') {
      this.logsDir = options;
      this.jsonLogs = false;
      this.baseLogger = pino({ level: 'debug' });
    } else {
      this.logsDir = options.logsDir ?? '.marktoflow/state/execution-logs';
      this.jsonLogs = options.jsonLogs ?? false;
      this.baseLogger = pino(
        { level: PINO_LEVELS[options.level ?? LogLevel.DEBUG] },
        options.destination
      );
    }
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.logsDir)) {
      await mkdir(this.logsDir, { recursive: true });
    }
  }

  private createRunLogger(runId: string, workflowId: string, workflowName: string): Logger {
    return this.baseLogger.child({
      runId,
      workflowId,
      workflowName,
    });
  }

  startLog(
    runId: string,
    workflowId: string,
    workflowName: string,
    inputs?: Record<string, unknown>
  ): ExecutionLog {
    const log = createExecutionLog(runId, workflowId, workflowName, inputs);
    this.activeLogs.set(runId, log);

    // Create a child logger for this run
    const logger = this.createRunLogger(runId, workflowId, workflowName);
    this.activeLoggers.set(runId, logger);

    // Log to both Pino and internal log
    logger.info({ inputs }, 'Workflow execution started');
    addLogEntry(log, LogLevel.INFO, 'Workflow execution started');

    return log;
  }

  getLog(runId: string): ExecutionLog | undefined {
    return this.activeLogs.get(runId);
  }

  /**
   * Get the Pino logger for a specific run
   */
  getLogger(runId: string): Logger | undefined {
    return this.activeLoggers.get(runId);
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
    const logger = this.activeLoggers.get(runId);

    if (log) {
      addLogEntry(log, level, message, options);
    }

    if (logger) {
      const pinoLevel = PINO_LEVELS[level];
      const logData = {
        stepName: options?.stepName,
        stepIndex: options?.stepIndex,
        ...options?.details,
      };

      // Call the appropriate Pino method
      switch (pinoLevel) {
        case 'debug':
          logger.debug(logData, message);
          break;
        case 'info':
          logger.info(logData, message);
          break;
        case 'warn':
          logger.warn(logData, message);
          break;
        case 'error':
          logger.error(logData, message);
          break;
        case 'fatal':
          logger.fatal(logData, message);
          break;
      }
    }
  }

  async finishLog(
    runId: string,
    success: boolean,
    outputs?: Record<string, unknown>,
    error?: string
  ): Promise<string | null> {
    const log = this.activeLogs.get(runId);
    const logger = this.activeLoggers.get(runId);

    if (!log) {
      return null;
    }

    const message = success
      ? 'Workflow execution completed successfully'
      : `Workflow execution failed: ${error}`;
    const level = success ? LogLevel.INFO : LogLevel.ERROR;

    // Log completion
    addLogEntry(log, level, message);
    if (logger) {
      if (success) {
        logger.info({ outputs, durationMs: Date.now() - log.startedAt.getTime() }, message);
      } else {
        logger.error({ error, durationMs: Date.now() - log.startedAt.getTime() }, message);
      }
    }

    completeLog(log, success, outputs, error);

    // Save markdown file
    await this.ensureDir();
    const timestamp = log.startedAt.toISOString().replace(/[:.]/g, '-');
    const baseFilename = `${log.workflowId}_${runId}_${timestamp}`;
    const markdownPath = join(this.logsDir, `${baseFilename}.md`);

    const markdown = logToMarkdown(log);
    await writeFile(markdownPath, markdown, 'utf-8');

    // Optionally save JSON log
    if (this.jsonLogs) {
      const jsonPath = join(this.logsDir, `${baseFilename}.json`);
      await writeFile(jsonPath, JSON.stringify(log, null, 2), 'utf-8');
    }

    // Cleanup
    this.activeLogs.delete(runId);
    this.activeLoggers.delete(runId);

    return markdownPath;
  }

  async listLogs(options?: {
    workflowId?: string;
    limit?: number;
    format?: 'markdown' | 'json' | 'both';
  }): Promise<string[]> {
    await this.ensureDir();

    const format = options?.format ?? 'markdown';
    const extensions = format === 'both' ? ['.md', '.json'] : format === 'json' ? ['.json'] : ['.md'];

    let files = await readdir(this.logsDir);
    files = files.filter((f) => extensions.some((ext) => f.endsWith(ext)));

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

  /**
   * Read and parse a JSON log file
   */
  async readJsonLog(filepath: string): Promise<ExecutionLog> {
    const content = await readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    // Convert date strings back to Date objects
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      entries: data.entries.map((e: Record<string, unknown>) => ({
        ...e,
        timestamp: new Date(e.timestamp as string),
      })),
    };
  }

  async cleanupLogs(retentionDays: number = 30): Promise<number> {
    await this.ensureDir();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const files = await readdir(this.logsDir);
    let deleted = 0;

    for (const file of files) {
      // Support both .md and .json cleanup
      if (!file.endsWith('.md') && !file.endsWith('.json')) continue;

      const filepath = join(this.logsDir, file);

      // For JSON files, parse the startedAt directly
      if (file.endsWith('.json')) {
        try {
          const log = await this.readJsonLog(filepath);
          if (log.startedAt < cutoffDate) {
            await unlink(filepath);
            deleted++;
          }
        } catch {
          // Skip invalid JSON files
        }
        continue;
      }

      // For markdown files, extract date from content
      const content = await readFile(filepath, 'utf-8');
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

// ============================================================================
// Standalone Pino Logger Factory
// ============================================================================

export interface CreateLoggerOptions {
  name?: string;
  level?: LogLevel;
  destination?: DestinationStream;
  pretty?: boolean;
}

/**
 * Create a standalone Pino logger for non-workflow logging needs
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const pinoOptions: pino.LoggerOptions = {
    level: PINO_LEVELS[options.level ?? LogLevel.INFO],
  };

  // Only set name if provided
  if (options.name) {
    pinoOptions.name = options.name;
  }

  if (options.pretty && process.env.NODE_ENV !== 'production') {
    // Use pino-pretty in development
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return options.destination ? pino(pinoOptions, options.destination) : pino(pinoOptions);
}

/**
 * Create a file destination for Pino
 */
export function createFileDestination(filepath: string): DestinationStream {
  return createWriteStream(filepath, { flags: 'a' });
}
