/**
 * `marktoflow tools` commands — Tool management.
 */

import chalk from 'chalk';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ToolRegistry, loadConfig } from '@marktoflow/core';

export function executeToolsList(): void {
  const config = loadConfig(process.cwd());
  const registryPath = config.tools?.registryPath ?? join('.marktoflow', 'tools', 'registry.yaml');

  if (!existsSync(registryPath)) {
    console.log(chalk.yellow("No tool registry found. Run 'marktoflow init' first."));
    return;
  }

  const registry = new ToolRegistry(registryPath);
  const tools = registry.listTools();

  if (tools.length === 0) {
    console.log(chalk.yellow('No tools registered.'));
    return;
  }

  console.log(chalk.bold('Registered Tools:'));
  for (const toolName of tools) {
    const definition = registry.getDefinition(toolName);
    const types = definition?.implementations.map((impl) => impl.type).join(', ') ?? '';
    console.log(`  ${chalk.cyan(toolName)} ${types ? `(${types})` : ''}`);
  }
}
