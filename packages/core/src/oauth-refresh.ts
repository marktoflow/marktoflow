/**
 * OAuth Token Refresh Utilities
 *
 * Provides automatic token refresh for OAuth2 providers.
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface GoogleOAuthRefreshResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

export interface MicrosoftOAuthRefreshResponse {
  access_token: string;
  expires_in: number;
  ext_expires_in?: number;
  token_type: string;
  scope?: string;
}

/**
 * Refresh Google OAuth2 access token using refresh token
 */
export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<OAuthTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${response.status} ${error}`);
  }

  const data = (await response.json()) as GoogleOAuthRefreshResponse;

  return {
    accessToken: data.access_token,
    refreshToken, // Google doesn't return a new refresh token
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Refresh Microsoft Graph OAuth2 access token using refresh token
 */
export async function refreshMicrosoftToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  tenantId: string = 'common'
): Promise<OAuthTokens> {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Microsoft token: ${response.status} ${error}`);
  }

  const data = (await response.json()) as MicrosoftOAuthRefreshResponse;

  return {
    accessToken: data.access_token,
    refreshToken, // Microsoft may return a new refresh token in some flows
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Generic OAuth2 token refresh
 */
export async function refreshOAuthToken(
  provider: 'google' | 'microsoft',
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  tenantId?: string
): Promise<OAuthTokens> {
  switch (provider) {
    case 'google':
      return refreshGoogleToken(clientId, clientSecret, refreshToken);
    case 'microsoft':
      return refreshMicrosoftToken(clientId, clientSecret, refreshToken, tenantId);
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
