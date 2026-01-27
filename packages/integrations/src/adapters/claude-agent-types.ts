/**
 * Type definitions for Claude Agent SDK integration with marktoflow
 *
 * These types enable deep integration with the Claude Agent SDK for
 * agentic workflows without subprocess overhead.
 */

import { z } from 'zod';

// ============================================================================
// Agent SDK Options
// ============================================================================

/**
 * Permission modes for tool execution
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

/**
 * Built-in tools available in the Agent SDK
 */
export type BuiltInTool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebSearch'
  | 'WebFetch'
  | 'AskUserQuestion'
  | 'Task'
  | 'TodoWrite'
  | 'NotebookEdit'
  | 'BashOutput'
  | 'KillBash';

/**
 * Custom tool permission result
 */
export interface ToolPermissionResult {
  behavior: 'allow' | 'deny';
  message?: string;
  updatedInput?: Record<string, unknown>;
}

/**
 * Custom tool permission handler
 */
export type ToolPermissionHandler = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<ToolPermissionResult>;

/**
 * Subagent definition for specialized tasks
 */
export interface SubagentDefinition {
  /** Description of what this subagent does */
  description: string;
  /** Tools available to this subagent */
  tools?: BuiltInTool[];
  /** Custom system prompt for the subagent */
  prompt?: string;
  /** Model to use (overrides default) */
  model?: 'sonnet' | 'opus' | 'haiku';
  /** Maximum turns before stopping */
  maxTurns?: number;
}

/**
 * MCP server configuration for external integrations
 */
export interface McpServerConfig {
  /** Server type */
  type: 'stdio' | 'http' | 'sse' | 'sdk';
  /** Command to run (for stdio type) */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** URL for http/sse types */
  url?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** SDK server instance (for sdk type) */
  instance?: unknown;
}

/**
 * Hook event callback
 */
export interface HookCallback {
  /** Matcher pattern for filtering events */
  matcher?: string;
  /** Hook functions to execute */
  hooks: Array<(input: HookInput) => Promise<HookResult>>;
}

/**
 * Hook input data
 */
export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: string;
  session_id?: string;
  error?: string;
}

/**
 * Hook result
 */
export interface HookResult {
  continue?: boolean;
  message?: string;
}

/**
 * Hook events
 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop';

/**
 * Structured output format
 */
export interface OutputFormat {
  type: 'json_schema';
  schema: Record<string, unknown>;
}

// ============================================================================
// Agent SDK Configuration
// ============================================================================

/**
 * Full configuration options for the Claude Agent SDK
 */
export interface ClaudeAgentOptions {
  /** Model to use */
  model?: string;
  /** Working directory for file operations */
  cwd?: string;
  /** Additional directories the agent can access */
  additionalDirectories?: string[];
  /** Files to exclude from automatic context loading (e.g., ['CLAUDE.md', 'AGENTS.md']) */
  excludeFiles?: string[];
  /** Environment variables */
  env?: Record<string, string>;

  // Tool control
  /** Whitelist of allowed tools */
  allowedTools?: BuiltInTool[];
  /** Blacklist of disallowed tools */
  disallowedTools?: BuiltInTool[];

  // Permissions
  /** Permission mode for tool execution */
  permissionMode?: PermissionMode;
  /** Custom permission handler */
  canUseTool?: ToolPermissionHandler;

  // Session management
  /** Resume from a previous session */
  resume?: string;
  /** Continue previous conversation */
  continue?: boolean;
  /** Enable file change tracking */
  enableFileCheckpointing?: boolean;

  // Resource limits
  /** Maximum conversation turns */
  maxTurns?: number;
  /** Maximum spending in USD */
  maxBudgetUsd?: number;
  /** Maximum thinking tokens */
  maxThinkingTokens?: number;
  /** Timeout in milliseconds */
  timeout?: number;

