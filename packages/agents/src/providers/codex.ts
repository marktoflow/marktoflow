import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const CodexConfigSchema = z.object({
  model: z.string().default('codex-mini-latest'),
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
    capabilities: ['chat', 'tools', 'code-exec', 'streaming', 'structured-output', 'mcp'],
    auth: {
      required: true,
      supported: ['api_key', 'oauth'],
    },
    defaultModel: 'codex-mini-latest',
    models: ['codex-latest', 'codex-mini-latest'],
  },
  configSchema: CodexConfigSchema,
  createClient: async ({ config, auth }) => {
    // TODO(agents): Replace StubAgentClient with CodexInitializer-backed client wiring.
    return new StubAgentClient({
      provider: 'codex',
      capabilities: CodexProvider.metadata.capabilities,
      model: config.model,
      authType: auth?.type,
    });
  },
};
