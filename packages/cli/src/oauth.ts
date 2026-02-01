/**
 * OAuth CLI flows for Gmail and Outlook
 *
 * Provides interactive OAuth authentication flows that:
 * 1. Start a local HTTP server to receive callbacks
 * 2. Open the browser for user authorization
 * 3. Exchange authorization code for tokens
 * 4. Store tokens securely using CredentialManager (Fernet encryption)
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import open from 'open';
import chalk from 'chalk';
import { createCredentialManager, CredentialType } from '@marktoflow/core';

const DEFAULT_PORT = 8484;
const CREDENTIALS_DIR = '.marktoflow/credentials';
const STATE_DIR = join(homedir(), '.marktoflow', 'state');

// Lazy-initialized credential manager for secure token storage
let _credentialManager: ReturnType<typeof createCredentialManager> | null = null;

function getCredentialManager(): ReturnType<typeof createCredentialManager> {
  if (!_credentialManager) {
    _credentialManager = createCredentialManager({
      stateDir: STATE_DIR,
    });
  }
  return _credentialManager;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type: string;
  scope?: string;
}

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  port?: number;
}

export interface OutlookOAuthConfig {
  clientId: string;
  clientSecret?: string; // Optional for public clients
  tenantId?: string; // 'common' for multi-tenant, or specific tenant ID
  scopes?: string[];
  port?: number;
}

/**
 * Start a local server and wait for OAuth callback
 */
async function waitForCallback(port: number): Promise<{ code: string; state?: string }> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const state = url.searchParams.get('state');

        if (error) {
          cleanup();
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body>
              <h1>Authentication Failed</h1>
              <p>Error: ${error}</p>
              <p>You can close this window.</p>
            </body></html>
          `);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          cleanup();
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body>
              <h1>Authentication Failed</h1>
              <p>No authorization code received.</p>
              <p>You can close this window.</p>
            </body></html>
          `);
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        cleanup();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body>
            <h1>Authentication Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
            <script>window.close();</script>
          </body></html>
        `);

        // Close server and resolve after response is sent
        res.on('finish', () => {
          server.close(() => {
            resolve({ code, state: state ?? undefined });
          });
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });

    server.listen(port, () => {
      console.log(chalk.dim(`Waiting for OAuth callback on port ${port}...`));
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout: no callback received within 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Save tokens securely using CredentialManager (Fernet encryption)
 */
function saveTokens(service: string, tokens: OAuthTokens): void {
  const credentialName = `oauth:${service}`;
  const credentialManager = getCredentialManager();

  // Store tokens as encrypted JSON
  credentialManager.set({
    name: credentialName,
    value: JSON.stringify(tokens),
    credentialType: CredentialType.OAUTH_TOKEN,
    description: `OAuth tokens for ${service}`,
    expiresAt: tokens.expires_at ? new Date(tokens.expires_at) : undefined,
    tags: ['oauth', service],
  });

  console.log(chalk.green(`Tokens saved securely for ${service}`));
}

/**
 * Load tokens from secure credential storage
 */
export function loadTokens(service: string): OAuthTokens | null {
  const credentialName = `oauth:${service}`;
  const credentialManager = getCredentialManager();

  try {
    if (!credentialManager.exists(credentialName)) {
      // Fall back to legacy file-based storage for migration
      return loadLegacyTokens(service);
    }

    const decrypted = credentialManager.get(credentialName);
    return JSON.parse(decrypted) as OAuthTokens;
  } catch {
    return null;
  }
}

/**
 * Load tokens from legacy file-based storage (for migration)
 */
function loadLegacyTokens(service: string): OAuthTokens | null {
  const path = join(CREDENTIALS_DIR, `${service}.json`);
  if (!existsSync(path)) return null;
  try {
    const tokens = JSON.parse(readFileSync(path, 'utf-8')) as OAuthTokens;

    // Migrate to secure storage
    console.log(chalk.dim(`Migrating ${service} tokens to secure storage...`));
    saveTokens(service, tokens);

    return tokens;
  } catch {
    return null;
  }
}

// ============================================================================
// Gmail OAuth
// ============================================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Legacy Gmail constants (for backward compatibility)
const GMAIL_AUTH_URL = GOOGLE_AUTH_URL;
const GMAIL_TOKEN_URL = GOOGLE_TOKEN_URL;

const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

const DEFAULT_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

const DEFAULT_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

const DEFAULT_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const DEFAULT_DOCS_SCOPES = [
  'https://www.googleapis.com/auth/documents',
];

// Combined Google Workspace scopes (for all-in-one auth)
const DEFAULT_GOOGLE_WORKSPACE_SCOPES = [
  ...DEFAULT_GMAIL_SCOPES,
  ...DEFAULT_DRIVE_SCOPES,
  ...DEFAULT_SHEETS_SCOPES,
  ...DEFAULT_CALENDAR_SCOPES,
  ...DEFAULT_DOCS_SCOPES,
];

/**
 * Run Gmail OAuth flow
 */
export async function runGmailOAuth(config: GmailOAuthConfig): Promise<OAuthTokens> {
  const port = config.port ?? DEFAULT_PORT;
  const redirectUri = `http://localhost:${port}/callback`;
  const scopes = config.scopes ?? DEFAULT_GMAIL_SCOPES;

  // Build authorization URL
  const authUrl = new URL(GMAIL_AUTH_URL);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force refresh token

  console.log(chalk.bold('\nGmail OAuth Flow'));
  console.log(chalk.dim('Opening browser for authorization...'));

  // Open browser
  await open(authUrl.toString());

  // Wait for callback
  const { code } = await waitForCallback(port);

  console.log(chalk.dim('Exchanging code for tokens...'));

  // Exchange code for tokens
  const tokenResponse = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };

  saveTokens('gmail', tokens);
  return tokens;
}

