import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, MailchimpInitializer, MailchimpClient } from '../src/index.js';

describe('Mailchimp Integration', () => {
  it('should register mailchimp initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: '@mailchimp/mailchimp_marketing',
      auth: {
        api_key: 'test_key_123-us1',
        server: 'us1',
      },
    };

    const result = MailchimpInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if api_key is missing', async () => {
    const config = {
      sdk: '@mailchimp/mailchimp_marketing',
      auth: {
        server: 'us1',
      },
    };

    await expect(MailchimpInitializer.initialize({}, config)).rejects.toThrow('api_key');
  });

  it('should throw if server is missing', async () => {
    const config = {
      sdk: '@mailchimp/mailchimp_marketing',
      auth: {
        api_key: 'test_key_123-us1',
      },
    };

    await expect(MailchimpInitializer.initialize({}, config)).rejects.toThrow('server');
  });

  it('should create MailchimpClient', async () => {
    const config = {
      sdk: '@mailchimp/mailchimp_marketing',
      auth: {
        api_key: 'test_key_123-us1',
        server: 'us1',
      },
    };

    const result = await MailchimpInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: MailchimpClient }).client).toBeInstanceOf(MailchimpClient);
  });
});
