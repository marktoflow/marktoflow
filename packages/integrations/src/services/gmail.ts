import { google } from 'googleapis';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export const GmailInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const clientId = config.auth?.['client_id'] as string | undefined;
    const clientSecret = config.auth?.['client_secret'] as string | undefined;
    const redirectUri = config.auth?.['redirect_uri'] as string | undefined;
    const refreshToken = config.auth?.['refresh_token'] as string | undefined;
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail SDK requires auth.client_id, auth.client_secret, auth.redirect_uri');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  },
};
