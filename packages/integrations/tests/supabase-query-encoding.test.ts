/**
 * Tests for Supabase query parameter encoding.
 *
 * Verifies that filter values with special characters (&, =, spaces)
 * are properly URL-encoded instead of being concatenated into raw strings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseClient } from '../src/services/supabase.js';

describe('Supabase query parameter encoding', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should properly encode filter values with special characters', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('users');

    await query.select({
      filter: [
        { column: 'name', operator: 'eq', value: 'John & Jane' },
      ],
    });

    // The value "John & Jane" must be encoded — if it were raw, the & would
    // split the query string and corrupt the URL
    const url = new URL(capturedUrl);
    expect(url.searchParams.get('name')).toBe('eq.John & Jane');
    // Ensure it's not treated as separate params
    expect(capturedUrl).not.toContain('&Jane');
  });

  it('should properly encode filter values with equals signs', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('items');

    await query.select({
      filter: [
        { column: 'formula', operator: 'eq', value: 'x=y+z' },
      ],
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('formula')).toBe('eq.x=y+z');
  });

  it('should encode table names with special characters', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('my table');

    await query.select();

    expect(capturedUrl).toContain('my%20table');
    expect(capturedUrl).not.toContain('my table');
  });

  it('should properly encode multiple filters', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('users');

    await query.select({
      filter: [
        { column: 'status', operator: 'eq', value: 'active' },
        { column: 'name', operator: 'like', value: '%test&value%' },
      ],
      limit: 10,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('status')).toBe('eq.active');
    expect(url.searchParams.get('name')).toBe('like.%test&value%');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('should encode filter values in update', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('users');

    await query.update({
      data: { name: 'updated' },
      filter: [{ column: 'email', operator: 'eq', value: 'test&user@example.com' }],
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('email')).toBe('eq.test&user@example.com');
  });

  it('should encode filter values in delete', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }) as unknown as typeof global.fetch;

    const client = new SupabaseClient('https://test.supabase.co', 'test-key');
    const query = await client.from('users');

    await query.delete({
      filter: [{ column: 'tag', operator: 'eq', value: 'a&b=c' }],
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('tag')).toBe('eq.a&b=c');
  });
});
