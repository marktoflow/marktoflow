/**
 * `marktoflow template` commands — Workflow template management.
 */

import chalk from 'chalk';
import { TemplateRegistry } from '@marktoflow/core';

export function executeTemplateList(): void {
  const registry = new TemplateRegistry();
  const templates = registry.list();

  if (!templates.length) {
    console.log(chalk.yellow('No templates found.'));
    return;
  }

  console.log(chalk.bold('Templates:'));
  for (const template of templates) {
    console.log(`  ${chalk.cyan(template.id)}: ${template.name}`);
  }
}
