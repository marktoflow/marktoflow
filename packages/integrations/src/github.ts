import { Octokit } from '@octokit/rest';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const GitHubInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string;
    // GitHub API can be used without token for public data, but usually we want a token
    // We'll enforce token for now to match other integrations, or make it optional.
    // Let's make it optional but recommended.
    
    return new Octokit({ 
      auth: token 
    });
  },
};
