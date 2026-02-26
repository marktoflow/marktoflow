/**
 * Type definitions for OpenAI SDK integration with marktoflow
 *
 * These types enable integration with OpenAI-compatible APIs including
 * OpenAI, VLLM, llama.cpp, and other local/remote endpoints.
 * Includes full tool calling and structured output support.
 */

import { z } from 'zod';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for OpenAI client
 */
export interface OpenAIClientConfig {
  /** Base URL for the API (default: https://api.openai.com/v1) */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Default model to use */
  model?: string;
  /** Organization ID */
  organization?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Tool Calling Types
// ============================================================================

/**
 * Function definition for tool calling
 */
export interface OpenAIToolFunction {
  /** The name of the function */
  name: string;
  /** A description of what the function does */
  description?: string;
  /** JSON Schema for the function parameters */
  parameters?: Record<string, unknown>;
  /** Whether to enforce strict schema validation */
  strict?: boolean;
}

/**
 * Tool definition
 */
export interface OpenAITool {
  /** The type of tool (currently only 'function') */
  type: 'function';
  /** The function definition */
  function: OpenAIToolFunction;
}

/**
 * A tool call requested by the model
 */
export interface OpenAIToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** The type of tool call */
  type: 'function';
  /** The function to call */
  function: {
    /** The name of the function to call */
    name: string;
    /** JSON-encoded arguments for the function */
    arguments: string;
  };
}

/**
 * Tool choice configuration
 */
export type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } };

/**
 * Response format configuration
 */
export type OpenAIResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };

// ============================================================================
// Message Types
// ============================================================================

/**
 * Chat message format — supports all message roles including tool messages
 */
export type OpenAIChatMessage =
  | { role: 'system'; content: string; name?: string }
  | { role: 'user'; content: string | OpenAIContentPart[]; name?: string }
  | { role: 'assistant'; content: string | null; name?: string; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

/**
 * Content part for multimodal messages
 */
export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

// ============================================================================
// Chat Options & Results
// ============================================================================

/**
 * Options for chat completion
 */
export interface OpenAIChatOptions {
  /** Model to use */
  model?: string;
  /** Messages for the conversation */
  messages: OpenAIChatMessage[];
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Max tokens to generate */
  max_tokens?: number;
  /** Top-p sampling */
  top_p?: number;
  /** Number of completions to generate */
  n?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** Frequency penalty (-2 to 2) */
  frequency_penalty?: number;
  /** Presence penalty (-2 to 2) */
  presence_penalty?: number;
  /** Tools available for the model to call */
  tools?: OpenAITool[];
  /** Controls which tool the model calls */
  tool_choice?: OpenAIToolChoice;
  /** Response format (text, json_object, or json_schema) */
  response_format?: OpenAIResponseFormat;
}

/**
 * Chat completion result
 */
export interface OpenAIChatResult {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * A single choice in a chat completion result
 */
export interface OpenAIChatChoice {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
}

/**
 * Options for embeddings
 */
export interface OpenAIEmbeddingOptions {
  /** Model to use for embeddings */
  model?: string;
  /** Input text(s) to embed */
  input: string | string[];
}

/**
 * Embedding result
 */
export interface OpenAIEmbeddingResult {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Tool executor function type — called when the model requests a tool call
 */
export type OpenAIToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Options for the agentic tool calling loop
 */
export interface OpenAIToolLoopOptions extends OpenAIChatOptions {
  /** Tools are required for the tool loop */
  tools: OpenAITool[];
  /** Maximum number of tool-calling turns before stopping */
  maxTurns?: number;
  /** Called when a tool call is about to be executed */
  onToolCall?: (toolCall: OpenAIToolCall) => void;
  /** Called when a tool call returns a result */
  onToolResult?: (toolCall: OpenAIToolCall, result: unknown) => void;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const OpenAIClientConfigSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  organization: z.string().optional(),
  timeout: z.number().positive().optional(),
});

export const OpenAIToolFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  strict: z.boolean().optional(),
});

export const OpenAIToolSchema = z.object({
  type: z.literal('function'),
  function: OpenAIToolFunctionSchema,
});

export const OpenAIChatMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('system'),
    content: z.string(),
    name: z.string().optional(),
  }),
  z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(z.unknown())]),
    name: z.string().optional(),
  }),
  z.object({
    role: z.literal('assistant'),
    content: z.string().nullable(),
    name: z.string().optional(),
    tool_calls: z.array(z.object({
      id: z.string(),
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        arguments: z.string(),
      }),
    })).optional(),
  }),
  z.object({
    role: z.literal('tool'),
    content: z.string(),
    tool_call_id: z.string(),
  }),
]);

export const OpenAIChatOptionsSchema = z.object({
  model: z.string().optional(),
  messages: z.array(OpenAIChatMessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().positive().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  tools: z.array(OpenAIToolSchema).optional(),
  tool_choice: z.union([
    z.enum(['auto', 'none', 'required']),
    z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) }),
  ]).optional(),
  response_format: z.union([
    z.object({ type: z.literal('text') }),
    z.object({ type: z.literal('json_object') }),
    z.object({
      type: z.literal('json_schema'),
      json_schema: z.object({
        name: z.string(),
        schema: z.record(z.unknown()),
        strict: z.boolean().optional(),
      }),
    }),
  ]).optional(),
});

export const OpenAIEmbeddingOptionsSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string())]),
});
