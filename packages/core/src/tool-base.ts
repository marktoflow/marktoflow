/**
 * Tool base types for marktoflow.
 */

export enum ToolType {
  MCP = 'mcp',
  OPENAPI = 'openapi',
  CUSTOM = 'custom',
}

export enum ToolCompatibility {
  NATIVE = 'native',
  SUPPORTED = 'supported',
  VIA_BRIDGE = 'via_bridge',
  NOT_SUPPORTED = 'not_supported',
}

export interface ToolImplementation {
  type: ToolType;
  priority: number;
  configPath?: string;
  specPath?: string;
  specUrl?: string;
  adapterPath?: string;
  packageName?: string;
  agentCompatibility?: Record<string, string>;
}

export interface ToolAuth {
  type: string;
  tokenEnv?: string;
  scopes?: string[];
  provider?: string;
  extra?: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  category?: string;
  implementations: ToolImplementation[];
  authentication?: ToolAuth;
  rateLimits?: Record<string, unknown>;
}

export abstract class Tool {
  protected initialized = false;

  constructor(public readonly definition: ToolDefinition, public readonly implementation: ToolImplementation) {}

  get name(): string {
    return this.definition.name;
  }

  get toolType(): ToolType {
    return this.implementation.type;
  }

  abstract initialize(): Promise<void>;
  abstract execute(operation: string, params: Record<string, unknown>): Promise<unknown>;
  abstract listOperations(): string[];
  abstract getOperationSchema(operation: string): Record<string, unknown>;

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  toFunctionSchema(operation: string): Record<string, unknown> {
    const schema = this.getOperationSchema(operation) as any;
    return {
      name: `${this.name}.${operation}`,
      description: schema?.description ?? '',
      parameters: schema?.parameters ?? {},
    };
  }
}
