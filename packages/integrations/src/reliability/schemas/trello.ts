/**
 * Zod input schemas for Trello API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const trelloSchemas: Record<string, z.ZodTypeAny> = {
  getBoard: z.object({
    boardId: z.string().min(1, 'boardId is required'),
  }),

  createBoard: z.object({
    name: z.string().min(1, 'name is required'),
    defaultLists: z.boolean().optional(),
    desc: z.string().optional(),
  }),

  getListsOnBoard: z.object({
    boardId: z.string().min(1, 'boardId is required'),
  }),

  createList: z.object({
    name: z.string().min(1, 'name is required'),
    idBoard: z.string().min(1, 'idBoard is required'),
  }),

  getCard: z.object({
    cardId: z.string().min(1, 'cardId is required'),
  }),

  createCard: z.object({
    name: z.string().min(1, 'name is required'),
    idList: z.string().min(1, 'idList is required'),
    desc: z.string().optional(),
    due: z.string().optional(),
    idMembers: z.array(z.string()).optional(),
  }),

  updateCard: z.object({
    cardId: z.string().min(1, 'cardId is required'),
    name: z.string().optional(),
    desc: z.string().optional(),
    due: z.string().optional(),
    idList: z.string().optional(),
  }),

  deleteCard: z.object({
    cardId: z.string().min(1, 'cardId is required'),
  }),

  addCommentToCard: z.object({
    cardId: z.string().min(1, 'cardId is required'),
    text: z.string().min(1, 'text is required'),
  }),

  addLabelToCard: z.object({
    cardId: z.string().min(1, 'cardId is required'),
    labelId: z.string().min(1, 'labelId is required'),
  }),
};
