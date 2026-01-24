
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
    expect(output).toContain('marktoflow v2.0.0-alpha.1');
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
  });
});
