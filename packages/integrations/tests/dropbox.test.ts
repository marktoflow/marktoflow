import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, DropboxInitializer, DropboxClient } from '../src/index.js';

describe('Dropbox Integration', () => {
  it('should register dropbox initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'dropbox',
      auth: {
        access_token: 'test_token_123',
      },
    };

    const result = DropboxInitializer.initialize({}, config);
    expect(result).toBeInstanceOf(Promise);

    return expect(result).resolves.toHaveProperty('client');
  });

  it('should throw if access_token is missing', async () => {
    const config = {
      sdk: 'dropbox',
      auth: {},
    };

    await expect(DropboxInitializer.initialize({}, config)).rejects.toThrow('access_token');
  });

  it('should create DropboxClient', async () => {
    const config = {
      sdk: 'dropbox',
      auth: {
        access_token: 'test_token_123',
      },
    };

    const result = await DropboxInitializer.initialize({}, config);
    expect(result).toHaveProperty('client');
    expect((result as { client: DropboxClient }).client).toBeInstanceOf(DropboxClient);
  });
});
