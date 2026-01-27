import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, AsanaInitializer, AsanaClient } from '../src/index.js';

describe('Asana Integration', () => {
  it('should register asana initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'asana',
      auth: {
        access_token: 'test_token_123',
      },
    };

    const result = AsanaInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if access_token is missing', async () => {
    const config = {
      sdk: 'asana',
      auth: {},
    };

    await expect(AsanaInitializer.initialize({}, config)).rejects.toThrow('access_token');
  });

  it('should create AsanaClient', async () => {
    const config = {
      sdk: 'asana',
      auth: {
        access_token: 'test_token_123',
      },
    };

    const result = await AsanaInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: AsanaClient }).client).toBeInstanceOf(AsanaClient);
  });
});
