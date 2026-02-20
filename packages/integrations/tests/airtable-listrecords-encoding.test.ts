/**
 * Tests that AirtableClient.listRecords uses URLSearchParams for all query
 * params so values like cursor offsets, formulas, and field names are properly
 * URL-encoded rather than concatenated raw into the request path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AirtableClient.listRecords URL encoding', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  function mockFetch() {
    let capturedUrl = '';
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify({ records: [], offset: undefined })),
      });
    }) as unknown as typeof global.fetch;
    return { getUrl: () => capturedUrl };
  }

  it('encodes the offset cursor (which can contain +, =, /)', async () => {
    const { getUrl } = mockFetch();
    const { AirtableClient } = await import('../src/services/airtable.js');
    const client = new AirtableClient('token', 'appBase123');

    await client.listRecords('Tasks', {
      offset: 'itrOpaqueCursor+with=special/chars',
    });

    const url = new URL(getUrl());
    expect(url.searchParams.get('offset')).toBe('itrOpaqueCursor+with=special/chars');
    // Raw concatenation would produce offset=itrOpaqueCursor+with=special/chars
    // (unencoded), URLSearchParams produces offset=itrOpaqueCursor%2Bwith%3Dspecial%2Fchars
    expect(url.search).not.toContain('offset=itrOpaqueCursor+with=special');
  });

  it('encodes filterByFormula containing equals and ampersands', async () => {
    const { getUrl } = mockFetch();
    const { AirtableClient } = await import('../src/services/airtable.js');
    const client = new AirtableClient('token', 'appBase123');

    await client.listRecords('Tasks', {
      filterByFormula: "AND({Status}='Open',{Priority}='High')",
    });

    const url = new URL(getUrl());
    expect(url.searchParams.get('filterByFormula')).toBe("AND({Status}='Open',{Priority}='High')");
  });

  it('repeats fields[] correctly for multiple fields', async () => {
    const { getUrl } = mockFetch();
    const { AirtableClient } = await import('../src/services/airtable.js');
    const client = new AirtableClient('token', 'appBase123');

    await client.listRecords('Tasks', { fields: ['Name', 'Status', 'Due Date'] });

    const url = new URL(getUrl());
    const allFields = url.searchParams.getAll('fields[]');
    expect(allFields).toEqual(['Name', 'Status', 'Due Date']);
  });

  it('encodes sort field names with special characters', async () => {
    const { getUrl } = mockFetch();
    const { AirtableClient } = await import('../src/services/airtable.js');
    const client = new AirtableClient('token', 'appBase123');

    await client.listRecords('Tasks', {
      sort: [{ field: 'Due Date', direction: 'asc' }],
    });

    const url = new URL(getUrl());
    expect(url.searchParams.get('sort[0][field]')).toBe('Due Date');
    expect(url.searchParams.get('sort[0][direction]')).toBe('asc');
  });

  it('produces no query string when no options given', async () => {
    const { getUrl } = mockFetch();
    const { AirtableClient } = await import('../src/services/airtable.js');
    const client = new AirtableClient('token', 'appBase123');

    await client.listRecords('Tasks');
    expect(getUrl()).not.toContain('?');
  });
});
