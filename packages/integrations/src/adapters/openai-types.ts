/**
 * Type definitions for OpenAI SDK integration with marktoflow
 *
 * These types enable integration with OpenAI-compatible APIs including
 * OpenAI, VLLM, and other local/remote endpoints.
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

/**
 * Chat message format
 */
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

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
}

/**
 * Chat completion result
 */
export interface OpenAIChatResult {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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

export const OpenAIChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
});

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
});

export const OpenAIEmbeddingOptionsSchema = z.object({
  model: z.string().optional(),
  input: z.union([z.string(), z.array(z.string())]),
});
