/**
 * Custom tool implementation using JS/TS adapters.
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Tool, ToolDefinition, ToolImplementation } from '../tool-base.js';

export class CustomTool extends Tool {
  private adapter: any = null;
  private operations: Record<string, { method: (...args: any[]) => any; description: string }> = {};

  constructor(definition: ToolDefinition, implementation: ToolImplementation) {
    super(definition, implementation);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.implementation.adapterPath) {
      throw new Error(`Custom tool requires adapterPath for ${this.definition.name}`);
    }

    const adapterPath = resolve(this.implementation.adapterPath);
    const module = await import(pathToFileURL(adapterPath).href);
    if (module.Adapter) {
      this.adapter = new module.Adapter();
    } else if (module.default) {
      this.adapter = module.default;
    } else {
      this.adapter = module;
    }

    this.discoverOperations();
    this.initialized = true;
  }

  private discoverOperations(): void {
    if (!this.adapter) return;
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(this.adapter))) {
      if (name === 'constructor') continue;
      if (name.startsWith('op_')) {
        const method = this.adapter[name].bind(this.adapter);
        this.operations[name.slice(3)] = { method, description: method.description ?? '' };
      } else if (this.adapter[name]?._isOperation) {
        const method = this.adapter[name].bind(this.adapter);
        this.operations[name] = { method, description: method.description ?? '' };
      }
    }

    if (this.adapter.operations && typeof this.adapter.operations === 'object') {
      for (const [name, method] of Object.entries(this.adapter.operations)) {
        this.operations[name] = { method: method as any, description: (method as any)?.description ?? '' };
      }
    }
  }

  async execute(operation: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) await this.initialize();
    const op = this.operations[operation];
    if (!op) {
      throw new Error(`Unknown operation: ${operation}`);
    }
    const result = op.method(params);
    return await Promise.resolve(result);
  }

  listOperations(): string[] {
    return Object.keys(this.operations);
  }

  getOperationSchema(operation: string): Record<string, unknown> {
    const op = this.operations[operation];
    if (!op) return {};
    return {
      description: op.description ?? '',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }
}

export function operation<T extends (...args: any[]) => any>(fn: T): T {
  (fn as any)._isOperation = true;
  return fn;
}
