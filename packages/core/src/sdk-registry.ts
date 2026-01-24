/**
 * SDK Registry for marktoflow v2.0
 *
 * Dynamically loads and manages SDK instances for workflow execution.
 * Supports lazy loading and caching of SDK instances.
 */

import { ToolConfig } from './models.js';
import { McpLoader } from './mcp-loader.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// ============================================================================
// Types
// ============================================================================ 

export interface SDKInstance {
  name: string;
  sdk: unknown;
  config: ToolConfig;
}

export interface SDKLoader {
  /**
   * Load an SDK module.
   * @param packageName - npm package name (e.g., "@slack/web-api")
   * @returns The loaded module
   */
  load(packageName: string): Promise<unknown>;
}

export interface SDKInitializer {
  /**
   * Initialize an SDK with configuration.
   * @param module - The loaded SDK module
   * @param config - Tool configuration from workflow
   * @returns Initialized SDK client
   */
  initialize(module: unknown, config: ToolConfig): Promise<unknown>;
}

// ============================================================================ 
// Default SDK Loader (dynamic import)
// ============================================================================ 

export const defaultSDKLoader: SDKLoader = {
  async load(packageName: string): Promise<unknown> {
    try {
      // Dynamic import of npm package
      return await import(packageName);
    } catch (error) {
      throw new Error(
        `Failed to load SDK '${packageName}'. ` +
        `Make sure it's installed: npm install ${packageName}\n` +
        `Original error: ${error}`
      );
    }
  },
};

// ============================================================================ 
// SDK Initializers for common services
// ============================================================================ 

export const defaultInitializers: Record<string, SDKInitializer> = {
  '@slack/web-api': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const { WebClient } = module as { WebClient: new (token: string) => unknown };
      const token = config.auth?.['token'] as string;
      if (!token) {
        throw new Error('Slack SDK requires auth.token');
      }
      return new WebClient(token);
    },
  },

  '@octokit/rest': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const { Octokit } = module as { Octokit: new (options: { auth: string }) => unknown };
      const token = config.auth?.['token'] as string;
      return new Octokit({ auth: token });
    },
  },

  '@anthropic-ai/sdk': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const Anthropic = (module as { default: new (options: { apiKey: string }) => unknown }).default;
      const apiKey = config.auth?.['api_key'] as string;
      if (!apiKey) {
        throw new Error('Anthropic SDK requires auth.api_key');
      }
      return new Anthropic({ apiKey });
    },
  },

  'openai': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const OpenAI = (module as { default: new (options: { apiKey: string }) => unknown }).default;
      const apiKey = config.auth?.['api_key'] as string;
      if (!apiKey) {
        throw new Error('OpenAI SDK requires auth.api_key');
      }
      return new OpenAI({ apiKey });
    },
  },

  'jira.js': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const { Version3Client } = module as {
        Version3Client: new (options: { host: string; authentication: { basic: { email: string; apiToken: string } } }) => unknown;
      };
      const host = config.auth?.['host'] as string;
      const email = config.auth?.['email'] as string;
      const apiToken = config.auth?.['api_token'] as string;

      if (!host || !email || !apiToken) {
        throw new Error('Jira SDK requires auth.host, auth.email, and auth.api_token');
      }

      return new Version3Client({
        host,
        authentication: {
          basic: { email, apiToken },
        },
      });
    },
  },
};

// ============================================================================ 
// SDK Registry Implementation
// ============================================================================ 

export class SDKRegistry {
  private sdks: Map<string, SDKInstance> = new Map();
  private loader: SDKLoader;
  private initializers: Map<string, SDKInitializer>;
  private mcpLoader: McpLoader;

  constructor(
    loader: SDKLoader = defaultSDKLoader,
    initializers: Record<string, SDKInitializer> = defaultInitializers,
    mcpLoader?: McpLoader
  ) {
    this.loader = loader;
    this.initializers = new Map(Object.entries(initializers));
    this.mcpLoader = mcpLoader || new McpLoader();
  }

  /**
   * Register tool configurations from a workflow.
   */
  registerTools(tools: Record<string, ToolConfig>): void {
    for (const [name, config] of Object.entries(tools)) {
      if (!this.sdks.has(name)) {
        // Store config for lazy loading
        this.sdks.set(name, {
          name,
          sdk: null,
          config,
        });
      }
    }
  }

