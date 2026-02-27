/**
 * Qwen Code SDK Adapter for marktoflow
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { query as qwenQuery } from '@qwen-code/sdk';

type QwenAuthType = 'qwen-oauth' | 'openai';

interface QwenOptions {
  cwd?: string;
  model?: string;
  authType?: QwenAuthType;
  permissionMode?: 'default' | 'plan' | 'auto-edit' | 'yolo';
  includePartialMessages?: boolean;
  env?: Record<string, string>;
}

interface QwenMessage {
  type: string;
  message?: { content?: string | Array<{ type?: string; text?: string }> };
  result?: string;
  is_error?: boolean;
  error?: { message?: string };
}

interface QwenQuery extends AsyncGenerator<QwenMessage, void, unknown> {
  close?: () => Promise<void>;
  interrupt?: () => Promise<void>;
}

/**
 * Thin client wrapper around @qwen-code/sdk for marktoflow adapter compatibility.
 */
export class QwenCodeClient {
  private model: string;
  private cwd: string;
  private baseUrl?: string;
  private apiKey?: string;
  private authType: QwenAuthType;
  private currentQuery: QwenQuery | null = null;

  constructor(config: {
    model?: string;
    cwd?: string;
    baseUrl?: string;
    apiKey?: string;
    authType?: QwenAuthType;
  } = {}) {
    this.model = config.model || process.env.QWEN_MODEL || 'qwen-plus';
    this.cwd = config.cwd || process.cwd();
    this.baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL;
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.authType = config.authType || (this.baseUrl || this.apiKey ? 'openai' : 'qwen-oauth');
  }

  async send(inputs: { prompt: string; model?: string; cwd?: string }): Promise<string> {
    const result = await this.runQuery({
      prompt: inputs.prompt,
      options: {
        model: inputs.model || this.model,
        cwd: inputs.cwd || this.cwd,
        authType: this.authType,
        permissionMode: 'plan',
      },
    });

    return result.text;
  }

  async stream(inputs: {
    prompt: string;
    model?: string;
    cwd?: string;
    onChunk?: (chunk: string) => void;
  }): Promise<string> {
    const result = await this.runQuery({
      prompt: inputs.prompt,
      options: {
        model: inputs.model || this.model,
        cwd: inputs.cwd || this.cwd,
        authType: this.authType,
        permissionMode: 'plan',
        includePartialMessages: true,
      },
      onChunk: inputs.onChunk,
    });

    return result.text;
  }

  async cancel(): Promise<void> {
    const query = this.currentQuery;
    this.currentQuery = null;

    if (query?.interrupt) {
      await query.interrupt().catch((err) => {
        console.warn('[QwenCodeClient] Failed to interrupt active query during cancel', err);
      });
    }
  }

  getStatus(): { ready: boolean; model: string; authType: QwenAuthType; baseUrl?: string } {
    return {
      ready: true,
      model: this.model,
      authType: this.authType,
      baseUrl: this.baseUrl,
    };
  }

  chat = {
    completions: async (inputs: {
      model?: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{ choices: Array<{ message: { content: string } }> }> => {
      const userMessage = inputs.messages.filter((m) => m.role === 'user').at(-1)?.content || '';
      const content = await this.send({
        prompt: userMessage,
        model: inputs.model,
      });
      return { choices: [{ message: { content } }] };
    },
  };

  private async runQuery(params: {
    prompt: string;
    options: QwenOptions;
    onChunk?: (chunk: string) => void;
  }): Promise<{ text: string }> {
    if (this.currentQuery) {
      throw new Error('Qwen query already in progress; concurrent send/stream is not supported');
    }

    let responseText = '';

    const env: Record<string, string> = {};
    if (this.baseUrl) env.OPENAI_BASE_URL = this.baseUrl;
    if (this.apiKey) env.OPENAI_API_KEY = this.apiKey;

    const query = qwenQuery({
      prompt: params.prompt,
      options: {
        ...params.options,
        ...(Object.keys(env).length > 0 ? { env } : {}),
      },
    }) as unknown as QwenQuery;

    this.currentQuery = query;

    try {
      for await (const message of query) {
        if (message.type === 'assistant') {
          const next = this.extractAssistantText(message);
          if (params.onChunk && next.startsWith(responseText)) {
            const delta = next.slice(responseText.length);
            if (delta) {
              this.emitChunk(params.onChunk, delta);
            }
          }
          responseText = next;
        } else if (message.type === 'result') {
          if (message.is_error) {
            throw new Error(message.error?.message || 'Qwen query failed');
          }
          if (message.result) {
            if (params.onChunk && message.result.startsWith(responseText)) {
              const delta = message.result.slice(responseText.length);
              if (delta) {
                this.emitChunk(params.onChunk, delta);
              }
            }
            responseText = message.result;
          }
          break;
        }
      }

      return { text: responseText };
    } finally {
      if (query?.close) {
        await query.close().catch((err) => {
          console.warn('[QwenCodeClient] Failed to close query', err);
        });
      }
      if (this.currentQuery === query) {
        this.currentQuery = null;
      }
    }
  }


  private emitChunk(onChunk: (chunk: string) => void, chunk: string): void {
    try {
      onChunk(chunk);
    } catch (err) {
      console.warn('[QwenCodeClient] onChunk callback threw', err);
    }
  }

  private extractAssistantText(message: QwenMessage): string {
    const content = message.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text)
        .join('\n');
    }
    return '';
  }
}

/**
 * Lightweight runtime check used by GUI/CLI provider availability status.
 * Keeps module-resolution checks inside integrations, where @qwen-code/sdk is a direct dependency.
 */
export async function isQwenSdkAvailable(): Promise<boolean> {
  try {
    const sdkModule = await import('@qwen-code/sdk').catch(() => null);
    return !!(sdkModule && typeof sdkModule.query === 'function');
  } catch {
    return false;
  }
}

export const QwenCodeInitializer: SDKInitializer = {
  // Keep the standard SDKInitializer signature consistent across adapters.
  // `_module` is intentionally unused because Qwen client creation is config-driven.
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const auth = config.auth || {};
    const options = config.options || {};

    return new QwenCodeClient({
      model: (options['model'] as string) || (auth['model'] as string),
      cwd: (options['cwd'] as string) || (options['workingDirectory'] as string),
      baseUrl: (auth['base_url'] as string) || (options['baseUrl'] as string),
      apiKey: (auth['api_key'] as string) || (options['apiKey'] as string),
      authType: (auth['auth_type'] as QwenAuthType) || (options['authType'] as QwenAuthType),
    });
  },
};
