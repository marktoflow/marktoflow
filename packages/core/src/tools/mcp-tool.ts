/**
 * MCP tool implementation (minimal adapter).
 */

import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { Tool, ToolDefinition, ToolImplementation } from '../tool-base.js';
import { McpLoader } from '../mcp-loader.js';
import type { ToolConfig } from '../models.js';

type McpToolSpec = {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
};

export class MCPTool extends Tool {
  private operations: Record<string, McpToolSpec> = {};
  private client: any = null;
  private loader = new McpLoader();

  constructor(definition: ToolDefinition, implementation: ToolImplementation) {
    super(definition, implementation);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.implementation.packageName) {
      const config = this.buildConfig();
      const client = await this.loader.loadNative(this.implementation.packageName, config);
      const tools = await (client as any).listTools?.();
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          this.operations[tool.name] = {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema ?? tool.input_schema ?? {},
          };
        }
      }
      this.client = client;
    } else if (this.implementation.specPath) {
      const content = readFileSync(this.implementation.specPath, 'utf8');
      const data = parse(content) as { tools?: McpToolSpec[] };
      for (const tool of data.tools ?? []) {
        this.operations[tool.name] = tool;
      }
    }
    this.initialized = true;
  }

  async execute(operation: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) await this.initialize();
    if (!this.operations[operation]) {
      throw new Error(`Unknown MCP operation: ${operation}`);
    }
    if (!this.client) {
      throw new Error('MCP client is not initialized. Provide packageName in tool implementation.');
    }
    return await this.client.callTool({
      name: operation,
      arguments: params,
    });
  }

  listOperations(): string[] {
    return Object.keys(this.operations);
  }

  getOperationSchema(operation: string): Record<string, unknown> {
    const op = this.operations[operation];
    if (!op) return {};
    return {
      description: op.description ?? '',
      parameters: op.input_schema ?? { type: 'object', properties: {} },
    };
  }

  private buildConfig(): ToolConfig {
    let options: Record<string, unknown> = {};
    if (this.implementation.configPath && existsSync(this.implementation.configPath)) {
      const content = readFileSync(this.implementation.configPath, 'utf8');
      try {
        options = parse(content) as Record<string, unknown>;
      } catch {
        try {
          options = JSON.parse(content) as Record<string, unknown>;
        } catch {
          options = {};
        }
      }
    }

    const auth: Record<string, string> = {};
    if (this.definition.authentication?.tokenEnv) {
      const token = process.env[this.definition.authentication.tokenEnv];
      if (token) {
        auth.token = token;
      }
    }

    return {
      sdk: this.implementation.packageName ?? '',
      auth: Object.keys(auth).length ? auth : undefined,
      options,
    };
  }
}
