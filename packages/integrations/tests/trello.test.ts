import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, TrelloInitializer, TrelloClient } from '../src/index.js';

describe('Trello Integration', () => {
  it('should register trello initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'trello',
      auth: {
        api_key: 'test_api_key_123',
        token: 'test_token_123',
      },
    };

    const result = TrelloInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if api_key is missing', async () => {
    const config = {
      sdk: 'trello',
      auth: {
        token: 'test_token_123',
      },
    };

    await expect(TrelloInitializer.initialize({}, config)).rejects.toThrow('api_key');
  });

  it('should throw if token is missing', async () => {
    const config = {
      sdk: 'trello',
      auth: {
        api_key: 'test_api_key_123',
      },
    };

    await expect(TrelloInitializer.initialize({}, config)).rejects.toThrow('token');
  });

  it('should create TrelloClient', async () => {
    const config = {
      sdk: 'trello',
      auth: {
        api_key: 'test_api_key_123',
        token: 'test_token_123',
      },
    };

    const result = await TrelloInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: TrelloClient }).client).toBeInstanceOf(TrelloClient);
  });
});
