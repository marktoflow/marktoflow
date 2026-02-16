/**
 * Integration Reliability Wrapper
 *
 * Wraps raw SDK clients with:
 * - Input validation via Zod schemas
 * - Retry with exponential backoff (respects Retry-After)
 * - Configurable timeout
 * - Structured error normalization
 * - Rate limit awareness
 */

import { z } from 'zod';
import { IntegrationRequestError, normalizeError } from './errors.js';
import { getCircuitBreakerRegistry } from './circuit-breaker.js';
import { getRateLimiterRegistry } from './rate-limiter.js';

// ============================================================================
// Types
// ============================================================================

export interface WrapperOptions {
  /** Service name for error messages */
  service: string;
  /** Default timeout per action call in ms (default: 30000) */
  timeout?: number;
  /** HTTP status codes that trigger retry (default: [429, 500, 502, 503, 504]) */
  retryOn?: number[];
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelay?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelay?: number;
  /** Zod schemas for input validation per action */
  inputSchemas?: Record<string, z.ZodTypeAny>;
  /** Enable circuit breaker for this service (default: true) */
  circuitBreaker?: boolean;
  /** Enable proactive rate limiting (default: true) */
  rateLimiter?: boolean;
}

export interface ActionCallOptions {
  /** Override timeout for this call */
  timeout?: number;
  /** Override max retries for this call */
  maxRetries?: number;
  /** Skip input validation for this call */
  skipValidation?: boolean;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_RETRY_DELAY = 1000;
const DEFAULT_MAX_RETRY_DELAY = 30000;
const DEFAULT_RETRYABLE_CODES = [429, 500, 502, 503, 504];

// ============================================================================
// Wrapper Implementation
// ============================================================================

/**
 * Wrap an SDK client with reliability features.
 *
 * Returns a Proxy that intercepts method calls on the SDK,
 * adding validation, retry, timeout, and error normalization.
 *
 * The wrapper is transparent — all original SDK properties and methods
 * remain accessible. Only function calls get wrapped.
 */
export function wrapIntegration<T extends object>(
  service: string,
  sdk: T,
  options: Omit<WrapperOptions, 'service'> = {}
): T {
  const opts: Required<WrapperOptions> = {
    service,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    retryOn: options.retryOn ?? DEFAULT_RETRYABLE_CODES,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    initialRetryDelay: options.initialRetryDelay ?? DEFAULT_INITIAL_RETRY_DELAY,
    maxRetryDelay: options.maxRetryDelay ?? DEFAULT_MAX_RETRY_DELAY,
    inputSchemas: options.inputSchemas ?? {},
    circuitBreaker: options.circuitBreaker ?? true,
    rateLimiter: options.rateLimiter ?? true,
  };

  return createProxy(sdk, opts, '');
}

function createProxy<T extends object>(
  target: T,
  opts: Required<WrapperOptions>,
  path: string
): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      // Skip symbol properties and internal methods
      if (typeof prop === 'symbol') return Reflect.get(obj, prop, receiver);

      // Avoid treating the proxy as a Thenable
      if (prop === 'then') return undefined;

      const value = Reflect.get(obj, prop, receiver);

      // Respect Proxy invariants: if the property is non-configurable,
      // we must return the original value unchanged to avoid TypeError
      const desc = Object.getOwnPropertyDescriptor(obj, prop);
      if (desc && !desc.configurable) {
        return value;
      }

      // If the value is a function, wrap it with reliability
      if (typeof value === 'function') {
        const actionPath = path ? `${path}.${prop}` : String(prop);
        return createWrappedFunction(obj, value, opts, actionPath);
      }

      // If the value is an object (namespace like sdk.chat), proxy it too
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedPath = path ? `${path}.${prop}` : String(prop);
        try {
          return createProxy(value as object, opts, nestedPath);
        } catch {
          // If we can't proxy it (frozen, sealed, etc.), return as-is
          return value;
        }
      }

      return value;
    },
  }) as T;
}

function createWrappedFunction(
  thisArg: object,
  fn: Function,
  opts: Required<WrapperOptions>,
  actionPath: string
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    // 0. Circuit breaker check
    if (opts.circuitBreaker) {
      const registry = getCircuitBreakerRegistry();
      registry.allowRequest(opts.service); // Throws if circuit is open
    }

    // 1. Input validation
    const schema = opts.inputSchemas[actionPath];
    if (schema && args.length > 0 && args[0] && typeof args[0] === 'object') {
      const result = schema.safeParse(args[0]);
      if (!result.success) {
        throw new IntegrationRequestError({
          service: opts.service,
          action: actionPath,
          message: `Input validation failed: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          retryable: false,
        });
      }
    }

    // 2. Proactive rate limiting
    if (opts.rateLimiter) {
      await getRateLimiterRegistry().acquire(opts.service);
    }

    // 3. Retry loop with timeout
    // Circuit breaker records are per-request, not per-attempt,
    // to avoid fighting with retry logic.
    let lastError: IntegrationRequestError | undefined;
    const maxAttempts = opts.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Delay before retry (not on first attempt)
      if (attempt > 0 && lastError) {
        const delay = calculateDelay(
          attempt - 1,
          opts.initialRetryDelay,
          opts.maxRetryDelay,
          lastError.retryAfter
        );
        await sleep(delay);
      }

      try {
        const result = await withTimeout(
          fn.apply(thisArg, args),
          opts.timeout,
          opts.service,
          actionPath
        );

        // Record success once per request (not per attempt)
        if (opts.circuitBreaker) {
          getCircuitBreakerRegistry().recordSuccess(opts.service);
        }

        return result;
      } catch (error) {
        lastError = normalizeError(opts.service, actionPath, error);

        // Determine if this error should be retried:
        // 1. If status code is in our retryOn list, always retry
        // 2. If no status code, fall back to the retryable flag (network errors etc.)
        const shouldRetry = lastError.statusCode
          ? opts.retryOn.includes(lastError.statusCode)
          : lastError.retryable;

        if (!shouldRetry) {
          // Non-retryable failure — record and throw
          if (opts.circuitBreaker) {
            getCircuitBreakerRegistry().recordFailure(opts.service);
          }
          throw lastError;
        }

        // Last attempt — record failure and throw
        if (attempt === maxAttempts - 1) {
          if (opts.circuitBreaker) {
            getCircuitBreakerRegistry().recordFailure(opts.service);
          }
          throw lastError;
        }
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new IntegrationRequestError({
      service: opts.service,
      action: actionPath,
      message: `Request failed after ${maxAttempts} attempts`,
      retryable: false,
    });
  };
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  retryAfterSeconds?: number
): number {
  // If server told us when to retry, respect it
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, maxDelay);
  }

  // Exponential backoff with jitter
  const exponential = initialDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, capped + jitter);
}

async function withTimeout(
  promise: unknown,
  timeoutMs: number,
  service: string,
  action: string
): Promise<unknown> {
  // If the function returned a non-promise, just return it
  if (!promise || typeof (promise as Promise<unknown>).then !== 'function') {
    return promise;
  }

  const controller = new AbortController();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        controller.abort();
        reject(
          new IntegrationRequestError({
            service,
            action,
            message: `Request timed out after ${timeoutMs}ms`,
            retryable: true,
          })
        );
      }
    }, timeoutMs);

    (promise as Promise<unknown>).then(
      (result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      }
    );
  });
}

/**
 * Create an AbortSignal that triggers after the given timeout.
 * Useful for passing to fetch() or other cancellable operations.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Prevent timer from keeping the process alive
  if (timer.unref) timer.unref();
  return controller.signal;
}
