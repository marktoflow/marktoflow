/**
 * Zod input schemas for AWS S3 actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const awsS3Schemas: Record<string, z.ZodTypeAny> = {
  'uploadObject': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    key: z.string().min(1, 'key is required'),
    body: z.unknown().optional(),
    contentType: z.string().optional(),
  }),

  'getObject': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    key: z.string().min(1, 'key is required'),
  }),

  'deleteObject': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    key: z.string().min(1, 'key is required'),
  }),

  'listObjects': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    prefix: z.string().optional(),
    maxKeys: z.number().int().min(1).optional(),
    continuationToken: z.string().optional(),
  }),

  'copyObject': z.object({
    sourceBucket: z.string().min(1, 'sourceBucket is required'),
    sourceKey: z.string().min(1, 'sourceKey is required'),
    destBucket: z.string().min(1, 'destBucket is required'),
    destKey: z.string().min(1, 'destKey is required'),
  }),

  'createBucket': z.object({
    bucket: z.string().min(1, 'bucket is required'),
    region: z.string().optional(),
  }),

  'deleteBucket': z.object({
    bucket: z.string().min(1, 'bucket is required'),
  }),

  'listBuckets': z.object({}).optional().default({}),
};
