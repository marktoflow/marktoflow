/**
 * Google Gemini CLI Adapter for marktoflow
 *
 * Provides integration with Google's Gemini API using either:
 * - OAuth credentials extracted from the installed gemini-cli binary
 *   (uses the Cloud Code Assist endpoint: cloudcode-pa.googleapis.com/v1internal)
 * - Direct API key authentication
 *   (uses the standard Gemini API: generativelanguage.googleapis.com/v1beta)
 *
 * Follows the OllamaClient / OpenAIClient adapter pattern.
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { refreshAccessToken, parseGeminiAuth, discoverProject } from './gemini-cli-oauth.js';
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

/**
 * The Cloud Code Assist endpoint used by gemini-cli OAuth tokens.
 * OAuth tokens issued by gemini-cli only carry the `cloud-platform` scope,
 * which is accepted by this endpoint but NOT by generativelanguage.googleapis.com.
 */
const CODE_ASSIST_BASE_URL = 'https://cloudcode-pa.googleapis.com/v1internal';

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
      // Also resolve projectId if still empty (using the cached token)
      if (!oauthConfig.projectId) {
        oauthConfig.projectId = await discoverProject(this.accessToken);
      }
      return this.accessToken;
    }

    const result = await refreshAccessToken(
      oauthConfig.refreshToken,
      oauthConfig.clientId,
      oauthConfig.clientSecret
    );
    this.accessToken = result.accessToken;
    this.expiresAt = result.expiresAt;

    // Lazily discover the GCP project ID if not supplied in YAML
    if (!oauthConfig.projectId) {
      oauthConfig.projectId = await discoverProject(this.accessToken);
    }

    return result.accessToken;
  }

  // ============================================================================
  // Simple Interface
  // ============================================================================

  /**
   * Generate text from a prompt. Returns the generated text as a plain string.
   *
   * Accepts either a plain string or an inputs object from the workflow engine:
   *   { prompt: string, model?: string, temperature?: number, max_tokens?: number }
   *
   * Use `generateDetailed()` if you need the model name and usage metadata.
   */
  async generate(
    promptOrInputs: string | Record<string, unknown>,
    model?: string
  ): Promise<string> {
    const result = await this.generateDetailed(promptOrInputs, model);
    return result.text;
  }

  /**
   * Generate text from a prompt, returning a rich result with model name and
   * usage metadata in addition to the generated text.
   *
   * Accepts either a plain string or an inputs object from the workflow engine:
   *   { prompt: string, model?: string, temperature?: number, max_tokens?: number }
   */
  async generateDetailed(
    promptOrInputs: string | Record<string, unknown>,
    model?: string
  ): Promise<{
    text: string;
    model: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    let prompt: string;
    let resolvedModel: string | undefined = model;
    let temperature: number | undefined;
    let maxOutputTokens: number | undefined;

    if (typeof promptOrInputs === 'string') {
      prompt = promptOrInputs;
    } else {
      prompt = (promptOrInputs['prompt'] as string) || '';
      resolvedModel = (promptOrInputs['model'] as string | undefined) || model;
      temperature = promptOrInputs['temperature'] as number | undefined;
      maxOutputTokens = (promptOrInputs['max_tokens'] ?? promptOrInputs['maxOutputTokens']) as
        | number
        | undefined;
    }

    const result = await this.chat({
      model: resolvedModel,
      messages: [{ role: 'user', parts: [{ text: prompt }] }],
      temperature,
      maxOutputTokens,
    });
    return {
      text: result.content,
      model: result.model,
      usage: result.usage,
    };
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

    const raw = (await response.json()) as Record<string, unknown>;
    const data = this.unwrapResponse(raw);

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

    const { content, thinking } = this.parseThinking(text);

    return {
      content,
      model,
      done: true,
      thinking,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
      raw,
    };
  }

  /**
   * Stream chat completion
   */
  async *chatStream(options: GeminiCliChatOptions): AsyncGenerator<string> {
    const model = options.model || this.defaultModel;
    const headers = await this.getHeaders();
    const url = this.buildStreamUrl(model);

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
          const raw = JSON.parse(jsonStr) as Record<string, unknown>;
          // Code Assist SSE wraps candidates under "response"
          const data = this.unwrapResponse(raw);
          const text =
            data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
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
    callback: GeminiCliStreamCallback
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
   * List available models.
   * Only supported in API key mode. In OAuth (Code Assist) mode a static list
   * of well-known models is returned since the Code Assist endpoint does not
   * expose a model-listing API.
   */
  async listModels(): Promise<GeminiCliModelInfo[]> {
    if (this.isOAuth()) {
      return [
        {
          name: 'gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'gemini-2.0-flash',
          displayName: 'Gemini 2.0 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'gemini-1.5-pro',
          displayName: 'Gemini 1.5 Pro',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'gemini-1.5-flash',
          displayName: 'Gemini 1.5 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
      ];
    }

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

  /**
   * Returns true when using OAuth mode — in that case the Code Assist endpoint
   * is used instead of the standard generativelanguage.googleapis.com endpoint.
   */
  private isOAuth(): boolean {
    return this.auth.mode === 'oauth';
  }

  private buildUrl(model: string, method: string): string {
    if (this.isOAuth()) {
      // Code Assist: POST https://cloudcode-pa.googleapis.com/v1internal:generateContent
      const base = this.baseUrl !== DEFAULT_BASE_URL ? this.baseUrl : CODE_ASSIST_BASE_URL;
      return `${base}:${method}`;
    }
    // Standard API key: POST .../models/{model}:generateContent?key=...
    const apiKey = (this.auth as { apiKey: string }).apiKey;
    return `${this.baseUrl}/models/${model}:${method}?key=${apiKey}`;
  }

  private buildStreamUrl(model: string): string {
    if (this.isOAuth()) {
      const base = this.baseUrl !== DEFAULT_BASE_URL ? this.baseUrl : CODE_ASSIST_BASE_URL;
      return `${base}:streamGenerateContent?alt=sse`;
    }
    const apiKey = (this.auth as { apiKey: string }).apiKey;
    return `${this.baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  }

  private buildRequestBody(options: GeminiCliChatOptions): Record<string, unknown> {
    const model = options.model || this.defaultModel;

    // Inner request payload (same structure for both endpoints)
    const inner: Record<string, unknown> = {
      contents: options.messages,
    };

    if (options.systemInstruction) {
      if (this.isOAuth()) {
        // Code Assist uses snake_case for system instruction
        inner['system_instruction'] = { parts: [{ text: options.systemInstruction }] };
      } else {
        inner['systemInstruction'] = { parts: [{ text: options.systemInstruction }] };
      }
    }

    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.topP !== undefined) generationConfig.topP = options.topP;
    if (options.topK !== undefined) generationConfig.topK = options.topK;
    if (options.maxOutputTokens !== undefined)
      generationConfig.maxOutputTokens = options.maxOutputTokens;
    if (options.stopSequences?.length) generationConfig.stopSequences = options.stopSequences;

    if (Object.keys(generationConfig).length > 0) {
      inner['generationConfig'] = generationConfig;
    }

    if (this.isOAuth()) {
      // Code Assist wraps the request: { model, project, request: { contents, ... } }
      const oauthConfig = this.auth as GeminiCliOAuthConfig;
      return {
        model,
        project: oauthConfig.projectId,
        request: inner,
      };
    }

    return inner;
  }

  /**
   * Extract the candidates payload, handling both response shapes:
   * - Standard API:      { candidates: [...], usageMetadata: {...} }
   * - Code Assist OAuth: { response: { candidates: [...], usageMetadata: {...} }, traceId: ... }
   */
  private unwrapResponse(data: Record<string, unknown>): {
    candidates: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  } {
    if (this.isOAuth() && data['response']) {
      return data['response'] as ReturnType<typeof this.unwrapResponse>;
    }
    return data as ReturnType<typeof this.unwrapResponse>;
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
      const nonSystemMessages = messages.filter((_, i) => inputs.messages[i].role !== 'system');

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

    const parsedAuth = await parseGeminiAuth(auth as Record<string, unknown>);
    const model = (options['model'] as string) || DEFAULT_MODEL;

    return new GeminiCliClient({
      auth: parsedAuth,
      model,
      timeout: options['timeout'] as number | undefined,
      baseUrl: options['baseUrl'] as string | undefined,
    });
  },
};
