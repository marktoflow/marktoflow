import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, TeamsInitializer, TeamsClient } from '../src/index.js';

describe('Microsoft Teams Integration', () => {
  it('should register teams initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'teams',
      auth: { access_token: 'test-token-123' },
    };

    const result = TeamsInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if access_token and credentials are missing', async () => {
    const config = {
      sdk: 'teams',
      auth: {},
    };

    await expect(TeamsInitializer.initialize({}, config)).rejects.toThrow(
      'Microsoft Teams SDK requires either auth.access_token'
    );
  });

  it('should create TeamsClient with access token', async () => {
    const config = {
      sdk: 'teams',
      auth: { access_token: 'test-token-123' },
    };

    const result = await TeamsInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: TeamsClient }).client).toBeInstanceOf(TeamsClient);
  });

  it('should accept client credentials', async () => {
    const config = {
      sdk: 'teams',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        tenant_id: 'test-tenant',
        access_token: 'test-token', // Still need token for now
      },
    };

    const result = await TeamsInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
  });
});
