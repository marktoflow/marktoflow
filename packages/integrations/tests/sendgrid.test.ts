import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, SendGridInitializer, SendGridClient } from '../src/index.js';

describe('SendGrid Integration', () => {
  it('should register sendgrid initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: '@sendgrid/mail',
      auth: { api_key: 'SG.test_key_123' },
    };

    const result = SendGridInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if api_key is missing', async () => {
    const config = {
      sdk: '@sendgrid/mail',
      auth: {},
    };

    await expect(SendGridInitializer.initialize({}, config)).rejects.toThrow('api_key');
  });

  it('should create SendGridClient with api key', async () => {
    const config = {
      sdk: '@sendgrid/mail',
      auth: { api_key: 'SG.test_key_123' },
    };

    const result = await SendGridInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: SendGridClient }).client).toBeInstanceOf(SendGridClient);
  });
});
