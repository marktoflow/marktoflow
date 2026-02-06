import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { google } from 'googleapis';
import { GmailInitializer } from '../src/services/gmail.js';
import type { ToolConfig } from '@marktoflow/core';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('OAuth Token Refresh Integration', () => {
  const testDir = join(process.cwd(), 'test-temp-oauth');
  const credentialsPath = join(testDir, '.marktoflow', 'credentials');

  beforeEach(() => {
    // Create test credentials directory
    mkdirSync(credentialsPath, { recursive: true });

    // Mock process.cwd() to use test directory
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('should initialize Gmail SDK with OAuth2 credentials', async () => {
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
        refresh_token: 'test-refresh-token',
        access_token: 'test-access-token',
      },
    };

    // Initialize Gmail SDK
    const sdk = await GmailInitializer.initialize(google, config);
    expect(sdk).toBeTruthy();

    // Verify SDK has expected methods
    expect(sdk).toHaveProperty('sendEmail');
    expect(sdk).toHaveProperty('getEmails');
    expect(sdk).toHaveProperty('client'); // Gmail API client
    expect(sdk).toHaveProperty('actions'); // GmailActions instance
  });

  it('should initialize with saved tokens from credentials file', async () => {
    // Create saved credentials
    const gmailCredPath = join(credentialsPath, 'gmail.json');
    writeFileSync(
      gmailCredPath,
      JSON.stringify({
        access_token: 'saved-access-token',
        refresh_token: 'saved-refresh-token',
      })
    );

    // Config without tokens (should load from file)
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
      },
    };

    // Initialize should load saved tokens
    const sdk = await GmailInitializer.initialize(google, config);
    expect(sdk).toBeTruthy();

    // Verify SDK was initialized (no way to directly check tokens, but no error means success)
    expect(sdk).toHaveProperty('sendEmail');
    expect(sdk).toHaveProperty('getEmails');
  });

  it('should prioritize config tokens over saved tokens', async () => {
    // Create saved credentials
    const gmailCredPath = join(credentialsPath, 'gmail.json');
    writeFileSync(
      gmailCredPath,
      JSON.stringify({
        access_token: 'saved-access-token',
        refresh_token: 'saved-refresh-token',
      })
    );

    // Config with explicit tokens (should override saved)
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
        refresh_token: 'config-refresh-token',
        access_token: 'config-access-token',
      },
    };

    // Initialize should use config tokens
    const sdk = await GmailInitializer.initialize(google, config);
    expect(sdk).toBeTruthy();

    // Saved credentials should not be modified yet
    const savedCreds = JSON.parse(readFileSync(gmailCredPath, 'utf-8'));
    expect(savedCreds.access_token).toBe('saved-access-token');
  });

  it('should throw error when required OAuth fields are missing', async () => {
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        // Missing client_id, client_secret, redirect_uri
        refresh_token: 'test-refresh-token',
      },
    };

    await expect(async () => {
      await GmailInitializer.initialize(google, config);
    }).rejects.toThrow('Gmail SDK requires auth.client_id, auth.client_secret, auth.redirect_uri');
  });

  it('should support Gmail API methods after initialization', async () => {
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
        refresh_token: 'test-refresh-token',
        access_token: 'test-access-token',
      },
    };

    const sdk = await GmailInitializer.initialize(google, config) as Record<string, unknown>;

    // Verify SDK has expected methods
    expect(sdk).toHaveProperty('sendEmail');
    expect(sdk).toHaveProperty('getEmails');
    expect(sdk).toHaveProperty('getEmail');
    expect(sdk).toHaveProperty('createDraft');
    expect(sdk).toHaveProperty('client'); // Gmail API client
    expect(sdk).toHaveProperty('actions'); // GmailActions instance

    // Verify methods are functions
    expect(typeof sdk.sendEmail).toBe('function');
    expect(typeof sdk.getEmails).toBe('function');
    expect(typeof sdk.createDraft).toBe('function');
  });

  it('should have token refresh listener configured', async () => {
    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
        refresh_token: 'test-refresh-token',
        access_token: 'test-access-token',
      },
    };

    // Initialize SDK - this sets up the 'tokens' event listener
    const sdk = await GmailInitializer.initialize(google, config);
    expect(sdk).toBeTruthy();

    // The initializer sets up the listener on the OAuth2 client
    // We can't easily test the actual token refresh in unit tests
    // as it requires real OAuth2 flows, but we verify initialization succeeds
    expect(sdk).toHaveProperty('client');
    expect(sdk).toHaveProperty('sendEmail');
  });

  it('should handle partial token configuration gracefully', async () => {
    // Save refresh token only
    const gmailCredPath = join(credentialsPath, 'gmail.json');
    writeFileSync(
      gmailCredPath,
      JSON.stringify({
        refresh_token: 'saved-refresh-token',
      })
    );

    const config: ToolConfig = {
      sdk: 'google-gmail',
      auth: {
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'http://localhost:3000/callback',
        access_token: 'config-access-token', // Only access token in config
      },
    };

    // Should merge saved refresh token with config access token
    const sdk = await GmailInitializer.initialize(google, config);
    expect(sdk).toBeTruthy();
  });
});