  // Extensions
  /** MCP server configurations */
  mcpServers?: Record<string, McpServerConfig>;
  /** Subagent definitions */
  agents?: Record<string, SubagentDefinition>;
  /** Lifecycle hooks */
  hooks?: Partial<Record<HookEvent, HookCallback[]>>;

  // Output
  /** Structured output format */
  outputFormat?: OutputFormat;
  /** Custom system prompt */
  systemPrompt?: string;
}

// ============================================================================
// SDK Message Types
// ============================================================================

/**
 * Base message from the Agent SDK
 */
export interface SDKMessageBase {
  type: string;
}

/**
 * Assistant message with Claude's response
 */
export interface SDKAssistantMessage extends SDKMessageBase {
  type: 'assistant';
  message?: {
    role: 'assistant';
    content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  };
  stop_reason?: string;
}

/**
 * User message
 */
export interface SDKUserMessage extends SDKMessageBase {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
}

/**
 * Result message with completion info
 */
export interface SDKResultMessage extends SDKMessageBase {
  type: 'result';
  result?: string;
  error?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  structured_output?: unknown;
  session_id?: string;
}

/**
 * System message for initialization
 */
export interface SDKSystemMessage extends SDKMessageBase {
  type: 'system';
  subtype?: 'init';
  session_id?: string;
  cwd?: string;
  tools?: string[];
}

/**
 * Partial message for streaming updates
 */
export interface SDKPartialMessage extends SDKMessageBase {
  type: 'partial';
  delta?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/**
 * Union of all SDK message types
 */
export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialMessage;

// ============================================================================
// Agent Client Interface
// ============================================================================

/**
 * Query instance returned by the agent
 */
export interface AgentQuery extends AsyncGenerator<SDKMessage, void, unknown> {
  /** Interrupt the current operation */
  interrupt(): Promise<void>;
  /** Rewind files to a previous state */
  rewindFiles(messageUuid: string): Promise<void>;
  /** Change permission mode during execution */
  setPermissionMode(mode: PermissionMode): void;
  /** Change model during execution */
  setModel(model: string): void;
  /** Get supported models */
  supportedModels(): Promise<string[]>;
  /** Get MCP server status */
  mcpServerStatus(): Promise<Record<string, { status: string }>>;
  /** Get account info */
  accountInfo(): Promise<{ plan: string; usage: unknown }>;
}

/**
 * Result from a completed agent query
 */
export interface AgentResult {
  /** Final text result */
  result?: string;
  /** Error if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Total cost in USD */
  costUsd: number;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  /** Session ID for resumption */
  sessionId?: string;
  /** Structured output if requested */
  structuredOutput?: unknown;
  /** All messages from the session */
  messages: SDKMessage[];
}

/**
 * Streaming callback for real-time updates
 */
export type StreamCallback = (message: SDKMessage) => void | Promise<void>;

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const SubagentDefinitionSchema = z.object({
  description: z.string(),
  tools: z
    .array(
      z.enum([
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
        'AskUserQuestion',
        'Task',
        'TodoWrite',
        'NotebookEdit',
        'BashOutput',
        'KillBash',
      ])
    )
    .optional(),
  prompt: z.string().optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  maxTurns: z.number().optional(),
});

export const McpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http', 'sse', 'sdk']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export const ClaudeAgentOptionsSchema = z.object({
  model: z.string().optional(),
  cwd: z.string().optional(),
  additionalDirectories: z.array(z.string()).optional(),
  excludeFiles: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  disallowedTools: z.array(z.string()).optional(),
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
  resume: z.string().optional(),
  continue: z.boolean().optional(),
  enableFileCheckpointing: z.boolean().optional(),
  maxTurns: z.number().optional(),
  maxBudgetUsd: z.number().optional(),
  maxThinkingTokens: z.number().optional(),
  timeout: z.number().optional(),
  mcpServers: z.record(McpServerConfigSchema).optional(),
  agents: z.record(SubagentDefinitionSchema).optional(),
  systemPrompt: z.string().optional(),
});
