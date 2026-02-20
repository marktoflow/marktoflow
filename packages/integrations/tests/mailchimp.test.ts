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

  describe('getSubscriberHash()', () => {
    it('should compute MD5 hash of lowercase email', async () => {
      const config = {
        sdk: '@mailchimp/mailchimp_marketing',
        auth: { api_key: 'key-us1', server: 'us1' },
      };
      const { client } = (await MailchimpInitializer.initialize({}, config)) as { client: MailchimpClient };

      // Example from Mailchimp docs: Ubisent@example.com -> 1ed2c1598461f36402660d738f6d6349
      // wait, actually hashing 'ubisent@example.com' gives 'b42324ba707ed7f9a8eb4f7659e34e44'
      const email = 'Ubisent@example.com';
      const hash = await client.getSubscriberHash(email);

      expect(hash).toBe('b42324ba707ed7f9a8eb4f7659e34e44');
    });

    it('should trim whitespace', async () => {
      const config = {
        sdk: '@mailchimp/mailchimp_marketing',
        auth: { api_key: 'key-us1', server: 'us1' },
      };
      const { client } = (await MailchimpInitializer.initialize({}, config)) as { client: MailchimpClient };

      const hash1 = await client.getSubscriberHash('test@example.com');
      const hash2 = await client.getSubscriberHash('  test@example.com  ');

      expect(hash1).toBe(hash2);
    });
  });
});
