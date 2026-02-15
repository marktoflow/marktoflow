/**
 * `marktoflow workflow` commands — Workflow management.
 */

import chalk from 'chalk';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFile, loadConfig } from '@marktoflow/core';

export async function executeWorkflowList(): Promise<void> {
  const config = loadConfig(process.cwd());
  const workflowsDir = config.workflows?.path ?? '.marktoflow/workflows';

  if (!existsSync(workflowsDir)) {
    console.log(chalk.yellow('No workflows found. Run `marktoflow init` first.'));
    return;
  }

  const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));

  if (files.length === 0) {
    console.log(chalk.yellow('No workflows found.'));
    return;
  }

  console.log(chalk.bold('Available Workflows:'));
  for (const file of files) {
    try {
      const { workflow } = await parseFile(join(workflowsDir, file));
      console.log(`  ${chalk.cyan(file)}: ${workflow.metadata.name}`);
    } catch {
      console.log(`  ${chalk.red(file)}: (invalid)`);
    }
  }
}
