/**
 * Unified trigger manager for workflows.
 */

import { TriggerType } from './models.js';
import { Scheduler, createJob, type ScheduledJob } from './scheduler.js';
import { FileWatcher, type FileWatcherOptions, type FileEvent } from './filewatcher.js';

export interface TriggerHandler {
  (payload: Record<string, unknown>): Promise<void>;
}

export interface TriggerDefinition {
  id: string;
  type: TriggerType;
  config: Record<string, unknown>;
  handler: TriggerHandler;
}

export class TriggerManager {
  private scheduler = new Scheduler();
  private fileWatchers: Map<string, FileWatcher> = new Map();
  private triggers: Map<string, TriggerDefinition> = new Map();

  constructor() {
    this.scheduler.onJobDue(async (job) => {
      const triggerId = job.id;
      const trigger = this.triggers.get(triggerId);
      if (!trigger) return;
      await trigger.handler({ type: 'schedule', job });
    });
  }

  register(trigger: TriggerDefinition): void {
    this.triggers.set(trigger.id, trigger);

    if (trigger.type === TriggerType.SCHEDULE) {
      const schedule = trigger.config.schedule as string;
      const workflowPath = (trigger.config.workflowPath as string) ?? trigger.id;
      const inputs = (trigger.config.inputs as Record<string, unknown>) ?? {};
      const job: ScheduledJob = createJob(trigger.id, workflowPath, schedule, inputs);
      this.scheduler.addJob(job);
    }

    if (trigger.type === TriggerType.EVENT && trigger.config.kind === 'file') {
      const options = trigger.config.options as FileWatcherOptions;
      const watcher = new FileWatcher(options);
      watcher.onEvent(async (event: FileEvent) => {
        await trigger.handler({ type: 'file', event });
      });
      this.fileWatchers.set(trigger.id, watcher);
    }
  }

  start(): void {
    this.scheduler.start();
    for (const watcher of this.fileWatchers.values()) {
      watcher.start();
    }
  }

  async stop(): Promise<void> {
    this.scheduler.stop();
    for (const watcher of this.fileWatchers.values()) {
      await watcher.stop();
    }
  }

  list(): TriggerDefinition[] {
    return Array.from(this.triggers.values());
  }
}
