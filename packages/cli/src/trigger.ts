import { Command } from 'commander';
import { 
  Scheduler, 
  createJob,
  parseFile,
  WorkflowEngine,
  StateStore,
  SDKRegistry,
  createSDKStepExecutor
} from '@marktoflow/core';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { registerIntegrations } from '@marktoflow/integrations';

export const triggerCommand = new Command('trigger')
  .description('Start trigger service (scheduler)')
  .action(async () => {
    console.log(chalk.blue('Starting trigger service...'));
    
    const scheduler = new Scheduler();
    const workflowsDir = join('.marktoflow', 'workflows');
    const stateStore = new StateStore();
    const engine = new WorkflowEngine({}, {}, stateStore);
    const registry = new SDKRegistry();
    registerIntegrations(registry);
    
    if (existsSync(workflowsDir)) {
      const files = readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      
      for (const file of files) {
        try {
          const path = join(workflowsDir, file);
          const { workflow } = await parseFile(path);
          
          if (workflow.triggers) {
            for (const trigger of workflow.triggers) {
              if (trigger.type === 'schedule' && trigger.enabled) {
                const cron = trigger.config['cron'] as string;
                if (cron) {
                  const job = createJob(
                    `${workflow.metadata.id}-schedule`,
                    path,
                    cron,
                    (trigger.config['inputs'] as Record<string, unknown>) || {}
                  );
                  scheduler.addJob(job);
                  console.log(chalk.cyan(`Scheduled ${workflow.metadata.id} at "${cron}"`));
                }
              }
            }
          }
        } catch (e) {
          console.warn(chalk.yellow(`Failed to load ${file}: ${e}`));
        }
      }
    }
    
    scheduler.onJobDue(async (job) => {
      console.log(chalk.green(`Triggering scheduled job: ${job.id}`));
      
      try {
        const { workflow } = await parseFile(job.workflowPath);
        registry.registerTools(workflow.tools);
        
        await engine.execute(
          workflow,
          job.inputs,
          registry,
          createSDKStepExecutor()
        );
        console.log(chalk.green(`Job ${job.id} completed`));
      } catch (error) {
        console.error(chalk.red(`Job ${job.id} failed:`), error);
      }
    });

    scheduler.start();
    console.log(chalk.green('Scheduler running. Press Ctrl+C to stop.'));
    
    // Keep process alive
    await new Promise(() => {});
  });
