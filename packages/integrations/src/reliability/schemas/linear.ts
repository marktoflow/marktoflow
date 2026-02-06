/**
 * Zod input schemas for Linear API actions.
 */

import { z } from 'zod';

export const linearSchemas: Record<string, z.ZodTypeAny> = {
  createIssue: z.object({
    title: z.string().min(1, 'title is required'),
    teamId: z.string().min(1, 'teamId is required'),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    stateId: z.string().optional(),
    labelIds: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    estimate: z.number().optional(),
  }),

  updateIssue: z.object({
    id: z.string().min(1, 'issue id is required'),
    title: z.string().optional(),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    stateId: z.string().optional(),
  }),

  getIssue: z.object({
    id: z.string().min(1, 'issue id is required'),
  }),

  listIssues: z.object({
    teamId: z.string().optional(),
    first: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
  }).optional().default({}),

  createComment: z.object({
    issueId: z.string().min(1, 'issueId is required'),
    body: z.string().min(1, 'body is required'),
  }),

  listTeams: z.object({}).optional().default({}),
};
