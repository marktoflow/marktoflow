import { AgentProviderRegistry } from './registry.js';
import {
  ClaudeProvider,
  CodexProvider,
  CopilotProvider,
  GeminiProvider,
  QwenProvider,
} from './providers/index.js';
import type { AgentCapability, AgentClient, AgentProvider, CreateClientInput, ProviderMetadata } from './types.js';

export interface AgentsSDKOptions {
  includeDefaultProviders?: boolean;
}

export class AgentsSDK {
  readonly registry: AgentProviderRegistry;

  constructor(options: AgentsSDKOptions = {}) {
    this.registry = new AgentProviderRegistry();
    if (options.includeDefaultProviders !== false) {
      this.registerDefaults();
    }
  }

  register<TConfig>(provider: AgentProvider<TConfig>): void {
    this.registry.register(provider);
  }

  listProviders(): ProviderMetadata[] {
    return this.registry.list();
  }

  providersByCapability(capability: AgentCapability): ProviderMetadata[] {
    return this.registry.findByCapability(capability);
  }

  createClient<TConfig>(input: CreateClientInput<TConfig>): Promise<AgentClient> {
    return this.registry.createClient(input);
  }

  private registerDefaults(): void {
    this.registry.register(ClaudeProvider);
    this.registry.register(CodexProvider);
    this.registry.register(CopilotProvider);
    this.registry.register(QwenProvider);
    this.registry.register(GeminiProvider);
  }
}

export function createAgentsSDK(options?: AgentsSDKOptions): AgentsSDK {
  return new AgentsSDK(options);
}
