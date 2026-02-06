/**
 * Zod input schemas for Notion API actions.
 */

import { z } from 'zod';

export const notionSchemas: Record<string, z.ZodTypeAny> = {
  createPage: z.object({
    parentPageId: z.string().optional(),
    parentDatabaseId: z.string().optional(),
    title: z.string().min(1, 'title is required'),
    properties: z.record(z.unknown()).optional(),
    children: z.array(z.record(z.unknown())).optional(),
    icon: z.union([z.object({ emoji: z.string() }), z.object({ external: z.object({ url: z.string() }) })]).optional(),
    cover: z.object({ external: z.object({ url: z.string() }) }).optional(),
  }).refine((d) => d.parentPageId || d.parentDatabaseId, {
    message: 'Either parentPageId or parentDatabaseId is required',
  }),

  getPage: z.object({
    pageId: z.string().min(1, 'pageId is required'),
  }),

  updatePage: z.object({
    pageId: z.string().min(1, 'pageId is required'),
    properties: z.record(z.unknown()).optional(),
    archived: z.boolean().optional(),
    icon: z.string().optional(),
    cover: z.string().optional(),
  }),

  queryDatabase: z.object({
    databaseId: z.string().min(1, 'databaseId is required'),
    filter: z.record(z.unknown()).optional(),
    sorts: z.array(z.record(z.unknown())).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    startCursor: z.string().optional(),
  }),

  getDatabase: z.object({
    databaseId: z.string().min(1, 'databaseId is required'),
  }),

  search: z.object({
    query: z.string().optional(),
    filter: z.object({
      value: z.enum(['page', 'database']),
      property: z.literal('object'),
    }).optional(),
    sort: z.object({
      direction: z.enum(['ascending', 'descending']),
      timestamp: z.literal('last_edited_time'),
    }).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    startCursor: z.string().optional(),
  }).optional().default({}),

  appendBlocks: z.object({
    blockId: z.string().min(1, 'blockId is required'),
    children: z.array(z.record(z.unknown())).min(1, 'children array must not be empty'),
  }),

  getBlocks: z.object({
    blockId: z.string().min(1, 'blockId is required'),
    pageSize: z.number().int().min(1).max(100).optional(),
    startCursor: z.string().optional(),
  }),

  deleteBlock: z.object({
    blockId: z.string().min(1, 'blockId is required'),
  }),
};
