import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, StripeInitializer, StripeClient } from '../src/index.js';

describe('Stripe Integration', () => {
  it('should register stripe initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'stripe',
      auth: { api_key: 'sk_test_123456789' },
    };

    const result = StripeInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if api_key is missing', async () => {
    const config = {
      sdk: 'stripe',
      auth: {},
    };

    await expect(StripeInitializer.initialize({}, config)).rejects.toThrow('auth.api_key');
  });

  it('should create StripeClient with api key', async () => {
    const config = {
      sdk: 'stripe',
      auth: { api_key: 'sk_test_123456789' },
    };

    const result = await StripeInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: StripeClient }).client).toBeInstanceOf(StripeClient);
  });

  it('should support custom api_version in options', async () => {
    const config = {
      sdk: 'stripe',
      auth: { api_key: 'sk_test_123456789' },
      options: { api_version: '2024-12-18.acacia' },
    };

    const result = await StripeInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
  });
});
