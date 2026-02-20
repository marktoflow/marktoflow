import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RssClient, RssInitializer } from '../src/services/rss.js';

const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech Blog</title>
    <link>https://example.com</link>
    <description>A tech blog feed</description>
    <language>en-us</language>
    <lastBuildDate>Wed, 03 Jan 2024 12:00:00 GMT</lastBuildDate>
    <item>
      <title>First Post</title>
      <link>https://example.com/first</link>
      <description>The first post</description>
      <guid>guid-1</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <author>Alice</author>
      <category>Tech</category>
      <category>News</category>
    </item>
    <item>
      <title>Second Post</title>
      <link>https://example.com/second</link>
      <description>The second post</description>
      <guid>guid-2</guid>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
      <author>Bob</author>
      <category>Updates</category>
    </item>
    <item>
      <title>Third Post</title>
      <link>https://example.com/third</link>
      <description>The third post</description>
      <guid>guid-3</guid>
      <pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <subtitle>An Atom feed</subtitle>
  <link href="https://example.com/atom" rel="alternate" />
  <updated>2024-01-02T00:00:00Z</updated>
  <entry>
    <title>Atom Post 1</title>
    <link href="https://example.com/atom/1" rel="alternate" />
    <id>atom-guid-1</id>
    <updated>2024-01-01T00:00:00Z</updated>
    <summary>First atom post</summary>
    <author><name>Charlie</name></author>
    <category term="Science" />
  </entry>
  <entry>
    <title>Atom Post 2</title>
    <link href="https://example.com/atom/2" rel="alternate" />
    <id>atom-guid-2</id>
    <updated>2024-01-02T00:00:00Z</updated>
    <summary>Second atom post</summary>
    <author><name>Dana</name></author>
  </entry>
</feed>`;

describe('RssClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(body: string, ok = true, status = 200) {
    fetchMock.mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Internal Server Error',
      text: () => Promise.resolve(body),
    });
  }

  describe('fetch()', () => {
    it('parses RSS 2.0 feed correctly', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const feed = await client.fetch({ url: 'https://example.com/feed.xml' });

      expect(feed.title).toBe('Tech Blog');
      expect(feed.description).toBe('A tech blog feed');
      expect(feed.link).toBe('https://example.com');
      expect(feed.language).toBe('en-us');
      expect(feed.items).toHaveLength(3);

      expect(feed.items[0].title).toBe('First Post');
      expect(feed.items[0].link).toBe('https://example.com/first');
      expect(feed.items[0].guid).toBe('guid-1');
      expect(feed.items[0].author).toBe('Alice');
      expect(feed.items[0].categories).toEqual(['Tech', 'News']);

      expect(feed.items[1].title).toBe('Second Post');
      expect(feed.items[2].title).toBe('Third Post');
    });

    it('parses Atom feed correctly', async () => {
      mockFetch(ATOM_FEED);
      const client = new RssClient();
      const feed = await client.fetch({ url: 'https://example.com/atom.xml' });

      expect(feed.title).toBe('Atom Blog');
      expect(feed.items).toHaveLength(2);

      expect(feed.items[0].title).toBe('Atom Post 1');
      expect(feed.items[0].link).toBe('https://example.com/atom/1');
      expect(feed.items[0].guid).toBe('atom-guid-1');
      expect(feed.items[0].author).toBe('Charlie');

      expect(feed.items[1].title).toBe('Atom Post 2');
      expect(feed.items[1].author).toBe('Dana');
    });

    it('throws on HTTP errors', async () => {
      mockFetch('', false, 500);
      const client = new RssClient();

      await expect(client.fetch({ url: 'https://example.com/feed.xml' })).rejects.toThrow(
        'RSS fetch failed: 500',
      );
    });

    it('passes custom headers', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient({ headers: { 'X-Default': 'yes' } });
      await client.fetch({ url: 'https://example.com/feed.xml', headers: { 'X-Custom': 'value' } });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/feed.xml',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Default': 'yes',
            'X-Custom': 'value',
          }),
        }),
      );
    });
  });

  describe('getItems()', () => {
    it('returns all items', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const items = await client.getItems({ url: 'https://example.com/feed.xml' });

      expect(items).toHaveLength(3);
    });

    it('filters by since date', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const items = await client.getItems({
        url: 'https://example.com/feed.xml',
        since: '2024-01-02T00:00:00Z',
      });

      // Only items after Jan 2 should remain (Third Post on Jan 3)
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Third Post');
    });

    it('filters by regex pattern', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const items = await client.getItems({
        url: 'https://example.com/feed.xml',
        filter: 'second',
      });

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Second Post');
    });

    it('respects maxItems', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const items = await client.getItems({
        url: 'https://example.com/feed.xml',
        maxItems: 2,
      });

      expect(items).toHaveLength(2);
    });

    it('combines filters', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();
      const items = await client.getItems({
        url: 'https://example.com/feed.xml',
        filter: 'post',
        maxItems: 1,
      });

      expect(items).toHaveLength(1);
    });

    it('throws a descriptive error for invalid regex patterns', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();

      // '[unclosed' is an invalid regex — the raw SyntaxError message is cryptic;
      // after the fix it should be wrapped with a clear message.
      await expect(
        client.getItems({ url: 'https://example.com/feed.xml', filter: '[unclosed' })
      ).rejects.toThrow(/invalid filter regex "\[unclosed"/i);
    });

    it('includes the underlying regex error reason in the message', async () => {
      mockFetch(RSS_FEED);
      const client = new RssClient();

      let caughtError: Error | undefined;
      try {
        await client.getItems({ url: 'https://example.com/feed.xml', filter: '(?invalid' });
      } catch (e) {
        caughtError = e as Error;
      }

      expect(caughtError).toBeDefined();
      // Message must start with our prefix so callers know which option is wrong
      expect(caughtError!.message).toMatch(/RSS getItems: invalid filter regex/);
      // And must include the bad pattern so users can identify it
      expect(caughtError!.message).toContain('(?invalid');
    });
  });
});

describe('RssInitializer', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes without auth', async () => {
    const sdk = await RssInitializer.initialize(undefined, {
      sdk: 'rss',
      options: {},
    });

    expect(sdk).toBeDefined();
    expect(sdk).toHaveProperty('client');
    expect(sdk).toHaveProperty('fetch');
    expect(sdk).toHaveProperty('getItems');
  });

  it('initializes with custom headers and timeout', async () => {
    const sdk = await RssInitializer.initialize(undefined, {
      sdk: 'rss',
      options: { headers: { Authorization: 'Bearer token' }, timeout: 5000 },
    });

    expect(sdk).toBeDefined();
    expect((sdk as Record<string, unknown>).client).toBeInstanceOf(RssClient);
  });

  it('fetch action calls client.fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_FEED),
    });

    const sdk = (await RssInitializer.initialize(undefined, {
      sdk: 'rss',
      options: {},
    })) as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;

    const result = await sdk.fetch({ url: 'https://example.com/feed.xml' });
    expect(result).toHaveProperty('title', 'Tech Blog');
    expect(result).toHaveProperty('items');
  });

  it('getItems action calls client.getItems', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RSS_FEED),
    });

    const sdk = (await RssInitializer.initialize(undefined, {
      sdk: 'rss',
      options: {},
    })) as Record<string, (inputs: Record<string, unknown>) => Promise<unknown>>;

    const items = (await sdk.getItems({
      url: 'https://example.com/feed.xml',
      maxItems: 1,
    })) as unknown[];
    expect(items).toHaveLength(1);
  });
});
