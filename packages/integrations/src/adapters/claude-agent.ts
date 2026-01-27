/**
 * Claude Agent SDK Adapter for marktoflow
 *
 * This adapter provides deep integration with the Claude Agent SDK,
 * enabling agentic workflows with built-in tools, MCP support,
 * session management, and streaming capabilities.
 *
 * Unlike the CLI-based claude-code adapter, this uses the SDK directly
 * for lower latency and richer functionality.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import {
  ClaudeAgentOptions,
  SDKMessage,
  SDKResultMessage,
  AgentResult,
  StreamCallback,
  BuiltInTool,
  SubagentDefinition,
  McpServerConfig,
  HookCallback,
  HookEvent,
  ToolPermissionHandler,
  ToolPermissionResult,
  PermissionMode,
} from './claude-agent-types.js';

// ============================================================================
// Types for the Agent SDK (will be replaced with actual imports)
// ============================================================================

interface AgentSDK {
  query: (config: { prompt: string | AsyncIterable<unknown>; options?: unknown }) => AgentQuery;
  tool: (
    name: string,
    description: string,
    schema: unknown,
    handler: (args: unknown) => Promise<unknown>
  ) => unknown;
  createSdkMcpServer: (config: { name: string; version?: string; tools: unknown[] }) => unknown;
}

interface AgentQuery extends AsyncGenerator<SDKMessage, void, unknown> {
  interrupt(): Promise<void>;
}

// ============================================================================
// Claude Agent Client
// ============================================================================

/**
 * Client for interacting with Claude via the Agent SDK
 *
 * Provides multiple interfaces for different use cases:
 * - generate(): Simple prompt-response (compatible with old interface)
 * - query(): Full agentic capabilities with streaming
 * - runWithTools(): Execute with specific built-in tools
 * - runWithSubagents(): Delegate to specialized subagents
 */
export class ClaudeAgentClient {
  private sdk: AgentSDK | null = null;
  private options: ClaudeAgentOptions;
  private currentQuery: AgentQuery | null = null;
  private sessionId: string | null = null;

  constructor(options: ClaudeAgentOptions = {}) {
    this.options = {
      permissionMode: 'acceptEdits',
      maxTurns: 50,
      ...options,
    };
  }

