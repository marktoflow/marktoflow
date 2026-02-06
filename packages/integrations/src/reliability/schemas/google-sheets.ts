/**
 * Zod input schemas for Google Sheets API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const googleSheetsSchemas: Record<string, z.ZodTypeAny> = {
  'getSpreadsheet': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
  }),

  'getValues': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    range: z.string().min(1, 'range is required'),
  }),

  'appendValues': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    range: z.string().min(1, 'range is required'),
    values: z.array(z.array(z.unknown())).min(1, 'values array is required'),
  }),

  'updateValues': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    range: z.string().min(1, 'range is required'),
    values: z.array(z.array(z.unknown())).min(1, 'values array is required'),
  }),

  'clearValues': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    range: z.string().min(1, 'range is required'),
  }),

  'createSpreadsheet': z.object({
    title: z.string().min(1, 'title is required'),
  }),

  'addSheet': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    title: z.string().min(1, 'title is required'),
  }),

  'deleteSheet': z.object({
    spreadsheetId: z.string().min(1, 'spreadsheetId is required'),
    sheetId: z.number().int().min(0, 'sheetId is required'),
  }),
};
