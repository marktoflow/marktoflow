/**
 * `marktoflow bundle` commands — Workflow bundle management.
 */

import chalk from 'chalk';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  WorkflowBundle,
  WorkflowEngine,
  SDKRegistry,
  createSDKStepExecutor,
} from '@marktoflow/core';
import { registerIntegrations } from '@marktoflow/integrations';
import { parseInputPairs, validateAndApplyDefaults, printMissingInputsError } from '../utils/index.js';

function isBundle(path: string): boolean {
  try {
    const stat = existsSync(path) ? statSync(path) : null;
    if (!stat || !stat.isDirectory()) return false;
    const entries = readdirSync(path);
    return entries.some((name) => name.endsWith('.md') && name !== 'README.md');
  } catch {
    return false;
  }
}

export function executeBundleList(path: string = '.'): void {
  if (!existsSync(path)) {
    console.log(chalk.red(`Path not found: ${path}`));
    process.exit(1);
  }

  const entries = readdirSync(path, { withFileTypes: true });
  const bundles: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = join(path, entry.name);
    if (isBundle(fullPath)) bundles.push(fullPath);
  }

  if (bundles.length === 0) {
    console.log(chalk.yellow(`No bundles found in ${path}`));
    return;
  }

  console.log(chalk.bold('Bundles:'));
  for (const bundlePath of bundles) {
    console.log(`  ${chalk.cyan(bundlePath)}`);
  }
}

export async function executeBundleInfo(path: string): Promise<void> {
  if (!isBundle(path)) {
    console.log(chalk.red(`Not a valid bundle: ${path}`));
    process.exit(1);
  }

  const bundle = new WorkflowBundle(path);
  const workflow = await bundle.loadWorkflow();
  const tools = bundle.loadTools().listTools();

  console.log(chalk.bold(`Bundle: ${bundle.name}`));
  console.log(`  Workflow: ${workflow.metadata.name} (${workflow.metadata.id})`);
  console.log(`  Steps: ${workflow.steps.length}`);
  console.log(`  Tools: ${tools.length ? tools.join(', ') : 'none'}`);
}

export async function executeBundleValidate(path: string): Promise<void> {
  if (!isBundle(path)) {
    console.log(chalk.red(`Not a valid bundle: ${path}`));
    process.exit(1);
  }

  try {
    const bundle = new WorkflowBundle(path);
    await bundle.loadWorkflow();
    console.log(chalk.green(`Bundle '${bundle.name}' is valid.`));
  } catch (error) {
    console.log(chalk.red(`Bundle validation failed: ${error}`));
    process.exit(1);
  }
}

export interface BundleRunOptions {
  input?: string[];
}

export async function executeBundleRun(path: string, options: BundleRunOptions): Promise<void> {
  if (!isBundle(path)) {
    console.log(chalk.red(`Not a valid bundle: ${path}`));
    process.exit(1);
  }

  const bundle = new WorkflowBundle(path);
  const workflow = await bundle.loadWorkflowWithBundleTools();

  const parsedInputs = parseInputPairs(options.input);
  const validation = validateAndApplyDefaults(workflow, parsedInputs);
  if (!validation.valid) {
    printMissingInputsError(workflow, validation.missingInputs, 'bundle run', path);
    process.exit(1);
  }
  const inputs = validation.inputs;

  const engine = new WorkflowEngine();
  const registry = new SDKRegistry();
  registerIntegrations(registry);
  registry.registerTools(workflow.tools);

  const result = await engine.execute(workflow, inputs, registry, createSDKStepExecutor());
  console.log(chalk.bold(`Bundle completed: ${result.status}`));
}
