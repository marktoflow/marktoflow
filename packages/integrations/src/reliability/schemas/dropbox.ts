/**
 * Zod input schemas for Dropbox API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const dropboxSchemas: Record<string, z.ZodTypeAny> = {
  'uploadFile': z.object({
    path: z.string().min(1, 'path is required'),
    contents: z.unknown(),
    mode: z.enum(['add', 'overwrite']).optional(),
  }),

  'downloadFile': z.object({
    path: z.string().min(1, 'path is required'),
  }),

  'getMetadata': z.object({
    path: z.string().min(1, 'path is required'),
  }),

  'listFolder': z.object({
    path: z.string().min(1, 'path is required'),
    recursive: z.boolean().optional(),
    limit: z.number().int().min(1).optional(),
  }),

  'createFolder': z.object({
    path: z.string().min(1, 'path is required'),
  }),

  'delete': z.object({
    path: z.string().min(1, 'path is required'),
  }),

  'move': z.object({
    fromPath: z.string().min(1, 'fromPath is required'),
    toPath: z.string().min(1, 'toPath is required'),
  }),

  'copy': z.object({
    fromPath: z.string().min(1, 'fromPath is required'),
    toPath: z.string().min(1, 'toPath is required'),
  }),

  'search': z.object({
    query: z.string().min(1, 'query is required'),
    path: z.string().optional(),
    maxResults: z.number().int().min(1).optional(),
  }),

  'createSharedLink': z.object({
    path: z.string().min(1, 'path is required'),
    settings: z.record(z.unknown()).optional(),
  }),
};
