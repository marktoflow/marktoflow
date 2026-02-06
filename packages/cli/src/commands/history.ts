/**
 * Execution History Commands
 *
 * Browse, inspect, and replay workflow executions.
 */

import chalk from 'chalk';
import { StateStore, WorkflowStatus } from '@marktoflow/core';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ============================================================================
// State Store Helpers
// ============================================================================

function getStateStore(): StateStore | null {
  const dbPath = join(process.cwd(), '.marktoflow', 'state.db');
  if (!existsSync(dbPath)) {
    console.log(chalk.yellow('  No execution history found.'));
    console.log(chalk.dim('  Run a workflow first: marktoflow run <workflow.md>'));
    return null;
  }
  return new StateStore(dbPath);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleString();
}

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return chalk.green('✓');
    case 'failed': return chalk.red('✗');
    case 'running': return chalk.blue('⟳');
    case 'pending': return chalk.dim('○');
    case 'cancelled': return chalk.yellow('⊘');
    default: return chalk.dim('?');
  }
}

function statusColor(status: string): (s: string) => string {
  switch (status) {
    case 'completed': return chalk.green;
    case 'failed': return chalk.red;
    case 'running': return chalk.blue;
    case 'cancelled': return chalk.yellow;
    default: return chalk.dim;
  }
}

// ============================================================================
// List Executions
// ============================================================================

export function executeHistory(options: {
  limit?: number;
  status?: string;
  workflow?: string;
}): void {
  const store = getStateStore();
  if (!store) return;

  const limit = options.limit ?? 20;
  const filterStatus = options.status as WorkflowStatus | undefined;

  const executions = store.listExecutions({
    limit,
    status: filterStatus,
    workflowId: options.workflow,
  });

  if (executions.length === 0) {
    console.log(chalk.dim('  No executions found matching filters.'));
    return;
  }

  console.log(chalk.bold('\n  Execution History\n'));

  // Table header
  console.log(
    chalk.dim('  ') +
    chalk.bold('Status'.padEnd(12)) +
    chalk.bold('Run ID'.padEnd(40)) +
    chalk.bold('Workflow'.padEnd(25)) +
    chalk.bold('Duration'.padEnd(12)) +
    chalk.bold('Started')
  );
  console.log(chalk.dim('  ' + '─'.repeat(100)));

  for (const exec of executions) {
    const duration = exec.completedAt
      ? formatDuration(exec.completedAt.getTime() - exec.startedAt.getTime())
      : 'running...';

    const icon = statusIcon(exec.status);
    const colorFn = statusColor(exec.status);

    console.log(
      `  ${icon} ${colorFn(exec.status.padEnd(10))} ` +
      chalk.cyan(exec.runId.substring(0, 36).padEnd(40)) +
      (exec.workflowId || 'unknown').substring(0, 23).padEnd(25) +
      duration.padEnd(12) +
      chalk.dim(formatDate(exec.startedAt))
    );
  }

  // Stats
  const stats = store.getStats(options.workflow);
  console.log(chalk.dim('\n  ' + '─'.repeat(100)));
  console.log(
    chalk.dim('  ') +
    `Total: ${stats.totalExecutions}  ` +
    chalk.green(`${stats.completed} passed  `) +
    chalk.red(`${stats.failed} failed  `) +
    chalk.blue(`${stats.running} running  `) +
    chalk.dim(`Success rate: ${(stats.successRate * 100).toFixed(0)}%  `) +
    chalk.dim(`Avg: ${stats.averageDuration ? formatDuration(stats.averageDuration) : 'N/A'}`)
  );
  console.log('');
}

// ============================================================================
// Show Execution Details
// ============================================================================

