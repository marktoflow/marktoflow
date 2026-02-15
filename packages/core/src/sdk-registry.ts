/**
 * SDK Registry for marktoflow v2.0
 *
 * Dynamically loads and manages SDK instances for workflow execution.
 * Supports lazy loading and caching of SDK instances.
 */

import { ToolConfig } from './models.js';
import { McpLoader } from './mcp-loader.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SecretManager } from './secret-providers/secret-manager.js';

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
// SDK Package Name Mappings
// ============================================================================

/**
 * Maps SDK names to actual npm package names.
 * Used when the SDK name in workflows differs from the npm package name.
 */
export const packageNameMappings: Record<string, string> = {
  'google-gmail': 'googleapis',
  'google-sheets': 'googleapis',
  'google-calendar': 'googleapis',
  'google-drive': 'googleapis',
  'google-docs': 'googleapis',
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
      const Anthropic = (module as { default: new (options: { apiKey: string }) => unknown })
        .default;
      const apiKey = config.auth?.['api_key'] as string;
      if (!apiKey) {
        throw new Error('Anthropic SDK requires auth.api_key');
      }
      return new Anthropic({ apiKey });
    },
  },

  openai: {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const OpenAI = (module as { default: new (options: { apiKey: string; baseURL?: string }) => unknown }).default;
      const apiKey = config.auth?.['api_key'] as string;
      const baseUrl = config.auth?.['base_url'] as string || config.options?.['baseUrl'] as string;

      // For local endpoints (llama.cpp, VLLM), allow dummy key
      const effectiveKey = apiKey || (baseUrl ? 'dummy-key' : '');
      if (!effectiveKey) {
        throw new Error('OpenAI SDK requires auth.api_key (or auth.base_url for local endpoints)');
      }

      const initOptions: { apiKey: string; baseURL?: string } = { apiKey: effectiveKey };
      if (baseUrl) initOptions.baseURL = baseUrl;
      return new OpenAI(initOptions);
    },
  },

  'jira.js': {
    async initialize(module: unknown, config: ToolConfig): Promise<unknown> {
      const { Version2Client, Version3Client } = module as {
        Version2Client: new (options: {
          host: string;
          authentication: { basic: { email: string; apiToken: string } };
        }) => unknown;
        Version3Client: new (options: {
          host: string;
          authentication: { basic: { email: string; apiToken: string } };
        }) => unknown;
      };
      const host = config.auth?.['host'] as string;
      const email = config.auth?.['email'] as string;
      const apiToken = config.auth?.['api_token'] as string;
      const apiVersion = (config.auth?.['api_version'] as string) || 'auto';

      if (!host || !email || !apiToken) {
        throw new Error('Jira SDK requires auth.host, auth.email, and auth.api_token');
      }

      // Auto-detect API version based on host
      // Cloud (*.atlassian.net) uses v3, self-hosted uses v2
      let useVersion3 = true;
      if (apiVersion === 'auto') {
        useVersion3 = host.includes('.atlassian.net');
      } else {
        useVersion3 = apiVersion === '3' || apiVersion === 'v3';
      }

      const authConfig = {
        host,
        authentication: {
          basic: { email, apiToken },
        },
      };

      return useVersion3 ? new Version3Client(authConfig) : new Version2Client(authConfig);
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
  private secretManager?: SecretManager;

  constructor(
    loader: SDKLoader = defaultSDKLoader,
    initializers: Record<string, SDKInitializer> = defaultInitializers,
    mcpLoader?: McpLoader,
    secretManager?: SecretManager
  ) {
    this.loader = loader;
    this.initializers = new Map(Object.entries(initializers));
    this.mcpLoader = mcpLoader || new McpLoader();
    if (secretManager) {
      this.secretManager = secretManager;
    }
  }

  /**
   * Register tool configurations from a workflow.
   */
  registerTools(tools: Record<string, ToolConfig>): void {
    // Always register built-in tools (core and workflow) if not already present
    const builtInTools = ['core', 'workflow'];
    for (const toolName of builtInTools) {
      if (!this.sdks.has(toolName)) {
        this.sdks.set(toolName, {
          name: toolName,
          sdk: null,
          config: { sdk: toolName }, // Minimal config for built-in tools
        });
      }
    }

    // Register workflow-specific tools
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

    // Resolve secret references in config.auth before initializing
    const resolvedConfig = await this.resolveConfigSecrets(instance.config);

    // Load the SDK module
    // Check if there's a package name mapping (e.g., 'google-gmail' -> 'googleapis')
    const packageName = packageNameMappings[resolvedConfig.sdk] || resolvedConfig.sdk;

    let module: unknown;
    try {
      module = await this.loader.load(packageName);
    } catch (error) {
      // If we have an initializer, ignore load error and pass null (e.g. for 'script' tool)
      if (this.initializers.has(resolvedConfig.sdk)) {
        module = null;
      } else {
        throw error;
      }
    }

    // Initialize with resolved config
    const initializer = this.initializers.get(resolvedConfig.sdk);
    if (initializer) {
      instance.sdk = await initializer.initialize(module, resolvedConfig);
    } else {
      // Check for MCP
      if (this.isMcpModule(module)) {
        try {
          const client = await this.mcpLoader.connectModule(module, resolvedConfig);
          instance.sdk = this.createMcpProxy(client);
        } catch (error) {
          throw new Error(`Failed to connect to MCP module '${resolvedConfig.sdk}': ${error}`);
        }
      } else {
        // No custom initializer - use generic initialization
        instance.sdk = await this.genericInitialize(module, resolvedConfig);
      }
    }

    return instance.sdk;
  }

  /**
   * Resolve secret references in tool configuration.
   */
  private async resolveConfigSecrets(config: ToolConfig): Promise<ToolConfig> {
    if (!this.secretManager || !config.auth) {
      return config;
    }

    const resolvedAuth: Record<string, string> = {};

    for (const [key, value] of Object.entries(config.auth)) {
      if (typeof value === 'string' && SecretManager.isSecretReference(value)) {
        // Resolve secret reference
        resolvedAuth[key] = await this.secretManager.resolveSecrets(value);
      } else {
        resolvedAuth[key] = value;
      }
    }

    return {
      ...config,
      auth: resolvedAuth,
    };
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
              arguments: args,
            });

            // If tool call fails, it throws? No, Client.callTool throws on error.
            // Result content handling?
            // For now return result.
            return result;
          };
        }
        return Reflect.get(target, prop);
      },
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
 * Execution context interface for step executor
 */
