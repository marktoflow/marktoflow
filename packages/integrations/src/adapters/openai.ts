/**
 * OpenAI SDK Adapter for marktoflow
 *
 * This adapter provides integration with OpenAI-compatible APIs,
 * including OpenAI, VLLM, and other local/remote endpoints that
 * implement the OpenAI API specification.
 */

import OpenAI from 'openai';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import type {
  OpenAIClientConfig,
  OpenAIChatOptions,
  OpenAIChatResult,
  OpenAIEmbeddingOptions,
  OpenAIEmbeddingResult,
} from './openai-types.js';

// ============================================================================
// OpenAI Client
// ============================================================================

export class OpenAIClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAIClientConfig = {}) {
    // For VLLM/local endpoints, a dummy key is needed since the SDK requires non-empty string
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY || 'dummy-key';

    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      organization: config.organization,
      timeout: config.timeout || 60000,
    });

    this.defaultModel = config.model || 'gpt-4o';
  }

  // --------------------------------------------------------------------------
  // Generation
  // --------------------------------------------------------------------------

  /**
   * Simple text generation from a prompt
   */
  async generate(inputs: { prompt: string; model?: string } | string, model?: string): Promise<string> {
    const prompt = typeof inputs === 'string' ? inputs : inputs.prompt;
    const selectedModel = typeof inputs === 'object' && inputs.model ? inputs.model : model || this.defaultModel;

    const response = await this.client.chat.completions.create({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || '';
  }

  // --------------------------------------------------------------------------
  // Chat Completions
  // --------------------------------------------------------------------------

  /**
   * Full chat completion with all options
   */
  async chatCompletion(options: OpenAIChatOptions): Promise<OpenAIChatResult> {
    const model = options.model || this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages: options.messages as OpenAI.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      n: options.n,
      stop: options.stop,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
    });

    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice, index) => ({
        index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
        },
        finish_reason: choice.finish_reason || 'stop',
      })),
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(
    options: OpenAIChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.defaultModel;

    const stream = await this.client.chat.completions.create({
      model,
      messages: options.messages as OpenAI.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Embeddings
  // --------------------------------------------------------------------------

  /**
   * Create embeddings for text input
   */
  async embeddings(options: OpenAIEmbeddingOptions): Promise<OpenAIEmbeddingResult> {
    const model = options.model || 'text-embedding-3-small';

    const response = await this.client.embeddings.create({
      model,
      input: options.input,
    });

    return {
      object: response.object,
      data: response.data.map((item) => ({
        object: item.object,
        embedding: item.embedding,
        index: item.index,
      })),
      model: response.model,
      usage: {
        prompt_tokens: response.usage.prompt_tokens,
        total_tokens: response.usage.total_tokens,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Models
  // --------------------------------------------------------------------------

  /**
   * List available models
   */
  async listModels(): Promise<Array<{ id: string; owned_by: string }>> {
    const response = await this.client.models.list();
    const models: Array<{ id: string; owned_by: string }> = [];
    for await (const model of response) {
      models.push({ id: model.id, owned_by: model.owned_by });
    }
    return models;
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  /**
   * Check if the API endpoint is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  // --------------------------------------------------------------------------
  // OpenAI-Compatible Interface (for workflow compatibility)
  // --------------------------------------------------------------------------

  /**
   * OpenAI-compatible chat.completions interface
   */
  chat = {
    completions: async (inputs: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    }): Promise<{ choices: Array<{ message: { content: string } }> }> => {
      const response = await this.client.chat.completions.create({
        model: inputs.model || this.defaultModel,
        messages: inputs.messages as OpenAI.ChatCompletionMessageParam[],
        temperature: inputs.temperature,
        max_tokens: inputs.max_tokens,
      });

      return {
        choices: response.choices.map((choice) => ({
          message: {
            content: choice.message.content || '',
          },
        })),
      };
    },
  };
}

// ============================================================================
// SDK Initializer
// ============================================================================

export const OpenAIInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<OpenAIClient> {
    const auth = config.auth || {};
    const options = config.options || {};

    return new OpenAIClient({
      baseUrl: (auth['base_url'] as string) || (options['baseUrl'] as string),
      apiKey: (auth['api_key'] as string) || (options['apiKey'] as string),
      model: options['model'] as string,
      organization: options['organization'] as string,
      timeout: options['timeout'] as number,
    });
  },
};
