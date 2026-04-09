/**
 * Ollama SDK Adapter for marktoflow
 *
 * This adapter provides integration with Ollama for local LLM workflows,
 * enabling AI-powered automation with generation, chat, embeddings,
 * streaming, and model management capabilities.
 */

import { Ollama } from 'ollama';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import type {
  OllamaClientConfig,
  OllamaGenerateOptions,
  OllamaChatOptions,
  OllamaEmbeddingsOptions,
  OllamaGenerateResult,
  OllamaChatResult,
  OllamaEmbeddingsResult,
  OllamaModelInfo,
  OllamaRunningModel,
  OllamaPullProgress,
  OllamaResult,
  OllamaStreamCallback,
  OllamaChatMessage,
} from './ollama-types.js';

// ============================================================================
// Ollama Client
// ============================================================================

/**
 * Client for interacting with Ollama for local LLM inference
 *
 * Provides multiple interfaces for different use cases:
 * - generate(): Simple text generation
 * - generateStream(): Streaming text generation
 * - chat(): Conversational interface
 * - chatStream(): Streaming chat
 * - embed(): Generate embeddings for RAG
 * - Model management: list, pull, show, delete
 */
export class OllamaClient {
  private ollama: Ollama;
  private defaultModel: string;

  constructor(config: OllamaClientConfig = {}) {
    const host = config.host || 'http://127.0.0.1:11434';
    this.ollama = new Ollama({ host });
    this.defaultModel = config.model || 'llama3.2';
  }

  // ============================================================================
  // Simple Interface
  // ============================================================================

  /**
   * Generate text from a prompt (simple interface)
   */
  async generate(prompt: string, model?: string): Promise<string> {
    const response = await this.ollama.generate({
      model: model || this.defaultModel,
      prompt,
      stream: false,
    });
    return response.response;
  }

