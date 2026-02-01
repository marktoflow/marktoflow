/**
 * Scheduler for marktoflow v2.0
 *
 * Handles cron-based scheduling of workflow execution.
 * Uses cron-parser for robust cron expression handling with proper
 * DST handling, leap year support, and timezone awareness.
 */

import { CronExpressionParser, type CronExpression } from 'cron-parser';

// ============================================================================
// Types
// ============================================================================

export interface ScheduledJob {
  id: string;
  workflowPath: string;
  schedule: string; // Cron expression
  timezone: string;
  enabled: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  inputs: Record<string, unknown>;
}

export interface CronFields {
  minute: number[];
  hour: number[];
  day: number[];
  month: number[];
  weekday: number[];
}

export type JobCallback = (job: ScheduledJob) => Promise<void>;

// ============================================================================
// Cron Parser (wrapper around cron-parser)
// ============================================================================

export class CronParser {
  /**
   * Parse a cron expression into component values.
   * Format: minute hour day month weekday
   * Special values: * (any), * /N (every N), N-M (range), N,M (list)
   */
  static parse(expression: string): CronFields {
    const parts = expression.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: ${expression}. Expected 5 fields.`);
    }

    // Use cron-parser to validate and parse
    const cronExpr = CronExpressionParser.parse(expression);
    const fields = cronExpr.fields;

    // Extract numeric values from cron fields
    const extractNumbers = (values: readonly (number | string)[]): number[] =>
      values.filter((v) => typeof v === 'number') as number[];

    return {
      minute: extractNumbers(fields.minute.values),
      hour: extractNumbers(fields.hour.values),
      day: extractNumbers(fields.dayOfMonth.values),
      month: extractNumbers(fields.month.values),
      weekday: extractNumbers(fields.dayOfWeek.values),
    };
  }

  /**
   * Check if a date matches a cron expression.
   */
  static matches(expression: string, date: Date): boolean {
    try {
      const fields = this.parse(expression);

      return (
        fields.minute.includes(date.getMinutes()) &&
        fields.hour.includes(date.getHours()) &&
        fields.day.includes(date.getDate()) &&
        fields.month.includes(date.getMonth() + 1) &&
        fields.weekday.includes(date.getDay())
      );
    } catch {
      return false;
    }
  }

  /**
   * Calculate the next run time for a cron expression.
   * Supports timezone-aware scheduling.
   */
  static nextRun(expression: string, after?: Date, timezone?: string): Date | null {
    try {
      const cronExpr = CronExpressionParser.parse(expression, {
        currentDate: after ?? new Date(),
        tz: timezone ?? 'UTC',
      });
      return cronExpr.next().toDate();
    } catch {
      return null;
    }
  }

  /**
   * Calculate the previous run time for a cron expression.
   */
  static prevRun(expression: string, before?: Date, timezone?: string): Date | null {
    try {
      const cronExpr = CronExpressionParser.parse(expression, {
        currentDate: before ?? new Date(),
        tz: timezone ?? 'UTC',
      });
      return cronExpr.prev().toDate();
    } catch {
      return null;
    }
  }

  /**
   * Validate a cron expression without throwing.
   * Only accepts standard 5-field cron expressions.
   */
  static isValid(expression: string): boolean {
    if (!expression || typeof expression !== 'string') {
      return false;
    }

    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return false;
    }

    try {
      CronExpressionParser.parse(expression);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the underlying cron-parser CronExpression for advanced usage.
   */
  static getInterval(expression: string, options?: { currentDate?: Date; tz?: string }): CronExpression {
    return CronExpressionParser.parse(expression, {
      currentDate: options?.currentDate ?? new Date(),
      tz: options?.tz ?? 'UTC',
    });
  }
}

// ============================================================================
// Scheduler Implementation
// ============================================================================

export class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private running = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: JobCallback[] = [];

  constructor(private checkIntervalMs: number = 60000) {}

  /**
   * Add a scheduled job.
   */
  addJob(job: ScheduledJob): void {
    // Calculate next run time with timezone support
    job.nextRun = CronParser.nextRun(job.schedule, undefined, job.timezone);
    this.jobs.set(job.id, job);
  }

  /**
   * Remove a scheduled job.
   */
  removeJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get a scheduled job by ID.
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * List all scheduled jobs.
   */
  listJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Register a callback for when a job is due.
   */
  onJobDue(callback: JobCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Start the scheduler.
   */
  start(): void {
    if (this.running) return;

    this.running = true;

    // Calculate time until next minute
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // Start checking at the next minute boundary
    setTimeout(() => {
      this.checkJobs();
      this.intervalId = setInterval(() => this.checkJobs(), this.checkIntervalMs);
    }, msUntilNextMinute);
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check and run due jobs.
   */
  private async checkJobs(): Promise<void> {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;
      if (!job.nextRun || now < job.nextRun) continue;

      // Job is due - execute callbacks
      for (const callback of this.callbacks) {
        try {
          await callback(job);
        } catch (error) {
          console.error(`Error executing job ${job.id}:`, error);
        }
      }

      // Update job state
      job.lastRun = now;
      job.runCount++;
      job.nextRun = CronParser.nextRun(job.schedule, now, job.timezone);
    }
  }

  /**
   * Run due jobs once (non-blocking check).
   */
  async runOnce(): Promise<Map<string, Date>> {
    const results = new Map<string, Date>();
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (!job.enabled) continue;
      if (!job.nextRun || now < job.nextRun) continue;

      // Job is due
      for (const callback of this.callbacks) {
        try {
          await callback(job);
        } catch (error) {
          console.error(`Error executing job ${job.id}:`, error);
        }
      }

      job.lastRun = now;
      job.runCount++;
      job.nextRun = CronParser.nextRun(job.schedule, now, job.timezone);
      results.set(job.id, now);
    }

    return results;
  }

  /**
   * Check if scheduler is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createJob(
  id: string,
  workflowPath: string,
  schedule: string,
  inputs: Record<string, unknown> = {},
  timezone: string = 'UTC'
): ScheduledJob {
  return {
    id,
    workflowPath,
    schedule,
    timezone,
    enabled: true,
    lastRun: null,
    nextRun: CronParser.nextRun(schedule, undefined, timezone),
    runCount: 0,
    inputs,
  };
}
