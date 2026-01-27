import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, TwilioInitializer, TwilioClientWrapper } from '../src/index.js';

describe('Twilio Integration', () => {
  it('should register twilio initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'twilio',
      auth: {
        account_sid: 'ACtest123',
        auth_token: 'test_token',
      },
    };

    const result = TwilioInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if account_sid is missing', async () => {
    const config = {
      sdk: 'twilio',
      auth: { auth_token: 'test_token' },
    };

    await expect(TwilioInitializer.initialize({}, config)).rejects.toThrow('account_sid');
  });

  it('should throw if auth_token is missing', async () => {
    const config = {
      sdk: 'twilio',
      auth: { account_sid: 'ACtest123' },
    };

    await expect(TwilioInitializer.initialize({}, config)).rejects.toThrow('auth_token');
  });

  it('should create TwilioClientWrapper', async () => {
    const config = {
      sdk: 'twilio',
      auth: {
        account_sid: 'ACtest123',
        auth_token: 'test_token',
      },
    };

    const result = await TwilioInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: TwilioClientWrapper }).client).toBeInstanceOf(TwilioClientWrapper);
  });
});
