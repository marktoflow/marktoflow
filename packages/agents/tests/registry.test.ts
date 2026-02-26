import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { asSecret } from '../src/auth.js';
import { AgentError } from '../src/errors.js';
import { AgentProviderRegistry } from '../src/registry.js';
import type { AgentProvider } from '../src/types.js';

const testProvider: AgentProvider<{ model: string }> = {
  metadata: {
    id: 'test-provider',
    displayName: 'Test Provider',
    capabilities: ['chat', 'tools'],
    auth: {
      required: true,
      supported: ['api_key'],
    },
  },
  configSchema: z.object({
    model: z.string().min(1),
  }),
  createClient: async ({ config }) => ({
    provider: 'test-provider',
    capabilities: ['chat', 'tools'],
    invoke: async (request) => ({
      provider: 'test-provider',
      model: config.model,
      output: request.input,
    }),
  }),
};

describe('AgentProviderRegistry', () => {
  it('registers and lists providers', () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    expect(registry.has('test-provider')).toBe(true);
    expect(registry.has('missing')).toBe(false);
    expect(registry.list()).toHaveLength(1);
    expect(registry.findByCapability('tools').map((p) => p.id)).toEqual(['test-provider']);
  });

  it('rejects duplicate registration', () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    expect(() => registry.register(testProvider)).toThrow(AgentError);
  });

  it('throws when provider is missing', () => {
    const registry = new AgentProviderRegistry();
    expect(() => registry.get('missing-provider')).toThrow(AgentError);
  });

  it('creates a client with validated config/auth', async () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    const client = await registry.createClient({
      provider: 'test-provider',
      config: { model: 'alpha' },
      auth: {
        type: 'api_key',
        apiKey: asSecret('secret-key'),
      },
    });

    const response = await client.invoke({ input: 'hello' });
    expect(response).toEqual({
      provider: 'test-provider',
      model: 'alpha',
      output: 'hello',
    });
  });

  it('enforces required auth', async () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    await expect(
      registry.createClient({
        provider: 'test-provider',
        config: { model: 'alpha' },
      })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('rejects unsupported auth type', async () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    await expect(
      registry.createClient({
        provider: 'test-provider',
        config: { model: 'alpha' },
        auth: {
          type: 'oauth',
          accessToken: asSecret('token'),
        },
      })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('normalizes zod validation issues to INVALID_CONFIG', async () => {
    const registry = new AgentProviderRegistry();
    registry.register(testProvider);

    await expect(
      registry.createClient({
        provider: 'test-provider',
        config: { model: '' },
        auth: {
          type: 'api_key',
          apiKey: asSecret('secret-key'),
        },
      })
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });
});