/**
 * Run Google OAuth flow for any Google service (Drive, Sheets, Calendar, Docs, etc.)
 */
export async function runGoogleOAuth(
  service: string,
  config: GmailOAuthConfig
): Promise<OAuthTokens> {
  const port = config.port ?? DEFAULT_PORT;
  const redirectUri = `http://localhost:${port}/callback`;

  // Select scopes based on service
  let defaultScopes: string[];
  let serviceName: string;

  switch (service) {
    case 'google-drive':
    case 'drive':
      defaultScopes = DEFAULT_DRIVE_SCOPES;
      serviceName = 'Google Drive';
      break;
    case 'google-sheets':
    case 'sheets':
      defaultScopes = DEFAULT_SHEETS_SCOPES;
      serviceName = 'Google Sheets';
      break;
    case 'google-calendar':
    case 'calendar':
      defaultScopes = DEFAULT_CALENDAR_SCOPES;
      serviceName = 'Google Calendar';
      break;
    case 'google-docs':
    case 'docs':
      defaultScopes = DEFAULT_DOCS_SCOPES;
      serviceName = 'Google Docs';
      break;
    case 'google-workspace':
    case 'workspace':
      defaultScopes = DEFAULT_GOOGLE_WORKSPACE_SCOPES;
      serviceName = 'Google Workspace (All Services)';
      break;
    case 'google-gmail':
    case 'gmail':
    default:
      defaultScopes = DEFAULT_GMAIL_SCOPES;
      serviceName = 'Gmail';
      break;
  }

  const scopes = config.scopes ?? defaultScopes;

  // Build authorization URL
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force refresh token

  console.log(chalk.bold(`\n${serviceName} OAuth Flow`));
  console.log(chalk.dim('Opening browser for authorization...'));
  console.log(chalk.dim(`Scopes requested: ${scopes.length} permissions`));

  // Open browser
  await open(authUrl.toString());

  // Wait for callback
  const { code } = await waitForCallback(port);

  console.log(chalk.dim('Exchanging code for tokens...'));

  // Exchange code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };

  // Normalize service name for saving
  const normalizedService = service.startsWith('google-') ? service : `google-${service}`;
  saveTokens(normalizedService, tokens);

  console.log(chalk.green(`\n✓ ${serviceName} connected successfully!`));
  console.log(chalk.dim(`Tokens saved to ${CREDENTIALS_DIR}/${normalizedService}.json`));

  return tokens;
}

// ============================================================================
// Outlook OAuth
// ============================================================================

const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';
const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
const DEFAULT_OUTLOOK_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Mail.Send',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'offline_access',
];

/**
 * Run Outlook/Microsoft Graph OAuth flow
 */
export async function runOutlookOAuth(config: OutlookOAuthConfig): Promise<OAuthTokens> {
  const port = config.port ?? DEFAULT_PORT;
  const redirectUri = `http://localhost:${port}/callback`;
  const tenant = config.tenantId ?? 'common';
  const scopes = config.scopes ?? DEFAULT_OUTLOOK_SCOPES;

  const authUrl = new URL(OUTLOOK_AUTH_URL.replace('{tenant}', tenant));
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('response_mode', 'query');

  console.log(chalk.bold('\nOutlook/Microsoft Graph OAuth Flow'));
  console.log(chalk.dim('Opening browser for authorization...'));

  // Open browser
  await open(authUrl.toString());

  // Wait for callback
  const { code } = await waitForCallback(port);

  console.log(chalk.dim('Exchanging code for tokens...'));

  // Exchange code for tokens
  const tokenUrl = OUTLOOK_TOKEN_URL.replace('{tenant}', tenant);
  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  });

  // Add client secret if provided (confidential client)
  if (config.clientSecret) {
    tokenParams.set('client_secret', config.clientSecret);
  }

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };

  saveTokens('outlook', tokens);
  return tokens;
}

// ============================================================================
// Token refresh
// ============================================================================

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(
  config: GmailOAuthConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const tokenResponse = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token refresh failed: ${await tokenResponse.text()}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: refreshToken, // Keep the original refresh token
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };

  saveTokens('gmail', tokens);
  return tokens;
}

/**
 * Refresh Outlook access token
 */
export async function refreshOutlookToken(
  config: OutlookOAuthConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const tenant = config.tenantId ?? 'common';
  const tokenUrl = OUTLOOK_TOKEN_URL.replace('{tenant}', tenant);
  const scopes = config.scopes ?? DEFAULT_OUTLOOK_SCOPES;

  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: scopes.join(' '),
  });

  if (config.clientSecret) {
    tokenParams.set('client_secret', config.clientSecret);
  }

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams,
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token refresh failed: ${await tokenResponse.text()}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    scope?: string;
  };

  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? refreshToken,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };

  saveTokens('outlook', tokens);
  return tokens;
}
