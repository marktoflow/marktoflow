/**
 * Zod input schemas for Sentry API actions.
 */

import { z } from 'zod';

export const sentrySchemas: Record<string, z.ZodTypeAny> = {
  listIssues: z.object({
    project: z.string().min(1, 'project is required'),
    statuses: z.array(z.string()).optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),

  getIssue: z.object({
    issueId: z.string().min(1, 'issueId is required'),
  }),

  updateIssue: z.object({
    issueId: z.string().min(1, 'issueId is required'),
    updates: z.object({
      status: z.enum(['resolved', 'unresolved', 'ignored']).optional(),
      assignedTo: z.string().optional(),
      hasSeen: z.boolean().optional(),
      isBookmarked: z.boolean().optional(),
    }),
  }),

  deleteIssue: z.object({
    issueId: z.string().min(1, 'issueId is required'),
  }),

  listProjects: z.object({}).optional().default({}),

  getProject: z.object({
    projectSlug: z.string().min(1, 'projectSlug is required'),
  }),

  listReleases: z.object({}).optional().default({}),

  createRelease: z.object({
    version: z.string().min(1, 'version is required'),
    projects: z.array(z.string()).min(1, 'At least one project is required'),
    ref: z.string().optional(),
    url: z.string().optional(),
    dateReleased: z.string().optional(),
  }),
};
