/**
 * OpenAI Codex SDK Adapter for marktoflow
 *
 * This adapter provides integration with the OpenAI Codex SDK,
 * enabling AI-powered coding workflows with file changes, command execution,
 * web search, structured output, and streaming capabilities.
 */

import {
  Codex,
  type Thread,
  type ThreadItem,
  type Usage,
  type ThreadOptions,
  type TurnOptions,
  type Input,
} from '@openai/codex-sdk';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import type {
  CodexClientConfig,
  CodexThreadOptions,
  CodexTurnOptions,
  CodexResult,
  CodexStreamCallback,
  AgentMessageItem,
  CommandExecutionItem,
  FileChangeItem,
} from './codex-types.js';

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Extended configuration for the CodexClient wrapper
 */
export interface CodexClientOptions extends CodexClientConfig {
  /** Default thread options */
  defaultThreadOptions?: CodexThreadOptions;
}

// ============================================================================
// Codex Client
// ============================================================================

/**
 * Client for interacting with OpenAI Codex via the SDK
 *
 * Provides multiple interfaces for different use cases:
 * - send(): Simple prompt-response
 * - stream(): Streaming responses with callbacks
 * - sendWithThread(): Full thread control
 * - resumeThread(): Continue previous conversations
 */
export class CodexClient {
  private codex: Codex;
  private defaultThreadOptions: CodexThreadOptions;
  private activeThread: Thread | null = null;
  private lastThreadId: string | null = null;

  constructor(config: CodexClientOptions = {}) {
    this.codex = new Codex({
      codexPathOverride: config.codexPathOverride,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      env: config.env,
    });

    this.defaultThreadOptions = config.defaultThreadOptions || {
      skipGitRepoCheck: true,
      sandboxMode: 'workspace-write',
    };
  }

  // ============================================================================
  // Simple Interface
  // ============================================================================

  /**
   * Send a message and wait for the complete response
   */
  async send(inputs: {
    prompt: string | Input;
    threadOptions?: CodexThreadOptions;
    turnOptions?: CodexTurnOptions;
  }): Promise<string> {
    const thread = this.codex.startThread(
      this.buildThreadOptions(inputs.threadOptions)
    );
    this.activeThread = thread;

    const turnOptions: TurnOptions = {};
    if (inputs.turnOptions?.outputSchema) {
      turnOptions.outputSchema = inputs.turnOptions.outputSchema;
    }
    if (inputs.turnOptions?.signal) {
      turnOptions.signal = inputs.turnOptions.signal;
    }

    const result = await thread.run(inputs.prompt, turnOptions);
    this.lastThreadId = thread.id;

    // Extract the final response text
    const agentMessage = result.items.find(
      (item): item is AgentMessageItem => item.type === 'agent_message'
    );

    return agentMessage?.text || result.finalResponse || '';
  }

  /**
   * Send a message and stream the response
   */
  async stream(inputs: {
    prompt: string | Input;
    threadOptions?: CodexThreadOptions;
    turnOptions?: CodexTurnOptions;
    onChunk?: (chunk: string) => void;
    onEvent?: CodexStreamCallback;
    onComplete?: (result: CodexResult) => void;
  }): Promise<CodexResult> {
    const thread = this.codex.startThread(
      this.buildThreadOptions(inputs.threadOptions)
    );
    this.activeThread = thread;

    const turnOptions: TurnOptions = {};
    if (inputs.turnOptions?.outputSchema) {
      turnOptions.outputSchema = inputs.turnOptions.outputSchema;
    }
    if (inputs.turnOptions?.signal) {
      turnOptions.signal = inputs.turnOptions.signal;
    }

    const streamResult = await thread.runStreamed(inputs.prompt, turnOptions);
    const items: ThreadItem[] = [];
    let finalResponse = '';
    let usage: Usage | null = null;

    for await (const event of streamResult.events) {
      // Call event callback if provided
      if (inputs.onEvent) {
        await Promise.resolve(inputs.onEvent('', event));
      }

      // Process events
      if (event.type === 'thread.started') {
        this.lastThreadId = event.thread_id;
      } else if (event.type === 'item.completed') {
        items.push(event.item);

        // Stream text chunks for agent messages
        if (event.item.type === 'agent_message') {
          const text = event.item.text;
          if (inputs.onChunk) {
            inputs.onChunk(text);
          }
          finalResponse = text;
        }
      } else if (event.type === 'turn.completed') {
        usage = event.usage;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      } else if (event.type === 'turn.failed') {
        throw new Error(event.error.message);
      }
    }

    const result: CodexResult = {
      content: finalResponse,
      threadId: thread.id,
      items,
      usage,
      fileChanges: items.filter(
        (item): item is FileChangeItem => item.type === 'file_change'
      ),
      commands: items.filter(
        (item): item is CommandExecutionItem => item.type === 'command_execution'
      ),
    };

    if (inputs.onComplete) {
      inputs.onComplete(result);
    }

    return result;
  }

