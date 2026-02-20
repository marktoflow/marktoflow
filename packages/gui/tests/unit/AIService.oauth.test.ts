import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { AIService } from '../../src/server/services/AIService';

const spawnMock = vi.fn();

vi.mock('node:child_process', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    spawn: (...args: unknown[]) => spawnMock(...args),
    default: {
      ...(actual.default as Record<string, unknown> | undefined),
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
  };
});

function makeFakeChild(result: 'spawn' | 'error', message = 'ENOENT') {
  const emitter = new EventEmitter() as EventEmitter & { unref: () => void };
  emitter.unref = vi.fn();

  queueMicrotask(() => {
    if (result === 'spawn') {
      emitter.emit('spawn');
    } else {
      emitter.emit('error', new Error(message));
    }
  });

  return emitter;
}

describe('AIService OAuth flow', () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it('starts Claude OAuth flow', async () => {
    spawnMock.mockImplementation(() => makeFakeChild('spawn'));
    const service = new AIService();

    const result = await service.startOAuthFlow('claude-agent');

    expect(result.authUrl).toBe('https://claude.ai/login');
    expect(result.message).toContain('claude login');
    expect(spawnMock).toHaveBeenCalledWith(
      'claude',
      ['login'],
      expect.objectContaining({ detached: true, stdio: 'ignore' })
    );
  });

  it('falls back to secondary command for Copilot if first fails', async () => {
    spawnMock
      .mockImplementationOnce(() => makeFakeChild('error', 'command not found'))
      .mockImplementationOnce(() => makeFakeChild('spawn'));

    const service = new AIService();
    const result = await service.startOAuthFlow('copilot');

    expect(result.authUrl).toBe('https://github.com/login/device');
    expect(result.message).toContain('github-copilot-cli login');
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it('throws for unsupported provider', async () => {
    const service = new AIService();
    await expect(service.startOAuthFlow('openai')).rejects.toThrow('OAuth login is not supported');
  });

  it('throws when all provider commands fail', async () => {
    spawnMock.mockImplementation(() => makeFakeChild('error', 'no such file'));
    const service = new AIService();

    await expect(service.startOAuthFlow('codex')).rejects.toThrow('Unable to start OAuth command');
  });
});
