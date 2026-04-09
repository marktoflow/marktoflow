/**
 * Type definitions for Google Gemini CLI integration with marktoflow
 *
 * Supports both OAuth (via gemini-cli credentials) and API key authentication.
 */

import { z } from 'zod';

// ============================================================================
// Authentication Types
// ============================================================================

export type GeminiCliAuthMode = 'oauth' | 'api_key';

export interface GeminiCliOAuthCredentials {
  access: string;
  refresh: string;
  expires: number;
  email?: string;
  projectId: string;
}

export interface GeminiCliOAuthConfig {
  mode: 'oauth';
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  projectId: string;
  clientId?: string;
  clientSecret?: string;
}

export interface GeminiCliApiKeyConfig {
  mode: 'api_key';
  apiKey: string;
}

export type GeminiCliAuthConfig = GeminiCliOAuthConfig | GeminiCliApiKeyConfig;

// ============================================================================
// Configuration Types
// ============================================================================

export interface GeminiCliClientConfig {
  /** Authentication configuration */
  auth: GeminiCliAuthConfig;
  /** Default model (default: gemini-2.5-flash) */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** API base URL override */
  baseUrl?: string;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface GeminiCliChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiCliChatOptions {
  /** Model to use */
  model?: string;
  /** Conversation messages */
  messages: GeminiCliChatMessage[];
  /** System instruction */
  systemInstruction?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

export interface GeminiCliChatResult {
  /** Response text */
  content: string;
  /** Model used */
  model: string;
  /** Whether generation completed */
  done: boolean;
  /** Thinking content (extracted from <think> tags) */
  thinking?: string;
  /** Token usage */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Raw API response */
  raw?: unknown;
}

export type GeminiCliStreamCallback = (chunk: string, done: boolean) => void | Promise<void>;

// ============================================================================
// Model Types
// ============================================================================

export interface GeminiCliModelInfo {
  name: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

// ============================================================================
// Workflow Configuration
// ============================================================================

export interface GeminiCliWorkflowConfig {
  /** Default model */
  model?: string;
  /** Request timeout */
  timeout?: number;
  /** Temperature */
  temperature?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const GeminiCliClientConfigSchema = z.object({
  model: z.string().optional(),
  timeout: z.number().optional(),
  baseUrl: z.string().optional(),
});

export const GeminiCliChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  parts: z.array(z.object({ text: z.string() })),
});

export const GeminiCliChatOptionsSchema = z.object({
  model: z.string().optional(),
  messages: z.array(GeminiCliChatMessageSchema),
  systemInstruction: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
});
