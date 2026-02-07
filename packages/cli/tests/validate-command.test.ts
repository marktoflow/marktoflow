/**
 * Tests for the CLI `workflow validate` command.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI_PATH = join(__dirname, '../dist/index.js');

function runCLI(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args} 2>&1`, {
      encoding: 'utf-8',
      timeout: 15000,
      cwd,
    });
  } catch (error: any) {
    return (error.stdout || '') + (error.stderr || '');
  }
}

describe('CLI workflow validate command', () => {
  const cliExists = existsSync(CLI_PATH);
  let tempDir: string;

  beforeAll(() => {
    tempDir = join(tmpdir(), `marktoflow-validate-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it.skipIf(!cliExists)('should validate a valid workflow file', () => {
    const validWorkflow = `---
workflow:
  id: test-workflow
  name: Test Workflow

triggers:
  - type: manual
---

# Test Workflow

## Step 1: Hello

\`\`\`yaml
action: core.log
inputs:
  message: "hello"
output_variable: result
\`\`\`
`;
    const filePath = join(tempDir, 'valid-workflow.md');
    writeFileSync(filePath, validWorkflow);

    const output = runCLI(`workflow validate ${filePath}`);
    // Should not contain error for a valid workflow
    expect(output).not.toMatch(/invalid yaml|parse error/i);
  });

  it.skipIf(!cliExists)('should reject invalid YAML', () => {
    const invalidWorkflow = `---
workflow:
  id: [broken
  name: !!!
---

# Bad Workflow
`;
    const filePath = join(tempDir, 'invalid-workflow.md');
    writeFileSync(filePath, invalidWorkflow);

    const output = runCLI(`workflow validate ${filePath}`);
    expect(output).toMatch(/error|invalid|failed/i);
  });

  it.skipIf(!cliExists)('should error on nonexistent file', () => {
    const output = runCLI('workflow validate /tmp/does-not-exist-12345.md');
    expect(output).toMatch(/not found|error|no such file|does not exist/i);
  });
});
