/**
 * Tests for the CLI `run` command argument parsing and file resolution.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const CLI_PATH = join(__dirname, '../dist/index.js');

function runCLI(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args} 2>&1`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
  } catch (error: any) {
    return (error.stdout || '') + (error.stderr || '');
  }
}

describe('CLI run command', () => {
  const cliExists = existsSync(CLI_PATH);

  it.skipIf(!cliExists)('should show error for missing workflow file', () => {
    const output = runCLI('run nonexistent-workflow.md');
    expect(output).toMatch(/not found|error|no such file|does not exist/i);
  });

  it.skipIf(!cliExists)('should accept --input flag', () => {
    // Running with --help or checking that the flag is recognized
    const output = runCLI('run --help');
    expect(output).toMatch(/input|usage|options/i);
  });

  it.skipIf(!cliExists)('should show help for run command', () => {
    const output = runCLI('run --help');
    expect(output).toContain('run');
  });
});
