import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { Octokit } from '@octokit/rest';
import { registerIntegrations, GitHubInitializer } from '../src/index.js';

describe('GitHub Integration', () => {
  it('should register github initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: '@octokit/rest',
      auth: { token: 'test-token' }
    };

    const client = GitHubInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    
    return expect(client).resolves.toBeInstanceOf(Octokit);
  });
  
  it('should reject initialization without token', async () => {
     const config = {
      sdk: '@octokit/rest',
      auth: {}
    };

    await expect(GitHubInitializer.initialize({}, config)).rejects.toThrow('GitHub SDK requires auth.token');
  });
});