  /**
   * Check if an SDK is registered.
   */
  has(name: string): boolean {
    return this.sdks.has(name);
  }

  /**
   * Load and initialize an SDK.
   */
  async load(name: string): Promise<unknown> {
    const instance = this.sdks.get(name);
    if (!instance) {
      throw new Error(`SDK '${name}' is not registered. Add it to workflow tools.`);
    }

    // Return cached SDK if already loaded
    if (instance.sdk) {
      return instance.sdk;
    }

    // Load the SDK module
    const module = await this.loader.load(instance.config.sdk);

    // Initialize with config
    const initializer = this.initializers.get(instance.config.sdk);
    if (initializer) {
      instance.sdk = await initializer.initialize(module, instance.config);
    } else {
      // Check for MCP
      if (this.isMcpModule(module)) {
        try {
          const client = await this.mcpLoader.connectModule(module, instance.config);
          instance.sdk = this.createMcpProxy(client);
        } catch (error) {
           throw new Error(`Failed to connect to MCP module '${instance.config.sdk}': ${error}`);
        }
      } else {
        // No custom initializer - use generic initialization
        instance.sdk = await this.genericInitialize(module, instance.config);
      }
    }

    return instance.sdk;
  }

  private isMcpModule(module: unknown): boolean {
    return typeof (module as { createMcpServer?: unknown }).createMcpServer === 'function';
  }

  private createMcpProxy(client: Client): unknown {
    return new Proxy(client, {
      get: (target, prop) => {
        if (typeof prop === 'string') {
          // Avoid treating the proxy as a Thenable
          if (prop === 'then') {
            return undefined;
          }

          // If property is 'close', return the close method
          if (prop === 'close') {
            return target.close.bind(target);
          }

          // Otherwise, treat as tool name
          return async (args: Record<string, unknown>) => {
             const result = await client.callTool({
               name: prop,
               arguments: args
             });
             
             // If tool call fails, it throws? No, Client.callTool throws on error.
             // Result content handling? 
             // For now return result.
             return result;
          };
        }
        return Reflect.get(target, prop);
      }
    });
  }

  /**
   * Generic SDK initialization for unknown packages.
   */
  private async genericInitialize(module: unknown, config: ToolConfig): Promise<unknown> {
    // Try common patterns
    const mod = module as Record<string, unknown>;

    // Pattern 1: Default export is a class
    if (typeof mod.default === 'function') {
      const Constructor = mod.default as new (options?: unknown) => unknown;
      return new Constructor(config.options || config.auth);
    }

    // Pattern 2: Named export 'Client'
    if (typeof mod.Client === 'function') {
      const Client = mod.Client as new (options?: unknown) => unknown;
      return new Client(config.options || config.auth);
    }

    // Pattern 3: Return module as-is (for utility modules)
    return module;
  }

  /**
   * Register a custom initializer for an SDK.
   */
  registerInitializer(sdkName: string, initializer: SDKInitializer): void {
    this.initializers.set(sdkName, initializer);
  }

  /**
   * Get all registered SDK names.
   */
  getRegisteredNames(): string[] {
    return Array.from(this.sdks.keys());
  }

  /**
   * Clear all cached SDK instances.
   */
  clear(): void {
    this.sdks.clear();
  }
}

// ============================================================================ 
// Step Executor Factory
// ============================================================================ 

export interface SDKRegistryLike {
  load(sdkName: string): Promise<unknown>;
  has(sdkName: string): boolean;
}

/**
 * Create a step executor that invokes SDK methods.
 */
export function createSDKStepExecutor() {
  return async (
    step: { action: string; inputs: Record<string, unknown> },
    _context: unknown,
    sdkRegistry: SDKRegistryLike
  ): Promise<unknown> => {
    const parts = step.action.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid action format: ${step.action}. Expected: sdk.method or sdk.namespace.method`);
    }

    const sdkName = parts[0];
    const methodPath = parts.slice(1);

    // Load SDK
    const sdk = await sdkRegistry.load(sdkName);

    // Navigate to method
    let current: unknown = sdk;
    for (const part of methodPath) {
      if (current === null || current === undefined) {
        throw new Error(`Cannot find ${part} in ${step.action}`);
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (typeof current !== 'function') {
      throw new Error(`${step.action} is not a function`);
    }

    // Call the method
    const method = current as (params: unknown) => Promise<unknown>;
    return method.call(sdk, step.inputs);
  };
}