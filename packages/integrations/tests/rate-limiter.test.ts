/**
 * Tests for proactive rate limiter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RateLimiterRegistry,
  resetRateLimiterRegistry,
  KNOWN_RATE_LIMITS,
} from '../src/reliability/rate-limiter.js';
import { wrapIntegration } from '../src/reliability/wrapper.js';

describe('RateLimiterRegistry', () => {
  let limiter: RateLimiterRegistry;

  beforeEach(() => {
    limiter = new RateLimiterRegistry();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow requests within the limit', async () => {
    limiter.configure('test', { maxRequests: 5, windowMs: 1000 });

    for (let i = 0; i < 5; i++) {
      await limiter.acquire('test');
    }
  });

  it('should reject when using reject strategy', async () => {
    limiter.configure('test', {
      maxRequests: 2,
      windowMs: 60000,
      strategy: 'reject',
    });

    await limiter.acquire('test');
    await limiter.acquire('test');

    await expect(limiter.acquire('test')).rejects.toThrow('Rate limit reached');
  });

  it('should queue requests when using queue strategy', async () => {
    limiter.configure('test', {
      maxRequests: 1,
      windowMs: 50,
      strategy: 'queue',
    });

    await limiter.acquire('test'); // Takes the only token

    const start = Date.now();
    await limiter.acquire('test'); // Should wait for refill
    const elapsed = Date.now() - start;

    // Should have waited roughly 50ms for refill
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });

  it('should reject when queue is full', async () => {
    limiter.configure('test', {
      maxRequests: 1,
      windowMs: 60000,
      strategy: 'queue',
      maxQueueSize: 2,
    });

    await limiter.acquire('test'); // Takes the only token

    // Fill queue
    const p1 = limiter.acquire('test');
    const p2 = limiter.acquire('test');

    // Queue is full — this should reject
    await expect(limiter.acquire('test')).rejects.toThrow('queue full');

    // Clean up
    limiter.destroy();
    await p1.catch(() => {});
    await p2.catch(() => {});
  });

  it('should allow unconfigured services without delay', async () => {
    await limiter.acquire('unconfigured-service');
    // Should not throw or delay
  });

  it('should refill tokens over time', async () => {
    limiter.configure('test', { maxRequests: 2, windowMs: 100 });

    await limiter.acquire('test');
    await limiter.acquire('test');

    // Wait for refill
    await new Promise((r) => setTimeout(r, 120));

    // Should have tokens again
    await limiter.acquire('test');
  });

  it('should return status for configured services', () => {
    limiter.configure('test', { maxRequests: 10, windowMs: 1000 });

    const status = limiter.getStatus('test');
    expect(status).not.toBeNull();
    expect(status!.available).toBe(10);
    expect(status!.max).toBe(10);
    expect(status!.queued).toBe(0);
  });

  it('should return null for unconfigured services', () => {
    expect(limiter.getStatus('unknown')).toBeNull();
  });

  it('should update tokens from response headers', () => {
    limiter.configure('test', { maxRequests: 100, windowMs: 1000 });

    limiter.updateFromHeaders('test', { 'x-ratelimit-remaining': '42' });

    const status = limiter.getStatus('test');
    expect(status!.available).toBe(42);
  });

  it('should have known rate limits for popular services', () => {
    expect(KNOWN_RATE_LIMITS.slack).toBeDefined();
    expect(KNOWN_RATE_LIMITS.github).toBeDefined();
    expect(KNOWN_RATE_LIMITS.gmail).toBeDefined();
    expect(KNOWN_RATE_LIMITS.discord).toBeDefined();
    expect(KNOWN_RATE_LIMITS.notion).toBeDefined();
  });

  it('should respect custom overrides in constructor', () => {
    const custom = new RateLimiterRegistry({
      slack: { maxRequests: 10, windowMs: 1000 },
    });

    const status = custom.getStatus('slack');
    expect(status!.max).toBe(10); // Overridden from default 50

    custom.destroy();
  });
});

describe('rate limiter integration with wrapper', () => {
  beforeEach(() => {
    resetRateLimiterRegistry();
  });

  it('should throttle requests through wrapper', async () => {
    const sdk = {
      action: async () => 'ok',
    };

    const wrapped = wrapIntegration('notion', sdk, {
      maxRetries: 0,
      rateLimiter: true,
    });

    // Notion limit is 3/sec — first 3 should be fast
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(await wrapped.action());
    }

    expect(results).toEqual(['ok', 'ok', 'ok']);
  });

  it('should allow disabling rate limiter', async () => {
    const sdk = {
      action: async () => 'ok',
    };

    const wrapped = wrapIntegration('notion', sdk, {
      maxRetries: 0,
      rateLimiter: false,
    });

    // Even beyond rate limit, should work since limiter is disabled
    for (let i = 0; i < 10; i++) {
      const result = await wrapped.action();
      expect(result).toBe('ok');
    }
  });
});
