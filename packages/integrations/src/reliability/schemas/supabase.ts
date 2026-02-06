/**
 * Zod input schemas for Supabase API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const supabaseSchemas: Record<string, z.ZodTypeAny> = {
  'from': z.object({
    table: z.string().min(1, 'table is required'),
    select: z.string().optional(),
    insert: z.record(z.unknown()).optional(),
    update: z.record(z.unknown()).optional(),
    delete: z.boolean().optional(),
    eq: z.record(z.unknown()).optional(),
    limit: z.number().int().min(1).optional(),
  }),

  'rpc': z.object({
    fn: z.string().min(1, 'fn is required'),
    args: z.record(z.unknown()),
  }),

  'signUp': z.object({
    email: z.string().min(1, 'email is required'),
    password: z.string().min(1, 'password is required'),
  }),

  'signIn': z.object({
    email: z.string().min(1, 'email is required'),
    password: z.string().min(1, 'password is required'),
  }),

  'signOut': z.object({}).optional().default({}),

  'getUser': z.object({}).optional().default({}),

  'uploadFile': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    path: z.string().min(1, 'path is required'),
    file: z.unknown(),
    contentType: z.string().optional(),
  }),

  'downloadFile': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    path: z.string().min(1, 'path is required'),
  }),

  'deleteFile': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    paths: z.array(z.string().min(1)),
  }),

  'listFiles': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    path: z.string().optional(),
    limit: z.number().int().min(1).optional(),
  }),
};
