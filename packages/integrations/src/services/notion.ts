/**
 * Notion Integration
 *
 * All-in-one workspace for docs, databases, and knowledge management.
 * API Docs: https://developers.notion.com/
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  icon?: { type: string; emoji?: string; external?: { url: string } };
  cover?: { type: string; external?: { url: string } };
  parent: { type: string; page_id?: string; database_id?: string; workspace?: boolean };
  createdTime: string;
  lastEditedTime: string;
  createdBy: { id: string };
  lastEditedBy: { id: string };
  archived: boolean;
  properties?: Record<string, unknown>;
}

export interface NotionDatabase {
  id: string;
  url: string;
  title: string;
  description?: string;
  icon?: { type: string; emoji?: string };
  properties: Record<string, { id: string; type: string; name: string }>;
  createdTime: string;
  lastEditedTime: string;
  archived: boolean;
}

export interface NotionBlock {
  id: string;
  type: string;
  hasChildren: boolean;
  createdTime: string;
  lastEditedTime: string;
  content: unknown;
}

export interface CreatePageOptions {
  parentPageId?: string;
  parentDatabaseId?: string;
  title: string;
  icon?: { emoji: string } | { external: { url: string } };
  cover?: { external: { url: string } };
  properties?: Record<string, unknown>;
  children?: NotionBlockInput[];
}

export interface NotionBlockInput {
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'toggle' | 'code' | 'quote' | 'callout' | 'divider';
  content?: string;
  language?: string; // for code blocks
  checked?: boolean; // for to_do
  children?: NotionBlockInput[];
}

export interface QueryDatabaseOptions {
  filter?: Record<string, unknown>;
  sorts?: Array<{ property: string; direction: 'ascending' | 'descending' } | { timestamp: 'created_time' | 'last_edited_time'; direction: 'ascending' | 'descending' }>;
  startCursor?: string;
  pageSize?: number;
}

export interface SearchOptions {
  query?: string;
  filter?: { property: 'object'; value: 'page' | 'database' };
  sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
  startCursor?: string;
  pageSize?: number;
}

function buildRichText(text: string): Array<{ type: 'text'; text: { content: string } }> {
  return [{ type: 'text', text: { content: text } }];
}

function buildBlock(input: NotionBlockInput): Record<string, unknown> {
  const block: Record<string, unknown> = {
    object: 'block',
    type: input.type,
  };

  switch (input.type) {
    case 'paragraph':
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'quote':
      block[input.type] = {
        rich_text: buildRichText(input.content ?? ''),
        children: input.children?.map(buildBlock),
      };
      break;
    case 'to_do':
      block.to_do = {
        rich_text: buildRichText(input.content ?? ''),
        checked: input.checked ?? false,
        children: input.children?.map(buildBlock),
      };
      break;
    case 'toggle':
      block.toggle = {
        rich_text: buildRichText(input.content ?? ''),
        children: input.children?.map(buildBlock),
      };
      break;
    case 'code':
      block.code = {
        rich_text: buildRichText(input.content ?? ''),
        language: input.language ?? 'plain text',
      };
      break;
    case 'callout':
      block.callout = {
        rich_text: buildRichText(input.content ?? ''),
        icon: { type: 'emoji', emoji: '💡' },
        children: input.children?.map(buildBlock),
      };
      break;
    case 'divider':
      block.divider = {};
      break;
  }

  return block;
}

function extractTitle(properties: Record<string, unknown>): string {
  // Find title property
  for (const [, value] of Object.entries(properties)) {
    if ((value as Record<string, unknown>)?.type === 'title') {
      const titleArr = (value as Record<string, unknown>)?.title as Array<{ plain_text?: string }>;
      return titleArr?.map((t) => t.plain_text).join('') ?? '';
    }
  }
  return '';
}

/**
 * Notion API client for workflow integration
 */
