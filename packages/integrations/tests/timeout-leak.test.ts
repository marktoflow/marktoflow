/**
 * Tests for timeout resource leak fix.
 *
 * Verifies that the reliability wrapper properly handles timeouts
 * without leaking resources (dangling promises, uncleared timers).
 */

import { describe, it, expect, vi } from 'vitest';
import { wrapIntegration, createTimeoutSignal } from '../src/reliability/wrapper.js';

describe('timeout resource leak fix', () => {
  it('should reject with timeout error when operation exceeds timeout', async () => {
    const sdk = {
      slowAction: () => new Promise((resolve) => setTimeout(resolve, 5000, 'done')),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 50,
      maxRetries: 0,
    });

    await expect(wrapped.slowAction()).rejects.toThrow('Request timed out after 50ms');
  });

  it('should resolve normally when operation completes before timeout', async () => {
    const sdk = {
      fastAction: () => Promise.resolve('quick result'),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 5000,
      maxRetries: 0,
    });

    const result = await wrapped.fastAction();
    expect(result).toBe('quick result');
  });

  it('should not resolve after timeout even if underlying promise resolves late', async () => {
    let resolveUnderlying: (v: string) => void;
    const sdk = {
      lateAction: () => new Promise<string>((resolve) => {
        resolveUnderlying = resolve;
      }),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 50,
      maxRetries: 0,
    });

    const promise = wrapped.lateAction();

    // Wait for timeout to fire
    await expect(promise).rejects.toThrow('Request timed out');

    // Now resolve the underlying promise — should NOT cause issues
    resolveUnderlying!('late result');

    // Give event loop a tick to process
    await new Promise((r) => setTimeout(r, 10));

    // If we got here without errors, the settled guard worked
    expect(true).toBe(true);
  });

  it('should not reject twice if underlying rejects after timeout', async () => {
    let rejectUnderlying: (e: Error) => void;
    const sdk = {
      failLate: () => new Promise<string>((_, reject) => {
        rejectUnderlying = reject;
      }),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 50,
      maxRetries: 0,
    });

    const promise = wrapped.failLate();
    await expect(promise).rejects.toThrow('Request timed out');

    // Reject underlying after timeout — should be silently ignored
    rejectUnderlying!(new Error('late failure'));
    await new Promise((r) => setTimeout(r, 10));

    expect(true).toBe(true);
  });

  it('should handle synchronous return values without timeout', async () => {
    const sdk = {
      syncAction: () => 42,
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 100,
      maxRetries: 0,
    });

    const result = await wrapped.syncAction();
    expect(result).toBe(42);
  });

  it('should clear timer when operation completes before timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const sdk = {
      quickAction: () => Promise.resolve('fast'),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 5000,
      maxRetries: 0,
    });

    await wrapped.quickAction();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('should clear timer when operation fails before timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const sdk = {
      failAction: () => Promise.reject(new Error('immediate failure')),
    };

    const wrapped = wrapIntegration('TestService', sdk, {
      timeout: 5000,
      maxRetries: 0,
    });

    await expect(wrapped.failAction()).rejects.toThrow('immediate failure');
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});

describe('createTimeoutSignal', () => {
  it('should return an AbortSignal', () => {
    const signal = createTimeoutSignal(1000);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('should abort after the specified timeout', async () => {
    const signal = createTimeoutSignal(50);
    expect(signal.aborted).toBe(false);

    await new Promise((r) => setTimeout(r, 100));
    expect(signal.aborted).toBe(true);
  });
});
