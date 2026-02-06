import { WebClient } from '@slack/web-api';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';
import { slackSchemas } from '../reliability/schemas/slack.js';

export const SlackInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string;
    if (!token) {
      throw new Error('Slack SDK requires auth.token');
    }
    const client = new WebClient(token);
    return wrapIntegration('slack', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: slackSchemas,
    });
  },
};
