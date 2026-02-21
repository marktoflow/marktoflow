import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const QwenConfigSchema = z.object({
  model: z.string().default('qwen-max'),
  baseUrl: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type QwenConfig = z.infer<typeof QwenConfigSchema>;

export const QwenProvider: AgentProvider<QwenConfig> = {
  metadata: {
    id: 'qwen',
    displayName: 'Qwen',
    description: 'Qwen provider adapter for OpenAI-compatible endpoints',
    capabilities: ['chat', 'tools', 'vision', 'streaming', 'structured-output'],
    auth: {
      required: true,
      supported: ['api_key', 'oauth'],
    },
    defaultModel: 'qwen-max',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  configSchema: QwenConfigSchema,
  createClient: async ({ config }) => {
    return new StubAgentClient({
      provider: 'qwen',
      capabilities: QwenProvider.metadata.capabilities,
      model: config.model,
    });
  },
};
