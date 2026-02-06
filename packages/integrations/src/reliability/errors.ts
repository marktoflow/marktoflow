/**
 * Structured error types for integration reliability.
 *
 * Normalizes errors from any SDK/API into a consistent format
 * with actionable metadata for retry decisions and debugging.
 */

export interface IntegrationError {
  /** Service name (e.g., 'slack', 'github') */
  service: string;
  /** Action that failed (e.g., 'chat.postMessage') */
  action: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Human-readable error message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Original error for debugging */
  cause?: unknown;
  /** Retry-After header value in seconds, if present */
  retryAfter?: number;
}

export class IntegrationRequestError extends Error {
  readonly service: string;
  readonly action: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(info: IntegrationError) {
    super(info.message);
    this.name = 'IntegrationRequestError';
    this.service = info.service;
    this.action = info.action;
    this.statusCode = info.statusCode;
    this.retryable = info.retryable;
    this.retryAfter = info.retryAfter;
    if (info.cause) {
      this.cause = info.cause;
    }
  }

  toJSON(): IntegrationError {
    return {
      service: this.service,
      action: this.action,
      statusCode: this.statusCode,
      message: this.message,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
    };
  }
}

/** HTTP status codes that are generally retryable */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Normalize any error into an IntegrationRequestError.
 */
export function normalizeError(
  service: string,
  action: string,
  error: unknown
): IntegrationRequestError {
  if (error instanceof IntegrationRequestError) {
    return error;
  }

  // HTTP response-like errors (fetch Response, Axios-style, SDK-wrapped)
  const statusCode = extractStatusCode(error);
  const retryAfter = extractRetryAfter(error);
  const message = extractMessage(error);
  const retryable = isRetryableError(error, statusCode);

  return new IntegrationRequestError({
    service,
    action,
    statusCode,
    message,
    retryable,
    retryAfter,
    cause: error,
  });
}

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as Record<string, unknown>;

  // Direct status code
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  if (typeof e.code === 'number' && e.code >= 100 && e.code < 600) return e.code;

  // Nested response object (Axios, Octokit, etc.)
  if (e.response && typeof e.response === 'object') {
    const resp = e.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
    if (typeof resp.statusCode === 'number') return resp.statusCode;
  }

  return undefined;
}

function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as Record<string, unknown>;

  // Check headers
  const headers =
    (e.headers as Record<string, string>) ??
    ((e.response as Record<string, unknown>)?.headers as Record<string, string>);

  if (headers) {
    const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!isNaN(seconds)) return seconds;
      // Could be a date string
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
      }
    }
  }

  return undefined;
}

function extractMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  const e = error as Record<string, unknown>;
  if (typeof e.message === 'string') return e.message;
  if (typeof e.error === 'string') return e.error;
  if (e.error && typeof e.error === 'object') {
    const nested = e.error as Record<string, unknown>;
    if (typeof nested.message === 'string') return nested.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Status code based
  if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) return true;

  // Network-level errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const retryablePatterns = [
      'econnreset',
      'econnrefused',
      'etimedout',
      'enotfound',
      'epipe',
      'fetch failed',
      'network error',
      'socket hang up',
      'aborted',
      'timeout',
    ];
    if (retryablePatterns.some((p) => msg.includes(p))) return true;
  }

  return false;
}