  // ============================================================================
  // Full Thread Interface
  // ============================================================================

  /**
   * Send a message with full thread configuration
   */
  async sendWithThread(
    message: string | Input,
    threadOptions?: CodexThreadOptions,
    turnOptions?: CodexTurnOptions
  ): Promise<CodexResult> {
    const thread = this.codex.startThread(
      this.buildThreadOptions(threadOptions)
    );
    this.activeThread = thread;

    const sdkTurnOptions: TurnOptions = {};
    if (turnOptions?.outputSchema) {
      sdkTurnOptions.outputSchema = turnOptions.outputSchema;
    }
    if (turnOptions?.signal) {
      sdkTurnOptions.signal = turnOptions.signal;
    }

    const result = await thread.run(message, sdkTurnOptions);
    this.lastThreadId = thread.id;

    const agentMessage = result.items.find(
      (item): item is AgentMessageItem => item.type === 'agent_message'
    );

    return {
      content: agentMessage?.text || result.finalResponse || '',
      threadId: thread.id,
      items: result.items,
      usage: result.usage,
      fileChanges: result.items.filter(
        (item): item is FileChangeItem => item.type === 'file_change'
      ),
      commands: result.items.filter(
        (item): item is CommandExecutionItem => item.type === 'command_execution'
      ),
    };
  }

  /**
   * Stream with full thread configuration
   */
  async streamWithThread(
    message: string | Input,
    callback: CodexStreamCallback,
    threadOptions?: CodexThreadOptions,
    turnOptions?: CodexTurnOptions
  ): Promise<CodexResult> {
    return this.stream({
      prompt: message,
      threadOptions,
      turnOptions,
      onEvent: callback,
    });
  }

  // ============================================================================
  // Thread Management
  // ============================================================================

  /**
   * Resume a previous thread and send a message
   */
  async resumeAndSend(
    threadId: string,
    message: string | Input,
    threadOptions?: CodexThreadOptions,
    turnOptions?: CodexTurnOptions
  ): Promise<CodexResult> {
    const thread = this.codex.resumeThread(
      threadId,
      this.buildThreadOptions(threadOptions)
    );
    this.activeThread = thread;

    const sdkTurnOptions: TurnOptions = {};
    if (turnOptions?.outputSchema) {
      sdkTurnOptions.outputSchema = turnOptions.outputSchema;
    }
    if (turnOptions?.signal) {
      sdkTurnOptions.signal = turnOptions.signal;
    }

    const result = await thread.run(message, sdkTurnOptions);
    this.lastThreadId = thread.id;

    const agentMessage = result.items.find(
      (item): item is AgentMessageItem => item.type === 'agent_message'
    );

    return {
      content: agentMessage?.text || result.finalResponse || '',
      threadId: thread.id,
      items: result.items,
      usage: result.usage,
      fileChanges: result.items.filter(
        (item): item is FileChangeItem => item.type === 'file_change'
      ),
      commands: result.items.filter(
        (item): item is CommandExecutionItem => item.type === 'command_execution'
      ),
    };
  }

