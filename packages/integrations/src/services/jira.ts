import { Version2Client, Version3Client } from 'jira.js';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';
import { jiraSchemas } from '../reliability/schemas/jira.js';

export const JiraInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = config.auth?.['host'] as string;
    const email = config.auth?.['email'] as string;
    const apiToken = config.auth?.['api_token'] as string;
    const apiVersion = (config.auth?.['api_version'] as string) || 'auto';

    if (!host || !email || !apiToken) {
      throw new Error('Jira SDK requires auth.host, auth.email, and auth.api_token');
    }

    // Determine which API version to use
    // - 'auto': detect based on host (Cloud uses v3, self-hosted uses v2)
    // - '2' or 'v2': force Version2Client
    // - '3' or 'v3': force Version3Client
    let useVersion3 = true;

    if (apiVersion === 'auto') {
      // Jira Cloud uses .atlassian.net domain
      useVersion3 = host.includes('.atlassian.net');
    } else {
      useVersion3 = apiVersion === '3' || apiVersion === 'v3';
    }

    const authConfig = {
      host,
      authentication: {
        basic: {
          email,
          apiToken,
        },
      },
    };

    const client = useVersion3 ? new Version3Client(authConfig) : new Version2Client(authConfig);
    return wrapIntegration('jira', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: jiraSchemas,
    });
  },
};
