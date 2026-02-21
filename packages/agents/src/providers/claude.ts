import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const ClaudeConfigSchema = z.object({
  model: z.string().default('claude-sonnet-4-5'),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;

export const ClaudeProvider: AgentProvider<ClaudeConfig> = {
  metadata: {
    id: 'claude',
    displayName: 'Claude Agent',
    description: 'Anthropic Claude agent provider adapter',
    capabilities: ['chat', 'tools', 'vision', 'code-exec', 'streaming', 'structured-output', 'mcp'],
    auth: {
      required: true,
      supported: ['api_key', 'oauth'],
    },
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  },
  configSchema: ClaudeConfigSchema,
  createClient: async ({ config }) => {
    return new StubAgentClient({
      provider: 'claude',
      capabilities: ClaudeProvider.metadata.capabilities,
      model: config.model,
    });
  },
};