export class NotionClient {
  constructor(private token: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${NOTION_API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} ${error}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Get the current user
   */
  async getMe(): Promise<{ id: string; name: string; type: string }> {
    const data = await this.request<{ id: string; name: string; type: string }>('GET', '/users/me');
    return data;
  }

  /**
   * Search pages and databases
   */
  async search(options: SearchOptions = {}): Promise<{ results: (NotionPage | NotionDatabase)[]; hasMore: boolean; nextCursor?: string }> {
    const body: Record<string, unknown> = {};
    if (options.query) body.query = options.query;
    if (options.filter) body.filter = options.filter;
    if (options.sort) body.sort = options.sort;
    if (options.startCursor) body.start_cursor = options.startCursor;
    if (options.pageSize) body.page_size = options.pageSize;

    const data = await this.request<{
      results: Array<Record<string, unknown>>;
      has_more: boolean;
      next_cursor?: string;
    }>('POST', '/search', body);

    const results = data.results.map((item) => {
      if (item.object === 'page') {
        return {
          id: item.id as string,
          url: item.url as string,
          title: extractTitle(item.properties as Record<string, unknown>),
          icon: item.icon as NotionPage['icon'],
          cover: item.cover as NotionPage['cover'],
          parent: item.parent as NotionPage['parent'],
          createdTime: item.created_time as string,
          lastEditedTime: item.last_edited_time as string,
          createdBy: item.created_by as { id: string },
          lastEditedBy: item.last_edited_by as { id: string },
          archived: item.archived as boolean,
          properties: item.properties as Record<string, unknown>,
        } as NotionPage;
      } else {
        const titleArr = item.title as Array<{ plain_text?: string }>;
        return {
          id: item.id as string,
          url: item.url as string,
          title: titleArr?.map((t) => t.plain_text).join('') ?? '',
          description: (item.description as Array<{ plain_text?: string }>)?.map((t) => t.plain_text).join(''),
          icon: item.icon as NotionDatabase['icon'],
          properties: item.properties as NotionDatabase['properties'],
          createdTime: item.created_time as string,
          lastEditedTime: item.last_edited_time as string,
          archived: item.archived as boolean,
        } as NotionDatabase;
      }
    });

    return {
      results,
      hasMore: data.has_more,
      nextCursor: data.next_cursor,
    };
  }

  /**
   * Get a page by ID
   */
  async getPage(pageId: string): Promise<NotionPage> {
    const data = await this.request<Record<string, unknown>>('GET', `/pages/${pageId}`);

    return {
      id: data.id as string,
      url: data.url as string,
      title: extractTitle(data.properties as Record<string, unknown>),
      icon: data.icon as NotionPage['icon'],
      cover: data.cover as NotionPage['cover'],
      parent: data.parent as NotionPage['parent'],
      createdTime: data.created_time as string,
      lastEditedTime: data.last_edited_time as string,
      createdBy: data.created_by as { id: string },
      lastEditedBy: data.last_edited_by as { id: string },
      archived: data.archived as boolean,
      properties: data.properties as Record<string, unknown>,
    };
  }

  /**
   * Create a page
   */
  async createPage(options: CreatePageOptions): Promise<NotionPage> {
    const body: Record<string, unknown> = {
      properties: {
        title: { title: buildRichText(options.title) },
        ...(options.properties ?? {}),
      },
    };

    if (options.parentPageId) {
      body.parent = { type: 'page_id', page_id: options.parentPageId };
    } else if (options.parentDatabaseId) {
      body.parent = { type: 'database_id', database_id: options.parentDatabaseId };
    } else {
      throw new Error('Either parentPageId or parentDatabaseId is required');
    }

    if (options.icon) body.icon = options.icon;
    if (options.cover) body.cover = options.cover;
    if (options.children) {
      body.children = options.children.map(buildBlock);
    }

    const data = await this.request<Record<string, unknown>>('POST', '/pages', body);

    return {
      id: data.id as string,
      url: data.url as string,
      title: options.title,
      icon: data.icon as NotionPage['icon'],
      cover: data.cover as NotionPage['cover'],
      parent: data.parent as NotionPage['parent'],
      createdTime: data.created_time as string,
      lastEditedTime: data.last_edited_time as string,
      createdBy: data.created_by as { id: string },
      lastEditedBy: data.last_edited_by as { id: string },
      archived: data.archived as boolean,
      properties: data.properties as Record<string, unknown>,
    };
  }

  /**
   * Update page properties
   */
  async updatePage(
    pageId: string,
    options: {
      properties?: Record<string, unknown>;
      icon?: { emoji: string } | { external: { url: string } } | null;
      cover?: { external: { url: string } } | null;
      archived?: boolean;
    }
  ): Promise<NotionPage> {
    const data = await this.request<Record<string, unknown>>('PATCH', `/pages/${pageId}`, options);

    return {
      id: data.id as string,
      url: data.url as string,
      title: extractTitle(data.properties as Record<string, unknown>),
      icon: data.icon as NotionPage['icon'],
      cover: data.cover as NotionPage['cover'],
      parent: data.parent as NotionPage['parent'],
      createdTime: data.created_time as string,
      lastEditedTime: data.last_edited_time as string,
      createdBy: data.created_by as { id: string },
      lastEditedBy: data.last_edited_by as { id: string },
      archived: data.archived as boolean,
      properties: data.properties as Record<string, unknown>,
    };
  }

  /**
   * Get a database by ID
   */
  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    const data = await this.request<Record<string, unknown>>('GET', `/databases/${databaseId}`);
    const titleArr = data.title as Array<{ plain_text?: string }>;

    return {
      id: data.id as string,
      url: data.url as string,
      title: titleArr?.map((t) => t.plain_text).join('') ?? '',
      description: (data.description as Array<{ plain_text?: string }>)?.map((t) => t.plain_text).join(''),
      icon: data.icon as NotionDatabase['icon'],
      properties: data.properties as NotionDatabase['properties'],
      createdTime: data.created_time as string,
      lastEditedTime: data.last_edited_time as string,
      archived: data.archived as boolean,
    };
  }

