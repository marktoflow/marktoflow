import { z } from 'zod';
import { StubAgentClient } from '../client.js';
import type { AgentProvider } from '../types.js';

export const CopilotConfigSchema = z.object({
  model: z.string().default('codex-mini-latest'),
  cliPath: z.string().optional(),
  cliUrl: z.string().url().optional(),
  useStdio: z.boolean().default(false),
  port: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export type CopilotConfig = z.infer<typeof CopilotConfigSchema>;

export const CopilotProvider: AgentProvider<CopilotConfig> = {
  metadata: {
    id: 'copilot',
    displayName: 'GitHub Copilot',
    description: 'GitHub Copilot provider adapter',
    capabilities: ['chat', 'tools', 'code-exec', 'streaming'],
    auth: {
      required: true,
      supported: ['oauth', 'api_key'],
    },
    defaultModel: 'codex-mini-latest',
  },
  configSchema: CopilotConfigSchema,
  createClient: async ({ config, auth }) => {
    // TODO(agents): Replace StubAgentClient with GitHubCopilotInitializer-backed client wiring.
    return new StubAgentClient({
      provider: 'copilot',
      capabilities: CopilotProvider.metadata.capabilities,
      model: config.model,
      authType: auth?.type,
    });
  },
};
