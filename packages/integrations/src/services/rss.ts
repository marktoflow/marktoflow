/**
 * RSS/Atom Feed Integration
 *
 * Fetch and parse RSS 2.0 and Atom feeds for workflow automation.
 * No authentication required for public feeds; supports custom headers for private feeds.
 */

import { XMLParser } from 'fast-xml-parser';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RssFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author: string;
  categories: string[];
}

export interface RssFeed {
  title: string;
  description: string;
  link: string;
  language: string;
  lastBuildDate: string;
  items: RssFeedItem[];
}

export interface FetchFeedOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface GetItemsOptions extends FetchFeedOptions {
  /** Only return items published after this date */
  since?: string | Date;
  /** Only return items matching this regex pattern (tested against title) */
  filter?: string;
  /** Maximum number of items to return */
  maxItems?: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class RssClient {
  private parser: XMLParser;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(options?: { headers?: Record<string, string>; timeout?: number }) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });
    this.defaultHeaders = options?.headers ?? {};
    this.defaultTimeout = options?.timeout ?? 30_000;
  }

  async fetch(options: FetchFeedOptions): Promise<RssFeed> {
    const { url, headers, timeout } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout ?? this.defaultTimeout);

    try {
      const res = await global.fetch(url, {
        headers: {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
          ...this.defaultHeaders,
          ...headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
      }

      const xml = await res.text();
      const parsed = this.parser.parse(xml);

      return this.normalizeFeed(parsed, url);
    } finally {
      clearTimeout(timer);
    }
  }

  async getItems(options: GetItemsOptions): Promise<RssFeedItem[]> {
    const feed = await this.fetch(options);
    let items = feed.items;

    if (options.since) {
      const sinceDate = new Date(options.since);
      items = items.filter((item) => {
        if (!item.pubDate) return true;
        return new Date(item.pubDate) > sinceDate;
      });
    }

    if (options.filter) {
      let re: RegExp;
      try {
        re = new RegExp(options.filter, 'i');
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
          `RSS getItems: invalid filter regex "${options.filter}" — ${reason}`
        );
      }
      items = items.filter((item) => re.test(item.title));
    }

    if (options.maxItems !== undefined) {
      items = items.slice(0, options.maxItems);
    }

    return items;
  }

  private normalizeFeed(parsed: Record<string, unknown>, url: string): RssFeed {
    // Atom feed
    if (parsed.feed) {
      const feed = parsed.feed as Record<string, unknown>;
      const entries = this.toArray(feed.entry);
      return {
        title: this.text(feed.title),
        description: this.text(feed.subtitle) || this.text(feed.title),
        link: this.atomLink(feed.link) || url,
        language: (feed['@_xml:lang'] as string) ?? '',
        lastBuildDate: this.text(feed.updated) || '',
        items: entries.map((e) => this.normalizeAtomEntry(e)),
      };
    }

    // RSS 2.0
    const channel = (parsed.rss as Record<string, unknown>)?.channel as Record<string, unknown>;
    if (!channel) {
      return { title: '', description: '', link: url, language: '', lastBuildDate: '', items: [] };
    }

    const rawItems = this.toArray(channel.item);
    return {
      title: this.text(channel.title),
      description: this.text(channel.description),
      link: this.text(channel.link) || url,
      language: (channel.language as string) ?? '',
      lastBuildDate: this.text(channel.lastBuildDate) || '',
      items: rawItems.map((item) => this.normalizeRssItem(item)),
    };
  }

  private normalizeRssItem(item: Record<string, unknown>): RssFeedItem {
    return {
      title: this.text(item.title),
      link: this.text(item.link),
      description: this.text(item.description),
      pubDate: this.text(item.pubDate),
      guid: this.text(item.guid) || this.text(item.link),
      author: this.text(item.author) || this.text(item['dc:creator']),
      categories: this.toArray(item.category).map((c) => this.text(c)),
    };
  }

  private normalizeAtomEntry(entry: Record<string, unknown>): RssFeedItem {
    return {
      title: this.text(entry.title),
      link: this.atomLink(entry.link) || this.text(entry.link),
      description: this.text(entry.summary) || this.text(entry.content),
      pubDate: this.text(entry.updated) || this.text(entry.published),
      guid: this.text(entry.id),
      author: this.atomAuthor(entry.author),
      categories: this.toArray(entry.category).map((c) =>
        typeof c === 'object' && c !== null ? ((c as Record<string, unknown>)['@_term'] as string) ?? '' : this.text(c),
      ),
    };
  }

  private text(val: unknown): string {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object' && val !== null && '#text' in val) {
      return String((val as Record<string, unknown>)['#text']);
    }
    return String(val);
  }

  private atomLink(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      const alt = val.find((l) => (l as Record<string, unknown>)['@_rel'] === 'alternate');
      const link = alt ?? val[0];
      return (link as Record<string, unknown>)?.['@_href'] as string ?? '';
    }
    if (typeof val === 'object') {
      return (val as Record<string, unknown>)['@_href'] as string ?? '';
    }
    return '';
  }

  private atomAuthor(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      return this.text((val as Record<string, unknown>).name);
    }
    return '';
  }

  private toArray(val: unknown): Record<string, unknown>[] {
    if (!val) return [];
    if (Array.isArray(val)) return val as Record<string, unknown>[];
    return [val as Record<string, unknown>];
  }
}

// ── Initializer ──────────────────────────────────────────────────────────────

export const RssInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const headers = config.options?.['headers'] as Record<string, string> | undefined;
    const timeout = config.options?.['timeout'] as number | undefined;

    const client = new RssClient({ headers, timeout });

    return {
      client,
      fetch: async (inputs: Record<string, unknown>) => {
        return client.fetch({
          url: inputs.url as string,
          headers: inputs.headers as Record<string, string> | undefined,
          timeout: inputs.timeout as number | undefined,
        });
      },
      getItems: async (inputs: Record<string, unknown>) => {
        return client.getItems({
          url: inputs.url as string,
          headers: inputs.headers as Record<string, string> | undefined,
          timeout: inputs.timeout as number | undefined,
          since: inputs.since as string | Date | undefined,
          filter: inputs.filter as string | undefined,
          maxItems: inputs.maxItems as number | undefined,
        });
      },
    };
  },
};