export interface ExecutionContextLike {
  variables: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

/**
 * Create a step executor that invokes SDK methods.
 */
export function createSDKStepExecutor() {
  return async (
    step: { action?: string; workflow?: string; inputs: Record<string, unknown> },
    executionContext: unknown,
    sdkRegistry: SDKRegistryLike
  ): Promise<unknown> => {
    // Sub-workflows are handled by the engine, not by this executor
    if (step.workflow) {
      throw new Error('Sub-workflow steps should be handled by the engine, not the step executor');
    }

    if (!step.action) {
      throw new Error('Step must have either "action" or "workflow" field');
    }

    const parts = step.action.split('.');
    if (parts.length < 2) {
      throw new Error(
        `Invalid action format: ${step.action}. Expected: sdk.method or sdk.namespace.method`
      );
    }

    const sdkName = parts[0];
    const methodPath = parts.slice(1);

    // Load SDK
    const sdk = await sdkRegistry.load(sdkName);

    // Navigate to method
    let current: unknown = sdk;
    let parent: unknown = sdk;
    for (const part of methodPath) {
      if (current === null || current === undefined) {
        throw new Error(`Cannot find ${part} in ${step.action}`);
      }
      parent = current;
      current = (current as Record<string, unknown>)[part];
    }

    if (typeof current !== 'function') {
      throw new Error(`${step.action} is not a function`);
    }

    // For script.execute, automatically inject workflow context variables
    let inputs = step.inputs;
    if (sdkName === 'script' && methodPath[0] === 'execute') {
      const ctx = executionContext as ExecutionContextLike | undefined;
      if (ctx && !inputs.context) {
        // Inject workflow variables and inputs as context for the script
        inputs = {
          ...inputs,
          context: {
            ...ctx.variables,
            inputs: ctx.inputs,
          },
        };
      }
    }

    // Call the method with correct 'this' context (parent object, not root SDK)
    const method = current as (params: unknown) => Promise<unknown>;
    return method.call(parent, inputs);
  };
}
