import { Command } from 'commander';
import { 
  RedisQueue, 
  WorkflowQueueManager, 
  WorkflowEngine, 
  SDKRegistry, 
  createSDKStepExecutor,
  parseFile
} from '@marktoflow/core';
import { join } from 'node:path';
import chalk from 'chalk';
import { registerIntegrations } from '@marktoflow/integrations';

export const workerCommand = new Command('worker')
  .description('Start a workflow worker')
  .option('--redis <url>', 'Redis URL', 'redis://localhost:6379')
  .option('--concurrency <number>', 'Number of concurrent workflows', '1')
  .action(async (options) => {
    console.log(chalk.blue('Starting marktoflow worker...'));
    
    // Setup infrastructure
    const queue = new RedisQueue(options.redis);
    try {
      await queue.connect();
    } catch (e) {
      console.error(chalk.red(`Failed to connect to Redis at ${options.redis}:`), e);
      process.exit(1);
    }
    
    const engine = new WorkflowEngine();
    const registry = new SDKRegistry();
    registerIntegrations(registry);
    
    // Workflow execution callback
    const executeWorkflow = async (workflowId: string, inputs: Record<string, unknown>) => {
      console.log(chalk.green(`Processing workflow: ${workflowId}`));
      
      try {
        // Load workflow
        // In a real distributed system, workflowId might be a path or DB ID
        // Here we assume it's a relative path from .marktoflow/workflows if it doesn't end with .md
        // or just use as is if it looks like a path.
        let workflowPath = workflowId;
        if (!workflowPath.endsWith('.md')) {
           workflowPath = join('.marktoflow', 'workflows', `${workflowId}.md`);
        }
        
        const { workflow } = await parseFile(workflowPath);
        
        // Register tools
        registry.registerTools(workflow.tools);
        
        // Execute
        const result = await engine.execute(
          workflow,
          inputs,
          registry,
          createSDKStepExecutor()
        );
        
        if (result.status === 'completed') {
          console.log(chalk.green(`Workflow ${workflowId} completed`));
        } else {
          console.error(chalk.red(`Workflow ${workflowId} failed: ${result.error}`));
          throw new Error(result.error || 'Unknown error');
        }
        
        return result;
      } catch (error) {
        console.error(chalk.red(`Error executing workflow ${workflowId}:`), error);
        throw error;
      }
    };
    
    const manager = new WorkflowQueueManager(queue, executeWorkflow);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\nShutting down...'));
      await manager.stopWorker();
      await queue.disconnect();
      process.exit(0);
    });
    
    await manager.startWorker(parseInt(options.concurrency));
    console.log(chalk.blue(`Worker started (concurrency: ${options.concurrency})`));
    
    // Keep process alive
    await new Promise(() => {});
  });
