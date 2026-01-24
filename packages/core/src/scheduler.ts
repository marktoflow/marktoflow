/**
 * Scheduler for marktoflow v2.0
 *
 * Handles cron-based scheduling of workflow execution.
 */

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
// Cron Parser
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

    const ranges: Record<keyof CronFields, [number, number]> = {
      minute: [0, 59],
      hour: [0, 23],
      day: [1, 31],
      month: [1, 12],
      weekday: [0, 6],
    };

    const fieldNames: (keyof CronFields)[] = ['minute', 'hour', 'day', 'month', 'weekday'];
    const result: CronFields = {
      minute: [],
      hour: [],
      day: [],
      month: [],
      weekday: [],
    };

    for (let i = 0; i < fieldNames.length; i++) {
      const name = fieldNames[i];
      const [min, max] = ranges[name];
      result[name] = this.parseField(parts[i], min, max);
    }

    return result;
  }

  private static parseField(field: string, minVal: number, maxVal: number): number[] {
    const values = new Set<number>();

    for (const part of field.split(',')) {
      if (part === '*') {
        for (let i = minVal; i <= maxVal; i++) {
          values.add(i);
        }
      } else if (part.includes('/')) {
        const [base, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        const start = base === '*' ? minVal : parseInt(base, 10);

        for (let i = start; i <= maxVal; i += step) {
          values.add(i);
        }
      } else if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        for (let i = start; i <= end; i++) {
          values.add(i);
        }
      } else {
        values.add(parseInt(part, 10));
      }
    }

    return Array.from(values).sort((a, b) => a - b);
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
   */
  static nextRun(expression: string, after?: Date): Date | null {
    const start = after || new Date();

    try {
      this.parse(expression);
    } catch {
      return null;
    }

    // Start from next minute
    const current = new Date(start);
    current.setSeconds(0, 0);
    current.setMinutes(current.getMinutes() + 1);

    // Search up to 1 year ahead
    const maxIterations = 366 * 24 * 60;

    for (let i = 0; i < maxIterations; i++) {
      if (this.matches(expression, current)) {
        return current;
      }
      current.setMinutes(current.getMinutes() + 1);
    }

    return null;
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
    // Calculate next run time
    job.nextRun = CronParser.nextRun(job.schedule);
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
      job.nextRun = CronParser.nextRun(job.schedule, now);
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
      job.nextRun = CronParser.nextRun(job.schedule, now);
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
  inputs: Record<string, unknown> = {}
): ScheduledJob {
  return {
    id,
    workflowPath,
    schedule,
    timezone: 'UTC',
    enabled: true,
    lastRun: null,
    nextRun: CronParser.nextRun(schedule),
    runCount: 0,
    inputs,
  };
}
