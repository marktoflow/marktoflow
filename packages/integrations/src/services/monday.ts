/**
 * Monday.com Integration
 *
 * Project Management platform (GraphQL API).
 * API Docs: https://developer.monday.com/api-reference/docs
 */

import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { BaseApiClient } from './base-client.js';
import { wrapIntegration } from '../reliability/wrapper.js';
import { mondaySchemas } from '../reliability/schemas/monday.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';

export interface MondayBoard {
  id: string;
  name: string;
  description: string;
  state: 'active' | 'archived' | 'deleted';
  board_kind: 'public' | 'private' | 'share';
  permissions: string;
}

export interface MondayItem {
  id: string;
  name: string;
  state: 'active' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  creator_id: string;
  board: { id: string };
  group: { id: string; title: string };
  column_values: Array<{ id: string; text: string; value: string }>;
}

export interface MondayGroup {
  id: string;
  title: string;
  color: string;
  position: string;
}

export interface MondayUpdate {
  id: string;
  body: string;
  created_at: string;
  creator_id: string;
  item_id: string;
  text_body: string;
}

/**
 * Monday.com API client for workflow integration
 * Note: Monday.com uses GraphQL, so all requests are POST with query + variables
 */
export class MondayClient extends BaseApiClient {
  constructor(token: string) {
    super({
      baseUrl: MONDAY_API_URL,
      authType: 'bearer',
      authValue: token,
      serviceName: 'Monday.com',
    });
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.post<{ data: T; errors?: Array<{ message: string }> }>('', {
      query,
      variables,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(`Monday.com GraphQL error: ${response.errors.map((e) => e.message).join(', ')}`);
    }

    return response.data;
  }

  /**
   * List boards
   */
  async listBoards(limit?: number): Promise<{ boards: MondayBoard[] }> {
    const query = `
      query ($limit: Int) {
        boards(limit: $limit) {
          id
          name
          description
          state
          board_kind
          permissions
        }
      }
    `;
    return this.graphql(query, { limit });
  }

  /**
   * Get a board by ID
   */
  async getBoard(boardId: string): Promise<{ boards: MondayBoard[] }> {
    const query = `
      query ($boardIds: [ID!]) {
        boards(ids: $boardIds) {
          id
          name
          description
          state
          board_kind
          permissions
        }
      }
    `;
    return this.graphql(query, { boardIds: [boardId] });
  }

  /**
   * Create a board
   */
  async createBoard(options: { boardName: string; boardKind: 'public' | 'private' | 'share' }): Promise<{ create_board: MondayBoard }> {
    const query = `
      mutation ($boardName: String!, $boardKind: BoardKind!) {
        create_board(board_name: $boardName, board_kind: $boardKind) {
          id
          name
          description
          state
          board_kind
          permissions
        }
      }
    `;
    return this.graphql(query, { boardName: options.boardName, boardKind: options.boardKind });
  }

  /**
   * List items in a board
   */
  async listItems(options: { boardId: string; limit?: number }): Promise<{ boards: Array<{ items_page: { items: MondayItem[] } }> }> {
    const query = `
      query ($boardIds: [ID!], $limit: Int) {
        boards(ids: $boardIds) {
          items_page(limit: $limit) {
            items {
              id
              name
              state
              created_at
              updated_at
              creator_id
              board { id }
              group { id title }
            }
          }
        }
      }
    `;
    return this.graphql(query, { boardIds: [options.boardId], limit: options.limit });
  }

  /**
   * Get an item by ID
   */
  async getItem(itemId: string): Promise<{ items: MondayItem[] }> {
    const query = `
      query ($itemIds: [ID!]) {
        items(ids: $itemIds) {
          id
          name
          state
          created_at
          updated_at
          creator_id
          board { id }
          group { id title }
          column_values { id text value }
        }
      }
    `;
    return this.graphql(query, { itemIds: [itemId] });
  }

  /**
   * Create an item
   */
  async createItem(options: { boardId: string; itemName: string; groupId?: string }): Promise<{ create_item: MondayItem }> {
    const query = `
      mutation ($boardId: ID!, $itemName: String!, $groupId: String) {
        create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId) {
          id
          name
          state
          created_at
          updated_at
          creator_id
          board { id }
          group { id title }
        }
      }
    `;
    return this.graphql(query, { boardId: options.boardId, itemName: options.itemName, groupId: options.groupId });
  }

  /**
   * Update an item
   */
  async updateItem(options: { boardId: string; itemId: string; columnValues: Record<string, unknown> }): Promise<{ change_multiple_column_values: MondayItem }> {
    const query = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $columnValues) {
          id
          name
          state
          column_values { id text value }
        }
      }
    `;
    return this.graphql(query, { boardId: options.boardId, itemId: options.itemId, columnValues: JSON.stringify(options.columnValues) });
  }

  /**
   * Delete an item
   */
  async deleteItem(itemId: string): Promise<{ delete_item: { id: string } }> {
    const query = `
      mutation ($itemId: ID!) {
        delete_item(item_id: $itemId) {
          id
        }
      }
    `;
    return this.graphql(query, { itemId });
  }

  /**
   * Create a group
   */
  async createGroup(options: { boardId: string; groupName: string }): Promise<{ create_group: MondayGroup }> {
    const query = `
      mutation ($boardId: ID!, $groupName: String!) {
        create_group(board_id: $boardId, group_name: $groupName) {
          id
          title
          color
          position
        }
      }
    `;
    return this.graphql(query, { boardId: options.boardId, groupName: options.groupName });
  }

  /**
   * Create an update (comment)
   */
  async createUpdate(options: { itemId: string; body: string }): Promise<{ create_update: MondayUpdate }> {
    const query = `
      mutation ($itemId: ID!, $body: String!) {
        create_update(item_id: $itemId, body: $body) {
          id
          body
          created_at
          creator_id
          item_id
          text_body
        }
      }
    `;
    return this.graphql(query, { itemId: options.itemId, body: options.body });
  }

  /**
   * List updates for an item
   */
  async listUpdates(options: { itemId: string }): Promise<{ items: Array<{ updates: MondayUpdate[] }> }> {
    const query = `
      query ($itemIds: [ID!]) {
        items(ids: $itemIds) {
          updates {
            id
            body
            created_at
            creator_id
            item_id
            text_body
          }
        }
      }
    `;
    return this.graphql(query, { itemIds: [options.itemId] });
  }
}

export const MondayInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const token = config.auth?.['token'] as string | undefined;

    if (!token) {
      throw new Error('Monday.com SDK requires auth.token');
    }

    const client = new MondayClient(token);
    const wrapped = wrapIntegration('monday', client, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
      inputSchemas: mondaySchemas,
    });
    return {
      client: wrapped,
      actions: wrapped,
    };
  },
};
