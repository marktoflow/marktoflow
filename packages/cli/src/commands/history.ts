/**
 * Execution History Commands
 *
 * Browse, inspect, and replay workflow executions.
 */

import chalk from 'chalk';
import { StateStore, WorkflowStatus } from '@marktoflow/core';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { t } from '../i18n.js';

// ============================================================================
// State Store Helpers
// ============================================================================

function getStateStore(): StateStore | null {
  const dbPath = join(process.cwd(), '.marktoflow', 'state.db');
  if (!existsSync(dbPath)) {
    console.log(chalk.yellow(`  ${t('cli:commands.history.noHistory')}`));
    console.log(chalk.dim(`  ${t('cli:commands.history.runFirst')}`));
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
    console.log(chalk.dim(`  ${t('cli:commands.history.noExecutions')}`));
    return;
  }

  console.log(chalk.bold(`\n  ${t('cli:commands.history.title')}\n`));

  // Table header
  console.log(
    chalk.dim('  ') +
    chalk.bold(t('cli:commands.history.columns.status').padEnd(12)) +
    chalk.bold(t('cli:commands.history.columns.runId').padEnd(40)) +
    chalk.bold(t('cli:commands.history.columns.workflow').padEnd(25)) +
    chalk.bold(t('cli:commands.history.columns.duration').padEnd(12)) +
    chalk.bold(t('cli:commands.history.columns.started'))
  );
  console.log(chalk.dim('  ' + '─'.repeat(100)));

  for (const exec of executions) {
    const duration = exec.completedAt
      ? formatDuration(exec.completedAt.getTime() - exec.startedAt.getTime())
      : t('cli:commands.history.running');

    const icon = statusIcon(exec.status);
    const colorFn = statusColor(exec.status);

    console.log(
      `  ${icon} ${colorFn(exec.status.padEnd(10))} ` +
      chalk.cyan(exec.runId.substring(0, 36).padEnd(40)) +
      (exec.workflowId || t('cli:commands.history.unknown')).substring(0, 23).padEnd(25) +
      duration.padEnd(12) +
      chalk.dim(formatDate(exec.startedAt))
    );
  }

  // Stats
  const stats = store.getStats(options.workflow);
  console.log(chalk.dim('\n  ' + '─'.repeat(100)));
  console.log(
    chalk.dim('  ') +
    `${t('cli:commands.history.stats.total')}: ${stats.totalExecutions}  ` +
    chalk.green(`${stats.completed} ${t('cli:commands.history.stats.passed')}  `) +
    chalk.red(`${stats.failed} ${t('cli:commands.history.stats.failed')}  `) +
    chalk.blue(`${stats.running} ${t('cli:commands.history.stats.running')}  `) +
    chalk.dim(`${t('cli:commands.history.stats.successRate')}: ${(stats.successRate * 100).toFixed(0)}%  `) +
    chalk.dim(`${t('cli:commands.history.stats.avg')}: ${stats.averageDuration ? formatDuration(stats.averageDuration) : t('cli:commands.history.stats.na')}`)
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
    console.log(chalk.red(`  ${t('cli:commands.history.details.notFound', { runId })}`));
    return;
  }

  const checkpoints = store.getCheckpoints(exec.runId);

  // If --step specified, show step detail
  if (options.step) {
    const checkpoint = checkpoints.find(
      (c) => c.stepName === options.step || c.stepIndex === Number(options.step)
    );
    if (!checkpoint) {
      console.log(chalk.red(`  ${t('cli:commands.history.details.stepNotFound', { step: options.step })}`));
      console.log(chalk.dim(`  ${t('cli:commands.history.details.availableSteps')}:`));
      for (const cp of checkpoints) {
        console.log(chalk.dim(`    ${cp.stepIndex}: ${cp.stepName}`));
      }
      return;
    }

    console.log(chalk.bold(`\n  ${t('cli:commands.history.details.step')}: ${checkpoint.stepName}`));
    console.log(`  ${t('cli:commands.history.columns.status')}: ${statusIcon(checkpoint.status)} ${statusColor(checkpoint.status)(checkpoint.status)}`);
    console.log(`  ${t('cli:commands.history.details.retries')}: ${checkpoint.retryCount}`);

    if (checkpoint.inputs) {
      console.log(chalk.bold(`\n  ${t('cli:commands.history.details.inputs')}:`));
      console.log(chalk.dim(JSON.stringify(checkpoint.inputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
    }

    if (checkpoint.outputs) {
      console.log(chalk.bold(`\n  ${t('cli:commands.history.details.outputs')}:`));
      console.log(chalk.dim(JSON.stringify(checkpoint.outputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
    }

    if (checkpoint.error) {
      console.log(chalk.bold(`\n  ${t('cli:commands.history.details.error')}:`));
      console.log(chalk.red('    ' + checkpoint.error));
    }
    console.log('');
    return;
  }

  // Show execution overview
  const duration = exec.completedAt
    ? formatDuration(exec.completedAt.getTime() - exec.startedAt.getTime())
    : t('cli:commands.history.details.stillRunning');

  console.log(chalk.bold(`\n  ${t('cli:commands.history.details.title')}\n`));
  console.log(`  ${t('cli:commands.history.details.runId')}:    ${chalk.cyan(exec.runId)}`);
  console.log(`  ${t('cli:commands.history.details.workflow')}:  ${exec.workflowId}`);
  console.log(`  ${t('cli:commands.history.columns.status')}:    ${statusIcon(exec.status)} ${statusColor(exec.status)(exec.status)}`);
  console.log(`  ${t('cli:commands.history.details.started')}:   ${formatDate(exec.startedAt)}`);
  if (exec.completedAt) {
    console.log(`  ${t('cli:commands.history.details.completed')}: ${formatDate(exec.completedAt)}`);
  }
  console.log(`  ${t('cli:commands.history.columns.duration')}:  ${duration}`);
  console.log(`  ${t('cli:commands.history.details.steps')}:     ${exec.currentStep}/${exec.totalSteps}`);

  if (exec.inputs) {
    console.log(chalk.bold(`\n  ${t('cli:commands.history.details.inputs')}:`));
    console.log(chalk.dim(JSON.stringify(exec.inputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
  }

  if (exec.error) {
    console.log(chalk.bold(`\n  ${t('cli:commands.history.details.error')}:`));
    console.log(chalk.red('    ' + exec.error));
  }

  // Show step timeline
  if (checkpoints.length > 0) {
    console.log(chalk.bold(`\n  ${t('cli:commands.history.details.stepTimeline')}`));
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
    console.log(chalk.bold(`\n  ${t('cli:commands.history.details.outputs')}:`));
    console.log(chalk.dim(JSON.stringify(exec.outputs, null, 2).split('\n').map((l) => '    ' + l).join('\n')));
  }

  console.log(
    chalk.dim(`\n  ${t('cli:commands.history.details.viewStepHint', { runId: exec.runId.substring(0, 8) })}`)
  );
  console.log(
    chalk.dim(`  ${t('cli:commands.history.replay.hint', { runId: exec.runId.substring(0, 8) })}`)
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
    console.log(chalk.red(`  ${t('cli:commands.history.details.notFound', { runId })}`));
    return;
  }

  if (!exec.workflowPath) {
    console.log(chalk.red(`  ${t('cli:commands.history.replay.noWorkflowPath')}`));
    console.log(chalk.dim(`  ${t('cli:commands.history.details.workflow')} ID: ${exec.workflowId}`));
    return;
  }

  if (!existsSync(exec.workflowPath)) {
    console.log(chalk.red(`  ${t('cli:commands.history.replay.fileNotFound', { path: exec.workflowPath })}`));
    return;
  }

  const mode = options.dryRun ? 'dry-run' : 'run';
  const fromStep = options.from ? ` --from ${options.from}` : '';

  console.log(chalk.bold(`\n  ${t('cli:commands.history.replay.title')}\n`));
  console.log(`  ${t('cli:commands.history.replay.originalRun')}:  ${chalk.cyan(exec.runId)}`);
  console.log(`  ${t('cli:commands.history.details.workflow')}:      ${exec.workflowPath}`);
  console.log(`  ${t('cli:commands.history.replay.mode')}:          ${mode}`);
  if (options.from) {
    console.log(`  ${t('cli:commands.history.replay.startingFrom')}: ${options.from}`);
  }

  const inputs = exec.inputs ? Object.entries(exec.inputs).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  console.log(chalk.dim(`\n  ${t('cli:commands.history.replay.equivalentCommand')}:`));
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

  console.log(chalk.blue(`  ${t('cli:commands.history.replay.starting')}\n`));
  const result = await engine.execute(workflow, replayInputs, registry, executor);

  if (result.status === 'completed') {
    console.log(chalk.green(`  ✓ ${t('cli:commands.history.replay.completed', { duration: formatDuration(result.duration) })}`));
  } else {
    console.log(chalk.red(`  ✗ ${t('cli:commands.history.replay.failed', { error: result.error })}`));
  }
  console.log('');
}
