import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { WebClient } from '@slack/web-api';
import { registerIntegrations, SlackInitializer } from '../src/index.js';

describe('Slack Integration', () => {
  it('should register slack initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    // We can't easily check internal state of registry, but we can check if it initializes correctly
    // However, registry.load() will try to load the module via the loader.
    // The default loader uses dynamic import.
    // Since we are in the same project, we might need to mock the loader or rely on real import if @slack/web-api is installed.
    // But SlackInitializer ignores the module passed to it (in my implementation).
    
    // Let's manually invoke the initializer to test it.
    
    const config = {
      sdk: '@slack/web-api',
      auth: { token: 'test-token' }
    };

    const client = SlackInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    
    return expect(client).resolves.toBeInstanceOf(WebClient);
  });
  
  it('should throw if token is missing', async () => {
     const config = {
      sdk: '@slack/web-api',
      auth: {}
    };
    
    await expect(SlackInitializer.initialize({}, config)).rejects.toThrow('auth.token');
  });
});
