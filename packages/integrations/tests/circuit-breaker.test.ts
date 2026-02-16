/**
 * Tests for circuit breaker pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreakerRegistry,
  resetCircuitBreakerRegistry,
} from '../src/reliability/circuit-breaker.js';
import { wrapIntegration } from '../src/reliability/wrapper.js';

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry({
      failureThreshold: 3,
      resetTimeout: 100,
      successThreshold: 2,
      failureWindow: 5000,
    });
  });

  it('should start in closed state', () => {
    expect(registry.getState('test-service')).toBe('closed');
  });

  it('should allow requests when closed', () => {
    expect(() => registry.allowRequest('test-service')).not.toThrow();
  });

  it('should open after reaching failure threshold', () => {
    registry.recordFailure('test-service');
    registry.recordFailure('test-service');
    expect(registry.getState('test-service')).toBe('closed');

    registry.recordFailure('test-service');
    expect(registry.getState('test-service')).toBe('open');
  });

  it('should reject requests when open', () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('test-service');

    expect(() => registry.allowRequest('test-service')).toThrow('Circuit breaker is open');
  });

  it('should transition to half-open after reset timeout', async () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('test-service');
    expect(registry.getState('test-service')).toBe('open');

    await new Promise((r) => setTimeout(r, 150));

    // allowRequest should succeed and transition to half_open
    expect(() => registry.allowRequest('test-service')).not.toThrow();
    expect(registry.getState('test-service')).toBe('half_open');
  });

  it('should close after enough successes in half-open', async () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('test-service');
    await new Promise((r) => setTimeout(r, 150));
    registry.allowRequest('test-service'); // transitions to half_open

    registry.recordSuccess('test-service');
    expect(registry.getState('test-service')).toBe('half_open');

    registry.recordSuccess('test-service');
    expect(registry.getState('test-service')).toBe('closed');
  });

  it('should reopen on failure in half-open', async () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('test-service');
    await new Promise((r) => setTimeout(r, 150));
    registry.allowRequest('test-service'); // transitions to half_open

    registry.recordFailure('test-service');
    expect(registry.getState('test-service')).toBe('open');
  });

  it('should track circuits per service independently', () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('service-a');

    expect(registry.getState('service-a')).toBe('open');
    expect(registry.getState('service-b')).toBe('closed');
  });

  it('should prune old failures outside the window', () => {
    const shortWindowRegistry = new CircuitBreakerRegistry({
      failureThreshold: 3,
      failureWindow: 50,
    });

    shortWindowRegistry.recordFailure('svc');
    shortWindowRegistry.recordFailure('svc');

    // Wait for failures to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        shortWindowRegistry.recordFailure('svc');
        // Only 1 recent failure (other 2 expired), should still be closed
        expect(shortWindowRegistry.getState('svc')).toBe('closed');
        resolve();
      }, 80);
    });
  });

  it('should call onStateChange callback', () => {
    const onChange = vi.fn();
    const reg = new CircuitBreakerRegistry({
      failureThreshold: 2,
      onStateChange: onChange,
    });

    reg.recordFailure('svc');
    reg.recordFailure('svc');

    expect(onChange).toHaveBeenCalledWith('svc', 'closed', 'open');
  });

  it('should return stats for all circuits', () => {
    registry.recordFailure('svc-a');
    registry.recordFailure('svc-a');
    registry.recordFailure('svc-b');

    const stats = registry.getStats();
    expect(stats['svc-a'].recentFailures).toBe(2);
    expect(stats['svc-a'].state).toBe('closed');
    expect(stats['svc-b'].recentFailures).toBe(1);
  });

  it('should reset a specific circuit', () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('svc');
    expect(registry.getState('svc')).toBe('open');

    registry.reset('svc');
    expect(registry.getState('svc')).toBe('closed');
  });

  it('should include retryAfter in error when circuit is open', () => {
    for (let i = 0; i < 3; i++) registry.recordFailure('svc');

    try {
      registry.allowRequest('svc');
      expect.unreachable('should have thrown');
    } catch (error: any) {
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBeGreaterThan(0);
    }
  });
});

describe('circuit breaker integration with wrapper', () => {
  beforeEach(() => {
    resetCircuitBreakerRegistry();
  });

  it('should open circuit after repeated failures through wrapper', async () => {
    let callCount = 0;
    const sdk = {
      failingAction: async () => {
        callCount++;
        throw new Error('service down');
      },
    };

    const wrapped = wrapIntegration('FailService', sdk, {
      maxRetries: 0,
      circuitBreaker: true,
    });

    // Trigger failures to open circuit (default threshold: 5)
    for (let i = 0; i < 5; i++) {
      await wrapped.failingAction().catch(() => {});
    }

    // Next call should be rejected by circuit breaker without calling SDK
    const beforeCount = callCount;
    await expect(wrapped.failingAction()).rejects.toThrow('Circuit breaker is open');
    expect(callCount).toBe(beforeCount); // SDK not called
  });

  it('should allow disabling circuit breaker per service', async () => {
    const sdk = {
      action: async () => { throw new Error('fail'); },
    };

    const wrapped = wrapIntegration('NoBreaker', sdk, {
      maxRetries: 0,
      circuitBreaker: false,
    });

    // Even after many failures, should not get circuit breaker error
    for (let i = 0; i < 10; i++) {
      try {
        await wrapped.action();
      } catch (e: any) {
        expect(e.message).not.toContain('Circuit breaker');
      }
    }
  });

  it('should record success and keep circuit closed', async () => {
    const sdk = {
      goodAction: async () => 'ok',
    };

    const wrapped = wrapIntegration('GoodService', sdk, {
      maxRetries: 0,
      circuitBreaker: true,
    });

    for (let i = 0; i < 10; i++) {
      const result = await wrapped.goodAction();
      expect(result).toBe('ok');
    }
  });
});
