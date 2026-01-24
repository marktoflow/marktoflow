/**
 * Confluence Integration
 *
 * Enterprise documentation and knowledge management (Atlassian).
 * API Docs: https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface ConfluencePage {
  id: string;
  status: string;
  title: string;
  spaceId: string;
  parentId?: string;
  parentType?: string;
  authorId: string;
  createdAt: string;
  version: { number: number; createdAt: string };
  body?: { storage?: { value: string }; view?: { value: string } };
  _links: { webui: string; editui?: string; tinyui?: string };
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  description?: { plain?: { value: string } };
  homepageId?: string;
  _links: { webui: string };
}

export interface ConfluenceComment {
  id: string;
  status: string;
  title: string;
  body: { storage?: { value: string } };
  version: { number: number; createdAt: string };
  authorId: string;
  createdAt: string;
}

export interface CreatePageOptions {
  spaceId: string;
  title: string;
  body: string;
  bodyFormat?: 'storage' | 'wiki';
  parentId?: string;
  status?: 'current' | 'draft';
}

export interface UpdatePageOptions {
  title?: string;
  body?: string;
  bodyFormat?: 'storage' | 'wiki';
  status?: 'current' | 'draft';
  version: number; // Required - current version number
}

export interface SearchOptions {
  query: string;
  limit?: number;
  start?: number;
  includeArchivedSpaces?: boolean;
  excerpt?: boolean;
}

export interface ListPagesOptions {
  spaceId?: string;
  title?: string;
  status?: 'current' | 'draft' | 'archived';
  limit?: number;
  cursor?: string;
  sort?: 'id' | '-id' | 'title' | '-title' | 'created-date' | '-created-date' | 'modified-date' | '-modified-date';
}

/**
 * Confluence API client for workflow integration (v2 API)
 */
export class ConfluenceClient {
  private baseUrl: string;

