/**
 * Type definitions for GitHub Copilot SDK integration with marktoflow
 *
 * These types enable deep integration with the GitHub Copilot SDK for
 * AI-powered workflows with tools, MCP servers, custom agents, and more.
 */

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Log levels for the Copilot CLI
 */
export type LogLevel = 'none' | 'error' | 'warning' | 'info' | 'debug' | 'all';

/**
 * Connection states for the Copilot client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Tool result types
 */
export type ToolResultType = 'success' | 'failure' | 'rejected' | 'denied';

/**
 * Permission request kinds
 */
export type PermissionKind = 'shell' | 'write' | 'mcp' | 'read' | 'url';

/**
 * Permission result kinds
 */
export type PermissionResultKind =
  | 'approved'
  | 'denied-by-rules'
  | 'denied-no-approval-rule-and-could-not-request-from-user'
  | 'denied-interactively-by-user';

// ============================================================================
// Client Options
// ============================================================================

/**
 * Options for creating a CopilotClient
 */
export interface CopilotClientOptions {
  /** Path to the Copilot CLI executable */
  cliPath?: string;
  /** Extra arguments to pass to the CLI */
  cliArgs?: string[];
  /** Working directory for the CLI process */
  cwd?: string;
  /** Port for TCP mode */
  port?: number;
  /** Use stdio transport instead of TCP */
  useStdio?: boolean;
  /** URL of existing Copilot CLI server */
  cliUrl?: string;
  /** Log level for the CLI server */
  logLevel?: LogLevel;
  /** Auto-start the CLI server on first use */
  autoStart?: boolean;
  /** Auto-restart if CLI crashes */
  autoRestart?: boolean;
  /** Environment variables for CLI process */
  env?: Record<string, string | undefined>;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Binary result from a tool
 */
export interface ToolBinaryResult {
  data: string;
  mimeType: string;
  type: string;
  description?: string;
}

/**
 * Structured tool result
 */
export interface ToolResultObject {
  textResultForLlm: string;
  binaryResultsForLlm?: ToolBinaryResult[];
  resultType: ToolResultType;
  error?: string;
  sessionLog?: string;
  toolTelemetry?: Record<string, unknown>;
}

/**
 * Tool result can be string or object
 */
export type ToolResult = string | ToolResultObject;

/**
 * Information passed to tool handler
 */
export interface ToolInvocation {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
}

/**
 * Tool handler function type
 */
export type ToolHandler<TArgs = unknown> = (
  args: TArgs,
  invocation: ToolInvocation
) => Promise<unknown> | unknown;

/**
 * Tool definition for the Copilot SDK
 */
export interface ToolDefinition<TArgs = unknown> {
  name: string;
  description?: string;
  parameters?: z.ZodType<TArgs> | Record<string, unknown>;
  handler: ToolHandler<TArgs>;
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

/**
 * Base MCP server configuration
 */
interface McpServerConfigBase {
  /** List of tools to include. [] = none, "*" = all */
  tools: string[] | '*';
  /** Server type */
  type?: 'local' | 'stdio' | 'http' | 'sse';
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Local/stdio MCP server configuration
 */
export interface McpLocalServerConfig extends McpServerConfigBase {
  type?: 'local' | 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Remote MCP server configuration (HTTP/SSE)
 */
export interface McpRemoteServerConfig extends McpServerConfigBase {
  type: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

/**
 * Union type for MCP server configurations
 */
export type McpServerConfig = McpLocalServerConfig | McpRemoteServerConfig;

// ============================================================================
// Custom Agent Configuration
// ============================================================================

/**
 * Configuration for a custom agent
 */
export interface CustomAgentConfig {
  /** Unique name */
  name: string;
  /** Display name for UI */
  displayName?: string;
  /** Description of what the agent does */
  description?: string;
  /** List of tool names the agent can use (null = all) */
  tools?: string[] | null;
  /** System prompt for the agent */
  prompt: string;
  /** MCP servers specific to this agent */
  mcpServers?: Record<string, McpServerConfig>;
  /** Whether available for model inference */
  infer?: boolean;
}

// ============================================================================
// Permission Handling
// ============================================================================

/**
 * Permission request from the server
 */
export interface PermissionRequest {
  kind: PermissionKind;
  toolCallId?: string;
  [key: string]: unknown;
}

/**
 * Permission request result
 */
export interface PermissionRequestResult {
  kind: PermissionResultKind;
  rules?: unknown[];
}

/**
 * Permission handler function
 */
export type PermissionHandler = (
  request: PermissionRequest,
  invocation: { sessionId: string }
) => Promise<PermissionRequestResult> | PermissionRequestResult;

// ============================================================================
// System Message Configuration
// ============================================================================

/**
 * Append mode: SDK foundation + optional custom content
 */
export interface SystemMessageAppendConfig {
  mode?: 'append';
  content?: string;
}

/**
 * Replace mode: Full control over system message
 */
export interface SystemMessageReplaceConfig {
  mode: 'replace';
  content: string;
}

/**
 * System message configuration
 */
export type SystemMessageConfig = SystemMessageAppendConfig | SystemMessageReplaceConfig;

// ============================================================================
// Provider Configuration (BYOK)
// ============================================================================

/**
 * Custom API provider configuration
 */
export interface ProviderConfig {
  type?: 'openai' | 'azure' | 'anthropic';
  wireApi?: 'completions' | 'responses';
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  azure?: {
    apiVersion?: string;
  };
}

// ============================================================================
// Infinite Session Configuration
// ============================================================================

/**
 * Configuration for infinite sessions with auto-compaction
 */
export interface InfiniteSessionConfig {
  enabled?: boolean;
  backgroundCompactionThreshold?: number;
  bufferExhaustionThreshold?: number;
}

// ============================================================================
// Session Configuration
// ============================================================================

/**
 * Configuration for creating a session
 */
export interface SessionConfig {
  /** Optional custom session ID */
  sessionId?: string;
  /** Model to use */
  model?: string;
  /** Override config directory */
  configDir?: string;
  /** Tools exposed to the CLI */
  tools?: ToolDefinition[];
  /** System message configuration */
  systemMessage?: SystemMessageConfig;
  /** List of tool names to allow */
  availableTools?: string[];
  /** List of tool names to disable */
  excludedTools?: string[];
  /** Custom provider (BYOK) */
  provider?: ProviderConfig;
  /** Permission handler */
  onPermissionRequest?: PermissionHandler;
  /** Enable streaming */
  streaming?: boolean;
  /** MCP server configurations */
  mcpServers?: Record<string, McpServerConfig>;
  /** Custom agent configurations */
  customAgents?: CustomAgentConfig[];
  /** Directories to load skills from */
  skillDirectories?: string[];
  /** List of skill names to disable */
  disabledSkills?: string[];
  /** Infinite session configuration */
  infiniteSessions?: InfiniteSessionConfig;
}

/**
 * Configuration for resuming a session
 */
export type ResumeSessionConfig = Pick<
  SessionConfig,
  | 'tools'
  | 'provider'
  | 'streaming'
  | 'onPermissionRequest'
  | 'mcpServers'
  | 'customAgents'
  | 'skillDirectories'
  | 'disabledSkills'
>;

// ============================================================================
// Message Options
// ============================================================================

/**
 * File or directory attachment
 */
export interface Attachment {
  type: 'file' | 'directory';
  path: string;
  displayName?: string;
}

/**
 * Options for sending a message
 */
export interface MessageOptions {
  prompt: string;
  attachments?: Attachment[];
  mode?: 'enqueue' | 'immediate';
}

// ============================================================================
// Session Events
// ============================================================================

/**
 * Base session event
 */
export interface SessionEventBase {
  id: string;
  timestamp: string;
  parentId: string | null;
  ephemeral?: boolean;
}

/**
 * Assistant message event
 */
export interface AssistantMessageEvent extends SessionEventBase {
  type: 'assistant.message';
  data: {
    messageId: string;
    content: string;
    toolRequests?: Array<{
      toolCallId: string;
      name: string;
      arguments?: unknown;
    }>;
  };
}

/**
 * Assistant message delta (streaming)
 */
export interface AssistantMessageDeltaEvent extends SessionEventBase {
  type: 'assistant.message_delta';
  data: {
    deltaContent: string;
    messageId?: string;
  };
}

/**
 * User message event
 */
export interface UserMessageEvent extends SessionEventBase {
  type: 'user.message';
  data: {
    content: string;
    attachments?: Attachment[];
  };
}

/**
 * Tool result event
 */
export interface ToolResultEvent extends SessionEventBase {
  type: 'tool.result';
  data: {
    toolCallId: string;
    toolName: string;
    result: ToolResult;
  };
}

/**
 * Session idle event
 */
export interface SessionIdleEvent extends SessionEventBase {
  type: 'session.idle';
  data: Record<string, never>;
}

/**
 * Session error event
 */
export interface SessionErrorEvent extends SessionEventBase {
  type: 'session.error';
  data: {
    message: string;
    code?: string;
  };
}

/**
 * Union of all session events
 */
export type SessionEvent =
  | AssistantMessageEvent
  | AssistantMessageDeltaEvent
  | UserMessageEvent
  | ToolResultEvent
  | SessionIdleEvent
  | SessionErrorEvent;

/**
 * Session event handler
 */
export type SessionEventHandler = (event: SessionEvent) => void;

// ============================================================================
// Model Information
// ============================================================================

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  supports: {
    vision: boolean;
  };
  limits: {
    max_prompt_tokens?: number;
    max_context_window_tokens: number;
    vision?: {
      supported_media_types: string[];
      max_prompt_images: number;
      max_prompt_image_size: number;
    };
  };
}

/**
 * Model policy state
 */
export interface ModelPolicy {
  state: 'enabled' | 'disabled' | 'unconfigured';
  terms: string;
}

/**
 * Model billing info
 */
export interface ModelBilling {
  multiplier: number;
}

/**
 * Information about an available model
 */
export interface ModelInfo {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  policy?: ModelPolicy;
  billing?: ModelBilling;
}

// ============================================================================
// Session Metadata
// ============================================================================

/**
 * Metadata about a session
 */
export interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  modifiedTime: Date;
  summary?: string;
  isRemote: boolean;
}

// ============================================================================
// Status Responses
// ============================================================================

/**
 * CLI status response
 */
export interface StatusResponse {
  version: string;
  protocolVersion: number;
}

/**
 * Authentication status response
 */
export interface AuthStatusResponse {
  isAuthenticated: boolean;
  authType?: 'user' | 'env' | 'gh-cli' | 'hmac' | 'api-key' | 'token';
  host?: string;
  login?: string;
  statusMessage?: string;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result from a Copilot query
 */
export interface CopilotResult {
  /** Response content */
  content: string;
  /** Session ID for resumption */
  sessionId: string;
  /** All events from the session */
  events: SessionEvent[];
  /** Tool requests made during the session */
  toolRequests?: Array<{
    toolCallId: string;
    name: string;
    arguments?: unknown;
  }>;
}

/**
 * Streaming callback
 */
export type StreamCallback = (chunk: string, event: SessionEvent) => void | Promise<void>;

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const McpLocalServerConfigSchema = z.object({
  type: z.enum(['local', 'stdio']).optional(),
  tools: z.union([z.array(z.string()), z.literal('*')]),
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().optional(),
});

export const McpRemoteServerConfigSchema = z.object({
  type: z.enum(['http', 'sse']),
  tools: z.union([z.array(z.string()), z.literal('*')]),
  url: z.string(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().optional(),
});

export const McpServerConfigSchema = z.union([McpLocalServerConfigSchema, McpRemoteServerConfigSchema]);

export const CustomAgentConfigSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  tools: z.union([z.array(z.string()), z.null()]).optional(),
  prompt: z.string(),
  mcpServers: z.record(McpServerConfigSchema).optional(),
  infer: z.boolean().optional(),
});

export const ProviderConfigSchema = z.object({
  type: z.enum(['openai', 'azure', 'anthropic']).optional(),
  wireApi: z.enum(['completions', 'responses']).optional(),
  baseUrl: z.string(),
  apiKey: z.string().optional(),
  bearerToken: z.string().optional(),
  azure: z
    .object({
      apiVersion: z.string().optional(),
    })
    .optional(),
});

export const SessionConfigSchema = z.object({
  sessionId: z.string().optional(),
  model: z.string().optional(),
  configDir: z.string().optional(),
  systemMessage: z
    .union([
      z.object({ mode: z.literal('append').optional(), content: z.string().optional() }),
      z.object({ mode: z.literal('replace'), content: z.string() }),
    ])
    .optional(),
  availableTools: z.array(z.string()).optional(),
  excludedTools: z.array(z.string()).optional(),
  provider: ProviderConfigSchema.optional(),
  streaming: z.boolean().optional(),
  mcpServers: z.record(McpServerConfigSchema).optional(),
  customAgents: z.array(CustomAgentConfigSchema).optional(),
  skillDirectories: z.array(z.string()).optional(),
  disabledSkills: z.array(z.string()).optional(),
  infiniteSessions: z
    .object({
      enabled: z.boolean().optional(),
      backgroundCompactionThreshold: z.number().optional(),
      bufferExhaustionThreshold: z.number().optional(),
    })
    .optional(),
});
