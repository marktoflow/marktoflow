/**
 * Zod input schemas for Google Drive API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const googleDriveSchemas: Record<string, z.ZodTypeAny> = {
  'listFiles': z.object({
    q: z.string().optional(),
    pageSize: z.number().int().min(1).optional(),
    orderBy: z.string().optional(),
  }).optional().default({}),

  'getFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
  }),

  'createFile': z.object({
    name: z.string().min(1, 'name is required'),
    mimeType: z.string().optional(),
    parents: z.array(z.string()).optional(),
    content: z.unknown().optional(),
  }),

  'createFolder': z.object({
    name: z.string().min(1, 'name is required'),
    parents: z.array(z.string()).optional(),
  }),

  'updateFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
    name: z.string().optional(),
    content: z.unknown().optional(),
  }),

  'deleteFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
  }),

  'copyFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
    name: z.string().optional(),
  }),

  'moveFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
    folderId: z.string().min(1, 'folderId is required'),
  }),

  'shareFile': z.object({
    fileId: z.string().min(1, 'fileId is required'),
    role: z.enum(['owner', 'organizer', 'fileOrganizer', 'editor', 'writer', 'commenter', 'reader'], {
      errorMap: () => ({ message: 'role must be one of: owner, organizer, fileOrganizer, editor, writer, commenter, reader' }),
    }),
    type: z.enum(['user', 'group', 'domain', 'anyone'], {
      errorMap: () => ({ message: 'type must be one of: user, group, domain, anyone' }),
    }),
    emailAddress: z.string().email().optional(),
  }),

  'searchFiles': z.object({
    query: z.string().min(1, 'query is required'),
    pageSize: z.number().int().min(1).optional(),
  }),
};
