import { Octokit } from '@octokit/rest';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';
import { githubSchemas } from '../reliability/schemas/github.js';

export const GitHubInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string;
    if (!token) {
      throw new Error('GitHub SDK requires auth.token');
    }
    const client = new Octokit({ auth: token });
    return wrapIntegration('github', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: githubSchemas,
    });
  },
};
