/**
 * Webhook receiver for marktoflow v2.0
 *
 * HTTP server for receiving webhook events from external services.
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface WebhookEndpoint {
  path: string;
  secret: string | undefined;
  workflowId: string | undefined;
  methods: string[];
  enabled: boolean;
}

export interface WebhookEvent {
  id: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  query: Record<string, string>;
  receivedAt: Date;
}

export type WebhookHandler = (event: WebhookEvent) => Promise<WebhookResponse>;

export interface WebhookResponse {
  status: number;
  body?: string;
  headers?: Record<string, string>;
}

export interface WebhookReceiverOptions {
  host?: string;
  port?: number;
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify a GitHub-style webhook signature.
 * Format: sha256=<hex signature>
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Verify a generic HMAC-SHA256 signature.
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Generate a signature for testing.
 */
export function generateSignature(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

// ============================================================================
// WebhookReceiver Implementation
// ============================================================================

export class WebhookReceiver {
  private server: Server | null = null;
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private handlers: Map<string, WebhookHandler> = new Map();
  private host: string;
  private port: number;

  constructor(options: WebhookReceiverOptions = {}) {
    this.host = options.host || '0.0.0.0';
    this.port = options.port || 3000;
  }

  /**
   * Register a webhook endpoint.
   */
  registerEndpoint(endpoint: WebhookEndpoint, handler: WebhookHandler): void {
    this.endpoints.set(endpoint.path, endpoint);
    this.handlers.set(endpoint.path, handler);
  }

  /**
   * Unregister a webhook endpoint.
   */
  unregisterEndpoint(path: string): boolean {
    this.handlers.delete(path);
    return this.endpoints.delete(path);
  }

  /**
   * Get all registered endpoints.
   */
  getEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Start the webhook server.
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          console.error('Webhook handler error:', error);
          res.statusCode = 500;
          res.end('Internal Server Error');
        });
      });

      this.server.on('error', reject);

      this.server.listen(this.port, this.host, () => {
        console.log(`Webhook receiver listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the webhook server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running.
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get the server URL.
   */
  getUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // Find matching endpoint
    const endpoint = this.endpoints.get(path);
    const handler = this.handlers.get(path);

    if (!endpoint || !handler) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    if (!endpoint.enabled) {
      res.statusCode = 503;
      res.end('Endpoint Disabled');
      return;
    }

    if (!endpoint.methods.includes(method)) {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }

    // Read body
    const body = await this.readBody(req);

    // Verify signature if secret is configured
    if (endpoint.secret) {
      const signature =
        (req.headers['x-hub-signature-256'] as string) ||
        (req.headers['x-signature'] as string);

      if (!signature) {
        res.statusCode = 401;
        res.end('Missing Signature');
        return;
      }

      const isValid = signature.startsWith('sha256=')
        ? verifyGitHubSignature(body, signature, endpoint.secret)
        : verifyHmacSignature(body, signature, endpoint.secret);

      if (!isValid) {
        res.statusCode = 401;
        res.end('Invalid Signature');
        return;
      }
    }

    // Parse query parameters
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Create webhook event
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      path,
      method,
      headers: this.flattenHeaders(req.headers),
      body,
      query,
      receivedAt: new Date(),
    };

    // Call handler
    try {
      const response = await handler(event);

      res.statusCode = response.status;

      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
        }
      }

      res.end(response.body || '');
    } catch (error) {
      console.error('Handler error:', error);
      res.statusCode = 500;
      res.end('Handler Error');
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  private flattenHeaders(headers: IncomingMessage['headers']): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        result[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    return result;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createEndpoint(
  path: string,
  options: {
    secret?: string;
    workflowId?: string;
    methods?: string[];
  } = {}
): WebhookEndpoint {
  return {
    path,
    secret: options.secret,
    workflowId: options.workflowId,
    methods: options.methods || ['POST'],
    enabled: true,
  };
}

export function parseWebhookBody(event: WebhookEvent): unknown {
  const contentType = event.headers['content-type'] || '';

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(event.body);
    } catch {
      return event.body;
    }
  }

  return event.body;
}
