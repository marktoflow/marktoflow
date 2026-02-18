/**
 * Tests that Discord and Notion use proper URLSearchParams encoding for query
 * parameters rather than manual string concatenation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Discord getMessages ───────────────────────────────────────────────────────

describe('Discord getMessages URL encoding', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should build query string with URLSearchParams', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('[]'),
      });
    }) as unknown as typeof global.fetch;

    const { DiscordClient } = await import('../src/services/discord.js');
    const client = new DiscordClient('test-token');

    await client.getMessages('123456', { limit: 50, before: '999' });

    expect(capturedUrl).toContain('limit=50');
    expect(capturedUrl).toContain('before=999');
    // Both params separated by &
    expect(capturedUrl).toMatch(/\?.*&/);
  });

  it('should omit query string entirely when no options given', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('[]'),
      });
    }) as unknown as typeof global.fetch;

    const { DiscordClient } = await import('../src/services/discord.js');
    const client = new DiscordClient('test-token');

    await client.getMessages('123456');

    expect(capturedUrl).toContain('/channels/123456/messages');
    expect(capturedUrl).not.toContain('?');
  });

  it('should include all four optional params when set', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve('[]'),
      });
    }) as unknown as typeof global.fetch;

    const { DiscordClient } = await import('../src/services/discord.js');
    const client = new DiscordClient('test-token');

    await client.getMessages('chan1', {
      around: 'aaa',
      before: 'bbb',
      after: 'ccc',
      limit: 10,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('around')).toBe('aaa');
    expect(url.searchParams.get('before')).toBe('bbb');
    expect(url.searchParams.get('after')).toBe('ccc');
    expect(url.searchParams.get('limit')).toBe('10');
  });
});

// ── Notion getBlockChildren ───────────────────────────────────────────────────

describe('Notion getBlockChildren pagination param encoding', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should append start_cursor and page_size as URL query params', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ results: [], has_more: false, next_cursor: null }),
          ),
      });
    }) as unknown as typeof global.fetch;

    const { NotionClient } = await import('../src/services/notion.js');
    const client = new NotionClient('test-token');

    await client.getBlockChildren('block-abc', {
      startCursor: 'cursor-xyz',
      pageSize: 25,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('start_cursor')).toBe('cursor-xyz');
    expect(url.searchParams.get('page_size')).toBe('25');
  });

  it('should omit query string when no pagination options given', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ results: [], has_more: false, next_cursor: null }),
          ),
      });
    }) as unknown as typeof global.fetch;

    const { NotionClient } = await import('../src/services/notion.js');
    const client = new NotionClient('test-token');

    await client.getBlockChildren('block-abc');

    expect(capturedUrl).toContain('/blocks/block-abc/children');
    expect(capturedUrl).not.toContain('?');
  });

  it('should properly encode a cursor that contains special characters', async () => {
    let capturedUrl = '';

    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () =>
          Promise.resolve(
            JSON.stringify({ results: [], has_more: false, next_cursor: null }),
          ),
      });
    }) as unknown as typeof global.fetch;

    const { NotionClient } = await import('../src/services/notion.js');
    const client = new NotionClient('test-token');

    const specialCursor = 'cursor+with spaces&special=chars';
    await client.getBlockChildren('block-abc', { startCursor: specialCursor });

    const url = new URL(capturedUrl);
    // URLSearchParams must encode the value; raw concat would break the URL
    expect(url.searchParams.get('start_cursor')).toBe(specialCursor);
    expect(capturedUrl).not.toContain('cursor+with spaces');
  });
});
