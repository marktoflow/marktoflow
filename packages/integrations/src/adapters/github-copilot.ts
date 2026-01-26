/**
 * GitHub Copilot SDK Adapter for marktoflow
 *
 * This adapter provides deep integration with the GitHub Copilot SDK,
 * enabling AI-powered workflows with tools, MCP servers, custom agents,
 * session management, and streaming capabilities.
 */

import {
  CopilotClient,
  type SessionEvent,
  type SessionConfig as SDKSessionConfig,
  type ResumeSessionConfig as SDKResumeSessionConfig,
  type Tool as SDKTool,
  type CustomAgentConfig as SDKCustomAgentConfig,
  type MCPServerConfig as SDKMCPServerConfig,
  type ModelInfo as SDKModelInfo,
  type SessionMetadata as SDKSessionMetadata,
  defineTool,
} from '@github/copilot-sdk';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

// ============================================================================
// Type Aliases
// ============================================================================

type LogLevel = 'info' | 'none' | 'error' | 'warning' | 'debug' | 'all';

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration for creating a GitHubCopilotClient
 */
export interface CopilotClientConfig {
  /** Path to the Copilot CLI executable */
  cliPath?: string;
  /** URL of existing Copilot CLI server */
  cliUrl?: string;
  /** Default model to use */
  model?: string;
  /** Auto-start the CLI server */
  autoStart?: boolean;
  /** Log level */
  logLevel?: LogLevel;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string | undefined>;
}

/**
 * File or directory attachment
 */
export interface CopilotAttachment {
  type: 'file' | 'directory';
  path: string;
  displayName?: string;
}

/**
 * Tool definition for workflows
 */
export interface CopilotToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown> | unknown;
}

/**
 * Custom agent configuration for workflows
 */
export interface CopilotAgentConfig {
  name: string;
  displayName?: string;
  description?: string;
  tools?: string[] | null;
  prompt: string;
}

/**
 * MCP server configuration for workflows
 */
export interface CopilotMcpServerConfig {
  type?: 'local' | 'stdio' | 'http' | 'sse';
  tools: string[] | '*';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Configuration for creating a session
 */
export interface CopilotSessionConfig {
  /** Model to use */
  model?: string;
  /** Custom system message */
  systemMessage?: string;
  /** Enable streaming */
  streaming?: boolean;
  /** Tools to expose */
  tools?: CopilotToolDefinition[];
  /** MCP server configurations */
  mcpServers?: Record<string, CopilotMcpServerConfig>;
  /** Custom agent configurations */
  customAgents?: CopilotAgentConfig[];
  /** Available tools whitelist */
  availableTools?: string[];
  /** Excluded tools blacklist */
  excludedTools?: string[];
}

/**
 * Result from a Copilot query
 */
export interface CopilotResult {
  content: string;
  sessionId: string;
  events: SessionEvent[];
  toolRequests?: Array<{
    toolCallId: string;
    name: string;
    arguments?: unknown;
  }>;
}

/**
 * Streaming callback
 */
export type CopilotStreamCallback = (chunk: string, event: SessionEvent) => void | Promise<void>;

// ============================================================================
// GitHub Copilot Client
// ============================================================================

/**
 * Client for interacting with GitHub Copilot via the SDK
 *
 * Provides multiple interfaces for different use cases:
 * - send(): Simple prompt-response
 * - stream(): Streaming responses with callbacks
 * - sendWithSession(): Full session control
 * - sendWithTools(): Execute with custom tools
 * - sendWithAgents(): Use custom agents
 * - sendWithMcp(): Use MCP servers
 */
export class GitHubCopilotClient {
  private client: CopilotClient;
  private defaultModel: string;

  constructor(config: CopilotClientConfig = {}) {
    const clientConfig: {
      cliPath?: string;
      cliUrl?: string;
      autoStart?: boolean;
      logLevel?: LogLevel;
      cwd?: string;
      env?: Record<string, string | undefined>;
    } = {
      autoStart: config.autoStart ?? true,
      logLevel: config.logLevel || 'info',
    };

    if (config.cliUrl) {
      clientConfig.cliUrl = config.cliUrl;
    } else {
      clientConfig.cliPath = config.cliPath || 'copilot';
    }

    if (config.cwd) {
      clientConfig.cwd = config.cwd;
    }

    if (config.env) {
      clientConfig.env = config.env;
    }

    this.client = new CopilotClient(clientConfig);
    this.defaultModel = config.model || 'gpt-4.1';
  }

