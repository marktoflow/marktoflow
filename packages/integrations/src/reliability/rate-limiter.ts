/**
 * Proactive rate limiter for integration reliability.
 *
 * Prevents 429 errors by tracking request rates per service
 * and queuing/delaying requests that would exceed known limits.
 *
 * Uses a token bucket algorithm with configurable refill rates.
 */

import { IntegrationRequestError } from './errors.js';

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in ms */
  windowMs: number;
  /** Strategy when limit is reached: 'queue' waits, 'reject' throws (default: 'queue') */
  strategy?: 'queue' | 'reject';
  /** Maximum queue size before rejecting (default: 100) */
  maxQueueSize?: number;
}

/** Well-known rate limits for popular services */
export const KNOWN_RATE_LIMITS: Record<string, RateLimitConfig> = {
  slack: { maxRequests: 50, windowMs: 60_000 },
  github: { maxRequests: 5000, windowMs: 3_600_000 },
  gmail: { maxRequests: 250, windowMs: 1_000 },
  discord: { maxRequests: 50, windowMs: 1_000 },
  notion: { maxRequests: 3, windowMs: 1_000 },
  linear: { maxRequests: 50, windowMs: 60_000 },
  stripe: { maxRequests: 100, windowMs: 1_000 },
  sendgrid: { maxRequests: 600, windowMs: 60_000 },
  trello: { maxRequests: 100, windowMs: 10_000 },
  shopify: { maxRequests: 40, windowMs: 1_000 },
};

interface TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
  lastRefillAt: number;
  queue: Array<{ resolve: () => void; reject: (err: Error) => void }>;
}

export class RateLimiterRegistry {
  private buckets = new Map<string, TokenBucket>();
  private configs = new Map<string, Required<RateLimitConfig>>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(overrides?: Record<string, RateLimitConfig>) {
    // Load known defaults, allow overrides
    for (const [service, config] of Object.entries(KNOWN_RATE_LIMITS)) {
      this.configure(service, config);
    }
    if (overrides) {
      for (const [service, config] of Object.entries(overrides)) {
        this.configure(service, config);
      }
    }
  }

  /**
   * Configure rate limit for a specific service.
   */
  configure(service: string, config: RateLimitConfig): void {
    const full: Required<RateLimitConfig> = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      strategy: config.strategy ?? 'queue',
      maxQueueSize: config.maxQueueSize ?? 100,
    };
    this.configs.set(service, full);

    const refillRate = config.maxRequests / config.windowMs;
    this.buckets.set(service, {
      tokens: config.maxRequests,
      maxTokens: config.maxRequests,
      refillRate,
      lastRefillAt: Date.now(),
      queue: [],
    });
  }

  /**
   * Acquire a token for the given service.
   * Resolves immediately if tokens available, queues or rejects otherwise.
   */
  async acquire(service: string): Promise<void> {
    const bucket = this.buckets.get(service);
    if (!bucket) return; // No rate limit configured — allow

    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    const config = this.configs.get(service)!;

    if (config.strategy === 'reject') {
      throw new IntegrationRequestError({
        service,
        action: 'rate_limiter',
        message: `Rate limit reached for ${service} (${config.maxRequests} requests per ${config.windowMs}ms)`,
        retryable: true,
        retryAfter: Math.ceil((1 / bucket.refillRate) / 1000),
      });
    }

    // Queue strategy — wait for a token
    if (bucket.queue.length >= config.maxQueueSize) {
      throw new IntegrationRequestError({
        service,
        action: 'rate_limiter',
        message: `Rate limit queue full for ${service} (${config.maxQueueSize} pending requests)`,
        retryable: true,
      });
    }

    return new Promise<void>((resolve, reject) => {
      bucket.queue.push({ resolve, reject });
      this.ensureDrainTimer(service, bucket);
    });
  }

  /**
   * Release a token (optional — for manual flow control).
   */
  release(service: string): void {
    const bucket = this.buckets.get(service);
    if (!bucket) return;
    bucket.tokens = Math.min(bucket.tokens + 1, bucket.maxTokens);
    this.drainQueue(bucket);
  }

  /**
   * Get current rate limit status for a service.
   */
  getStatus(service: string): {
    available: number;
    max: number;
    queued: number;
    refillRate: number;
  } | null {
    const bucket = this.buckets.get(service);
    if (!bucket) return null;
    this.refill(bucket);
    return {
      available: Math.floor(bucket.tokens),
      max: bucket.maxTokens,
      queued: bucket.queue.length,
      refillRate: bucket.refillRate * 1000, // tokens per second
    };
  }

  /**
   * Update limits based on response headers (Retry-After, X-RateLimit-*).
   */
  updateFromHeaders(service: string, headers: Record<string, string>): void {
    const remaining = headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'];
    if (remaining !== undefined) {
      const bucket = this.buckets.get(service);
      if (bucket) {
        const count = parseInt(remaining, 10);
        if (!isNaN(count)) {
          bucket.tokens = Math.min(count, bucket.maxTokens);
        }
      }
    }
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();

    // Reject all queued requests
    for (const bucket of this.buckets.values()) {
      for (const waiter of bucket.queue) {
        waiter.reject(new Error('Rate limiter destroyed'));
      }
      bucket.queue = [];
    }
  }

  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefillAt;
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.tokens + tokensToAdd, bucket.maxTokens);
    bucket.lastRefillAt = now;
  }

  private drainQueue(bucket: TokenBucket): void {
    while (bucket.queue.length > 0 && bucket.tokens >= 1) {
      bucket.tokens -= 1;
      const waiter = bucket.queue.shift()!;
      waiter.resolve();
    }
  }

  private ensureDrainTimer(service: string, bucket: TokenBucket): void {
    if (this.timers.has(service)) return;

    const intervalMs = Math.max(10, Math.ceil(1 / bucket.refillRate));
    const timer = setInterval(() => {
      this.refill(bucket);
      this.drainQueue(bucket);

      if (bucket.queue.length === 0) {
        clearInterval(timer);
        this.timers.delete(service);
      }
    }, intervalMs);

    if (timer.unref) timer.unref();
    this.timers.set(service, timer);
  }
}

/** Global rate limiter registry */
let _globalLimiter: RateLimiterRegistry | undefined;

export function getRateLimiterRegistry(overrides?: Record<string, RateLimitConfig>): RateLimiterRegistry {
  if (!_globalLimiter) {
    _globalLimiter = new RateLimiterRegistry(overrides);
  }
  return _globalLimiter;
}

export function resetRateLimiterRegistry(): void {
  _globalLimiter?.destroy();
  _globalLimiter = undefined;
}
