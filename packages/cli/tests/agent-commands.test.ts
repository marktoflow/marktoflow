import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI_PATH = join(__dirname, '../dist/index.js');

function runCLI(args: string, cwd?: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args} 2>&1`, { cwd, encoding: 'utf-8' });
  } catch (error: any) {
    return (error.stdout ?? '') + (error.stderr ?? '');
  }
}

describe('agent commands', () => {
  describe('agent list', () => {
    it('should show Available Agents header', () => {
      const output = runCLI('agent list');
      expect(output).toContain('Available Agents');
    });

    it('should list all known agents', () => {
      const output = runCLI('agent list');
      expect(output).toContain('claude-agent');
      expect(output).toContain('openai');
      expect(output).toContain('codex');
      expect(output).toContain('copilot');
      expect(output).toContain('opencode');
      expect(output).toContain('ollama');
    });

    it('should not list gemini-cli', () => {
      const output = runCLI('agent list');
      expect(output).not.toContain('gemini-cli');
    });

    it('should show detection status for each agent', () => {
      const output = runCLI('agent list');
      // Each line should have either "Available" or "Not configured"
      const agentLines = output.split('\n').filter((l) => l.includes('claude-agent') || l.includes('openai') || l.includes('ollama'));
      for (const line of agentLines) {
        expect(line).toMatch(/Available|Not configured/);
      }
    });

    it('should show config path', () => {
      const output = runCLI('agent list');
      expect(output).toContain('.marktoflow/agents/capabilities.yaml');
    });

    it('should show detection method for available agents', () => {
      const output = runCLI('agent list');
      // Check if any agent line contains "Available" (not just the header)
      const lines = output.split('\n');
      const availableAgents = lines.filter(line =>
        line.includes('claude-agent') || line.includes('openai') ||
        line.includes('ollama') || line.includes('codex') ||
        line.includes('copilot') || line.includes('opencode')
      ).filter(line => line.includes('Available'));

      if (availableAgents.length > 0) {
        // At least one agent is available, should show detection method
        const hasMethod = output.includes('CLI found') || output.includes('env var set') || output.includes('server running');
        expect(hasMethod).toBe(true);
      } else {
        // No agents available in CI - just verify format is correct
        expect(output).toContain('Not configured');
      }
    });

    it('should show config hints for unavailable agents', () => {
      const output = runCLI('agent list');
      // openai requires OPENAI_API_KEY which may not be set
      if (output.includes('openai') && output.includes('Not configured')) {
        expect(output).toContain('OPENAI_API_KEY');
      }
    });
  });

  describe('agent info', () => {
    it('should show detailed info for a known agent', () => {
      const output = runCLI('agent info claude-agent');
      expect(output).toContain('Claude Agent');
      expect(output).toContain('claude-agent');
      expect(output).toContain('Status:');
    });

    it('should show Available or Not configured status', () => {
      const output = runCLI('agent info claude-agent');
      expect(output).toMatch(/Available|Not configured/);
    });

    it('should show detection method when available', () => {
      const output = runCLI('agent info claude-agent');
      if (output.includes('Available')) {
        expect(output).toContain('Method:');
      }
    });

    it('should show setup hint when not configured', () => {
      const output = runCLI('agent info openai');
      if (output.includes('Not configured')) {
        expect(output).toContain('Setup:');
      }
    });

    it('should error for unknown agent', () => {
      const output = runCLI('agent info nonexistent');
      expect(output).toContain('Unknown agent: nonexistent');
      expect(output).toContain('Known agents:');
    });

    it('should list known agents in error message', () => {
      const output = runCLI('agent info fake-agent');
      expect(output).toContain('claude-agent');
      expect(output).toContain('openai');
      expect(output).toContain('ollama');
    });

    describe('with capabilities.yaml', () => {
      let tempDir: string;

      beforeAll(() => {
        tempDir = join(tmpdir(), `marktoflow-agent-info-${Date.now()}`);
        const agentsDir = join(tempDir, '.marktoflow', 'agents');
        mkdirSync(agentsDir, { recursive: true });
        writeFileSync(
          join(agentsDir, 'capabilities.yaml'),
          `agents:
  claude-agent:
    version: "3.0"
    provider: "anthropic"
`
        );
      });

      afterAll(() => {
        rmSync(tempDir, { recursive: true, force: true });
      });

      it('should show capabilities.yaml info when file exists', () => {
        const output = runCLI('agent info claude-agent', tempDir);
        expect(output).toContain('capabilities.yaml');
        expect(output).toContain('Version:');
        expect(output).toContain('3.0');
        expect(output).toContain('Provider:');
        expect(output).toContain('anthropic');
      });
    });
  });

  describe('init with agent detection', () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = join(tmpdir(), `marktoflow-init-agents-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should show detected agents after init', () => {
      const output = runCLI('init', tempDir);
      expect(output).toContain('Project initialized successfully');
      // Should show detection section (at least one agent should be on PATH in dev env)
      const hasDetected = output.includes('Detected agents:');
      const hasSetupHint = output.includes('marktoflow agent list');
      // Either agents were found or a hint to set them up is shown
      expect(hasDetected || hasSetupHint).toBe(true);
    });

    it('should show agent names in detection output', () => {
      // Re-init with --force
      const output = runCLI('init --force', tempDir);
      if (output.includes('Detected agents:')) {
        // Should show friendly names with detection method
        expect(output).toMatch(/✓.*\(CLI\)|✓.*\(env\)|✓.*\(server\)/);
      }
    });
  });
});
