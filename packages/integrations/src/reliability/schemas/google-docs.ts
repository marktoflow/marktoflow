/**
 * Zod input schemas for Google Docs API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const googleDocsSchemas: Record<string, z.ZodTypeAny> = {
  'getDocument': z.object({
    documentId: z.string().min(1, 'documentId is required'),
  }),

  'createDocument': z.object({
    title: z.string().min(1, 'title is required'),
  }),

  'getDocumentText': z.object({
    documentId: z.string().min(1, 'documentId is required'),
  }),

  'insertText': z.object({
    documentId: z.string().min(1, 'documentId is required'),
    text: z.string().min(1, 'text is required'),
    index: z.number().int().min(0, 'index is required'),
  }),

  'appendText': z.object({
    documentId: z.string().min(1, 'documentId is required'),
    text: z.string().min(1, 'text is required'),
  }),

  'deleteContent': z.object({
    documentId: z.string().min(1, 'documentId is required'),
    startIndex: z.number().int().min(0, 'startIndex is required'),
    endIndex: z.number().int().min(0, 'endIndex is required'),
  }).refine((d) => d.endIndex > d.startIndex, {
    message: 'endIndex must be greater than startIndex',
    path: ['endIndex'],
  }),

  'replaceAllText': z.object({
    documentId: z.string().min(1, 'documentId is required'),
    searchText: z.string().min(1, 'searchText is required'),
    replaceText: z.string(),
  }),
};
