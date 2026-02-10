import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

// Must import after mock setup
import { detectAgents, detectAgent, getKnownAgentIds } from '../src/utils/detect-agents.js';

describe('detect-agents', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockedExecSync.mockReset();
    // Clear relevant env vars
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  /**
   * Helper: configure which CLI commands are "found" by `which`.
   * Any `which <cmd>` call not in the list will throw (command not found).
   * The curl call for Ollama server ping is rejected by default.
   */
  function mockCliAvailability(available: string[], ollamaServerUp = false) {
    mockedExecSync.mockImplementation((cmd: string | URL, _opts?: any) => {
      const command = String(cmd);
      if (command.startsWith('which ')) {
        const binary = command.split(' ')[1];
        if (available.includes(binary)) return Buffer.from(`/usr/bin/${binary}`);
        throw new Error(`not found: ${binary}`);
      }
      if (command.includes('curl') && command.includes('11434')) {
        if (ollamaServerUp) return Buffer.from('200');
        throw new Error('connection refused');
      }
      throw new Error(`unexpected command: ${command}`);
    });
  }

  describe('getKnownAgentIds', () => {
    it('should return all known agent IDs', () => {
      const ids = getKnownAgentIds();
      expect(ids).toEqual(['claude-agent', 'openai', 'codex', 'copilot', 'opencode', 'ollama']);
    });

    it('should not include gemini-cli', () => {
      expect(getKnownAgentIds()).not.toContain('gemini-cli');
    });
  });

  describe('detectAgent', () => {
    it('should return undefined for unknown agent', () => {
      expect(detectAgent('nonexistent')).toBeUndefined();
    });

    it('should detect claude-agent via CLI', () => {
      mockCliAvailability(['claude']);
      const result = detectAgent('claude-agent');
      expect(result).toEqual({
        id: 'claude-agent',
        name: 'Claude Agent',
        available: true,
        method: 'cli',
        configHint: expect.any(String),
      });
    });

    it('should detect claude-agent via env var when CLI missing', () => {
      mockCliAvailability([]);
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      const result = detectAgent('claude-agent');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('env');
    });

    it('should mark claude-agent as unavailable when nothing is set', () => {
      mockCliAvailability([]);
      const result = detectAgent('claude-agent');
      expect(result!.available).toBe(false);
      expect(result!.method).toBe('none');
    });

    it('should detect openai via env var', () => {
      mockCliAvailability([]);
      process.env.OPENAI_API_KEY = 'sk-test';
      const result = detectAgent('openai');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('env');
    });

    it('should mark openai as unavailable without env var', () => {
      mockCliAvailability([]);
      const result = detectAgent('openai');
      expect(result!.available).toBe(false);
    });

    it('should detect codex via CLI', () => {
      mockCliAvailability(['codex']);
      const result = detectAgent('codex');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('cli');
    });

    it('should detect copilot via CLI', () => {
      mockCliAvailability(['copilot']);
      const result = detectAgent('copilot');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('cli');
    });

    it('should detect copilot via GITHUB_TOKEN when CLI missing', () => {
      mockCliAvailability([]);
      process.env.GITHUB_TOKEN = 'ghp_test';
      const result = detectAgent('copilot');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('env');
    });

    it('should detect opencode via CLI', () => {
      mockCliAvailability(['opencode']);
      const result = detectAgent('opencode');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('cli');
    });

    it('should detect ollama via CLI', () => {
      mockCliAvailability(['ollama']);
      const result = detectAgent('ollama');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('cli');
    });

    it('should detect ollama via server ping when CLI missing', () => {
      mockCliAvailability([], true);
      const result = detectAgent('ollama');
      expect(result!.available).toBe(true);
      expect(result!.method).toBe('server');
    });

    it('should mark ollama as unavailable when both CLI and server are missing', () => {
      mockCliAvailability([], false);
      const result = detectAgent('ollama');
      expect(result!.available).toBe(false);
      expect(result!.method).toBe('none');
    });
  });

  describe('detectAgents', () => {
    it('should return results for all known agents', () => {
      mockCliAvailability([]);
      const results = detectAgents();
      expect(results).toHaveLength(6);
      expect(results.map((r) => r.id)).toEqual(getKnownAgentIds());
    });

    it('should detect multiple available agents', () => {
      mockCliAvailability(['claude', 'ollama']);
      process.env.OPENAI_API_KEY = 'sk-test';

      const results = detectAgents();
      const available = results.filter((r) => r.available);
      expect(available.map((r) => r.id)).toEqual(
        expect.arrayContaining(['claude-agent', 'openai', 'ollama'])
      );
      expect(available).toHaveLength(3);
    });

    it('should show all agents as unavailable when nothing is set up', () => {
      mockCliAvailability([]);
      const results = detectAgents();
      expect(results.every((r) => !r.available)).toBe(true);
      expect(results.every((r) => r.method === 'none')).toBe(true);
    });

    it('should include configHint for every agent', () => {
      mockCliAvailability([]);
      const results = detectAgents();
      for (const result of results) {
        expect(result.configHint).toBeTruthy();
        expect(typeof result.configHint).toBe('string');
      }
    });

    it('should prefer CLI detection over env var for claude-agent', () => {
      mockCliAvailability(['claude']);
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      const result = detectAgent('claude-agent');
      expect(result!.method).toBe('cli');
    });

    it('should prefer CLI detection over server for ollama', () => {
      mockCliAvailability(['ollama'], true);
      const result = detectAgent('ollama');
      expect(result!.method).toBe('cli');
    });
  });
});
