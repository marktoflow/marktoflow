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
});
