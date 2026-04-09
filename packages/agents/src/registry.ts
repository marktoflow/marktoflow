import { z } from 'zod';
import { validateAuth } from './auth.js';
import { AgentError, toAgentError } from './errors.js';
import type {
  AgentCapability,
  AgentClient,
  AgentProvider,
  AuthType,
  CreateClientInput,
  ProviderMetadata,
} from './types.js';

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase();
}

function validateAuthType(metadata: ProviderMetadata, providedAuthType?: AuthType): void {
  if (!metadata.auth.required && !providedAuthType) {
    return;
  }

  if (metadata.auth.required && !providedAuthType) {
    throw new AgentError('INVALID_CONFIG', `Provider "${metadata.id}" requires authentication`, {
      provider: metadata.id,
    });
  }

  if (providedAuthType && !metadata.auth.supported.includes(providedAuthType)) {
    throw new AgentError(
      'INVALID_CONFIG',
      `Provider "${metadata.id}" does not support auth type "${providedAuthType}"`,
      { provider: metadata.id }
    );
  }
}

export class AgentProviderRegistry {
  private readonly providers = new Map<string, AgentProvider<unknown>>();

  register<TConfig>(provider: AgentProvider<TConfig>): void {
    const id = normalizeProviderId(provider.metadata.id);

    if (!id) {
      throw new AgentError('INVALID_CONFIG', 'Provider id cannot be empty');
    }

    if (this.providers.has(id)) {
      throw new AgentError('PROVIDER_CONFLICT', `Provider "${id}" is already registered`, {
        provider: id,
      });
    }

    this.providers.set(id, provider as AgentProvider<unknown>);
  }

  has(providerId: string): boolean {
    return this.providers.has(normalizeProviderId(providerId));
  }

  get<TConfig>(providerId: string): AgentProvider<TConfig> {
    const normalized = normalizeProviderId(providerId);
    const provider = this.providers.get(normalized);

    if (!provider) {
      throw new AgentError('PROVIDER_NOT_FOUND', `Provider "${providerId}" is not registered`, {
        provider: normalized,
      });
    }

    return provider as AgentProvider<TConfig>;
  }

  list(): ProviderMetadata[] {
    return [...this.providers.values()].map((provider) => provider.metadata);
  }

  findByCapability(capability: AgentCapability): ProviderMetadata[] {
    return this.list().filter((provider) => provider.capabilities.includes(capability));
  }

  async createClient<TConfig>(input: CreateClientInput<TConfig>): Promise<AgentClient> {
    const provider = this.get<TConfig>(input.provider);

    validateAuth(input.auth);
    validateAuthType(provider.metadata, input.auth?.type);

    try {
      const parsedConfig = provider.configSchema.parse(input.config) as TConfig;
      const context =
        input.auth !== undefined
          ? { config: parsedConfig, auth: input.auth }
          : { config: parsedConfig };
      return await provider.createClient(context);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AgentError('INVALID_CONFIG', 'Provider configuration validation failed', {
          provider: provider.metadata.id,
          details: error.issues,
          cause: error,
        });
      }

      throw toAgentError(error, provider.metadata.id);
    }
  }
}
