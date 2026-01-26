/**
 * Type definitions for OpenAI Codex SDK integration with marktoflow
 *
 * These types enable integration with the OpenAI Codex SDK for
 * AI-powered workflows with coding agents, structured output, and more.
 */

import { z } from 'zod';

// ============================================================================
// Core Types (re-exported from SDK for convenience)
// ============================================================================

/**
 * Approval modes for the Codex agent
 */
export type ApprovalMode = 'never' | 'on-request' | 'on-failure' | 'untrusted';

/**
 * Sandbox modes for file system access
 */
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';

/**
 * Model reasoning effort levels
 */
export type ModelReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Web search modes
 */
export type WebSearchMode = 'disabled' | 'cached' | 'live';

/**
 * Command execution status
 */
export type CommandExecutionStatus = 'in_progress' | 'completed' | 'failed';

/**
 * Patch apply status
 */
export type PatchApplyStatus = 'completed' | 'failed';

/**
 * File change kind
 */
export type PatchChangeKind = 'add' | 'delete' | 'update';

/**
 * MCP tool call status
 */
export type McpToolCallStatus = 'in_progress' | 'completed' | 'failed';

// ============================================================================
// Item Types
// ============================================================================

/**
 * Command execution item
 */
export interface CommandExecutionItem {
  id: string;
  type: 'command_execution';
  command: string;
  aggregated_output: string;
  exit_code?: number;
  status: CommandExecutionStatus;
}

/**
 * File change item
 */
export interface FileChangeItem {
  id: string;
  type: 'file_change';
  changes: Array<{
    path: string;
    kind: PatchChangeKind;
  }>;
  status: PatchApplyStatus;
}

/**
 * MCP tool call item
 */
export interface McpToolCallItem {
  id: string;
  type: 'mcp_tool_call';
  server: string;
  tool: string;
  arguments: unknown;
  result?: {
    content: unknown[];
    structured_content: unknown;
  };
  error?: {
    message: string;
  };
  status: McpToolCallStatus;
}

/**
 * Agent message item
 */
export interface AgentMessageItem {
  id: string;
  type: 'agent_message';
  text: string;
}

/**
 * Reasoning item
 */
export interface ReasoningItem {
  id: string;
  type: 'reasoning';
  text: string;
}

/**
 * Web search item
 */
export interface WebSearchItem {
  id: string;
  type: 'web_search';
  query: string;
}

/**
 * Error item
 */
export interface ErrorItem {
  id: string;
  type: 'error';
  message: string;
}

/**
 * Todo item
 */
export interface TodoItem {
  text: string;
  completed: boolean;
}

/**
 * Todo list item
 */
export interface TodoListItem {
  id: string;
  type: 'todo_list';
  items: TodoItem[];
}

/**
 * Union of all thread items
 */
export type ThreadItem =
  | AgentMessageItem
  | ReasoningItem
  | CommandExecutionItem
  | FileChangeItem
  | McpToolCallItem
  | WebSearchItem
  | TodoListItem
  | ErrorItem;

// ============================================================================
// Event Types
// ============================================================================

/**
 * Thread started event
 */
export interface ThreadStartedEvent {
  type: 'thread.started';
  thread_id: string;
}

/**
 * Turn started event
 */
export interface TurnStartedEvent {
  type: 'turn.started';
}

/**
 * Usage information
 */
export interface Usage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

/**
 * Turn completed event
 */
export interface TurnCompletedEvent {
  type: 'turn.completed';
  usage: Usage;
}

/**
 * Thread error
 */
export interface ThreadError {
  message: string;
}

/**
 * Turn failed event
 */
export interface TurnFailedEvent {
  type: 'turn.failed';
  error: ThreadError;
}

/**
 * Item started event
 */
export interface ItemStartedEvent {
  type: 'item.started';
  item: ThreadItem;
}

/**
 * Item updated event
 */
export interface ItemUpdatedEvent {
  type: 'item.updated';
  item: ThreadItem;
}

/**
 * Item completed event
 */
export interface ItemCompletedEvent {
  type: 'item.completed';
  item: ThreadItem;
}

/**
 * Thread error event
 */
export interface ThreadErrorEvent {
  type: 'error';
  message: string;
}

/**
 * Union of all thread events
 */
export type ThreadEvent =
  | ThreadStartedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | ItemStartedEvent
  | ItemUpdatedEvent
  | ItemCompletedEvent
  | ThreadErrorEvent;

// ============================================================================
// Input Types
// ============================================================================

/**
 * Text input
 */
export interface TextInput {
  type: 'text';
  text: string;
}

