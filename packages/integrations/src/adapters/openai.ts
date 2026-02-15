/**
 * OpenAI SDK Adapter for marktoflow
 *
 * This adapter provides integration with OpenAI-compatible APIs,
 * including OpenAI, VLLM, llama.cpp, and other local/remote endpoints
 * that implement the OpenAI API specification.
 *
 * Supports:
 * - Chat completions (standard and streaming)
 * - Tool calling / function calling with agentic loop
 * - Structured output (JSON mode, JSON schema)
 * - Embeddings
 * - Model listing and discovery
 */

import OpenAI from 'openai';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import type {
  OpenAIClientConfig,
  OpenAIChatOptions,
  OpenAIChatResult,
  OpenAIChatChoice,
  OpenAIChatMessage,
  OpenAIEmbeddingOptions,
  OpenAIEmbeddingResult,
  OpenAIToolCall,
  OpenAIToolExecutor,
  OpenAIToolLoopOptions,
} from './openai-types.js';

// ============================================================================
// OpenAI Client
// ============================================================================

export class OpenAIClient {
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAIClientConfig = {}) {
    // For local endpoints (VLLM, llama.cpp), a dummy key is needed since the SDK requires non-empty string
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
   * Full chat completion with all options including tools and response_format
   */
  async chatCompletion(options: OpenAIChatOptions): Promise<OpenAIChatResult> {
    const model = options.model || this.defaultModel;

    // Build request parameters
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: options.messages as OpenAI.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      n: options.n,
      stop: options.stop,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools as OpenAI.ChatCompletionTool[];
      if (options.tool_choice) {
        params.tool_choice = options.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
      }
    }

    // Add response format if provided
    if (options.response_format) {
      params.response_format = options.response_format as OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema;
    }

    const response = await this.client.chat.completions.create(params);

    return this.mapResponse(response);
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(
    options: OpenAIChatOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.defaultModel;

    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model,
      messages: options.messages as OpenAI.ChatCompletionMessageParam[],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools as OpenAI.ChatCompletionTool[];
      if (options.tool_choice) {
        params.tool_choice = options.tool_choice as OpenAI.ChatCompletionToolChoiceOption;
      }
    }

    if (options.response_format) {
      params.response_format = options.response_format as OpenAI.ResponseFormatText | OpenAI.ResponseFormatJSONObject | OpenAI.ResponseFormatJSONSchema;
    }

    const stream = await this.client.chat.completions.create(params);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Tool Calling — Agentic Loop
  // --------------------------------------------------------------------------

  /**
   * Run an agentic tool-calling loop.
   *
   * Sends the conversation to the model. If the model responds with tool_calls,
   * executes them via the provided executor, appends results, and re-sends.
   * Repeats until the model returns a text response or maxTurns is reached.
   *
   * @param options - Chat options including tools definition
   * @param toolExecutor - Function that executes a tool call and returns the result
   * @returns Final chat result after all tool calls are resolved
   */
  async chatWithTools(
    options: OpenAIToolLoopOptions,
    toolExecutor: OpenAIToolExecutor,
  ): Promise<OpenAIChatResult> {
    const maxTurns = options.maxTurns ?? 10;
    const messages: OpenAIChatMessage[] = [...options.messages];

    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await this.chatCompletion({
        ...options,
        messages,
      });

      const choice = result.choices[0];
      if (!choice) {
        return result;
      }

      // If no tool calls, we're done — model gave a final response
      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
        return result;
      }

      // Append the assistant's tool-calling message to conversation
      messages.push({
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      });

      // Execute each tool call and append results
      for (const toolCall of choice.message.tool_calls) {
        if (options.onToolCall) {
          options.onToolCall(toolCall);
        }

        let toolResult: unknown;
        try {
          const args = JSON.parse(toolCall.function.arguments);
          toolResult = await toolExecutor(toolCall.function.name, args);
        } catch (error) {
          toolResult = {
            error: error instanceof Error ? error.message : String(error),
          };
        }

        if (options.onToolResult) {
          options.onToolResult(toolCall, toolResult);
        }

        // Append tool result as a tool message
        const resultStr = typeof toolResult === 'string'
          ? toolResult
          : JSON.stringify(toolResult);

        messages.push({
          role: 'tool',
          content: resultStr,
          tool_call_id: toolCall.id,
        });
      }
    }

    // Max turns exceeded — return the last result
    // Make one final call without tools to get a summary
    return this.chatCompletion({
      ...options,
      messages,
      tools: undefined,
      tool_choice: undefined,
    });
  }

  // --------------------------------------------------------------------------
  // Structured Output
  // --------------------------------------------------------------------------

  /**
   * Generate a response in JSON format.
   * Uses response_format to ensure valid JSON output.
   */
  async generateJSON<T = unknown>(options: Omit<OpenAIChatOptions, 'response_format'>): Promise<T> {
    const result = await this.chatCompletion({
      ...options,
      response_format: { type: 'json_object' },
    });

    const content = result.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    return JSON.parse(content) as T;
  }

  /**
   * Generate a response matching a JSON schema.
   * Uses structured outputs for guaranteed schema compliance.
   */
  async generateStructured<T = unknown>(
    options: Omit<OpenAIChatOptions, 'response_format'> & {
      schema: { name: string; schema: Record<string, unknown>; strict?: boolean };
    },
  ): Promise<T> {
    const { schema, ...chatOptions } = options;

    const result = await this.chatCompletion({
      ...chatOptions,
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    });

    const content = result.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    return JSON.parse(content) as T;
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

  /**
   * Auto-detect the default model from the server.
   * Useful for local servers (llama.cpp) that serve a single model.
   */
  async autoDetectModel(): Promise<string | null> {
    try {
      const models = await this.listModels();
      if (models.length > 0) {
        this.defaultModel = models[0].id;
        return models[0].id;
      }
    } catch {
      // Server may not support /models endpoint
    }
    return null;
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
      tools?: Array<{ type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }>;
      tool_choice?: 'auto' | 'none' | 'required';
      response_format?: { type: string };
    }): Promise<{ choices: Array<{ message: { content: string | null; tool_calls?: OpenAIToolCall[] } }> }> => {
      const params: Record<string, unknown> = {
        model: inputs.model || this.defaultModel,
        messages: inputs.messages,
        temperature: inputs.temperature,
        max_tokens: inputs.max_tokens,
      };

      if (inputs.tools) params.tools = inputs.tools;
      if (inputs.tool_choice) params.tool_choice = inputs.tool_choice;
      if (inputs.response_format) params.response_format = inputs.response_format;

      const response = await this.client.chat.completions.create(
        params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming,
      );

      return {
        choices: response.choices.map((choice) => ({
          message: {
            content: choice.message.content || '',
            tool_calls: choice.message.tool_calls as OpenAIToolCall[] | undefined,
          },
        })),
      };
    },
  };

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private mapResponse(response: OpenAI.ChatCompletion): OpenAIChatResult {
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice, index): OpenAIChatChoice => ({
        index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          tool_calls: choice.message.tool_calls as OpenAIToolCall[] | undefined,
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
}

// ============================================================================
// SDK Initializer
// ============================================================================

export const OpenAIInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<OpenAIClient> {
    const auth = config.auth || {};
    const options = config.options || {};

    const clientConfig: OpenAIClientConfig = {
      baseUrl: (auth['base_url'] as string) || (options['baseUrl'] as string),
      apiKey: (auth['api_key'] as string) || (options['apiKey'] as string),
      model: options['model'] as string,
      organization: options['organization'] as string,
      timeout: options['timeout'] as number,
    };

    const client = new OpenAIClient(clientConfig);

    // Auto-detect model for local servers if model is 'auto' or not specified
    if (clientConfig.baseUrl && (!clientConfig.model || clientConfig.model === 'auto')) {
      await client.autoDetectModel();
    }

    return client;
  },
};
