/**
 * `marktoflow schedule` commands — Scheduler management.
 */

import chalk from 'chalk';
import { Scheduler } from '@marktoflow/core';

export function executeScheduleList(): void {
  const scheduler = new Scheduler();
  const jobs = scheduler.listJobs();

  if (jobs.length === 0) {
    console.log(chalk.yellow('No scheduled workflows found.'));
    console.log('Add schedule triggers to your workflows to enable scheduling.');
    return;
  }

  console.log(chalk.bold('Scheduled Workflows:'));
  for (const job of jobs) {
    console.log(`  ${chalk.cyan(job.id)} ${job.workflowPath} (${job.schedule})`);
  }
}
