/**
 * Zod input schemas for PostgreSQL actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const postgresSchemas: Record<string, z.ZodTypeAny> = {
  'query': z.object({
    text: z.string().min(1, 'text is required'),
    values: z.array(z.unknown()).optional(),
  }),

  'select': z.object({
    table: z.string().min(1, 'table is required'),
    columns: z.array(z.string()).optional(),
    where: z.record(z.unknown()).optional(),
    orderBy: z.record(z.unknown()).optional(),
    limit: z.number().int().min(1).optional(),
  }),

  'insert': z.object({
    table: z.string().min(1, 'table is required'),
    data: z.union([
      z.record(z.unknown()),
      z.array(z.record(z.unknown())),
    ]),
  }),

  'update': z.object({
    table: z.string().min(1, 'table is required'),
    data: z.record(z.unknown()),
    where: z.record(z.unknown()),
  }),

  'delete': z.object({
    table: z.string().min(1, 'table is required'),
    where: z.record(z.unknown()),
  }),
};
