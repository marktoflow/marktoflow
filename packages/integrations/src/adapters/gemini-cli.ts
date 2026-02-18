/**
 * Google Gemini CLI Adapter for marktoflow
 *
 * Provides integration with Google's Gemini API using either:
 * - OAuth credentials extracted from the installed gemini-cli binary
 * - Direct API key authentication
 *
 * Follows the OllamaClient / OpenAIClient adapter pattern.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { refreshAccessToken, parseGeminiAuth } from './gemini-cli-oauth.js';
import type {
  GeminiCliClientConfig,
  GeminiCliChatOptions,
  GeminiCliChatResult,
  GeminiCliStreamCallback,
  GeminiCliModelInfo,
  GeminiCliChatMessage,
  GeminiCliAuthConfig,
  GeminiCliOAuthConfig,
} from './gemini-cli-types.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// ============================================================================
// Gemini CLI Client
// ============================================================================

export class GeminiCliClient {
  private auth: GeminiCliAuthConfig;
  private defaultModel: string;
  private baseUrl: string;
  private timeout: number;
  // Mutable OAuth state for token refresh
  private accessToken?: string;
  private expiresAt?: number;

  constructor(config: GeminiCliClientConfig) {
    this.auth = config.auth;
    this.defaultModel = config.model || DEFAULT_MODEL;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || 60000;

    if (config.auth.mode === 'oauth') {
      this.accessToken = config.auth.accessToken;
      this.expiresAt = config.auth.expiresAt;
    }
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.auth.mode === 'api_key') {
      headers['x-goog-api-key'] = this.auth.apiKey;
    } else {
      const token = await this.ensureAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.auth.mode !== 'oauth') {
      throw new Error('ensureAccessToken called in non-OAuth mode');
    }

    const oauthConfig = this.auth as GeminiCliOAuthConfig;

    if (this.accessToken && this.expiresAt && Date.now() < this.expiresAt) {
      return this.accessToken;
    }

    const result = await refreshAccessToken(
      oauthConfig.refreshToken,
      oauthConfig.clientId,
      oauthConfig.clientSecret,
    );
    this.accessToken = result.accessToken;
    this.expiresAt = result.expiresAt;
    return result.accessToken;
  }

  // ============================================================================
  // Simple Interface
  // ============================================================================

  /**
   * Generate text from a prompt (simple interface)
   */
  async generate(prompt: string, model?: string): Promise<string> {
    const result = await this.chat({
      model,
      messages: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return result.content;
  }

  // ============================================================================
  // Chat Interface
  // ============================================================================

  /**
   * Chat completion
   */
  async chat(options: GeminiCliChatOptions): Promise<GeminiCliChatResult> {
    const model = options.model || this.defaultModel;
    const headers = await this.getHeaders();
    const url = this.buildUrl(model, 'generateContent');

    const body = this.buildRequestBody(options);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('') || '';

    const { content, thinking } = this.parseThinking(text);

    return {
      content,
      model,
      done: true,
      thinking,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      } : undefined,
      raw: data,
    };
  }

  /**
   * Stream chat completion
   */
  async *chatStream(options: GeminiCliChatOptions): AsyncGenerator<string> {
    const model = options.model || this.defaultModel;
    const headers = await this.getHeaders();
    const url = this.buildUrl(model, 'streamGenerateContent') + '&alt=sse';

    const body = this.buildRequestBody(options);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const text = data.candidates?.[0]?.content?.parts
            ?.map((p) => p.text || '')
            .join('') || '';
          if (text) {
            yield text;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * Chat with streaming callback
   */
  async chatWithCallback(
    options: GeminiCliChatOptions,
    callback: GeminiCliStreamCallback,
  ): Promise<GeminiCliChatResult> {
    let fullResponse = '';
    const model = options.model || this.defaultModel;

    for await (const chunk of this.chatStream(options)) {
      fullResponse += chunk;
      await Promise.resolve(callback(chunk, false));
    }

    await Promise.resolve(callback('', true));

    const { content, thinking } = this.parseThinking(fullResponse);
    return {
      content,
      model,
      done: true,
      thinking,
    };
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * List available models
   */
  async listModels(): Promise<GeminiCliModelInfo[]> {
    const headers = await this.getHeaders();
    const url = `${this.baseUrl}/models`;

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = (await response.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        description?: string;
        inputTokenLimit?: number;
        outputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }>;
    };

    return (data.models || []).map((m) => ({
      name: m.name?.replace('models/', '') || '',
      displayName: m.displayName || '',
      description: m.description,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
      supportedGenerationMethods: m.supportedGenerationMethods,
    }));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getDefaultModel(): string {
    return this.defaultModel;
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  /**
   * Parse thinking content from <think> tags in model output
   */
  parseThinking(text: string): { content: string; thinking?: string } {
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
    if (!thinkMatch) {
      return { content: text };
    }
    const thinking = thinkMatch[1].trim();
    const content = text.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    return { content, thinking };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildUrl(model: string, method: string): string {
    const separator = this.baseUrl.includes('?') ? '&' : '?';
    if (this.auth.mode === 'api_key') {
      return `${this.baseUrl}/models/${model}:${method}?key=${this.auth.apiKey}`;
    }
    return `${this.baseUrl}/models/${model}:${method}${separator}`;
  }

  private buildRequestBody(options: GeminiCliChatOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      contents: options.messages,
    };

    if (options.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.topP !== undefined) generationConfig.topP = options.topP;
    if (options.topK !== undefined) generationConfig.topK = options.topK;
    if (options.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = options.maxOutputTokens;
    if (options.stopSequences?.length) generationConfig.stopSequences = options.stopSequences;

    if (Object.keys(generationConfig).length > 0) {
      body.generationConfig = generationConfig;
    }

    return body;
  }

  // ============================================================================
  // OpenAI-Compatible Interface
  // ============================================================================

  chatCompletions = {
    create: async (inputs: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{ choices: Array<{ message: { role: string; content: string } }> }> => {
      const messages: GeminiCliChatMessage[] = inputs.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Extract system message if present
      const systemMsg = inputs.messages.find((m) => m.role === 'system');
      const nonSystemMessages = messages.filter(
        (_, i) => inputs.messages[i].role !== 'system',
      );

      const result = await this.chat({
        model: inputs.model || this.defaultModel,
        messages: nonSystemMessages,
        systemInstruction: systemMsg?.content,
      });

      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: result.content,
            },
          },
        ],
      };
    },
  };
}

// ============================================================================
// SDK Initializer for marktoflow Registry
// ============================================================================

export const GeminiCliInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const auth = config.auth || {};
    const options = config.options || {};

    const parsedAuth = parseGeminiAuth(auth as Record<string, unknown>);
    const model = (options['model'] as string) || DEFAULT_MODEL;

    return new GeminiCliClient({
      auth: parsedAuth,
      model,
      timeout: options['timeout'] as number | undefined,
      baseUrl: options['baseUrl'] as string | undefined,
    });
  },
};
