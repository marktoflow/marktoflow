import { describe, it, expect } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { Version3Client } from 'jira.js';
import { registerIntegrations, JiraInitializer } from '../src/index.js';

describe('Jira Integration', () => {
  it('should register jira initializer', () => {
    const registry = new SDKRegistry();
    registerIntegrations(registry);

    const config = {
      sdk: 'jira.js',
      auth: { 
        host: 'https://example.atlassian.net',
        email: 'user@example.com',
        api_token: 'test-token' 
      }
    };

    const client = JiraInitializer.initialize({}, config);
    expect(client).toBeInstanceOf(Promise);
    
    return expect(client).resolves.toBeInstanceOf(Version3Client);
  });
  
  it('should throw if config is missing', async () => {
     const config = {
      sdk: 'jira.js',
      auth: {}
    };
    
    await expect(JiraInitializer.initialize({}, config)).rejects.toThrow('Jira SDK requires auth.host, auth.email, and auth.api_token');
  });

  it('should throw if partial config is provided', async () => {
    const config = {
     sdk: 'jira.js',
     auth: {
       host: 'https://example.atlassian.net'
     }
   };
   
   await expect(JiraInitializer.initialize({}, config)).rejects.toThrow('Jira SDK requires auth.host, auth.email, and auth.api_token');
 });
});
