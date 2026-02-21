import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const CodexConfigSchema = z.object({
  model: z.string().default('gpt-5.2-codex'),
  baseUrl: z.string().url().optional(),
  workingDirectory: z.string().optional(),
  sandboxMode: z.enum(['read-only', 'workspace-write', 'danger-full-access']).default('workspace-write'),
  approvalMode: z.enum(['never', 'on-request', 'on-failure', 'untrusted']).default('on-request'),
  timeoutMs: z.number().int().positive().optional(),
});

export type CodexConfig = z.infer<typeof CodexConfigSchema>;

export const CodexProvider: AgentProvider<CodexConfig> = {
  metadata: {
    id: 'codex',
    displayName: 'OpenAI Codex',
    description: 'OpenAI Codex provider adapter',
    capabilities: ['chat', 'tools', 'vision', 'code-exec', 'streaming', 'structured-output', 'mcp'],
    auth: {
      required: true,
      supported: ['api_key', 'oauth'],
    },
    defaultModel: 'gpt-5.2-codex',
    models: ['gpt-5.2-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini'],
  },
  configSchema: CodexConfigSchema,
  createClient: async ({ config }) => {
    return new StubAgentClient({
      provider: 'codex',
      capabilities: CodexProvider.metadata.capabilities,
      model: config.model,
    });
  },
};