/**
 * Local image input
 */
export interface LocalImageInput {
  type: 'local_image';
  path: string;
}

/**
 * User input can be text or local image
 */
export type UserInput = TextInput | LocalImageInput;

/**
 * Input can be a string or array of UserInput
 */
export type Input = string | UserInput[];

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration options for the Codex client
 */
export interface CodexClientConfig {
  /** Override path to the Codex CLI executable */
  codexPathOverride?: string;
  /** Base URL for API calls */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Environment variables passed to the Codex CLI process */
  env?: Record<string, string>;
}

/**
 * Options for creating a thread
 */
export interface CodexThreadOptions {
  /** Model to use */
  model?: string;
  /** Sandbox mode for file system access */
  sandboxMode?: SandboxMode;
  /** Working directory for the agent */
  workingDirectory?: string;
  /** Skip Git repository check */
  skipGitRepoCheck?: boolean;
  /** Model reasoning effort level */
  modelReasoningEffort?: ModelReasoningEffort;
  /** Enable network access */
  networkAccessEnabled?: boolean;
  /** Web search mode */
  webSearchMode?: WebSearchMode;
  /** Enable web search (deprecated, use webSearchMode) */
  webSearchEnabled?: boolean;
  /** Approval policy for tool use */
  approvalPolicy?: ApprovalMode;
  /** Additional directories the agent can access */
  additionalDirectories?: string[];
}

/**
 * Options for a turn
 */
export interface CodexTurnOptions {
  /** JSON schema for structured output */
  outputSchema?: unknown;
  /** AbortSignal to cancel the turn */
  signal?: AbortSignal;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result from a completed turn
 */
export interface CodexTurnResult {
  /** Items produced during the turn */
  items: ThreadItem[];
  /** Final response from the agent */
  finalResponse: string;
  /** Usage statistics */
  usage: Usage | null;
}

/**
 * Result from a streamed turn
 */
export interface CodexStreamedResult {
  /** Async generator of events */
  events: AsyncGenerator<ThreadEvent>;
}

/**
 * Unified result from Codex operations
 */
export interface CodexResult {
  /** Response content */
  content: string;
  /** Thread ID for resumption */
  threadId: string | null;
  /** Items from the turn */
  items: ThreadItem[];
  /** Usage statistics */
  usage: Usage | null;
  /** File changes made */
  fileChanges?: FileChangeItem[];
  /** Commands executed */
  commands?: CommandExecutionItem[];
}

/**
 * Streaming callback
 */
export type CodexStreamCallback = (chunk: string, event: ThreadEvent) => void | Promise<void>;

// ============================================================================
// Workflow Configuration (for marktoflow YAML)
// ============================================================================

/**
 * Configuration for Codex in workflow YAML
 */
export interface CodexWorkflowConfig {
  /** Model to use */
  model?: string;
  /** Working directory */
  workingDirectory?: string;
  /** Skip Git check */
  skipGitRepoCheck?: boolean;
  /** Sandbox mode */
  sandboxMode?: SandboxMode;
  /** Reasoning effort */
  reasoningEffort?: ModelReasoningEffort;
  /** Web search mode */
  webSearchMode?: WebSearchMode;
  /** Approval policy */
  approvalPolicy?: ApprovalMode;
  /** Additional directories */
  additionalDirectories?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const CodexThreadOptionsSchema = z.object({
  model: z.string().optional(),
  sandboxMode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
  workingDirectory: z.string().optional(),
  skipGitRepoCheck: z.boolean().optional(),
  modelReasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  networkAccessEnabled: z.boolean().optional(),
  webSearchMode: z.enum(['disabled', 'cached', 'live']).optional(),
  webSearchEnabled: z.boolean().optional(),
  approvalPolicy: z.enum(['never', 'on-request', 'on-failure', 'untrusted']).optional(),
  additionalDirectories: z.array(z.string()).optional(),
});

export const CodexClientConfigSchema = z.object({
  codexPathOverride: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export const CodexWorkflowConfigSchema = z.object({
  model: z.string().optional(),
  workingDirectory: z.string().optional(),
  skipGitRepoCheck: z.boolean().optional(),
  sandboxMode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional(),
  webSearchMode: z.enum(['disabled', 'cached', 'live']).optional(),
  approvalPolicy: z.enum(['never', 'on-request', 'on-failure', 'untrusted']).optional(),
  additionalDirectories: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const UserInputSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('local_image'),
    path: z.string(),
  }),
]);

export const InputSchema = z.union([z.string(), z.array(UserInputSchema)]);
