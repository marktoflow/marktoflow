import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI_PATH = join(__dirname, '../dist/index.js');

function runCLI(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args} 2>&1`, { cwd, encoding: 'utf-8' });
  } catch (error: any) {
    return error.stdout + error.stderr;
  }
}

describe('CLI', () => {
  it('should show version', () => {
    const output = runCLI('version');
    expect(output).toContain('marktoflow v2.0.0-alpha.12');
  });

  it('should run doctor', () => {
    const output = runCLI('doctor');
    expect(output).toContain('marktoflow Doctor');
    expect(output).toContain('Node.js');
  });

  describe('init', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = join(tmpdir(), `marktoflow-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterAll(() => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to cleanup temp dir:', e);
      }
    });

    it('should initialize project', () => {
      const output = runCLI('init', tempDir);
      expect(output).toContain('Project initialized successfully');

      const configDir = join(tempDir, '.marktoflow');
      expect(existsSync(configDir)).toBe(true);
      expect(existsSync(join(configDir, 'workflows/hello-world.md'))).toBe(true);
      expect(existsSync(join(configDir, 'credentials/.gitignore'))).toBe(true);
    });

    it('should not re-initialize without force', () => {
      const output = runCLI('init', tempDir);
      expect(output).toContain('Project already initialized');
    });

    it('should re-initialize with force', () => {
      const output = runCLI('init --force', tempDir);
      expect(output).toContain('Project initialized successfully');
    });

    it('should list agents', () => {
      const output = runCLI('agent list', tempDir);
      expect(output).toContain('Available Agents');
    });

    it('should list tools with no registry', () => {
      const output = runCLI('tools list', tempDir);
      expect(output).toContain('No tool registry');
    });

    it('should list bundles in empty dir', () => {
      const output = runCLI('bundle list', tempDir);
      expect(output).toContain('No bundles found');
    });
  });

  describe('input validation', () => {
    let tempDir: string;
    let workflowPath: string;

    beforeAll(() => {
      tempDir = join(tmpdir(), `marktoflow-input-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });

      // Create a test workflow with required inputs
      const workflow = `---
workflow:
  id: test-inputs
  name: "Test Input Validation"
  version: "1.0.0"

inputs:
  required_string:
    type: string
    required: true
    description: "A required string input"
  required_number:
    type: number
    required: true
    description: "A required number input"
  optional_with_default:
    type: string
    default: "default_value"
    description: "An optional input with default"
  optional_no_default:
    type: string
    required: false
    description: "An optional input without default"

steps:
  - id: step1
    action: console.log
    inputs:
      message: "Test"
---

# Test Workflow

Just a test workflow.
`;

      workflowPath = join(tempDir, 'test-workflow.md');
      writeFileSync(workflowPath, workflow);
    });

    afterAll(() => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to cleanup temp dir:', e);
      }
    });

    it('should show error when required inputs are missing', () => {
      const output = runCLI(`run ${workflowPath}`);

      expect(output).toContain('Missing required input(s)');
      expect(output).toContain('required_string');
      expect(output).toContain('required_number');
      expect(output).toContain('A required string input');
      expect(output).toContain('A required number input');
      expect(output).toContain('Usage:');
      expect(output).toContain('Example:');
    });

    it('should show error when only some required inputs are provided', () => {
      const output = runCLI(`run ${workflowPath} --input required_string=test`);

      expect(output).toContain('Missing required input(s)');
      expect(output).toContain('required_number');
      expect(output).not.toContain('required_string'); // Should not list this since it was provided
    });

    it('should succeed with required inputs provided in dry-run mode', () => {
      const output = runCLI(`run ${workflowPath} --input required_string=test --input required_number=42 --dry-run`);

      expect(output).not.toContain('Missing required input(s)');
      expect(output).toContain('Dry Run Mode');
      expect(output).toContain('Dry run completed successfully');
    });

    it('should apply default values for optional inputs', () => {
      const output = runCLI(`run ${workflowPath} --input required_string=test --input required_number=42 --debug --dry-run`);

      expect(output).toContain('Using default for optional_with_default: "default_value"');
    });
  });
});
