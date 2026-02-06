/**
 * Zod input schemas for GitHub (Octokit) actions.
 */

import { z } from 'zod';

export const githubSchemas: Record<string, z.ZodTypeAny> = {
  'issues.create': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    milestone: z.number().optional(),
  }),

  'issues.update': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    title: z.string().optional(),
    body: z.string().optional(),
    state: z.enum(['open', 'closed']).optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  }),

  'issues.list': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
    sort: z.enum(['created', 'updated', 'comments']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),

  'issues.get': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
  }),

  'issues.listComments': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'issues.createComment': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    body: z.string().min(1, 'body is required'),
  }),

  'pulls.create': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    title: z.string().min(1, 'title is required'),
    head: z.string().min(1, 'head branch is required'),
    base: z.string().min(1, 'base branch is required'),
    body: z.string().optional(),
    draft: z.boolean().optional(),
  }),

  'pulls.list': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'repos.get': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
  }),

  'repos.listForOrg': z.object({
    org: z.string().min(1, 'org is required'),
    type: z.enum(['all', 'public', 'private', 'forks', 'sources', 'member']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'repos.createRelease': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    tag_name: z.string().min(1, 'tag_name is required'),
    name: z.string().optional(),
    body: z.string().optional(),
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
  }),

  'users.getAuthenticated': z.object({}).optional().default({}),
};
