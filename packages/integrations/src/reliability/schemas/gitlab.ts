/**
 * Zod input schemas for GitLab API actions.
 */

import { z } from 'zod';

export const gitlabSchemas: Record<string, z.ZodTypeAny> = {
  listProjects: z.object({
    owned: z.boolean().optional(),
    membership: z.boolean().optional(),
    simple: z.boolean().optional(),
  }).optional().default({}),

  getProject: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
  }),

  createIssue: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assigneeId: z.number().optional(),
  }),

  listIssues: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    state: z.enum(['opened', 'closed', 'all']).optional(),
    labels: z.array(z.string()).optional(),
  }),

  getIssue: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    issueIid: z.number().int().min(1, 'issueIid is required'),
  }),

  updateIssue: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    issueIid: z.number().int().min(1, 'issueIid is required'),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      state_event: z.enum(['close', 'reopen']).optional(),
      labels: z.array(z.string()).optional(),
    }),
  }),

  createMergeRequest: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    sourceBranch: z.string().min(1, 'sourceBranch is required'),
    targetBranch: z.string().min(1, 'targetBranch is required'),
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    assigneeId: z.number().optional(),
    labels: z.array(z.string()).optional(),
  }),

  listMergeRequests: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    state: z.enum(['opened', 'closed', 'merged', 'all']).optional(),
  }),

  getMergeRequest: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    mergeRequestIid: z.number().int().min(1, 'mergeRequestIid is required'),
  }),

  mergeMergeRequest: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    mergeRequestIid: z.number().int().min(1, 'mergeRequestIid is required'),
    merge_commit_message: z.string().optional(),
    should_remove_source_branch: z.boolean().optional(),
  }),

  listPipelines: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    status: z.string().optional(),
    ref: z.string().optional(),
  }),

  getPipeline: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    pipelineId: z.number().int().min(1, 'pipelineId is required'),
  }),

  createPipeline: z.object({
    projectId: z.union([z.string(), z.number()]).refine((val) => val !== '', {
      message: 'projectId is required',
    }),
    ref: z.string().min(1, 'ref is required (branch name)'),
    variables: z.record(z.string()).optional(),
  }),
};