export function executeHistoryDetail(runId: string, options: { step?: string }): void {
  const store = getStateStore();
  if (!store) return;

  const exec = store.getExecution(runId);
  if (!exec) {
    // Try prefix match
    const all = store.listExecutions({ limit: 1000 });
    const match = all.find((e) => e.runId.startsWith(runId));
    if (match) {
      return executeHistoryDetail(match.runId, options);
    }
    console.log(chalk.red(`  Execution not found: ${runId}`));
    return;
  }

  const checkpoints = store.getCheckpoints(exec.runId);

  // If --step specified, show step detail
  if (options.step) {
    const checkpoint = checkpoints.find(
      (c) => c.stepName === options.step || c.stepIndex === Number(options.step)
    );
    if (!checkpoint) {
      console.log(chalk.red(`  Step not found: ${options.step}`));
      console.log(chalk.dim('  Available steps:'));
      for (const cp of checkpoints) {
        console.log(chalk.dim(`    ${cp.stepIndex}: ${cp.stepName}`));
      }
      return;
    }

    console.log(chalk.bold(`\n  Step: ${checkpoint.stepName}`));
    console.log(`  Status: ${statusIcon(checkpoint.status)} ${statusColor(checkpoint.status)(checkpoint.status)}`);
    console.log(`  Retries: ${checkpoint.retryCount}`);

    if (checkpoint.inputs) {
      console.log(chalk.bold('\n  Inputs:'));
      console.log(chalk.dim(JSON.stringify(checkpoint.inputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
    }

    if (checkpoint.outputs) {
      console.log(chalk.bold('\n  Outputs:'));
      console.log(chalk.dim(JSON.stringify(checkpoint.outputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
    }

    if (checkpoint.error) {
      console.log(chalk.bold('\n  Error:'));
      console.log(chalk.red('    ' + checkpoint.error));
    }
    console.log('');
    return;
  }

  // Show execution overview
  const duration = exec.completedAt
    ? formatDuration(exec.completedAt.getTime() - exec.startedAt.getTime())
    : 'still running';

  console.log(chalk.bold('\n  Execution Details\n'));
  console.log(`  Run ID:    ${chalk.cyan(exec.runId)}`);
  console.log(`  Workflow:  ${exec.workflowId}`);
  console.log(`  Status:    ${statusIcon(exec.status)} ${statusColor(exec.status)(exec.status)}`);
  console.log(`  Started:   ${formatDate(exec.startedAt)}`);
  if (exec.completedAt) {
    console.log(`  Completed: ${formatDate(exec.completedAt)}`);
  }
  console.log(`  Duration:  ${duration}`);
  console.log(`  Steps:     ${exec.currentStep}/${exec.totalSteps}`);

  if (exec.inputs) {
    console.log(chalk.bold('\n  Inputs:'));
    console.log(chalk.dim(JSON.stringify(exec.inputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
  }

  if (exec.error) {
    console.log(chalk.bold('\n  Error:'));
    console.log(chalk.red('    ' + exec.error));
  }

  // Show step timeline
  if (checkpoints.length > 0) {
    console.log(chalk.bold('\n  Step Timeline'));
    console.log(chalk.dim('  ' + '─'.repeat(70)));

    for (const cp of checkpoints) {
      const icon = statusIcon(cp.status);
      const cpDuration = cp.completedAt
        ? formatDuration(cp.completedAt.getTime() - cp.startedAt.getTime())
        : '';

      console.log(
        `  ${icon} ${cp.stepName.padEnd(30)} ` +
        statusColor(cp.status)(cp.status.padEnd(12)) +
        chalk.dim(cpDuration)
      );
    }
  }

  if (exec.outputs) {
    console.log(chalk.bold('\n  Outputs:'));
    console.log(chalk.dim(JSON.stringify(exec.outputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
  }

  console.log(
    chalk.dim('\n  View step details: marktoflow history ' + exec.runId.substring(0, 8) + ' --step <step-name>')
  );
  console.log(
    chalk.dim('  Replay execution:  marktoflow replay ' + exec.runId.substring(0, 8))
  );
  console.log('');
}

// ============================================================================
// Replay Execution
// ============================================================================

export async function executeReplay(
  runId: string,
  options: { from?: string; dryRun?: boolean }
): Promise<void> {
  const store = getStateStore();
  if (!store) return;

  const exec = store.getExecution(runId);
  if (!exec) {
    // Try prefix match
    const all = store.listExecutions({ limit: 1000 });
    const match = all.find((e) => e.runId.startsWith(runId));
    if (match) {
      return executeReplay(match.runId, options);
    }
    console.log(chalk.red(`  Execution not found: ${runId}`));
    return;
  }

  if (!exec.workflowPath) {
    console.log(chalk.red('  Cannot replay: workflow path not stored in execution record.'));
    console.log(chalk.dim('  Workflow ID: ' + exec.workflowId));
    return;
  }

  if (!existsSync(exec.workflowPath)) {
    console.log(chalk.red(`  Cannot replay: workflow file not found at ${exec.workflowPath}`));
    return;
  }

  const mode = options.dryRun ? 'dry-run' : 'run';
  const fromStep = options.from ? ` --from ${options.from}` : '';

  console.log(chalk.bold('\n  Replaying Execution\n'));
  console.log(`  Original Run:  ${chalk.cyan(exec.runId)}`);
  console.log(`  Workflow:      ${exec.workflowPath}`);
  console.log(`  Mode:          ${mode}`);
  if (options.from) {
    console.log(`  Starting from: ${options.from}`);
  }

  const inputs = exec.inputs ? Object.entries(exec.inputs).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  console.log(chalk.dim(`\n  Equivalent command:`));
  console.log(chalk.dim(`    marktoflow ${mode} ${exec.workflowPath}${inputs ? ' --input ' + inputs : ''}${fromStep}`));
  console.log('');

  // Import and execute the workflow
  const { parseFile, WorkflowEngine, SDKRegistry, createSDKStepExecutor, loadEnv } = await import('@marktoflow/core');
  const { registerIntegrations } = await import('@marktoflow/integrations');

  loadEnv();

  const { workflow } = await parseFile(exec.workflowPath);
  const registry = new SDKRegistry();
  registerIntegrations(registry);
  registry.registerTools(workflow.tools);

  const engine = new WorkflowEngine({}, {}, store);
  engine.workflowPath = exec.workflowPath;
  const executor = createSDKStepExecutor();

  const replayInputs = exec.inputs ?? {};

  console.log(chalk.blue('  Starting execution...\n'));
  const result = await engine.execute(workflow, replayInputs, registry, executor);

  if (result.status === 'completed') {
    console.log(chalk.green(`  ✓ Replay completed successfully in ${formatDuration(result.duration)}`));
  } else {
    console.log(chalk.red(`  ✗ Replay failed: ${result.error}`));
  }
  console.log('');
}
