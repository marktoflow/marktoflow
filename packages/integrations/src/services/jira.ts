import { Version3Client } from 'jira.js';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const JiraInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = config.auth?.['host'] as string;
    const email = config.auth?.['email'] as string;
    const apiToken = config.auth?.['api_token'] as string;

    if (!host || !email || !apiToken) {
      throw new Error('Jira SDK requires auth.host, auth.email, and auth.api_token');
    }

    return new Version3Client({
      host,
      authentication: {
        basic: {
          email,
          apiToken,
        },
      },
    });
  },
};
