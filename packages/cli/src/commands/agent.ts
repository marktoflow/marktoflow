/**
 * `marktoflow agent` commands — Agent management.
 */

import chalk from 'chalk';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { detectAgents, detectAgent, getKnownAgentIds } from '../utils/index.js';

export function executeAgentList(): void {
  const agents = detectAgents();

  console.log(chalk.bold('Available Agents:\n'));
  for (const agent of agents) {
    if (agent.available) {
      const methodLabel = agent.method === 'cli' ? 'CLI found' : agent.method === 'env' ? 'env var set' : 'server running';
      console.log(`  ${chalk.cyan(agent.id)}  ${chalk.green('Available')} (${methodLabel})`);
    } else {
      console.log(`  ${chalk.cyan(agent.id)}  ${chalk.yellow('Not configured')} — ${agent.configHint}`);
    }
  }
  console.log(`\n  Config: ${chalk.dim('.marktoflow/agents/capabilities.yaml')}`);
}

export function executeAgentInfo(agentId: string): void {
  const detected = detectAgent(agentId);
  if (!detected) {
    const known = getKnownAgentIds();
    console.log(chalk.red(`Unknown agent: ${agentId}`));
    console.log(`Known agents: ${known.join(', ')}`);
    process.exit(1);
  }

  console.log(chalk.bold(detected.name) + ` (${detected.id})\n`);

  if (detected.available) {
    const methodLabel = detected.method === 'cli' ? 'CLI found on PATH' : detected.method === 'env' ? 'Environment variable set' : 'Server running';
    console.log(`  Status:  ${chalk.green('Available')}`);
    console.log(`  Method:  ${methodLabel}`);
  } else {
    console.log(`  Status:  ${chalk.yellow('Not configured')}`);
    console.log(`  Setup:   ${detected.configHint}`);
  }

  // Show config file info if it exists
  const capabilitiesPath = join('.marktoflow', 'agents', 'capabilities.yaml');
  if (existsSync(capabilitiesPath)) {
    const content = readFileSync(capabilitiesPath, 'utf8');
    const data = parseYaml(content) as { agents?: Record<string, any> };
    const fileInfo = data?.agents?.[agentId];
    if (fileInfo) {
      console.log(`\n  ${chalk.dim('From capabilities.yaml:')}`);
      if (fileInfo.version) console.log(`  Version:  ${fileInfo.version}`);
      if (fileInfo.provider) console.log(`  Provider: ${fileInfo.provider}`);
    }
  }
}