  /**
   * Query a database
   */
  async queryDatabase(
    databaseId: string,
    options: QueryDatabaseOptions = {}
  ): Promise<{ results: NotionPage[]; hasMore: boolean; nextCursor?: string }> {
    const body: Record<string, unknown> = {};
    if (options.filter) body.filter = options.filter;
    if (options.sorts) body.sorts = options.sorts;
    if (options.startCursor) body.start_cursor = options.startCursor;
    if (options.pageSize) body.page_size = options.pageSize;

    const data = await this.request<{
      results: Array<Record<string, unknown>>;
      has_more: boolean;
      next_cursor?: string;
    }>('POST', `/databases/${databaseId}/query`, body);

    const results = data.results.map((item) => ({
      id: item.id as string,
      url: item.url as string,
      title: extractTitle(item.properties as Record<string, unknown>),
      icon: item.icon as NotionPage['icon'],
      cover: item.cover as NotionPage['cover'],
      parent: item.parent as NotionPage['parent'],
      createdTime: item.created_time as string,
      lastEditedTime: item.last_edited_time as string,
      createdBy: item.created_by as { id: string },
      lastEditedBy: item.last_edited_by as { id: string },
      archived: item.archived as boolean,
      properties: item.properties as Record<string, unknown>,
    }));

    return {
      results,
      hasMore: data.has_more,
      nextCursor: data.next_cursor,
    };
  }

  /**
   * Get block children (page content)
   */
  async getBlockChildren(
    blockId: string,
    options: { startCursor?: string; pageSize?: number } = {}
  ): Promise<{ blocks: NotionBlock[]; hasMore: boolean; nextCursor?: string }> {
    let url = `/blocks/${blockId}/children`;
    const params: string[] = [];
    if (options.startCursor) params.push(`start_cursor=${options.startCursor}`);
    if (options.pageSize) params.push(`page_size=${options.pageSize}`);
    if (params.length) url += `?${params.join('&')}`;

    const data = await this.request<{
      results: Array<Record<string, unknown>>;
      has_more: boolean;
      next_cursor?: string;
    }>('GET', url);

    const blocks = data.results.map((item) => ({
      id: item.id as string,
      type: item.type as string,
      hasChildren: item.has_children as boolean,
      createdTime: item.created_time as string,
      lastEditedTime: item.last_edited_time as string,
      content: item[item.type as string],
    }));

    return {
      blocks,
      hasMore: data.has_more,
      nextCursor: data.next_cursor,
    };
  }

  /**
   * Append blocks to a page
   */
  async appendBlocks(pageId: string, blocks: NotionBlockInput[]): Promise<NotionBlock[]> {
    const data = await this.request<{ results: Array<Record<string, unknown>> }>(
      'PATCH',
      `/blocks/${pageId}/children`,
      { children: blocks.map(buildBlock) }
    );

    return data.results.map((item) => ({
      id: item.id as string,
      type: item.type as string,
      hasChildren: item.has_children as boolean,
      createdTime: item.created_time as string,
      lastEditedTime: item.last_edited_time as string,
      content: item[item.type as string],
    }));
  }

  /**
   * Delete a block
   */
  async deleteBlock(blockId: string): Promise<void> {
    await this.request('DELETE', `/blocks/${blockId}`);
  }

  /**
   * Archive a page (soft delete)
   */
  async archivePage(pageId: string): Promise<void> {
    await this.updatePage(pageId, { archived: true });
  }
}

export const NotionInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;
    if (!token) {
      throw new Error('Notion SDK requires auth.token (integration token)');
    }

    const client = new NotionClient(token);
    return {
      client,
      actions: client,
    };
  },
};
