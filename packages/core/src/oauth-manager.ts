/**
 * OAuth Token Manager for marktoflow.
 *
 * Manages OAuth2 token lifecycle:
 * - Stores token expiry alongside credentials
 * - Intercepts 401 responses and refreshes tokens automatically
 * - Saves refreshed tokens back to the credential store
 * - Emits events for token refresh (for audit logging)
 *
 * Supports Google OAuth2, Microsoft (MSAL), and generic OAuth2 refresh flows.
 */

import { EventEmitter } from 'node:events';
import type { CredentialManager } from './credentials.js';
import { CredentialType } from './credentials.js';

// ── Interfaces ──────────────────────────────────────────────────────────────

/** Configuration for a service's OAuth2 refresh flow. */
export interface OAuthServiceConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenEndpoint: string;
  /** Additional parameters to include in the refresh request body. */
  extraParams?: Record<string, string> | undefined;
  /** Scope to request when refreshing (some providers require it). */
  scope?: string | undefined;
}

/** Token data as stored/returned by the manager. */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType?: string | undefined;
  scope?: string | undefined;
}

/** The shape of a successful token endpoint JSON response. */
interface TokenEndpointResponse {
  access_token: string;
  refresh_token?: string | undefined;
  expires_in: number; // seconds
  token_type?: string | undefined;
  scope?: string | undefined;
}

/** Events emitted by OAuthTokenManager. */
export interface OAuthTokenManagerEvents {
  token_refreshed: [serviceName: string, tokenData: OAuthTokenData];
  token_refresh_failed: [serviceName: string, error: Error];
}

// ── Well-known token endpoints ──────────────────────────────────────────────

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const MICROSOFT_TOKEN_ENDPOINT =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// ── Pre-expiry buffer (refresh 5 minutes before actual expiry) ──────────────
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ── OAuthTokenManager ───────────────────────────────────────────────────────

export class OAuthTokenManager extends EventEmitter {
  private serviceConfigs = new Map<string, OAuthServiceConfig>();
  private credentialManager: CredentialManager;
  /** Track in-flight refresh promises to avoid concurrent refreshes for the same service. */
  private refreshLocks = new Map<string, Promise<OAuthTokenData>>();

  constructor(credentialManager: CredentialManager) {
    super();
    this.credentialManager = credentialManager;
  }

  // ── typed emit / on helpers ─────────────────────────────────────────────

