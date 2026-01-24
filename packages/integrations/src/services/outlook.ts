import { Client } from '@microsoft/microsoft-graph-client';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const OutlookInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    if (!token) {
      throw new Error('Outlook SDK requires auth.token');
    }

    const client = Client.init({
      authProvider: (done) => {
        done(null, token);
      },
    });

    return client;
  },
};
