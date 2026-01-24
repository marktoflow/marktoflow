import { WebClient } from '@slack/web-api';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const SlackInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string;
    if (!token) {
      throw new Error('Slack SDK requires auth.token');
    }
    return new WebClient(token);
  },
};