  override emit<K extends keyof OAuthTokenManagerEvents>(
    event: K,
    ...args: OAuthTokenManagerEvents[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof OAuthTokenManagerEvents>(
    event: K,
    listener: (...args: OAuthTokenManagerEvents[K]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<K extends keyof OAuthTokenManagerEvents>(
    event: K,
    listener: (...args: OAuthTokenManagerEvents[K]) => void,
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  // ── Configuration ───────────────────────────────────────────────────────

  /**
   * Register OAuth2 configuration for a service.
   */
  registerService(serviceName: string, config: OAuthServiceConfig): void {
    this.serviceConfigs.set(serviceName, config);
  }

  /**
   * Register a Google OAuth2 service using standard Google token endpoint.
   */
  registerGoogleService(
    serviceName: string,
    config: Omit<OAuthServiceConfig, 'tokenEndpoint'>,
  ): void {
    this.registerService(serviceName, {
      ...config,
      tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    });
  }

  /**
   * Register a Microsoft (MSAL) OAuth2 service.
   * Optionally provide a tenant ID; defaults to "common".
   */
  registerMicrosoftService(
    serviceName: string,
    config: Omit<OAuthServiceConfig, 'tokenEndpoint'> & {
      tenantId?: string | undefined;
    },
  ): void {
    const tenant = config.tenantId ?? 'common';
    const endpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const { tenantId: _unused, ...rest } = config;
    this.registerService(serviceName, {
      ...rest,
      tokenEndpoint: endpoint,
    });
  }

  /**
   * Remove a registered service configuration.
   */
  unregisterService(serviceName: string): boolean {
    return this.serviceConfigs.delete(serviceName);
  }

  /**
   * Get the configuration for a registered service.
   */
  getServiceConfig(serviceName: string): OAuthServiceConfig | undefined {
    return this.serviceConfigs.get(serviceName);
  }

  /**
   * List all registered service names.
   */
  listServices(): string[] {
    return Array.from(this.serviceConfigs.keys());
  }

  // ── Token persistence helpers ───────────────────────────────────────────

  /**
   * Save token data for a service into the credential store.
   */
  saveToken(serviceName: string, tokenData: OAuthTokenData): void {
    const credName = this.credentialName(serviceName);
    this.credentialManager.set({
      name: credName,
      value: JSON.stringify(tokenData),
      credentialType: CredentialType.OAUTH_TOKEN,
      description: `OAuth2 token for ${serviceName}`,
      metadata: {
        serviceName,
        expiresAt: tokenData.expiresAt,
        tokenType: tokenData.tokenType ?? 'Bearer',
      },
      expiresAt: new Date(tokenData.expiresAt),
      tags: ['oauth', serviceName],
    });
  }

  /**
   * Load token data for a service from the credential store.
   * Returns null if not found.
   */
  loadToken(serviceName: string): OAuthTokenData | null {
    const credName = this.credentialName(serviceName);
    if (!this.credentialManager.exists(credName)) {
      return null;
    }
    try {
      const raw = this.credentialManager.get(credName, true);
      return JSON.parse(raw) as OAuthTokenData;
    } catch {
      return null;
    }
  }

  // ── Core methods ────────────────────────────────────────────────────────

  /**
   * Check whether the token is expired (or close to expiry) and refresh if needed.
   * Returns the current token data if still valid, or a refreshed token.
   */
  async refreshIfNeeded(
    serviceName: string,
    tokenData: OAuthTokenData,
  ): Promise<OAuthTokenData> {
    if (!this.isExpiredOrExpiring(tokenData)) {
      return tokenData;
    }
    return this.doRefresh(serviceName, tokenData);
  }

  /**
   * Handle an authentication error (e.g., 401 response).
   * If the error looks like a 401/auth error, attempt a token refresh.
   * Returns refreshed token data on success, or re-throws on failure.
   */
  async handleAuthError(
    serviceName: string,
    tokenData: OAuthTokenData,
    error: unknown,
  ): Promise<OAuthTokenData> {
    if (!this.isAuthError(error)) {
      throw error;
    }
    return this.doRefresh(serviceName, tokenData);
  }

  /**
   * Force a token refresh regardless of expiry status.
   */
  async forceRefresh(
    serviceName: string,
    tokenData: OAuthTokenData,
  ): Promise<OAuthTokenData> {
    return this.doRefresh(serviceName, tokenData);
  }

  /**
   * Check whether a token is expired or will expire within the buffer window.
   */
  isExpiredOrExpiring(tokenData: OAuthTokenData): boolean {
    return Date.now() >= tokenData.expiresAt - TOKEN_EXPIRY_BUFFER_MS;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private credentialName(serviceName: string): string {
    return `oauth:${serviceName}`;
  }

  /**
   * Determine if an error represents an HTTP 401 / auth failure.
   */
  private isAuthError(error: unknown): boolean {
    if (error == null) return false;

    // Check for status / statusCode properties
    if (typeof error === 'object') {
      const obj = error as Record<string, unknown>;
      if (obj['status'] === 401 || obj['statusCode'] === 401) return true;
      if (typeof obj['code'] === 'string' && obj['code'] === 'UNAUTHENTICATED')
        return true;
      // Nested response.status pattern (e.g. Axios errors)
      if (
        typeof obj['response'] === 'object' &&
        obj['response'] !== null &&
        (obj['response'] as Record<string, unknown>)['status'] === 401
      ) {
        return true;
      }
    }

    // Check message string
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('unauthenticated')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Perform the actual token refresh. Uses a lock to prevent concurrent
   * refreshes for the same service.
   */
  private async doRefresh(
    serviceName: string,
    tokenData: OAuthTokenData,
  ): Promise<OAuthTokenData> {
    // If there is already an in-flight refresh for this service, wait for it.
    const existing = this.refreshLocks.get(serviceName);
    if (existing) {
      return existing;
    }

    const refreshPromise = this.executeRefresh(serviceName, tokenData);
    this.refreshLocks.set(serviceName, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshLocks.delete(serviceName);
    }
  }

  /**
   * Execute the HTTP call to the token endpoint.
   */
  private async executeRefresh(
    serviceName: string,
    tokenData: OAuthTokenData,
  ): Promise<OAuthTokenData> {
    const config = this.serviceConfigs.get(serviceName);
    if (!config) {
      const err = new Error(
        `No OAuth configuration registered for service "${serviceName}"`,
      );
      this.emit('token_refresh_failed', serviceName, err);
      throw err;
    }

    // Use the stored config's refreshToken as fallback
    const refreshToken = tokenData.refreshToken || config.refreshToken;

    // Build the form body
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    });

    if (config.scope) {
      params.set('scope', config.scope);
    }

    if (config.extraParams) {
      for (const [key, value] of Object.entries(config.extraParams)) {
        params.set(key, value);
      }
    }

    try {
      const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Token refresh failed for "${serviceName}": HTTP ${response.status} - ${body}`,
        );
      }

      const data = (await response.json()) as TokenEndpointResponse;

      const newTokenData: OAuthTokenData = {
        accessToken: data.access_token,
        // Some providers rotate refresh tokens; use the new one if provided.
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
        tokenType: data.token_type ?? tokenData.tokenType,
        scope: data.scope ?? tokenData.scope,
      };

      // Persist to credential store
      this.saveToken(serviceName, newTokenData);

      // Also update the service config's refresh token if it was rotated.
      if (data.refresh_token && data.refresh_token !== config.refreshToken) {
        config.refreshToken = data.refresh_token;
      }

      this.emit('token_refreshed', serviceName, newTokenData);
      return newTokenData;
    } catch (error) {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error(`Token refresh failed: ${String(error)}`);
      this.emit('token_refresh_failed', serviceName, wrappedError);
      throw wrappedError;
    }
  }
}

// ── Factory helpers ─────────────────────────────────────────────────────────

/**
 * Create an OAuthTokenManager wired to the given CredentialManager.
 */
export function createOAuthTokenManager(
  credentialManager: CredentialManager,
): OAuthTokenManager {
  return new OAuthTokenManager(credentialManager);
}

/**
 * Well-known token endpoints for convenience.
 */
export const TOKEN_ENDPOINTS = {
  google: GOOGLE_TOKEN_ENDPOINT,
  microsoft: MICROSOFT_TOKEN_ENDPOINT,
} as const;
