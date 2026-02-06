/**
 * Zod input schemas for Monday.com API actions.
 */

import { z } from 'zod';

export const mondaySchemas: Record<string, z.ZodTypeAny> = {
  listBoards: z.object({
    limit: z.number().int().min(1).max(100).optional(),
  }).optional().default({}),

  getBoard: z.object({
    boardId: z.string().min(1, 'boardId is required'),
  }),

  createBoard: z.object({
    boardName: z.string().min(1, 'boardName is required'),
    boardKind: z.enum(['public', 'private', 'share'], {
      errorMap: () => ({ message: 'boardKind must be public, private, or share' }),
    }),
  }),

  listItems: z.object({
    boardId: z.string().min(1, 'boardId is required'),
    limit: z.number().int().min(1).max(500).optional(),
  }),

  getItem: z.object({
    itemId: z.string().min(1, 'itemId is required'),
  }),

  createItem: z.object({
    boardId: z.string().min(1, 'boardId is required'),
    itemName: z.string().min(1, 'itemName is required'),
    groupId: z.string().optional(),
  }),

  updateItem: z.object({
    boardId: z.string().min(1, 'boardId is required'),
    itemId: z.string().min(1, 'itemId is required'),
    columnValues: z.record(z.unknown()).refine((vals) => Object.keys(vals).length > 0, {
      message: 'At least one column value is required',
    }),
  }),

  deleteItem: z.object({
    itemId: z.string().min(1, 'itemId is required'),
  }),

  createGroup: z.object({
    boardId: z.string().min(1, 'boardId is required'),
    groupName: z.string().min(1, 'groupName is required'),
  }),

  createUpdate: z.object({
    itemId: z.string().min(1, 'itemId is required'),
    body: z.string().min(1, 'body is required'),
  }),

  listUpdates: z.object({
    itemId: z.string().min(1, 'itemId is required'),
  }),
};
