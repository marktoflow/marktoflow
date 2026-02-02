/**
 * Type definitions for Ollama SDK integration with marktoflow
 *
 * These types enable integration with Ollama for local LLM workflows
 * with generation, chat, embeddings, and model management capabilities.
 */

import { z } from 'zod';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for Ollama client
 */
export interface OllamaClientConfig {
  /** Ollama server host URL (default: http://127.0.0.1:11434) */
  host?: string;
  /** Default model to use for operations */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for generate operations
 */
export interface OllamaGenerateOptions {
  /** The model to use */
  model?: string;
  /** The prompt to generate from */
  prompt: string;
  /** System prompt for context */
  system?: string;
  /** Template to use for generation */
  template?: string;
  /** Context from previous generation */
  context?: number[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Raw mode (no formatting) */
  raw?: boolean;
  /** Format for response (e.g., 'json') */
  format?: string;
  /** Images for multimodal models (base64 encoded) */
  images?: string[];
  /** Generation options */
  options?: OllamaModelOptions;
  /** Keep alive duration */
  keep_alive?: string | number;
}

/**
 * Options for chat operations
 */
export interface OllamaChatOptions {
  /** The model to use */
  model?: string;
  /** Array of messages for the conversation */
  messages: OllamaChatMessage[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Format for response (e.g., 'json') */
  format?: string;
  /** Generation options */
  options?: OllamaModelOptions;
  /** Keep alive duration */
  keep_alive?: string | number;
  /** Tools for function calling */
  tools?: OllamaTool[];
}

/**
 * Chat message structure
 */
export interface OllamaChatMessage {
  /** Role of the message sender */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message content */
  content: string;
  /** Images for multimodal models (base64 encoded) */
  images?: string[];
  /** Tool calls (for assistant messages) */
  tool_calls?: OllamaToolCall[];
}

/**
 * Tool definition for function calling
 */
export interface OllamaTool {
  /** Tool type */
  type: 'function';
  /** Function definition */
  function: {
    /** Function name */
    name: string;
    /** Function description */
    description: string;
    /** Parameter schema */
    parameters: {
      type: 'object';
      properties: {
        [key: string]: {
          type?: string | string[];
          items?: unknown;
          description?: string;
          enum?: unknown[];
        };
      };
      required?: string[];
    };
  };
}

/**
 * Tool call structure
 */
export interface OllamaToolCall {
  /** Tool call ID */
  id?: string;
  /** Tool type */
  type?: 'function';
  /** Function details */
  function: {
    /** Function name */
    name: string;
    /** Function arguments as object (matching ollama SDK) */
    arguments: { [key: string]: unknown };
  };
}

/**
 * Model options for fine-tuning generation
 */
export interface OllamaModelOptions {
  /** Number of tokens to predict (default: 128, -1 = infinite, -2 = fill context) */
  num_predict?: number;
  /** Temperature for sampling (higher = more random) */
  temperature?: number;
  /** Top-k sampling */
  top_k?: number;
  /** Top-p (nucleus) sampling */
  top_p?: number;
  /** Repeat penalty */
  repeat_penalty?: number;
  /** Repeat last n tokens for penalty */
  repeat_last_n?: number;
  /** Random seed */
  seed?: number;
  /** Stop sequences */
  stop?: string[];
  /** Context window size */
  num_ctx?: number;
  /** Number of GPUs to use */
  num_gpu?: number;
  /** Main GPU index */
  main_gpu?: number;
  /** Use MMAP */
  use_mmap?: boolean;
  /** Use MLock */
  use_mlock?: boolean;
  /** Number of threads */
  num_thread?: number;
}

/**
 * Options for embeddings operations
 */
export interface OllamaEmbeddingsOptions {
  /** The model to use for embeddings */
  model?: string;
  /** Text or array of texts to embed */
  input: string | string[];
  /** Truncate input to fit context length */
  truncate?: boolean;
  /** Generation options */
  options?: OllamaModelOptions;
  /** Keep alive duration */
  keep_alive?: string | number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Result from generation operations
 */
export interface OllamaGenerateResult {
  /** Generated text response */
  response: string;
  /** Model used */
  model: string;
  /** Creation timestamp (Date from ollama SDK) */
  created_at: Date;
  /** Whether generation is complete */
  done: boolean;
  /** Reason for completion */
  done_reason?: string;
  /** Context for subsequent generations */
  context?: number[];
  /** Total generation duration in nanoseconds */
  total_duration?: number;
  /** Model loading duration in nanoseconds */
  load_duration?: number;
  /** Prompt evaluation count */
  prompt_eval_count?: number;
  /** Prompt evaluation duration in nanoseconds */
  prompt_eval_duration?: number;
  /** Generation evaluation count */
  eval_count?: number;
  /** Generation evaluation duration in nanoseconds */
  eval_duration?: number;
}

/**
 * Result from chat operations
 */
export interface OllamaChatResult {
  /** The model used */
  model: string;
  /** Creation timestamp (Date from ollama SDK) */
  created_at: Date;
  /** The assistant's message */
  message: OllamaChatMessage;
  /** Whether chat is complete */
  done: boolean;
  /** Reason for completion */
  done_reason?: string;
  /** Total duration in nanoseconds */
  total_duration?: number;
  /** Model loading duration in nanoseconds */
  load_duration?: number;
  /** Prompt evaluation count */
  prompt_eval_count?: number;
  /** Prompt evaluation duration in nanoseconds */
  prompt_eval_duration?: number;
  /** Generation evaluation count */
  eval_count?: number;
  /** Generation evaluation duration in nanoseconds */
  eval_duration?: number;
}

/**
 * Result from embeddings operations
 */
export interface OllamaEmbeddingsResult {
  /** The model used */
  model: string;
  /** Array of embedding vectors */
  embeddings: number[][];
  /** Total duration in nanoseconds */
  total_duration?: number;
  /** Model loading duration in nanoseconds */
  load_duration?: number;
  /** Prompt evaluation count */
  prompt_eval_count?: number;
}

/**
 * Model information
 */
export interface OllamaModelInfo {
  /** Model name */
  name: string;
  /** Model digest */
  digest: string;
  /** Model size in bytes */
  size: number;
  /** Last modified timestamp (Date from ollama SDK) */
  modified_at: Date;
  /** Model details */
  details?: {
    /** Parent model */
    parent_model?: string;
    /** Model format */
    format?: string;
    /** Model family */
    family?: string;
    /** Model families */
    families?: string[];
    /** Parameter size */
    parameter_size?: string;
    /** Quantization level */
    quantization_level?: string;
  };
}

/**
 * Running model information
 */
export interface OllamaRunningModel {
  /** Model name */
  name: string;
  /** Model digest */
  digest: string;
  /** Model size in bytes */
  size: number;
  /** Size in VRAM */
  size_vram: number;
  /** Expiration time (Date from ollama SDK) */
  expires_at: Date;
  /** Model details */
  details?: {
    /** Parent model */
    parent_model?: string;
    /** Model format */
    format?: string;
    /** Model family */
    family?: string;
    /** Model families */
    families?: string[];
    /** Parameter size */
    parameter_size?: string;
    /** Quantization level */
    quantization_level?: string;
  };
}

/**
 * Model pull progress
 */
export interface OllamaPullProgress {
  /** Status message */
  status: string;
  /** Current digest being downloaded */
  digest?: string;
  /** Total bytes */
  total?: number;
  /** Completed bytes */
  completed?: number;
}

// ============================================================================
// Unified Result Type
// ============================================================================

/**
 * Unified result from Ollama operations
 */
export interface OllamaResult {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Whether operation completed */
  done: boolean;
  /** Raw response data */
  raw?: OllamaGenerateResult | OllamaChatResult;
  /** Duration in milliseconds */
  duration?: number;
  /** Token usage */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Streaming callback
 */
export type OllamaStreamCallback = (chunk: string, done: boolean) => void | Promise<void>;

// ============================================================================
// Workflow Configuration
// ============================================================================

/**
 * Configuration for Ollama in workflow YAML
 */
export interface OllamaWorkflowConfig {
  /** Ollama server host */
  host?: string;
  /** Default model */
  model?: string;
  /** Request timeout */
  timeout?: number;
  /** Default model options */
  options?: OllamaModelOptions;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const OllamaModelOptionsSchema = z.object({
  num_predict: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_k: z.number().optional(),
  top_p: z.number().min(0).max(1).optional(),
  repeat_penalty: z.number().optional(),
  repeat_last_n: z.number().optional(),
  seed: z.number().optional(),
  stop: z.array(z.string()).optional(),
  num_ctx: z.number().optional(),
  num_gpu: z.number().optional(),
  main_gpu: z.number().optional(),
  use_mmap: z.boolean().optional(),
  use_mlock: z.boolean().optional(),
  num_thread: z.number().optional(),
});

export const OllamaClientConfigSchema = z.object({
  host: z.string().optional(),
  model: z.string().optional(),
  timeout: z.number().optional(),
});

export const OllamaChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  images: z.array(z.string()).optional(),
});

export const OllamaGenerateOptionsSchema = z.object({
  model: z.string().optional(),
  prompt: z.string(),
  system: z.string().optional(),
  template: z.string().optional(),
  context: z.array(z.number()).optional(),
  stream: z.boolean().optional(),
  raw: z.boolean().optional(),
  format: z.string().optional(),
  images: z.array(z.string()).optional(),
  options: OllamaModelOptionsSchema.optional(),
  keep_alive: z.union([z.string(), z.number()]).optional(),
});

export const OllamaChatOptionsSchema = z.object({
  model: z.string().optional(),
  messages: z.array(OllamaChatMessageSchema),
  stream: z.boolean().optional(),
  format: z.string().optional(),
  options: OllamaModelOptionsSchema.optional(),
  keep_alive: z.union([z.string(), z.number()]).optional(),
});

export const OllamaEmbeddingsOptionsSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string())]),
  truncate: z.boolean().optional(),
  options: OllamaModelOptionsSchema.optional(),
  keep_alive: z.union([z.string(), z.number()]).optional(),
});
