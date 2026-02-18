/**
 * Tests for Supabase uploadFile Content-Type handling and signOut error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseClient } from '../src/services/supabase.js';

describe('Supabase uploadFile Content-Type handling', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should use FormData when no contentType is specified', async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = init.body;
      capturedHeaders = init.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ path: 'test/file.txt', id: '123' }),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');

    await client.uploadFile({
      bucket: 'test-bucket',
      path: 'test/file.txt',
      file: Buffer.from('hello'),
    });

    // Body should be FormData when no contentType is provided
    expect(capturedBody).toBeInstanceOf(FormData);
    // Content-Type should NOT be manually set (let FormData set multipart boundary)
    expect(capturedHeaders['Content-Type']).toBeUndefined();
  });

  it('should send raw body when contentType is specified', async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = init.body;
      capturedHeaders = init.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ path: 'test/file.txt', id: '123' }),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const fileData = Buffer.from('hello world');

    await client.uploadFile({
      bucket: 'test-bucket',
      path: 'test/file.txt',
      file: fileData,
      contentType: 'text/plain',
    });

    // Body should be the raw file, not FormData
    expect(capturedBody).toBe(fileData);
    // Content-Type should be set to the specified type
    expect(capturedHeaders['Content-Type']).toBe('text/plain');
  });
});

describe('Supabase signOut error handling', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should throw on failed signOut', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid token'),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    await expect(client.signOut('bad-token')).rejects.toThrow('Supabase API error: 401');
  });

  it('should succeed on valid signOut', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({ ok: true });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    await expect(client.signOut('valid-token')).resolves.toBeUndefined();
  });
});