  /**
   * Resume a thread and stream the response
   */
  async resumeAndStream(
    threadId: string,
    message: string | Input,
    callback: CodexStreamCallback,
    threadOptions?: CodexThreadOptions,
    turnOptions?: CodexTurnOptions
  ): Promise<CodexResult> {
    const thread = this.codex.resumeThread(
      threadId,
      this.buildThreadOptions(threadOptions)
    );
    this.activeThread = thread;

    const sdkTurnOptions: TurnOptions = {};
    if (turnOptions?.outputSchema) {
      sdkTurnOptions.outputSchema = turnOptions.outputSchema;
    }
    if (turnOptions?.signal) {
      sdkTurnOptions.signal = turnOptions.signal;
    }

    const streamResult = await thread.runStreamed(message, sdkTurnOptions);
    const items: ThreadItem[] = [];
    let finalResponse = '';
    let usage: Usage | null = null;

    for await (const event of streamResult.events) {
      await Promise.resolve(callback('', event));

      if (event.type === 'thread.started') {
        this.lastThreadId = event.thread_id;
      } else if (event.type === 'item.completed') {
        items.push(event.item);
        if (event.item.type === 'agent_message') {
          finalResponse = event.item.text;
        }
      } else if (event.type === 'turn.completed') {
        usage = event.usage;
      } else if (event.type === 'error') {
        throw new Error(event.message);
      } else if (event.type === 'turn.failed') {
        throw new Error(event.error.message);
      }
    }

    return {
      content: finalResponse,
      threadId: thread.id,
      items,
      usage,
      fileChanges: items.filter(
        (item): item is FileChangeItem => item.type === 'file_change'
      ),
      commands: items.filter(
        (item): item is CommandExecutionItem => item.type === 'command_execution'
      ),
    };
  }

  /**
   * Create a new thread for multi-turn conversations
   */
  startThread(options?: CodexThreadOptions): Thread {
    const thread = this.codex.startThread(this.buildThreadOptions(options));
    this.activeThread = thread;
    return thread;
  }

  /**
   * Resume an existing thread
   */
  resumeThread(threadId: string, options?: CodexThreadOptions): Thread {
    const thread = this.codex.resumeThread(
      threadId,
      this.buildThreadOptions(options)
    );
    this.activeThread = thread;
    return thread;
  }

  /**
   * Get the last thread ID
   */
  getLastThreadId(): string | null {
    return this.lastThreadId;
  }

  /**
   * Get the active thread
   */
  getActiveThread(): Thread | null {
    return this.activeThread;
  }

  // ============================================================================
  // Structured Output
  // ============================================================================

  /**
   * Send with structured JSON output
   */
  async sendStructured<T>(inputs: {
    prompt: string | Input;
    schema: unknown;
    threadOptions?: CodexThreadOptions;
  }): Promise<T> {
    const response = await this.send({
      prompt: inputs.prompt,
      threadOptions: inputs.threadOptions,
      turnOptions: {
        outputSchema: inputs.schema,
      },
    });

    try {
      return JSON.parse(response) as T;
    } catch {
      throw new Error(`Failed to parse structured output: ${response}`);
    }
  }

  // ============================================================================
  // Specialized Methods
  // ============================================================================

  /**
   * Execute code modifications
   */
  async modifyCode(inputs: {
    prompt: string;
    workingDirectory?: string;
    additionalDirectories?: string[];
    excludeFiles?: string[];
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  }): Promise<CodexResult> {
    return this.sendWithThread(inputs.prompt, {
      workingDirectory: inputs.workingDirectory || process.cwd(),
      additionalDirectories: inputs.additionalDirectories,
      excludeFiles: inputs.excludeFiles,
      modelReasoningEffort: inputs.reasoningEffort || 'medium',
      sandboxMode: 'workspace-write',
      skipGitRepoCheck: true,
    });
  }

