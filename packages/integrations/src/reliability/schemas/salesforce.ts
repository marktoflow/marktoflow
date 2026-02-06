/**
 * Zod input schemas for Salesforce API actions.
 */

import { z } from 'zod';

export const salesforceSchemas: Record<string, z.ZodTypeAny> = {
  query: z.object({
    soql: z.string().min(1, 'SOQL query is required'),
  }),

  createRecord: z.object({
    objectType: z.string().min(1, 'objectType is required (e.g., Account, Contact, Lead)'),
    fields: z.record(z.unknown()).refine((fields) => Object.keys(fields).length > 0, {
      message: 'At least one field is required',
    }),
  }),

  getRecord: z.object({
    objectType: z.string().min(1, 'objectType is required'),
    id: z.string().min(1, 'Record ID is required'),
    fields: z.array(z.string()).optional(),
  }),

  updateRecord: z.object({
    objectType: z.string().min(1, 'objectType is required'),
    id: z.string().min(1, 'Record ID is required'),
    fields: z.record(z.unknown()).refine((fields) => Object.keys(fields).length > 0, {
      message: 'At least one field is required',
    }),
  }),

  deleteRecord: z.object({
    objectType: z.string().min(1, 'objectType is required'),
    id: z.string().min(1, 'Record ID is required'),
  }),

  describeObject: z.object({
    objectType: z.string().min(1, 'objectType is required'),
  }),
};
