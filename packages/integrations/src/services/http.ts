/**
 * HTTP Integration
 *
 * Generic REST API client for calling any HTTP endpoint.
 * Essential for APIs without dedicated integrations.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  timeout?: number;
  followRedirects?: boolean;
  validateStatus?: (status: number) => boolean;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  ok: boolean;
  url: string;
}

export interface HttpClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

function buildUrl(base: string, path: string, query?: Record<string, string | number | boolean>): string {
  // Handle absolute URLs
  let url: URL;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    url = new URL(path);
  } else {
    const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
    const pathWithoutSlash = path.startsWith('/') ? path.slice(1) : path;
    url = new URL(pathWithoutSlash, baseWithSlash);
  }

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Generic HTTP client for workflow integration
 */
export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '';
    this.defaultTimeout = config.timeout ?? 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(config.headers ?? {}),
    };

    // Set up authentication
    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          if (config.auth.token) {
            this.defaultHeaders.Authorization = `Bearer ${config.auth.token}`;
          }
          break;
        case 'basic':
          if (config.auth.username && config.auth.password) {
            const credentials = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
            this.defaultHeaders.Authorization = `Basic ${credentials}`;
          }
          break;
        case 'api-key':
          if (config.auth.apiKey) {
            const header = config.auth.apiKeyHeader ?? 'X-API-Key';
            this.defaultHeaders[header] = config.auth.apiKey;
          }
          break;
      }
    }
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      query,
      body,
      timeout = this.defaultTimeout,
      validateStatus = (status) => status >= 200 && status < 300,
    } = options;

    const url = buildUrl(this.baseUrl, path, query);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestHeaders = { ...this.defaultHeaders, ...headers };

      // Handle body serialization
      let requestBody: string | undefined;
      if (body !== undefined) {
        if (typeof body === 'string') {
          requestBody = body;
        } else {
          requestBody = JSON.stringify(body);
        }
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
        redirect: options.followRedirects === false ? 'manual' : 'follow',
      });

      clearTimeout(timeoutId);

      // Parse response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response body
      let data: T;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else if (contentType.includes('text/')) {
        data = (await response.text()) as T;
      } else {
        // Return raw buffer for binary data
        const buffer = await response.arrayBuffer();
        data = Buffer.from(buffer) as T;
      }

      const result: HttpResponse<T> = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        ok: validateStatus(response.status),
        url: response.url,
      };

      if (!result.ok) {
        throw new HttpError(result);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof HttpError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${url}`);
      }
      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(path: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(path: string, options?: Omit<HttpRequestOptions, 'method'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * HEAD request
   */
  async head(path: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<undefined>> {
    return this.request<undefined>(path, { ...options, method: 'HEAD' });
  }

  /**
   * Set a default header
   */
  setHeader(name: string, value: string): void {
    this.defaultHeaders[name] = value;
  }

  /**
   * Remove a default header
   */
  removeHeader(name: string): void {
    delete this.defaultHeaders[name];
  }

  /**
   * Set bearer token
   */
  setBearerToken(token: string): void {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  /**
   * Set base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

/**
 * HTTP error with response details
 */
export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: unknown;
  readonly url: string;

  constructor(response: HttpResponse) {
    super(`HTTP ${response.status}: ${response.statusText}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.data = response.data;
    this.url = response.url;
  }
}

/**
 * Convenience function to make a one-off request
 */
export async function httpRequest<T = unknown>(
  url: string,
  options?: HttpRequestOptions & { headers?: Record<string, string> }
): Promise<HttpResponse<T>> {
  const client = new HttpClient();
  return client.request<T>(url, options);
}

/**
 * GraphQL client helper
 */
export class GraphQLClient {
  private http: HttpClient;

  constructor(endpoint: string, config: Omit<HttpClientConfig, 'baseUrl'> = {}) {
    this.http = new HttpClient({ ...config, baseUrl: endpoint });
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
    operationName?: string
  ): Promise<T> {
    const response = await this.http.post<{ data?: T; errors?: { message: string }[] }>('', {
      query,
      variables,
      operationName,
    });

    if (response.data.errors?.length) {
      throw new Error(`GraphQL error: ${response.data.errors.map((e) => e.message).join(', ')}`);
    }

    return response.data.data as T;
  }
}

export const HttpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const baseUrl = config.options?.['base_url'] as string | undefined;
    const timeout = config.options?.['timeout'] as number | undefined;
    const headers = config.options?.['headers'] as Record<string, string> | undefined;

    // Extract auth configuration
    let auth: HttpClientConfig['auth'];
    if (config.auth) {
      const authType = config.auth['type'] as string | undefined;
      if (authType === 'bearer' || !authType) {
        const token = config.auth['token'] as string | undefined;
        if (token) auth = { type: 'bearer', token };
      } else if (authType === 'basic') {
        auth = {
          type: 'basic',
          username: config.auth['username'] as string,
          password: config.auth['password'] as string,
        };
      } else if (authType === 'api-key') {
        auth = {
          type: 'api-key',
          apiKey: config.auth['api_key'] as string,
          apiKeyHeader: config.auth['api_key_header'] as string | undefined,
        };
      }
    }

    const client = new HttpClient({ baseUrl, timeout, headers, auth });
    return {
      client,
      actions: client,
      graphql: (endpoint: string) =>
        new GraphQLClient(endpoint, {
          timeout,
          headers,
          auth,
        }),
    };
  },
};
