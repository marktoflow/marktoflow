import { describe, it, expect, vi, afterEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, ClaudeCodeInitializer, ClaudeCodeClient } from '../src/index.js';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn()
  };
});

import { spawn } from 'node:child_process';

describe('Claude Code Integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register claude-code initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'claude-code',
      options: { cliPath: '/usr/bin/claude' }
    };

    const client = ClaudeCodeInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    return expect(client).resolves.toBeInstanceOf(ClaudeCodeClient);
  });

  it('should execute cli command', async () => {
    const config = {
      sdk: 'claude-code',
      options: { cliPath: 'claude' }
    };
    
    const client = await ClaudeCodeInitializer.initialize({}, config) as ClaudeCodeClient;

    // Mock spawn behavior
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn();
    
    (spawn as any).mockReturnValue(mockProcess);

    // Run generate in background
    const promise = client.generate('Hello');

    // Simulate process execution
    mockProcess.stdout.emit('data', 'Response from Claude');
    mockProcess.emit('close', 0);

    const result = await promise;
    expect(result).toBe('Response from Claude');
    expect(spawn).toHaveBeenCalledWith('claude', ['-p', 'Hello'], expect.anything());
  });
});
