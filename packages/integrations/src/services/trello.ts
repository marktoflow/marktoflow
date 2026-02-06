/**
 * Trello Integration
 *
 * Visual project management with boards, lists, and cards.
 * API Docs: https://developer.atlassian.com/cloud/trello/rest/
 * SDK: https://github.com/norberteder/trello
 */

// @ts-expect-error - trello doesn't have types
import Trello from 'trello';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';
import { wrapIntegration } from '../reliability/wrapper.js';

export interface TrelloCard {
  id?: string;
  name: string;
  desc?: string;
  idList: string;
  pos?: number | 'top' | 'bottom';
  due?: string;
  idMembers?: string[];
  idLabels?: string[];
  urlSource?: string;
}

export interface TrelloList {
  id?: string;
  name: string;
  idBoard: string;
  pos?: number | 'top' | 'bottom';
  closed?: boolean;
}

export interface TrelloBoard {
  id?: string;
  name: string;
  desc?: string;
  closed?: boolean;
  prefs?: {
    permissionLevel?: 'private' | 'org' | 'public';
    voting?: 'disabled' | 'members' | 'observers' | 'org' | 'public';
    comments?: 'disabled' | 'members' | 'observers' | 'org' | 'public';
  };
}

export interface TrelloLabel {
  id?: string;
  name: string;
  color: 'yellow' | 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'black' | 'sky' | 'pink' | 'lime';
  idBoard: string;
}

/**
 * Trello client wrapper for workflow integration
 */
export class TrelloClient {
  constructor(private client: Trello) {}

  // ==================== Boards ====================

  /**
   * Get board by ID
   */
  async getBoard(boardId: string) {
    return await this.client.getBoard(boardId);
  }

  /**
   * Create board
   */
  async createBoard(board: TrelloBoard) {
    return await this.client.addBoard(board.name, board.desc, undefined, board.prefs);
  }

  /**
   * Update board
   */
  async updateBoard(boardId: string, updates: Partial<TrelloBoard>) {
    return await this.client.updateBoard(boardId, updates);
  }

  /**
   * Get lists on board
   */
  async getListsOnBoard(boardId: string) {
    return await this.client.getListsOnBoard(boardId);
  }

  /**
   * Get cards on board
   */
  async getCardsOnBoard(boardId: string) {
    return await this.client.getCardsOnBoard(boardId);
  }

  /**
   * Get members of board
   */
  async getBoardMembers(boardId: string) {
    return await this.client.getBoardMembers(boardId);
  }

  // ==================== Lists ====================

  /**
   * Get list by ID
   */
  async getList(listId: string) {
    return await this.client.getListsOnBoard(listId);
  }

  /**
   * Create list
   */
  async createList(list: TrelloList) {
    return await this.client.addListToBoard(list.idBoard, list.name, list.pos);
  }

  /**
   * Update list
   */
  async updateList(listId: string, updates: { name?: string; closed?: boolean; pos?: number | string }) {
    return await this.client.updateList(listId, updates.name, updates.closed, updates.pos);
  }

  /**
   * Get cards in list
   */
  async getCardsOnList(listId: string) {
    return await this.client.getCardsOnList(listId);
  }

  // ==================== Cards ====================

  /**
   * Get card by ID
   */
  async getCard(cardId: string) {
    return await this.client.getCard(cardId);
  }

  /**
   * Create card
   */
  async createCard(card: TrelloCard) {
    return await this.client.addCard(
      card.name,
      card.desc || '',
      card.idList,
      card.pos,
      card.due,
      card.idMembers,
      card.idLabels,
      card.urlSource,
    );
  }

  /**
   * Update card
   */
  async updateCard(cardId: string, updates: Partial<TrelloCard>) {
    return await this.client.updateCard(cardId, updates.name, updates.desc, updates.due, updates.idList);
  }

  /**
   * Delete card
   */
  async deleteCard(cardId: string) {
    return await this.client.deleteCard(cardId);
  }

  /**
   * Add comment to card
   */
  async addCommentToCard(cardId: string, comment: string) {
    return await this.client.addCommentToCard(cardId, comment);
  }

  /**
   * Add member to card
   */
  async addMemberToCard(cardId: string, memberId: string) {
    return await this.client.addMemberToCard(cardId, memberId);
  }

  /**
   * Add attachment to card
   */
  async addAttachmentToCard(cardId: string, url: string) {
    return await this.client.addAttachmentToCard(cardId, url);
  }

  /**
   * Add checklist to card
   */
  async addChecklistToCard(cardId: string, name: string) {
    return await this.client.addChecklistToCard(cardId, name);
  }

  // ==================== Labels ====================

  /**
   * Get labels on board
   */
  async getLabelsForBoard(boardId: string) {
    return await this.client.getLabelsForBoard(boardId);
  }

  /**
   * Create label
   */
  async createLabel(label: TrelloLabel) {
    return await this.client.addLabelToBoard(label.idBoard, label.name, label.color);
  }

  /**
   * Add label to card
   */
  async addLabelToCard(cardId: string, labelId: string) {
    return await this.client.addLabelToCard(cardId, labelId);
  }

  /**
   * Remove label from card
   */
  async removeLabelFromCard(cardId: string, labelId: string) {
    return await this.client.deleteLabelFromCard(cardId, labelId);
  }

  // ==================== Checklists ====================

  /**
   * Get checklist
   */
  async getChecklist(checklistId: string) {
    return await this.client.getChecklist(checklistId);
  }

  /**
   * Add item to checklist
   */
  async addItemToChecklist(checklistId: string, name: string) {
    return await this.client.addItemToChecklist(checklistId, name);
  }

  /**
   * Update checklist item
   */
  async updateChecklistItem(checklistId: string, itemId: string, updates: { name?: string; state?: 'complete' | 'incomplete' }) {
    if (updates.state) {
      return await this.client.updateCheckItemOnCard(checklistId, itemId, updates.state);
    }
    // SDK doesn't support name updates directly, would need raw API call
    throw new Error('Updating checklist item name not supported by SDK');
  }
}

export const TrelloInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const apiKey = config.auth?.['api_key'] as string | undefined;
    const token = config.auth?.['token'] as string | undefined;

    if (!apiKey || !token) {
      throw new Error('Trello SDK requires auth.api_key and auth.token');
    }

    const client = new Trello(apiKey, token);
    const wrapper = new TrelloClient(client);
    const wrapped = wrapIntegration('trello', wrapper, {
      timeout: 30000,
      retryOn: [429, 500, 502, 503],
      maxRetries: 3,
    });

    return {
      client: wrapped,
      actions: wrapped,
      rawClient: client,
    };
  },
};
