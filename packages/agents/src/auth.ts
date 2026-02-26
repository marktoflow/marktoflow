import { AgentError } from './errors.js';
import type {
  ApiKeyAuthConfig,
  AuthConfig,
  OAuthAuthConfig,
  SecretString,
} from './types.js';

const DEFAULT_MASK = '***';

export function asSecret(value: string): SecretString {
  return value as SecretString;
}

export function redactSecret(value: string | undefined, visibleChars = 4): string {
  if (!value) {
    return DEFAULT_MASK;
  }

  if (value.length <= visibleChars) {
    return DEFAULT_MASK;
  }

  return `${value.slice(0, visibleChars)}${DEFAULT_MASK}`;
}

export function sanitizeAuthForLogging(auth?: AuthConfig): Record<string, unknown> | undefined {
  if (!auth) {
    return undefined;
  }

  if (auth.type === 'api_key') {
    return {
      type: auth.type,
      headerName: auth.headerName,
      prefix: auth.prefix,
      apiKey: redactSecret(auth.apiKey),
    };
  }

  return {
    type: auth.type,
    tokenType: auth.tokenType,
    expiresAt: auth.expiresAt,
    scopes: auth.scopes,
    accessToken: redactSecret(auth.accessToken),
    refreshToken: auth.refreshToken ? redactSecret(auth.refreshToken) : undefined,
  };
}

export function isOAuthExpired(auth: OAuthAuthConfig, nowMs = Date.now()): boolean {
  if (!auth.expiresAt) {
    return false;
  }

  return auth.expiresAt <= nowMs;
}

export function toAuthorizationHeader(auth: AuthConfig): { headerName: string; headerValue: string } {
  if (auth.type === 'api_key') {
    const headerName = auth.headerName ?? 'Authorization';
    const prefix = auth.prefix ?? 'Bearer';
    return {
      headerName,
      headerValue: `${prefix} ${auth.apiKey}`,
    };
  }

  const tokenType = auth.tokenType ?? 'Bearer';
  return {
    headerName: 'Authorization',
    headerValue: `${tokenType} ${auth.accessToken}`,
  };
}

function validateApiKeyAuth(auth: ApiKeyAuthConfig): void {
  if (!auth.apiKey || auth.apiKey.trim().length === 0) {
    throw new AgentError('INVALID_CONFIG', 'API key auth requires a non-empty apiKey');
  }
}

function validateOAuthAuth(auth: OAuthAuthConfig): void {
  if (!auth.accessToken || auth.accessToken.trim().length === 0) {
    throw new AgentError('INVALID_CONFIG', 'OAuth auth requires a non-empty accessToken');
  }
}

export function validateAuth(auth?: AuthConfig): void {
  if (!auth) {
    return;
  }

  if (auth.type === 'api_key') {
    validateApiKeyAuth(auth);
    return;
  }

  validateOAuthAuth(auth);
}