  // ============================================================================
  // Simple Interface
  // ============================================================================

  /**
   * Send a message and wait for the complete response
   */
  async send(inputs: {
    prompt: string;
    model?: string;
    attachments?: CopilotAttachment[];
    systemMessage?: string;
  }): Promise<string> {
    const session = await this.client.createSession({
      model: inputs.model || this.defaultModel,
      systemMessage: inputs.systemMessage ? { content: inputs.systemMessage } : undefined,
    });

    try {
      const response = await session.sendAndWait({
        prompt: inputs.prompt,
        attachments: inputs.attachments,
      });

      return response?.data.content || '';
    } finally {
      await session.destroy();
    }
  }

  /**
   * Send a message and stream the response
   */
  async stream(inputs: {
    prompt: string;
    model?: string;
    attachments?: CopilotAttachment[];
    systemMessage?: string;
    onChunk?: (chunk: string) => void;
    onComplete?: (fullResponse: string) => void;
  }): Promise<string> {
    const session = await this.client.createSession({
      model: inputs.model || this.defaultModel,
      streaming: true,
      systemMessage: inputs.systemMessage ? { content: inputs.systemMessage } : undefined,
    });

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      session.on((event: SessionEvent) => {
        if (event.type === 'assistant.message_delta') {
          const chunk = event.data.deltaContent;
          fullResponse += chunk;
          if (inputs.onChunk) {
            inputs.onChunk(chunk);
          }
        } else if (event.type === 'assistant.message') {
          fullResponse = event.data.content || fullResponse;
        } else if (event.type === 'session.idle') {
          if (inputs.onComplete) {
            inputs.onComplete(fullResponse);
          }
          session
            .destroy()
            .then(() => resolve(fullResponse))
            .catch(reject);
        } else if (event.type === 'session.error') {
          reject(new Error(event.data.message || 'Session error occurred'));
        }
      });

      session.send({
        prompt: inputs.prompt,
        attachments: inputs.attachments,
      }).catch(reject);
    });
  }

  // ============================================================================
  // Full Session Interface
  // ============================================================================

  /**
   * Send a message with full session configuration
   */
  async sendWithSession(
    message: { prompt: string; attachments?: CopilotAttachment[] },
    sessionConfig?: CopilotSessionConfig
  ): Promise<CopilotResult> {
    const config = this.buildSessionConfig(sessionConfig);
    const session = await this.client.createSession(config);
    const events: SessionEvent[] = [];

    try {
      return await new Promise((resolve, reject) => {
        session.on((event: SessionEvent) => {
          events.push(event);

          if (event.type === 'session.idle') {
            const lastAssistant = events
              .filter((e): e is Extract<SessionEvent, { type: 'assistant.message' }> =>
                e.type === 'assistant.message'
              )
              .pop();

            resolve({
              content: lastAssistant?.data.content || '',
              sessionId: session.sessionId,
              events,
              toolRequests: lastAssistant?.data.toolRequests?.map((tr) => ({
                toolCallId: tr.toolCallId,
                name: tr.name,
                arguments: tr.arguments,
              })),
            });
          } else if (event.type === 'session.error') {
            reject(new Error(event.data.message || 'Session error'));
          }
        });

        session.send(message).catch(reject);
      });
    } finally {
      await session.destroy();
    }
  }

  /**
   * Send a message with streaming and callbacks
   */
  async streamWithSession(
    message: { prompt: string; attachments?: CopilotAttachment[] },
    callback: CopilotStreamCallback,
    sessionConfig?: CopilotSessionConfig
  ): Promise<CopilotResult> {
    const config = this.buildSessionConfig({ ...sessionConfig, streaming: true });
    const session = await this.client.createSession(config);
    const events: SessionEvent[] = [];
    let fullContent = '';

    try {
      return await new Promise((resolve, reject) => {
        session.on((event: SessionEvent) => {
          events.push(event);

          if (event.type === 'assistant.message_delta') {
            const chunk = event.data.deltaContent;
            fullContent += chunk;
            Promise.resolve(callback(chunk, event)).catch(reject);
          } else if (event.type === 'assistant.message') {
            fullContent = event.data.content || fullContent;
          } else if (event.type === 'session.idle') {
            resolve({
              content: fullContent,
              sessionId: session.sessionId,
              events,
            });
          } else if (event.type === 'session.error') {
            reject(new Error(event.data.message || 'Session error'));
          }
        });

        session.send(message).catch(reject);
      });
    } finally {
      await session.destroy();
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Resume a previous session and send a message
   */
  async resumeAndSend(
    sessionId: string,
    message: { prompt: string; attachments?: CopilotAttachment[] },
    config?: SDKResumeSessionConfig
  ): Promise<CopilotResult> {
    const session = await this.client.resumeSession(sessionId, config);
    const events: SessionEvent[] = [];

    try {
      return await new Promise((resolve, reject) => {
        session.on((event: SessionEvent) => {
          events.push(event);

          if (event.type === 'session.idle') {
            const lastAssistant = events
              .filter((e): e is Extract<SessionEvent, { type: 'assistant.message' }> =>
                e.type === 'assistant.message'
              )
              .pop();

            resolve({
              content: lastAssistant?.data.content || '',
              sessionId: session.sessionId,
              events,
            });
          } else if (event.type === 'session.error') {
            reject(new Error(event.data.message || 'Session error'));
          }
        });

        session.send(message).catch(reject);
      });
    } finally {
      await session.destroy();
    }
  }

  /**
   * Create a persistent session for multi-turn conversations
   */
  async createSession(config?: CopilotSessionConfig) {
    return this.client.createSession(this.buildSessionConfig(config));
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, config?: SDKResumeSessionConfig) {
    return this.client.resumeSession(sessionId, config);
  }

  /**
   * Get the most recently updated session ID
   */
  async getLastSessionId(): Promise<string | undefined> {
    return this.client.getLastSessionId();
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    return this.client.deleteSession(sessionId);
  }

  /**
   * List all available sessions
   */
  async listSessions(): Promise<SDKSessionMetadata[]> {
    return this.client.listSessions();
  }

  // ============================================================================
  // Tools Interface
  // ============================================================================

  /**
   * Send with custom tools
   */
  async sendWithTools(
    message: { prompt: string; attachments?: CopilotAttachment[] },
    tools: CopilotToolDefinition[],
    sessionConfig?: Omit<CopilotSessionConfig, 'tools'>
  ): Promise<CopilotResult> {
    return this.sendWithSession(message, { ...sessionConfig, tools });
  }

  // ============================================================================
  // Custom Agents Interface
  // ============================================================================

  /**
   * Send with custom agents
   */
  async sendWithAgents(
    message: { prompt: string; attachments?: CopilotAttachment[] },
    customAgents: CopilotAgentConfig[],
    sessionConfig?: Omit<CopilotSessionConfig, 'customAgents'>
  ): Promise<CopilotResult> {
    return this.sendWithSession(message, { ...sessionConfig, customAgents });
  }

  // ============================================================================
  // MCP Interface
  // ============================================================================

  /**
   * Send with MCP servers
   */
  async sendWithMcp(
    message: { prompt: string; attachments?: CopilotAttachment[] },
    mcpServers: Record<string, CopilotMcpServerConfig>,
    sessionConfig?: Omit<CopilotSessionConfig, 'mcpServers'>
  ): Promise<CopilotResult> {
    return this.sendWithSession(message, { ...sessionConfig, mcpServers });
  }

  // ============================================================================
  // Model and Status
  // ============================================================================

  /**
   * List available models
   */
  async listModels(): Promise<SDKModelInfo[]> {
    return this.client.listModels();
  }

  /**
   * Get CLI status
   */
  async getStatus() {
    return this.client.getStatus();
  }

  /**
   * Get authentication status
   */
  async getAuthStatus() {
    return this.client.getAuthStatus();
  }

  /**
   * Ping the CLI server
   */
  async ping(): Promise<{ message: string; timestamp: number }> {
    return this.client.ping();
  }

  /**
   * Check if authenticated
   */
  async checkAuth(): Promise<boolean> {
    try {
      const status = await this.getAuthStatus();
      return status.isAuthenticated;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Stop the Copilot CLI client
   */
  async stop(): Promise<void> {
    const errors = await this.client.stop();
    if (errors.length > 0) {
      throw new Error(`Errors during stop: ${errors.map((e) => e.message).join(', ')}`);
    }
  }

  /**
   * Force stop the CLI client
   */
  async forceStop(): Promise<void> {
    return this.client.forceStop();
  }

  /**
   * Get current connection state
   */
  getState(): 'disconnected' | 'connecting' | 'connected' | 'error' {
    return this.client.getState();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Build session configuration from options
   */
  private buildSessionConfig(config?: CopilotSessionConfig): SDKSessionConfig {
    const sessionConfig: SDKSessionConfig = {
      model: config?.model || this.defaultModel,
      streaming: config?.streaming,
    };

    // System message
    if (config?.systemMessage) {
      sessionConfig.systemMessage = { content: config.systemMessage };
    }

    // Tools - convert to SDK format
    if (config?.tools && config.tools.length > 0) {
      sessionConfig.tools = config.tools.map((t) =>
        defineTool(t.name, {
          description: t.description,
          parameters: t.parameters,
          handler: t.handler,
        })
      ) as SDKTool[];
    }

    // MCP servers - convert to SDK format
    if (config?.mcpServers) {
      const mcpServers: Record<string, SDKMCPServerConfig> = {};
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
          mcpServers[name] = {
            type: serverConfig.type,
            tools: serverConfig.tools === '*' ? ['*'] : serverConfig.tools,
            url: serverConfig.url!,
            headers: serverConfig.headers,
            timeout: serverConfig.timeout,
          };
        } else {
          mcpServers[name] = {
            type: serverConfig.type || 'local',
            tools: serverConfig.tools === '*' ? ['*'] : serverConfig.tools,
            command: serverConfig.command!,
            args: serverConfig.args || [],
            env: serverConfig.env,
            timeout: serverConfig.timeout,
          };
        }
      }
      sessionConfig.mcpServers = mcpServers;
    }

    // Custom agents
    if (config?.customAgents) {
      sessionConfig.customAgents = config.customAgents as SDKCustomAgentConfig[];
    }

    // Tool filtering
    if (config?.availableTools) {
      sessionConfig.availableTools = config.availableTools;
    }
    if (config?.excludedTools) {
      sessionConfig.excludedTools = config.excludedTools;
    }

    return sessionConfig;
  }
}

// ============================================================================
// Tool Helper
// ============================================================================

/**
 * Create a tool definition with type inference
 */
export function createCopilotTool<T>(
  name: string,
  config: {
    description?: string;
    parameters?: Record<string, unknown>;
    handler: (args: T) => Promise<unknown> | unknown;
  }
): CopilotToolDefinition {
  return {
    name,
    description: config.description,
    parameters: config.parameters,
    handler: config.handler as (args: unknown) => Promise<unknown> | unknown,
  };
}

// ============================================================================
// SDK Initializer for marktoflow Registry
// ============================================================================

/**
 * SDK Initializer for GitHub Copilot
 */
export const GitHubCopilotInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    const auth = config.auth || {};

    return new GitHubCopilotClient({
      cliPath: (auth['cli_path'] as string) || (options['cliPath'] as string),
      cliUrl: (auth['cli_url'] as string) || (options['cliUrl'] as string),
      model: (options['model'] as string) || 'gpt-4.1',
      autoStart: (options['autoStart'] as boolean) ?? true,
      logLevel: (options['logLevel'] as LogLevel) || 'info',
      cwd: options['cwd'] as string,
      env: options['env'] as Record<string, string>,
    });
  },
};

// ============================================================================
// Re-export SDK types for convenience
// ============================================================================

export type { SessionEvent } from '@github/copilot-sdk';