  constructor(
    private host: string,
    private email: string,
    private apiToken: string
  ) {
    this.baseUrl = `${host.replace(/\/$/, '')}/wiki/api/v2`;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Confluence API error: ${response.status} ${error}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<{ accountId: string; email: string; publicName: string }> {
    // Note: Uses v1 API for user info
    const response = await fetch(`${this.host.replace(/\/$/, '')}/wiki/rest/api/user/current`, {
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Confluence API error: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      accountId: data.accountId as string,
      email: data.email as string,
      publicName: data.publicName as string,
    };
  }

  /**
   * List spaces
   */
  async listSpaces(options: { limit?: number; cursor?: string; type?: 'global' | 'personal' } = {}): Promise<{
    spaces: ConfluenceSpace[];
    nextCursor?: string;
  }> {
    const params: string[] = [];
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.cursor) params.push(`cursor=${options.cursor}`);
    if (options.type) params.push(`type=${options.type}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const data = await this.request<{ results: Array<Record<string, unknown>>; _links?: { next?: string } }>(
      'GET',
      `/spaces${query}`
    );

    return {
      spaces: data.results.map((s) => this.parseSpace(s)),
      nextCursor: data._links?.next ? new URL(data._links.next).searchParams.get('cursor') ?? undefined : undefined,
    };
  }

  /**
   * Get a space by ID
   */
  async getSpace(spaceId: string): Promise<ConfluenceSpace> {
    const data = await this.request<Record<string, unknown>>('GET', `/spaces/${spaceId}`);
    return this.parseSpace(data);
  }

  /**
   * Get a space by key
   */
  async getSpaceByKey(key: string): Promise<ConfluenceSpace> {
    const data = await this.request<{ results: Array<Record<string, unknown>> }>('GET', `/spaces?keys=${key}`);
    if (!data.results.length) {
      throw new Error(`Space not found: ${key}`);
    }
    return this.parseSpace(data.results[0]);
  }

  /**
   * List pages
   */
  async listPages(options: ListPagesOptions = {}): Promise<{ pages: ConfluencePage[]; nextCursor?: string }> {
    const params: string[] = [];
    if (options.spaceId) params.push(`space-id=${options.spaceId}`);
    if (options.title) params.push(`title=${encodeURIComponent(options.title)}`);
    if (options.status) params.push(`status=${options.status}`);
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.cursor) params.push(`cursor=${options.cursor}`);
    if (options.sort) params.push(`sort=${options.sort}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const data = await this.request<{ results: Array<Record<string, unknown>>; _links?: { next?: string } }>(
      'GET',
      `/pages${query}`
    );

    return {
      pages: data.results.map((p) => this.parsePage(p)),
      nextCursor: data._links?.next ? new URL(data._links.next).searchParams.get('cursor') ?? undefined : undefined,
    };
  }

  /**
   * Get a page by ID
   */
  async getPage(pageId: string, includeBody: boolean = true): Promise<ConfluencePage> {
    const bodyFormat = includeBody ? '?body-format=storage' : '';
    const data = await this.request<Record<string, unknown>>('GET', `/pages/${pageId}${bodyFormat}`);
    return this.parsePage(data);
  }

  /**
   * Create a page
   */
  async createPage(options: CreatePageOptions): Promise<ConfluencePage> {
    const bodyFormat = options.bodyFormat ?? 'storage';

    const requestBody: Record<string, unknown> = {
      spaceId: options.spaceId,
      status: options.status ?? 'current',
      title: options.title,
      body: {
        representation: bodyFormat,
        value: options.body,
      },
    };

    if (options.parentId) {
      requestBody.parentId = options.parentId;
    }

    const data = await this.request<Record<string, unknown>>('POST', '/pages', requestBody);
    return this.parsePage(data);
  }

  /**
   * Update a page
   */
  async updatePage(pageId: string, options: UpdatePageOptions): Promise<ConfluencePage> {
    const requestBody: Record<string, unknown> = {
      id: pageId,
      status: options.status ?? 'current',
      version: {
        number: options.version + 1,
        message: 'Updated via marktoflow',
      },
    };

    if (options.title) {
      requestBody.title = options.title;
    }

    if (options.body) {
      requestBody.body = {
        representation: options.bodyFormat ?? 'storage',
        value: options.body,
      };
    }

    const data = await this.request<Record<string, unknown>>('PUT', `/pages/${pageId}`, requestBody);
    return this.parsePage(data);
  }

  /**
   * Delete a page
   */
  async deletePage(pageId: string): Promise<void> {
    await this.request('DELETE', `/pages/${pageId}`);
  }

  /**
   * Get page content as storage format HTML
   */
  async getPageContent(pageId: string): Promise<string> {
    const page = await this.getPage(pageId, true);
    return page.body?.storage?.value ?? '';
  }

  /**
   * Append content to a page
   */
  async appendToPage(pageId: string, content: string, bodyFormat: 'storage' | 'wiki' = 'storage'): Promise<ConfluencePage> {
    const page = await this.getPage(pageId, true);
    const currentContent = page.body?.storage?.value ?? '';
    const newContent = `${currentContent}\n${content}`;

    return this.updatePage(pageId, {
      body: newContent,
      bodyFormat,
      version: page.version.number,
    });
  }

  /**
   * Get page comments
   */
  async getPageComments(pageId: string, options: { limit?: number; cursor?: string } = {}): Promise<{
    comments: ConfluenceComment[];
    nextCursor?: string;
  }> {
    const params: string[] = [];
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.cursor) params.push(`cursor=${options.cursor}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const data = await this.request<{ results: Array<Record<string, unknown>>; _links?: { next?: string } }>(
      'GET',
      `/pages/${pageId}/footer-comments${query}`
    );

    return {
      comments: data.results.map((c) => ({
        id: c.id as string,
        status: c.status as string,
        title: c.title as string,
        body: c.body as { storage?: { value: string } },
        version: c.version as { number: number; createdAt: string },
        authorId: c.authorId as string,
        createdAt: c.createdAt as string,
      })),
      nextCursor: data._links?.next ? new URL(data._links.next).searchParams.get('cursor') ?? undefined : undefined,
    };
  }

  /**
   * Add a comment to a page
   */
  async addComment(pageId: string, body: string, bodyFormat: 'storage' | 'wiki' = 'storage'): Promise<ConfluenceComment> {
    const data = await this.request<Record<string, unknown>>('POST', `/pages/${pageId}/footer-comments`, {
      body: {
        representation: bodyFormat,
        value: body,
      },
    });

    return {
      id: data.id as string,
      status: data.status as string,
      title: data.title as string,
      body: data.body as { storage?: { value: string } },
      version: data.version as { number: number; createdAt: string },
      authorId: data.authorId as string,
      createdAt: data.createdAt as string,
    };
  }

  /**
   * Search for content
   */
  async search(options: SearchOptions): Promise<{ results: Array<{ content: ConfluencePage; excerpt?: string }>; totalSize: number }> {
    // Note: Uses v1 API for CQL search
    const params: string[] = [`cql=${encodeURIComponent(options.query)}`];
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.start) params.push(`start=${options.start}`);
    if (options.includeArchivedSpaces) params.push(`includeArchivedSpaces=true`);
    if (options.excerpt) params.push(`excerpt=true`);

    const response = await fetch(
      `${this.host.replace(/\/$/, '')}/wiki/rest/api/content/search?${params.join('&')}`,
      {
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Confluence API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      results: Array<Record<string, unknown>>;
      totalSize: number;
    };

    return {
      results: data.results.map((r) => ({
        content: this.parsePageV1(r),
        excerpt: r.excerpt as string | undefined,
      })),
      totalSize: data.totalSize,
    };
  }

  /**
   * Get child pages
   */
  async getChildPages(pageId: string, options: { limit?: number; cursor?: string } = {}): Promise<{
    pages: ConfluencePage[];
    nextCursor?: string;
  }> {
    const params: string[] = [];
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.cursor) params.push(`cursor=${options.cursor}`);

    const query = params.length ? `?${params.join('&')}` : '';
    const data = await this.request<{ results: Array<Record<string, unknown>>; _links?: { next?: string } }>(
      'GET',
      `/pages/${pageId}/children${query}`
    );

    return {
      pages: data.results.map((p) => this.parsePage(p)),
      nextCursor: data._links?.next ? new URL(data._links.next).searchParams.get('cursor') ?? undefined : undefined,
    };
  }

  private parseSpace(data: Record<string, unknown>): ConfluenceSpace {
    const description = data.description as { plain?: { value: string } } | undefined;
    const links = data._links as { webui: string };

    return {
      id: data.id as string,
      key: data.key as string,
      name: data.name as string,
      type: data.type as string,
      status: data.status as string,
      description,
      homepageId: data.homepageId as string | undefined,
      _links: links,
    };
  }

  private parsePage(data: Record<string, unknown>): ConfluencePage {
    const version = data.version as { number: number; createdAt: string };
    const body = data.body as { storage?: { value: string }; view?: { value: string } } | undefined;
    const links = data._links as { webui: string; editui?: string; tinyui?: string };

    return {
      id: data.id as string,
      status: data.status as string,
      title: data.title as string,
      spaceId: data.spaceId as string,
      parentId: data.parentId as string | undefined,
      parentType: data.parentType as string | undefined,
      authorId: data.authorId as string,
      createdAt: data.createdAt as string,
      version,
      body,
      _links: links,
    };
  }

  private parsePageV1(data: Record<string, unknown>): ConfluencePage {
    const version = data.version as { number: number } | undefined;
    const space = data.space as { id: string } | undefined;
    const links = data._links as { webui: string } | undefined;

    return {
      id: data.id as string,
      status: data.status as string,
      title: data.title as string,
      spaceId: space?.id ?? '',
      authorId: '',
      createdAt: '',
      version: { number: version?.number ?? 1, createdAt: '' },
      _links: { webui: links?.webui ?? '' },
    };
  }
}

export const ConfluenceInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const host = config.auth?.['host'] as string | undefined;
    const email = config.auth?.['email'] as string | undefined;
    const apiToken = config.auth?.['api_token'] as string | undefined;

    if (!host || !email || !apiToken) {
      throw new Error('Confluence SDK requires auth.host, auth.email, and auth.api_token');
    }

    const client = new ConfluenceClient(host, email, apiToken);
    return {
      client,
      actions: client,
    };
  },
};
