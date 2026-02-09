import { describe, it, expect, vi, afterEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, OpenCodeInitializer, OpenCodeClient } from '../src/index.js';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  };
});

// Mock @opencode-ai/sdk
vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeClient: vi.fn().mockReturnValue({
    session: {
      create: vi.fn().mockResolvedValue({ data: { id: 'sess-123' }, error: null }),
      prompt: vi.fn().mockResolvedValue({
        data: { parts: [{ type: 'text', text: 'Server response' }] },
        error: null,
      }),
      list: vi.fn().mockResolvedValue({ data: [{ id: 'sess-1' }, { id: 'sess-2' }], error: null }),
      get: vi.fn().mockResolvedValue({ data: { id: 'sess-123', status: 'active' }, error: null }),
      delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
      abort: vi.fn().mockResolvedValue({ data: {}, error: null }),
      messages: vi.fn().mockResolvedValue({
        data: [{ role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi' }],
        error: null,
      }),
      share: vi.fn().mockResolvedValue({ data: { url: 'https://share.example.com/sess-123' }, error: null }),
      unshare: vi.fn().mockResolvedValue({ data: {}, error: null }),
      summarize: vi.fn().mockResolvedValue({ data: { summary: 'Session summary' }, error: null }),
    },
    app: {
      agents: vi.fn().mockResolvedValue({
        data: [{ id: 'code', name: 'Code Mode' }],
        error: null,
      }),
    },
    config: {
      get: vi.fn().mockResolvedValue({ data: { version: '1.1.53' }, error: null }),
      providers: vi.fn().mockResolvedValue({
        data: [{ id: 'anthropic', models: { 'claude-sonnet': {} } }],
        error: null,
      }),
    },
    find: {
      text: vi.fn().mockResolvedValue({ data: [{ file: 'test.ts', line: 1 }], error: null }),
      files: vi.fn().mockResolvedValue({ data: ['test.ts', 'main.ts'], error: null }),
      symbols: vi.fn().mockResolvedValue({ data: [{ name: 'MyClass', kind: 'class' }], error: null }),
    },
    file: {
      read: vi.fn().mockResolvedValue({ data: { content: 'file content' }, error: null }),
      status: vi.fn().mockResolvedValue({ data: { modified: ['test.ts'] }, error: null }),
    },
    event: {
      subscribe: vi.fn().mockResolvedValue({ data: [] }),
    },
  }),
}));

import { spawn } from 'node:child_process';

describe('OpenCode Integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register opencode initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'opencode',
      options: { mode: 'cli' }
    };

    const client = OpenCodeInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    return expect(client).resolves.toBeInstanceOf(OpenCodeClient);
  });

  it('should execute cli command', async () => {
    const config = {
      sdk: 'opencode',
      options: { mode: 'cli', cliPath: 'opencode' }
    };

    const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;

    // Mock spawn behavior
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    (spawn as any).mockReturnValue(mockProcess);

    // Run generate in background
    const promise = client.generate('Hello');

    // Simulate process execution
    mockProcess.stdout.emit('data', '<output>Response from OpenCode</output>');
    mockProcess.emit('close', 0);

    const result = await promise;
    expect(result).toBe('Response from OpenCode');
    expect(spawn).toHaveBeenCalledWith('opencode', ['run', 'Hello'], expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] }));
  });

  it('should initialize with excludeFiles option', async () => {
    const config = {
      sdk: 'opencode',
      options: {
        mode: 'cli',
        excludeFiles: ['CLAUDE.md', 'AGENTS.md', '.env']
      }
    };

    const client = await OpenCodeInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(OpenCodeClient);
  });

  describe('Server Mode', () => {
    it('should generate via server mode using session.chat()', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server', serverUrl: 'http://localhost:4096' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      const result = await client.generate('Hello');

      expect(result).toBe('Server response');
    });

    it('should auto-fallback from server to CLI', async () => {
      // Create client in auto mode with a server that will fail on prompt
      const config = {
        sdk: 'opencode',
        options: { mode: 'auto', cliPath: 'opencode' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;

      // Make the session.create call fail for the next invocation
      const { createOpencodeClient } = await import('@opencode-ai/sdk');
      const mockSdkClient = (createOpencodeClient as any)();
      mockSdkClient.session.create.mockResolvedValueOnce({
        data: null,
        error: { message: 'Connection refused' },
      });

      // Mock CLI fallback
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      (spawn as any).mockReturnValue(mockProcess);

      const promise = client.generate('Hello');
      // Small delay to let async auto-mode try server and fall back
      await new Promise(r => setTimeout(r, 10));
      mockProcess.stdout.emit('data', 'CLI response');
      mockProcess.emit('close', 0);

      const result = await promise;
      expect(result).toBe('CLI response');
    });

    it('should list available providers', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      const providers = await client.listProviders();

      expect(providers).toBeInstanceOf(Array);
      expect(providers[0]).toHaveProperty('id', 'anthropic');
    });

    it('should list available agents', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      const agents = await client.listAgents();

      expect(agents).toBeInstanceOf(Array);
      expect(agents[0]).toHaveProperty('id', 'code');
    });

    it('should abort a session', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      // First generate to create a session
      await client.generate('Hello');
      // Then abort
      await expect(client.abort()).resolves.toBeUndefined();
    });

    it('should get session messages', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      await client.generate('Hello');
      const messages = await client.getMessages();

      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBe(2);
    });

    it('should reuse session across calls', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;

      // First call creates a session
      await client.generate('Hello');
      const sessionId = client.getSessionId();
      expect(sessionId).toBe('sess-123');

      // Second call should reuse the session
      await client.generate('World');
      expect(client.getSessionId()).toBe(sessionId);
    });

    it('should return OpenAI-compatible chat.completions via server', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      const result = await client.chat.completions({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toHaveProperty('choices');
      expect(result.choices[0].message).toHaveProperty('content');
    });

    it('should initialize with sessionId for persistence', async () => {
      const config = {
        sdk: 'opencode',
        options: { mode: 'server', sessionId: 'existing-session' }
      };

      const client = await OpenCodeInitializer.initialize({}, config) as OpenCodeClient;
      expect(client.getSessionId()).toBe('existing-session');
    });
  });
});
