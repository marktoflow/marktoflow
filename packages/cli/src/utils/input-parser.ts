/**
 * Input parsing utilities for CLI commands
 */

import chalk from 'chalk';
import type { Workflow } from '@marktoflow/core';

export interface ParseInputsOptions {
  /** Raw input pairs from CLI (e.g., ['key=value', 'key2=value2']) */
  inputPairs?: string[];
  /** Whether to show debug output */
  debug?: boolean;
}

/**
 * Parse CLI input pairs into a key-value object
 */
export function parseInputPairs(inputPairs: string[] | undefined): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  if (inputPairs) {
    for (const pair of inputPairs) {
      const [key, value] = pair.split('=');
      inputs[key] = value;
    }
  }
  return inputs;
}

/**
 * Debug log parsed inputs
 */
export function debugLogInputs(inputs: Record<string, unknown>): void {
  console.log(chalk.gray('\n🐛 Debug: Parsed Inputs'));
  if (Object.keys(inputs).length > 0) {
    for (const [key, value] of Object.entries(inputs)) {
      console.log(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
    }
  } else {
    console.log(chalk.gray('  No inputs provided'));
  }
}

export interface ValidateInputsResult {
  /** Whether validation passed */
  valid: boolean;
  /** Final inputs with defaults applied */
  inputs: Record<string, unknown>;
  /** Missing required input names */
  missingInputs: string[];
}

/**
 * Validate required inputs and apply defaults
 */
export function validateAndApplyDefaults(
  workflow: Workflow,
  inputs: Record<string, unknown>,
  options?: { debug?: boolean }
): ValidateInputsResult {
  const result: ValidateInputsResult = {
    valid: true,
    inputs: { ...inputs },
    missingInputs: [],
  };

  if (!workflow.inputs) {
    return result;
  }

  // Check for missing required inputs
  for (const [inputName, inputDef] of Object.entries(workflow.inputs)) {
    if (inputDef.required && inputs[inputName] === undefined && inputDef.default === undefined) {
      result.missingInputs.push(inputName);
    }
  }

  if (result.missingInputs.length > 0) {
    result.valid = false;
    return result;
  }

  // Apply defaults for inputs that weren't provided
  for (const [inputName, inputDef] of Object.entries(workflow.inputs)) {
    if (result.inputs[inputName] === undefined && inputDef.default !== undefined) {
      result.inputs[inputName] = inputDef.default;
      if (options?.debug) {
        console.log(chalk.gray(`  Using default for ${inputName}: ${JSON.stringify(inputDef.default)}`));
      }
    }
  }

  return result;
}

/**
 * Print missing inputs error and usage info
 */
export function printMissingInputsError(
  workflow: Workflow,
  missingInputs: string[],
  command: string,
  workflowPath: string
): void {
  console.log(chalk.red('\n❌ Error: Missing required input(s)\n'));

  for (const inputName of missingInputs) {
    const inputDef = workflow.inputs![inputName];
    const description = inputDef.description ? ` - ${inputDef.description}` : '';
    console.log(chalk.red(`  • ${inputName} (${inputDef.type})${description}`));
  }

  console.log(chalk.yellow('\nUsage:'));
  console.log(`  marktoflow ${command} ${workflowPath} --input key=value\n`);
  console.log(chalk.yellow('Example:'));
  console.log(`  marktoflow ${command} ${workflowPath} ${missingInputs.map((i) => `--input ${i}=value`).join(' ')}\n`);
}
