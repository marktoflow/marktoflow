/**
 * Zod input schemas for Airtable API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const airtableSchemas: Record<string, z.ZodTypeAny> = {
  'listBases': z.object({}).optional().default({}),

  'getBaseSchema': z.object({
    baseId: z.string().min(1, 'baseId is required'),
  }),

  'listRecords': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    fields: z.array(z.string()).optional(),
    filterByFormula: z.string().optional(),
    maxRecords: z.number().int().min(1).optional(),
    sort: z.array(z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']).optional(),
    })).optional(),
  }),

  'getRecord': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    recordId: z.string().min(1, 'recordId is required'),
  }),

  'createRecord': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    fields: z.record(z.unknown()),
  }),

  'createRecords': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    records: z.array(z.object({
      fields: z.record(z.unknown()),
    })).min(1, 'records array is required and must not be empty'),
  }),

  'updateRecord': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    recordId: z.string().min(1, 'recordId is required'),
    fields: z.record(z.unknown()),
  }),

  'deleteRecord': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    recordId: z.string().min(1, 'recordId is required'),
  }),

  'findRecords': z.object({
    baseId: z.string().min(1, 'baseId is required'),
    tableIdOrName: z.string().min(1, 'tableIdOrName is required'),
    filterByFormula: z.string().optional(),
  }),
};
