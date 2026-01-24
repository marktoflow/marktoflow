/**
 * Tool registry for marktoflow.
 *
 * Manages tool discovery, registration, and selection based on agent compatibility.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import {
  Tool,
  ToolDefinition,
  ToolImplementation,
  ToolCompatibility,
  ToolType,
  ToolAuth,
} from './tool-base.js';
import { OpenAPITool } from './tools/openapi-tool.js';
import { CustomTool } from './tools/custom-tool.js';
import { MCPTool } from './tools/mcp-tool.js';

export class ToolRegistry {
  private definitions = new Map<string, ToolDefinition>();
  private tools = new Map<string, Map<string, Tool>>();
  private registryPath?: string;

  constructor(registryPath?: string) {
    this.registryPath = registryPath ? resolve(registryPath) : undefined;
    if (this.registryPath) {
      this.loadRegistry(this.registryPath);
    }
  }

  loadRegistry(path: string): void {
    const content = readFileSync(path, 'utf8');
    const data = parse(content) as { tools?: Array<Record<string, unknown>> };
    for (const toolData of data.tools ?? []) {
      const definition = this.parseToolDefinition(toolData);
      this.definitions.set(definition.name, definition);
    }
  }

  private parseToolDefinition(data: Record<string, unknown>): ToolDefinition {
    const implementations = (data.implementations as Array<Record<string, unknown>> | undefined) ?? [];
    const parsedImplementations: ToolImplementation[] = implementations.map((impl) => ({
      type: (impl.type as ToolType) ?? ToolType.CUSTOM,
      priority: (impl.priority as number) ?? 1,
      configPath: impl.config_path as string | undefined,
      specPath: impl.spec_path as string | undefined,
      specUrl: impl.spec_url as string | undefined,
      adapterPath: impl.adapter_path as string | undefined,
      packageName: impl.package as string | undefined,
      agentCompatibility: (impl.agent_compatibility as Record<string, string>) ?? {},
    }));

    const authData = (data.authentication as Record<string, unknown>) ?? {};
    const auth: ToolAuth | undefined = authData && Object.keys(authData).length
      ? {
          type: (authData.type as string) ?? 'none',
          tokenEnv: authData.token_env as string | undefined,
          scopes: (authData.scopes as string[]) ?? [],
          provider: authData.provider as string | undefined,
          extra: (authData.extra as Record<string, unknown>) ?? {},
        }
      : undefined;

    return {
      name: (data.name as string) ?? '',
      description: data.description as string | undefined,
      category: data.category as string | undefined,
      implementations: parsedImplementations,
      authentication: auth,
      rateLimits: (data.rate_limits as Record<string, unknown>) ?? {},
    };
  }

  register(definition: ToolDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  hasTool(name: string, agent?: string): boolean {
    const definition = this.definitions.get(name);
    if (!definition) return false;
    if (!agent) return true;
    return this.getBestImplementation(definition, agent) !== null;
  }

  getTool(name: string, agent: string): Tool | null {
    const cached = this.tools.get(name)?.get(agent);
    if (cached) return cached;

    const definition = this.definitions.get(name);
    if (!definition) return null;

    const implementation = this.getBestImplementation(definition, agent);
    if (!implementation) return null;

    const tool = this.createTool(definition, implementation);
    if (!this.tools.has(name)) this.tools.set(name, new Map());
    this.tools.get(name)!.set(agent, tool);
    return tool;
  }

  listTools(): string[] {
    return Array.from(this.definitions.keys());
  }

  listCompatibleTools(agent: string): string[] {
    const compatible: string[] = [];
    for (const [name, definition] of this.definitions.entries()) {
      if (this.getBestImplementation(definition, agent)) {
        compatible.push(name);
      }
    }
    return compatible;
  }

  getDefinition(name: string): ToolDefinition | null {
    return this.definitions.get(name) ?? null;
  }

  getAllFunctionSchemas(agent: string): Array<Record<string, unknown>> {
    const schemas: Array<Record<string, unknown>> = [];
    for (const name of this.listCompatibleTools(agent)) {
      const tool = this.getTool(name, agent);
      if (!tool) continue;
      for (const op of tool.listOperations()) {
        schemas.push(tool.toFunctionSchema(op));
      }
    }
    return schemas;
  }

  private getBestImplementation(definition: ToolDefinition, agent: string): ToolImplementation | null {
    const compatible = definition.implementations.filter((impl) => {
      const compat = impl.agentCompatibility?.[agent] ?? 'supported';
      return !['not_supported', 'none'].includes(compat);
    });
    if (compatible.length === 0) return null;

    const compatOrder: Record<string, number> = {
      [ToolCompatibility.NATIVE]: 0,
      [ToolCompatibility.SUPPORTED]: 1,
      [ToolCompatibility.VIA_BRIDGE]: 2,
    };

    compatible.sort((a, b) => {
      const aCompat = a.agentCompatibility?.[agent] ?? ToolCompatibility.SUPPORTED;
      const bCompat = b.agentCompatibility?.[agent] ?? ToolCompatibility.SUPPORTED;
      const aScore = compatOrder[aCompat] ?? 3;
      const bScore = compatOrder[bCompat] ?? 3;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return aScore - bScore;
    });

    return compatible[0];
  }

  private createTool(definition: ToolDefinition, implementation: ToolImplementation): Tool {
    if (implementation.type === ToolType.MCP) {
      return new MCPTool(definition, implementation);
    }
    if (implementation.type === ToolType.OPENAPI) {
      return new OpenAPITool(definition, implementation);
    }
    return new CustomTool(definition, implementation);
  }
}
