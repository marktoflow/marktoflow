import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const GeminiConfigSchema = z.object({
  model: z.string().default('gemini-2.5-flash'),
  baseUrl: z.string().url().optional(),
  apiVersion: z.string().default('v1beta'),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;

export const GeminiProvider: AgentProvider<GeminiConfig> = {
  metadata: {
    id: 'gemini',
    displayName: 'Google Gemini',
    description: 'Google Gemini provider adapter',
    capabilities: ['chat', 'tools', 'vision', 'streaming'],
    auth: {
      required: true,
      supported: ['api_key', 'oauth'],
    },
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  configSchema: GeminiConfigSchema,
  createClient: async ({ config, auth }) => {
    // TODO(agents): Replace StubAgentClient with GeminiCLIInitializer-backed client wiring (no MCP support).
    return new StubAgentClient({
      provider: 'gemini',
      capabilities: GeminiProvider.metadata.capabilities,
      model: config.model,
      authType: auth?.type,
    });
  },
};