  /**
   * Initialize the Agent SDK (lazy loading)
   */
  private async getSDK(): Promise<AgentSDK> {
    if (!this.sdk) {
      try {
        // Dynamic import of the Agent SDK (optional dependency)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = await import(/* webpackIgnore: true */ '@anthropic-ai/claude-agent-sdk').catch(
          () => null
        );
        if (!module) {
          throw new Error('SDK not installed');
        }
        this.sdk = module as unknown as AgentSDK;
      } catch (error) {
        throw new Error(
          `Failed to load Claude Agent SDK. Install it with: npm install @anthropic-ai/claude-agent-sdk\n` +
            `Original error: ${error}`
        );
      }
    }
    return this.sdk;
  }

  // ============================================================================
  // Simple Interface (backwards compatible)
  // ============================================================================

  /**
   * Generate a response from Claude (simple interface)
   *
   * This method is compatible with the old CLI-based interface,
   * but uses the Agent SDK under the hood for better performance.
   *
   * @param inputs - Prompt string or object with prompt and options
   * @returns The generated response text
   */
  async generate(inputs: { prompt: string; model?: string } | string): Promise<string> {
    const prompt = typeof inputs === 'string' ? inputs : inputs.prompt;
    const modelOverride = typeof inputs === 'string' ? undefined : inputs.model;

    const result = await this.run(prompt, {
      ...this.options,
      model: modelOverride || this.options.model,
      // For simple generation, limit tools
      allowedTools: [],
    });

    return result.result || '';
  }

  // ============================================================================
  // Full Agentic Interface
  // ============================================================================

  /**
   * Run an agentic query with full capabilities
   *
   * @param prompt - The task for the agent to perform
   * @param options - Override options for this query
   * @returns Complete result with all messages and metadata
   */
  async run(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    const messages: SDKMessage[] = [];
    const mergedOptions = { ...this.options, ...options };

    for await (const message of this.query(prompt, mergedOptions)) {
      messages.push(message);
    }

    // Extract result from the last message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.type === 'result') {
      const result = lastMessage as SDKResultMessage;
      this.sessionId = result.session_id || null;

      return {
        result: result.result,
        error: result.error,
        durationMs: result.duration_ms || 0,
        costUsd: result.total_cost_usd || 0,
        usage: {
          inputTokens: result.usage?.input_tokens || 0,
          outputTokens: result.usage?.output_tokens || 0,
          cacheCreationTokens: result.usage?.cache_creation_input_tokens,
          cacheReadTokens: result.usage?.cache_read_input_tokens,
        },
        sessionId: result.session_id,
        structuredOutput: result.structured_output,
        messages,
      };
    }

    // No result message, construct from assistant messages
    const assistantMessages = messages.filter((m) => m.type === 'assistant');
    const lastAssistant = assistantMessages[assistantMessages.length - 1];

    let resultText = '';
    if (lastAssistant?.type === 'assistant' && lastAssistant.message) {
      const content = lastAssistant.message.content;
      if (typeof content === 'string') {
        resultText = content;
      } else if (Array.isArray(content)) {
        resultText = content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
      }
    }

    return {
      result: resultText,
      durationMs: 0,
      costUsd: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      messages,
    };
  }

  /**
   * Stream messages from an agentic query
   *
   * @param prompt - The task for the agent to perform
   * @param callback - Called for each message received
   * @param options - Override options for this query
   * @returns Complete result after streaming finishes
   */
  async stream(
    prompt: string,
    callback: StreamCallback,
    options?: Partial<ClaudeAgentOptions>
  ): Promise<AgentResult> {
    const messages: SDKMessage[] = [];
    const mergedOptions = { ...this.options, ...options };

    for await (const message of this.query(prompt, mergedOptions)) {
      messages.push(message);
      await callback(message);
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.type === 'result') {
      const result = lastMessage as SDKResultMessage;
      return {
        result: result.result,
        error: result.error,
        durationMs: result.duration_ms || 0,
        costUsd: result.total_cost_usd || 0,
        usage: {
          inputTokens: result.usage?.input_tokens || 0,
          outputTokens: result.usage?.output_tokens || 0,
        },
        sessionId: result.session_id,
        messages,
      };
    }

    return {
      result: '',
      durationMs: 0,
      costUsd: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      messages,
    };
  }

  /**
   * Get the async generator for a query
   *
   * Use this for fine-grained control over message processing.
   *
   * @param prompt - The task for the agent to perform
   * @param options - Override options for this query
   * @returns Async generator yielding SDK messages
   */
  async *query(
    prompt: string,
    options?: Partial<ClaudeAgentOptions>
  ): AsyncGenerator<SDKMessage, void, unknown> {
    const sdk = await this.getSDK();
    const mergedOptions = { ...this.options, ...options };

    // Convert options to SDK format
    const sdkOptions = this.convertToSDKOptions(mergedOptions);

    // If resuming, add the resume option
    if (mergedOptions.resume) {
      sdkOptions.resume = mergedOptions.resume;
    }

    // Create the query
    this.currentQuery = sdk.query({
      prompt,
      options: sdkOptions,
    });

    try {
      for await (const message of this.currentQuery) {
        yield message;
      }
    } finally {
      this.currentQuery = null;
    }
  }

  // ============================================================================
  // Tool-Specific Methods
  // ============================================================================

  /**
   * Run with specific built-in tools enabled
   *
   * @param prompt - The task for the agent to perform
   * @param tools - List of tools to enable
   * @param options - Additional options
   */
  async runWithTools(
    prompt: string,
    tools: BuiltInTool[],
    options?: Partial<ClaudeAgentOptions>
  ): Promise<AgentResult> {
    return this.run(prompt, {
      ...options,
      allowedTools: tools,
    });
  }

  /**
   * Run a code analysis task
   *
   * @param prompt - What to analyze
   * @param options - Additional options
   */
  async analyzeCode(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    return this.runWithTools(prompt, ['Read', 'Glob', 'Grep'], options);
  }

  /**
   * Run a code modification task
   *
   * @param prompt - What to modify
   * @param options - Additional options
   */
  async modifyCode(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    return this.runWithTools(prompt, ['Read', 'Write', 'Edit', 'Glob', 'Grep'], options);
  }

  /**
   * Run a bash command task
   *
   * @param prompt - What commands to run
   * @param options - Additional options
   */
  async runCommands(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    return this.runWithTools(prompt, ['Bash', 'Read', 'Glob'], options);
  }

  /**
   * Run a web research task
   *
   * @param prompt - What to research
   * @param options - Additional options
   */
  async webResearch(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    return this.runWithTools(prompt, ['WebSearch', 'WebFetch'], options);
  }

  // ============================================================================
  // Subagent Methods
  // ============================================================================

  /**
   * Run with subagents for specialized tasks
   *
   * @param prompt - The main task
   * @param agents - Subagent definitions
   * @param options - Additional options
   */
  async runWithSubagents(
    prompt: string,
    agents: Record<string, SubagentDefinition>,
    options?: Partial<ClaudeAgentOptions>
  ): Promise<AgentResult> {
    return this.run(prompt, {
      ...options,
      agents,
      allowedTools: [...(options?.allowedTools || []), 'Task'] as BuiltInTool[],
    });
  }

  /**
   * Run a code review with specialized subagents
   *
   * @param prompt - What to review
   * @param options - Additional options
   */
  async codeReview(prompt: string, options?: Partial<ClaudeAgentOptions>): Promise<AgentResult> {
    return this.runWithSubagents(
      prompt,
      {
        'code-reviewer': {
          description: 'Review code for quality, correctness, and best practices',
          tools: ['Read', 'Glob', 'Grep'],
          prompt:
            'You are a senior code reviewer. Focus on code quality, potential bugs, security issues, and performance problems.',
        },
        'security-auditor': {
          description: 'Audit code for security vulnerabilities',
          tools: ['Read', 'Glob', 'Grep'],
          prompt:
            'You are a security expert. Look for OWASP Top 10 vulnerabilities, injection attacks, authentication issues, and data exposure risks.',
        },
        'test-analyzer': {
          description: 'Analyze test coverage and quality',
          tools: ['Read', 'Glob', 'Grep', 'Bash'],
          prompt:
            'You are a testing expert. Analyze test coverage, identify missing tests, and suggest improvements.',
        },
      },
      options
    );
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Resume a previous session
   *
   * @param sessionId - The session ID to resume
   * @param prompt - New prompt to continue with
   * @param options - Additional options
   */
  async resumeSession(
    sessionId: string,
    prompt: string,
    options?: Partial<ClaudeAgentOptions>
  ): Promise<AgentResult> {
    return this.run(prompt, {
      ...options,
      resume: sessionId,
      continue: true,
    });
  }

  /**
   * Get the last session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  // ============================================================================
  // Control Methods
  // ============================================================================

  /**
   * Interrupt the current query
   */
  async interrupt(): Promise<void> {
    if (this.currentQuery) {
      await this.currentQuery.interrupt();
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Convert marktoflow options to Agent SDK options
   */
  private convertToSDKOptions(options: ClaudeAgentOptions): Record<string, unknown> {
    const sdkOptions: Record<string, unknown> = {};

    if (options.model) sdkOptions.model = options.model;
    if (options.cwd) sdkOptions.cwd = options.cwd;
    if (options.additionalDirectories) sdkOptions.additionalDirectories = options.additionalDirectories;
    if (options.excludeFiles) sdkOptions.excludeFiles = options.excludeFiles;
    if (options.env) sdkOptions.env = options.env;
    if (options.allowedTools) sdkOptions.allowedTools = options.allowedTools;
    if (options.disallowedTools) sdkOptions.disallowedTools = options.disallowedTools;
    if (options.permissionMode) sdkOptions.permissionMode = options.permissionMode;
    if (options.canUseTool) sdkOptions.canUseTool = options.canUseTool;
    if (options.maxTurns) sdkOptions.maxTurns = options.maxTurns;
    if (options.maxBudgetUsd) sdkOptions.maxBudgetUsd = options.maxBudgetUsd;
    if (options.maxThinkingTokens) sdkOptions.maxThinkingTokens = options.maxThinkingTokens;
    if (options.enableFileCheckpointing) sdkOptions.enableFileCheckpointing = options.enableFileCheckpointing;
    if (options.mcpServers) sdkOptions.mcpServers = options.mcpServers;
    if (options.agents) sdkOptions.agents = options.agents;
    if (options.hooks) sdkOptions.hooks = options.hooks;
    if (options.outputFormat) sdkOptions.outputFormat = options.outputFormat;
    if (options.systemPrompt) sdkOptions.systemPrompt = options.systemPrompt;
    if (options.continue) sdkOptions.continue = options.continue;

    return sdkOptions;
  }
}

// ============================================================================
// Custom MCP Tool Factory
// ============================================================================

/**
 * Create a custom MCP tool for use with the Agent SDK
 *
 * @param name - Tool name
 * @param description - Tool description
 * @param schema - Zod schema for input validation
 * @param handler - Function to execute when tool is called
 */
export async function createCustomTool<T>(
  name: string,
  description: string,
  schema: T,
  handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>
): Promise<unknown> {
  try {
    // Dynamic import of the Agent SDK (optional dependency)
    const module = (await import(/* webpackIgnore: true */ '@anthropic-ai/claude-agent-sdk').catch(
      () => null
    )) as { tool?: unknown } | null;
    if (!module?.tool) {
      throw new Error('SDK not installed');
    }
    const tool = module.tool as (
      n: string,
      d: string,
      s: unknown,
      h: (a: unknown) => Promise<unknown>
    ) => unknown;
    return tool(name, description, schema, handler);
  } catch (error) {
    throw new Error(
      `Failed to create custom tool. Install the Agent SDK: npm install @anthropic-ai/claude-agent-sdk\n` +
        `Original error: ${error}`
    );
  }
}

/**
 * Create an in-process MCP server
 *
 * @param name - Server name
 * @param tools - Array of tools created with createCustomTool
 * @param version - Server version
 */
export async function createMcpServer(
  name: string,
  tools: unknown[],
  version = '1.0.0'
): Promise<unknown> {
  try {
    // Dynamic import of the Agent SDK (optional dependency)
    const module = (await import(/* webpackIgnore: true */ '@anthropic-ai/claude-agent-sdk').catch(
      () => null
    )) as { createSdkMcpServer?: unknown } | null;
    if (!module?.createSdkMcpServer) {
      throw new Error('SDK not installed');
    }
    const createSdkMcpServer = module.createSdkMcpServer as (config: {
      name: string;
      version: string;
      tools: unknown[];
    }) => unknown;
    return createSdkMcpServer({
      name,
      version,
      tools,
    });
  } catch (error) {
    throw new Error(
      `Failed to create MCP server. Install the Agent SDK: npm install @anthropic-ai/claude-agent-sdk\n` +
        `Original error: ${error}`
    );
  }
}

// ============================================================================
// SDK Initializer for marktoflow Registry
// ============================================================================

/**
 * Initializer for the SDK Registry
 */
export const ClaudeAgentInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<ClaudeAgentClient> {
    const options = config.options || {};

    return new ClaudeAgentClient({
      model: options['model'] as string,
      cwd: options['cwd'] as string,
      additionalDirectories: options['additionalDirectories'] as string[],
      env: options['env'] as Record<string, string>,
      allowedTools: options['allowedTools'] as BuiltInTool[],
      disallowedTools: options['disallowedTools'] as BuiltInTool[],
      permissionMode: options['permissionMode'] as PermissionMode,
      maxTurns: options['maxTurns'] as number,
      maxBudgetUsd: options['maxBudgetUsd'] as number,
      maxThinkingTokens: options['maxThinkingTokens'] as number,
      timeout: options['timeout'] as number,
      enableFileCheckpointing: options['enableFileCheckpointing'] as boolean,
      mcpServers: options['mcpServers'] as Record<string, McpServerConfig>,
      agents: options['agents'] as Record<string, SubagentDefinition>,
      systemPrompt: options['systemPrompt'] as string,
    });
  },
};

// ============================================================================
// Re-export types
// ============================================================================

export type {
  ClaudeAgentOptions,
  SDKMessage,
  SDKResultMessage,
  AgentResult,
  StreamCallback,
  BuiltInTool,
  SubagentDefinition,
  McpServerConfig,
  HookCallback,
  HookEvent,
  ToolPermissionHandler,
  ToolPermissionResult,
  PermissionMode,
};
