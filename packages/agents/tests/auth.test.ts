import { describe, expect, it } from 'vitest';
import {
  asSecret,
  isOAuthExpired,
  redactSecret,
  sanitizeAuthForLogging,
  toAuthorizationHeader,
  validateAuth,
} from '../src/auth.js';
import { AgentError } from '../src/errors.js';

describe('auth utilities', () => {
  it('redacts secrets', () => {
    expect(redactSecret('abcdef123456')).toBe('***3456');
    expect(redactSecret('abc')).toBe('***');
    expect(redactSecret(undefined)).toBe('***');
  });

  it('sanitizes api key auth for logs', () => {
    const safe = sanitizeAuthForLogging({
      type: 'api_key',
      apiKey: asSecret('my-secret-key'),
    });

    expect(safe).toEqual({
      type: 'api_key',
      headerName: undefined,
      prefix: undefined,
      apiKey: '***-key',
    });
  });

  it('sanitizes oauth auth for logs', () => {
    const safe = sanitizeAuthForLogging({
      type: 'oauth',
      accessToken: asSecret('access-token-value'),
      refreshToken: asSecret('refresh-token-value'),
      expiresAt: 100,
      tokenType: 'Bearer',
      scopes: ['read'],
    });

    expect(safe).toEqual({
      type: 'oauth',
      tokenType: 'Bearer',
      expiresAt: 100,
      scopes: ['read'],
      accessToken: '***alue',
      refreshToken: '***alue',
    });
  });

  it('detects oauth expiry', () => {
    expect(
      isOAuthExpired(
        {
          type: 'oauth',
          accessToken: asSecret('token'),
          expiresAt: 50,
        },
        100
      )
    ).toBe(true);

    expect(
      isOAuthExpired(
        {
          type: 'oauth',
          accessToken: asSecret('token'),
        },
        100
      )
    ).toBe(false);
  });

  it('builds authorization headers for auth types', () => {
    expect(
      toAuthorizationHeader({
        type: 'api_key',
        apiKey: asSecret('abc123'),
      })
    ).toEqual({
      headerName: 'Authorization',
      headerValue: 'Bearer abc123',
    });

    expect(
      toAuthorizationHeader({
        type: 'oauth',
        accessToken: asSecret('xyz789'),
        tokenType: 'Bearer',
      })
    ).toEqual({
      headerName: 'Authorization',
      headerValue: 'Bearer xyz789',
    });
  });

  it('validates auth payloads and rejects invalid values', () => {
    expect(() =>
      validateAuth({
        type: 'api_key',
        apiKey: asSecret('valid-key'),
      })
    ).not.toThrow();

    expect(() =>
      validateAuth({
        type: 'oauth',
        accessToken: asSecret('valid-token'),
      })
    ).not.toThrow();

    expect(() =>
      validateAuth({
        type: 'api_key',
        apiKey: asSecret(''),
      })
    ).toThrow(AgentError);

    expect(() =>
      validateAuth({
        type: 'oauth',
        accessToken: asSecret(''),
      })
    ).toThrow(AgentError);
  });
});