  /**
   * Execute shell commands via the agent
   */
  async executeCommands(inputs: {
    prompt: string;
    workingDirectory?: string;
    approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
  }): Promise<CodexResult> {
    return this.sendWithThread(inputs.prompt, {
      workingDirectory: inputs.workingDirectory || process.cwd(),
      approvalPolicy: inputs.approvalPolicy || 'never',
      sandboxMode: 'danger-full-access',
      skipGitRepoCheck: true,
    });
  }

  /**
   * Perform web research
   */
  async webSearch(inputs: {
    prompt: string;
    searchMode?: 'cached' | 'live';
  }): Promise<CodexResult> {
    return this.sendWithThread(inputs.prompt, {
      webSearchMode: inputs.searchMode || 'live',
      networkAccessEnabled: true,
      skipGitRepoCheck: true,
    });
  }

  /**
   * Analyze code without making changes
   */
  async analyzeCode(inputs: {
    prompt: string;
    workingDirectory?: string;
    additionalDirectories?: string[];
    excludeFiles?: string[];
  }): Promise<CodexResult> {
    return this.sendWithThread(inputs.prompt, {
      workingDirectory: inputs.workingDirectory || process.cwd(),
      additionalDirectories: inputs.additionalDirectories,
      excludeFiles: inputs.excludeFiles,
      sandboxMode: 'read-only',
      skipGitRepoCheck: true,
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Build thread options from configuration
   */
  private buildThreadOptions(options?: CodexThreadOptions): ThreadOptions {
    const merged = { ...this.defaultThreadOptions, ...options };

    return {
      model: merged.model,
      sandboxMode: merged.sandboxMode,
      workingDirectory: merged.workingDirectory,
      skipGitRepoCheck: merged.skipGitRepoCheck,
      modelReasoningEffort: merged.modelReasoningEffort,
      networkAccessEnabled: merged.networkAccessEnabled,
      webSearchMode: merged.webSearchMode,
      webSearchEnabled: merged.webSearchEnabled,
      approvalPolicy: merged.approvalPolicy,
      additionalDirectories: merged.additionalDirectories,
      // NOTE: excludeFiles is stored in merged but not passed to SDK yet
      // as the underlying Codex SDK doesn't support it yet
    };
  }
}

// ============================================================================
// SDK Initializer for marktoflow Registry
// ============================================================================

/**
 * SDK Initializer for OpenAI Codex
 */
export const CodexInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    const auth = config.auth || {};

    return new CodexClient({
      codexPathOverride:
        (auth['codex_path'] as string) || (options['codexPath'] as string),
      baseUrl: (auth['base_url'] as string) || (options['baseUrl'] as string),
      apiKey: (auth['api_key'] as string) || (options['apiKey'] as string),
      env: options['env'] as Record<string, string>,
      defaultThreadOptions: {
        model: options['model'] as string,
        workingDirectory: options['workingDirectory'] as string,
        skipGitRepoCheck: (options['skipGitRepoCheck'] as boolean) ?? true,
        sandboxMode:
          (options['sandboxMode'] as CodexThreadOptions['sandboxMode']) ||
          'workspace-write',
        modelReasoningEffort:
          options['reasoningEffort'] as CodexThreadOptions['modelReasoningEffort'],
        webSearchMode:
          options['webSearchMode'] as CodexThreadOptions['webSearchMode'],
        approvalPolicy:
          options['approvalPolicy'] as CodexThreadOptions['approvalPolicy'],
        additionalDirectories: options['additionalDirectories'] as string[],
        excludeFiles: options['excludeFiles'] as string[],
      },
    });
  },
};

// ============================================================================
// Re-export SDK classes for convenience
// ============================================================================

export { Codex, Thread };
