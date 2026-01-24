/**
 * OpenAPI tool implementation.
 */

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Tool, ToolDefinition, ToolImplementation } from '../tool-base.js';

export class OpenAPITool extends Tool {
  private spec: Record<string, any> = {};
  private operations: Record<string, any> = {};
  private baseUrl = '';

  constructor(definition: ToolDefinition, implementation: ToolImplementation) {
    super(definition, implementation);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.implementation.specPath) {
      const content = readFileSync(this.implementation.specPath, 'utf8');
      this.spec = parse(content) as Record<string, any>;
    } else if (this.implementation.specUrl) {
      const response = await fetch(this.implementation.specUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      this.spec = parse(text) as Record<string, any>;
    }

    if (this.spec) {
      this.parseSpec();
    }

    this.initialized = true;
  }

  private parseSpec(): void {
    const servers = this.spec.servers ?? [];
    if (servers.length > 0) {
      this.baseUrl = servers[0].url ?? '';
    }

    const paths = this.spec.paths ?? {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods as Record<string, any>)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const operationId = this.normalizeOperationId(details.operationId ?? `${method}_${path}`);
        this.operations[operationId] = {
          path,
          method: method.toUpperCase(),
          summary: details.summary ?? '',
          description: details.description ?? '',
          parameters: details.parameters ?? [],
          requestBody: details.requestBody ?? {},
          responses: details.responses ?? {},
        };
      }
    }
  }

  private normalizeOperationId(operationId: string): string {
    return operationId
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  async execute(operation: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      await this.initialize();
    }

    const op = this.operations[operation];
    if (!op) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    let url = `${this.baseUrl}${op.path}`;
    const method = op.method as string;
    const pathParams: Record<string, unknown> = {};
    const queryParams: Record<string, unknown> = {};
    let body: unknown = undefined;
    const headers: Record<string, string> = {};

    for (const param of op.parameters as Array<Record<string, any>>) {
      const name = param.name;
      const location = param.in;
      if (name in params) {
        if (location === 'path') pathParams[name] = params[name];
        if (location === 'query') queryParams[name] = params[name];
        if (location === 'header') headers[name] = String(params[name]);
      }
    }

    if (op.requestBody && 'body' in params) {
      body = params.body;
    }

    for (const [key, value] of Object.entries(pathParams)) {
      url = url.replace(`{${key}}`, String(value));
    }

    if (this.definition.authentication?.type === 'bearer_token' && this.definition.authentication.tokenEnv) {
      const token = process.env[this.definition.authentication.tokenEnv] ?? '';
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const finalUrl = new URL(url);
    for (const [key, value] of Object.entries(queryParams)) {
      finalUrl.searchParams.set(key, String(value));
    }

    const response = await fetch(finalUrl.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAPI request failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.startsWith('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  listOperations(): string[] {
    return Object.keys(this.operations);
  }

  getOperationSchema(operation: string): Record<string, unknown> {
    const op = this.operations[operation];
    if (!op) return {};

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of op.parameters as Array<Record<string, any>>) {
      const name = param.name;
      const schema = param.schema ?? { type: 'string' };
      properties[name] = {
        type: schema.type ?? 'string',
        description: param.description ?? '',
      };
      if (param.required) required.push(name);
    }

    if (op.requestBody) {
      const content = op.requestBody.content ?? {};
      const jsonContent = content['application/json'] ?? {};
      const bodySchema = jsonContent.schema ?? {};
      properties.body = bodySchema;
      if (op.requestBody.required) required.push('body');
    }

    return {
      description: op.description || op.summary || '',
      parameters: {
        type: 'object',
        properties,
        required,
      },
    };
  }
}
