/**
 * Base API Client for marktoflow integrations
 *
 * Provides a unified HTTP request layer with:
 * - Consistent error handling
 * - JSON request/response handling
 * - 204 No Content response handling
 * - Configurable auth headers
 * - Retry with exponential backoff
 * - Request timeout support
 */

export type AuthType = 'bearer' | 'basic' | 'apikey' | 'custom';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
}

export interface BaseApiClientOptions {
  baseUrl: string;
  authType?: AuthType;
  authValue?: string;
  /** For Basic auth: { username, password } */
  basicAuth?: { username: string; password: string };
  /** For API key auth: { headerName, value } */
  apiKeyAuth?: { headerName: string; value: string };
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
  /** Service name for error messages */
  serviceName?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Retry options for transient failures */
  retry?: RetryOptions;
}

export interface RequestOptions {
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Override timeout for this request */
  timeout?: number;
  /** Override retry options for this request */
  retry?: RetryOptions | false;
}

/** Default retryable HTTP status codes */
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors, timeouts, etc.
    const retryableMessages = [
      'fetch failed',
      'network error',
      'aborted',
      'timeout',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];
    return retryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
  return false;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Base API client that can be extended or used directly.
 * Eliminates duplicated request() methods across service integrations.
 */
export class BaseApiClient {
  protected readonly baseUrl: string;
  protected readonly defaultHeaders: Record<string, string>;
  protected readonly serviceName: string;
  protected readonly timeout: number;
  protected readonly retryOptions: Required<RetryOptions>;

  constructor(options: BaseApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.serviceName = options.serviceName ?? 'API';
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retryOptions = {
      maxRetries: options.retry?.maxRetries ?? 3,
      initialDelayMs: options.retry?.initialDelayMs ?? 1000,
      maxDelayMs: options.retry?.maxDelayMs ?? 30000,
      backoffMultiplier: options.retry?.backoffMultiplier ?? 2,
      retryableStatusCodes: options.retry?.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES,
    };
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Set up auth header based on type
    if (options.authType === 'bearer' && options.authValue) {
      this.defaultHeaders['Authorization'] = `Bearer ${options.authValue}`;
    } else if (options.authType === 'basic' && options.basicAuth) {
      const { username, password } = options.basicAuth;
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      this.defaultHeaders['Authorization'] = `Basic ${encoded}`;
    } else if (options.authType === 'apikey' && options.apiKeyAuth) {
      this.defaultHeaders[options.apiKeyAuth.headerName] = options.apiKeyAuth.value;
    } else if (options.authType === 'custom' && options.authValue) {
      this.defaultHeaders['Authorization'] = options.authValue;
    }
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = `${this.baseUrl}${path}`;
    if (!params) return url;

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Make an HTTP request with retry and timeout support
   */
  protected async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const timeout = options?.timeout ?? this.timeout;
    const retry = options?.retry === false ? null : { ...this.retryOptions, ...options?.retry };

    const headers = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    const requestBody = body ? JSON.stringify(body) : undefined;

    // Execute with retry logic
    let lastError: Error | undefined;
    const maxAttempts = retry ? retry.maxRetries + 1 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Add delay before retry (not on first attempt)
      if (attempt > 0 && retry) {
        const delay = calculateDelay(
          attempt - 1,
          retry.initialDelayMs,
          retry.maxDelayMs,
          retry.backoffMultiplier
        );
        await sleep(delay);
      }

      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers,
            body: requestBody,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Check if status is retryable
          if (!response.ok) {
            const error = await response.text();
            const statusError = new Error(
              `${this.serviceName} API error: ${response.status} ${error}`
            );

            // Check if we should retry this status code
            if (retry && retry.retryableStatusCodes.includes(response.status)) {
              lastError = statusError;
              continue; // Retry
            }

            throw statusError;
          }

          // Handle 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }

          return (await response.json()) as T;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`${this.serviceName} request timeout after ${timeout}ms`);
          if (retry) continue; // Retry on timeout
          throw lastError;
        }

        // Check if error is retryable
        if (retry && isRetryableError(error)) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue; // Retry
        }

        throw error;
      }
    }

    // All retries exhausted
    throw lastError ?? new Error(`${this.serviceName} request failed after ${maxAttempts} attempts`);
  }

  /**
   * GET request
   */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * POST request
   */
  protected async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * PUT request
   */
  protected async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * PATCH request
   */
  protected async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * DELETE request
   */
  protected async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

/**
 * Helper function to create a simple API client
 */
export function createApiClient(options: BaseApiClientOptions): BaseApiClient {
  return new BaseApiClient(options);
}
