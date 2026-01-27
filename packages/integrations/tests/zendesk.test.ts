import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, ZendeskInitializer, ZendeskClient } from '../src/index.js';

describe('Zendesk Integration', () => {
  it('should register zendesk initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'node-zendesk',
      auth: {
        subdomain: 'test-company',
        email: 'test@example.com',
        token: 'test_token_123',
      },
    };

    const result = ZendeskInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if subdomain is missing', async () => {
    const config = {
      sdk: 'node-zendesk',
      auth: {
        email: 'test@example.com',
        token: 'test_token_123',
      },
    };

    await expect(ZendeskInitializer.initialize({}, config)).rejects.toThrow('subdomain');
  });

  it('should throw if email is missing', async () => {
    const config = {
      sdk: 'node-zendesk',
      auth: {
        subdomain: 'test-company',
        token: 'test_token_123',
      },
    };

    await expect(ZendeskInitializer.initialize({}, config)).rejects.toThrow('email');
  });

  it('should throw if token is missing', async () => {
    const config = {
      sdk: 'node-zendesk',
      auth: {
        subdomain: 'test-company',
        email: 'test@example.com',
      },
    };

    await expect(ZendeskInitializer.initialize({}, config)).rejects.toThrow('token');
  });

  it('should create ZendeskClient', async () => {
    const config = {
      sdk: 'node-zendesk',
      auth: {
        subdomain: 'test-company',
        email: 'test@example.com',
        token: 'test_token_123',
      },
    };

    const result = await ZendeskInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: ZendeskClient }).client).toBeInstanceOf(ZendeskClient);
  });
});
