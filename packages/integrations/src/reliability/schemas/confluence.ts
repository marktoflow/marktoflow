/**
 * Zod input schemas for Confluence API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const confluenceSchemas: Record<string, z.ZodTypeAny> = {
  'listSpaces': z.object({
    limit: z.number().int().min(1).optional(),
    start: z.number().int().min(0).optional(),
  }).optional().default({}),

  'getSpace': z.object({
    spaceId: z.string().min(1, 'spaceId is required'),
  }),

  'listPages': z.object({
    spaceId: z.string().optional(),
    limit: z.number().int().min(1).optional(),
    start: z.number().int().min(0).optional(),
  }).optional().default({}),

  'getPage': z.object({
    pageId: z.string().min(1, 'pageId is required'),
  }),

  'createPage': z.object({
    spaceId: z.string().min(1, 'spaceId is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().min(1, 'body is required'),
    parentId: z.string().optional(),
  }),

  'updatePage': z.object({
    pageId: z.string().min(1, 'pageId is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().min(1, 'body is required'),
    version: z.number().int().min(1, 'version is required'),
  }),

  'deletePage': z.object({
    pageId: z.string().min(1, 'pageId is required'),
  }),

  'search': z.object({
    query: z.string().min(1, 'query is required'),
    limit: z.number().int().min(1).optional(),
  }),

  'addComment': z.object({
    pageId: z.string().min(1, 'pageId is required'),
    body: z.string().min(1, 'body is required'),
  }),
};