  /**
   * Generate with full options
   */
  async generateFull(options: OllamaGenerateOptions): Promise<OllamaResult> {
    const response = await this.ollama.generate({
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      system: options.system,
      template: options.template,
      context: options.context,
      stream: false,
      raw: options.raw,
      format: options.format,
      images: options.images,
      options: options.options,
      keep_alive: options.keep_alive,
    }) as unknown as OllamaGenerateResult;

    return {
      content: response.response,
      model: response.model,
      done: response.done,
      raw: response,
      duration: response.total_duration ? response.total_duration / 1_000_000 : undefined,
      usage: {
        prompt_tokens: response.prompt_eval_count,
        completion_tokens: response.eval_count,
        total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }

  /**
   * Stream text generation
   */
  async *generateStream(options: OllamaGenerateOptions): AsyncGenerator<string> {
    const stream = await this.ollama.generate({
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      system: options.system,
      template: options.template,
      context: options.context,
      stream: true,
      raw: options.raw,
      format: options.format,
      images: options.images,
      options: options.options,
      keep_alive: options.keep_alive,
    });

    for await (const chunk of stream) {
      yield chunk.response;
    }
  }

  /**
   * Generate with streaming callback
   */
  async generateWithCallback(
    options: OllamaGenerateOptions,
    callback: OllamaStreamCallback
  ): Promise<OllamaResult> {
    const stream = await this.ollama.generate({
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      system: options.system,
      template: options.template,
      context: options.context,
      stream: true,
      raw: options.raw,
      format: options.format,
      images: options.images,
      options: options.options,
      keep_alive: options.keep_alive,
    });

    let fullResponse = '';
    let lastChunk: OllamaGenerateResult | null = null;

    for await (const chunk of stream) {
      fullResponse += chunk.response;
      await Promise.resolve(callback(chunk.response, chunk.done));
      if (chunk.done) {
        lastChunk = chunk as unknown as OllamaGenerateResult;
      }
    }

    return {
      content: fullResponse,
      model: lastChunk?.model || options.model || this.defaultModel,
      done: true,
      raw: lastChunk || undefined,
      duration: lastChunk?.total_duration ? lastChunk.total_duration / 1_000_000 : undefined,
      usage: lastChunk ? {
        prompt_tokens: lastChunk.prompt_eval_count,
        completion_tokens: lastChunk.eval_count,
        total_tokens: (lastChunk.prompt_eval_count || 0) + (lastChunk.eval_count || 0),
      } : undefined,
    };
  }

  // ============================================================================
  // Chat Interface
  // ============================================================================

  /**
   * Chat completion (simple interface)
   */
  async chat(options: OllamaChatOptions): Promise<OllamaResult> {
    const response = await this.ollama.chat({
      model: options.model || this.defaultModel,
      messages: options.messages as unknown as Parameters<typeof this.ollama.chat>[0]['messages'],
      stream: false,
      format: options.format,
      options: options.options,
      keep_alive: options.keep_alive,
      tools: options.tools as unknown as Parameters<typeof this.ollama.chat>[0]['tools'],
    }) as unknown as OllamaChatResult;

    return {
      content: response.message.content,
      model: response.model,
      done: response.done,
      raw: response,
      duration: response.total_duration ? response.total_duration / 1_000_000 : undefined,
      usage: {
        prompt_tokens: response.prompt_eval_count,
        completion_tokens: response.eval_count,
        total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }

  /**
   * Stream chat completion
   */
  async *chatStream(options: OllamaChatOptions): AsyncGenerator<string> {
    const stream = await this.ollama.chat({
      model: options.model || this.defaultModel,
      messages: options.messages as unknown as Parameters<typeof this.ollama.chat>[0]['messages'],
      stream: true,
      format: options.format,
      options: options.options,
      keep_alive: options.keep_alive,
      tools: options.tools as unknown as Parameters<typeof this.ollama.chat>[0]['tools'],
    });

    for await (const chunk of stream) {
      yield chunk.message.content;
    }
  }

  /**
   * Chat with streaming callback
   */
  async chatWithCallback(
    options: OllamaChatOptions,
    callback: OllamaStreamCallback
  ): Promise<OllamaResult> {
    const stream = await this.ollama.chat({
      model: options.model || this.defaultModel,
      messages: options.messages as unknown as Parameters<typeof this.ollama.chat>[0]['messages'],
      stream: true,
      format: options.format,
      options: options.options,
      keep_alive: options.keep_alive,
      tools: options.tools as unknown as Parameters<typeof this.ollama.chat>[0]['tools'],
    });

    let fullResponse = '';
    let lastChunk: OllamaChatResult | null = null;

    for await (const chunk of stream) {
      fullResponse += chunk.message.content;
      await Promise.resolve(callback(chunk.message.content, chunk.done));
      if (chunk.done) {
        lastChunk = chunk as unknown as OllamaChatResult;
      }
    }

    return {
      content: fullResponse,
      model: lastChunk?.model || options.model || this.defaultModel,
      done: true,
      raw: lastChunk || undefined,
      duration: lastChunk?.total_duration ? lastChunk.total_duration / 1_000_000 : undefined,
      usage: lastChunk ? {
        prompt_tokens: lastChunk.prompt_eval_count,
        completion_tokens: lastChunk.eval_count,
        total_tokens: (lastChunk.prompt_eval_count || 0) + (lastChunk.eval_count || 0),
      } : undefined,
    };
  }

  // ============================================================================
  // Embeddings Interface
  // ============================================================================

  /**
   * Generate embeddings for RAG applications
   */
  async embeddings(options: OllamaEmbeddingsOptions): Promise<number[][]> {
    const response = await this.ollama.embed({
      model: options.model || this.defaultModel,
      input: options.input,
      truncate: options.truncate,
      options: options.options,
      keep_alive: options.keep_alive,
    }) as OllamaEmbeddingsResult;

    return response.embeddings;
  }

  /**
   * Generate embedding for a single text (convenience method)
   */
  async embed(text: string, model?: string): Promise<number[]> {
    const result = await this.embeddings({
      model: model || this.defaultModel,
      input: text,
    });
    return result[0];
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[], model?: string): Promise<number[][]> {
    return this.embeddings({
      model: model || this.defaultModel,
      input: texts,
    });
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await this.ollama.list();
    return response.models as OllamaModelInfo[];
  }

  /**
   * List running models
   */
  async listRunning(): Promise<OllamaRunningModel[]> {
    const response = await this.ollama.ps();
    return response.models as OllamaRunningModel[];
  }

  /**
   * Pull a model from the registry
   */
  async pullModel(name: string, onProgress?: (progress: OllamaPullProgress) => void): Promise<void> {
    const stream = await this.ollama.pull({ model: name, stream: true });

    for await (const progress of stream) {
      if (onProgress) {
        onProgress(progress as OllamaPullProgress);
      }
    }
  }

  /**
   * Pull a model without streaming (waits for completion)
   */
  async pullModelSync(name: string): Promise<void> {
    await this.ollama.pull({ model: name, stream: false });
  }

  /**
   * Show model information
   */
  async showModel(name: string): Promise<unknown> {
    return this.ollama.show({ model: name });
  }

  /**
   * Delete a model
   */
  async deleteModel(name: string): Promise<void> {
    await this.ollama.delete({ model: name });
  }

  /**
   * Copy a model
   */
  async copyModel(source: string, destination: string): Promise<void> {
    await this.ollama.copy({ source, destination });
  }

  /**
   * Create a model from a base model
   */
  async createModel(
    name: string,
    fromModel: string,
    onProgress?: (progress: { status: string }) => void
  ): Promise<void> {
    const stream = await this.ollama.create({ model: name, from: fromModel, stream: true });

    for await (const progress of stream) {
      if (onProgress) {
        onProgress(progress);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ollama.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a specific model is available
   */
  async hasModel(name: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(m => m.name === name || m.name.startsWith(`${name}:`));
    } catch {
      return false;
    }
  }

  /**
   * Ensure a model is available, pulling if necessary
   */
  async ensureModel(name: string): Promise<void> {
    if (!(await this.hasModel(name))) {
      await this.pullModelSync(name);
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

  // ============================================================================
  // OpenAI-Compatible Interface
  // ============================================================================

  /**
   * OpenAI-compatible chat interface for workflow compatibility
   */
  chatCompletions = {
    create: async (inputs: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
    }): Promise<{ choices: Array<{ message: { role: string; content: string } }> }> => {
      const messages: OllamaChatMessage[] = inputs.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
      }));

      const result = await this.chat({
        model: inputs.model || this.defaultModel,
        messages,
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

  /**
   * OpenAI-compatible embeddings interface
   */
  embeddingsCreate = {
    create: async (inputs: {
      model?: string;
      input: string | string[];
    }): Promise<{ data: Array<{ embedding: number[]; index: number }> }> => {
      const embeddings = await this.embeddings({
        model: inputs.model || this.defaultModel,
        input: inputs.input,
      });

      return {
        data: embeddings.map((embedding, index) => ({
          embedding,
          index,
        })),
      };
    },
  };
}

// ============================================================================
// SDK Initializer for marktoflow Registry
// ============================================================================

/**
 * SDK Initializer for Ollama
 */
export const OllamaInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const options = config.options || {};
    const auth = config.auth || {};

    const host = (options['host'] as string) ||
                 (auth['host'] as string) ||
                 'http://127.0.0.1:11434';
    const model = (options['model'] as string) || 'llama3.2';

    return new OllamaClient({
      host,
      model,
    });
  },
};

// ============================================================================
// Re-export SDK class for convenience
// ============================================================================

export { Ollama };
