/**
 * Zod input schemas for GitHub (Octokit) actions.
 *
 * Note: Schema keys include 'rest.' prefix to match Octokit SDK method paths
 * (e.g., octokit.rest.issues.create -> 'rest.issues.create')
 */

import { z } from 'zod';

export const githubSchemas: Record<string, z.ZodTypeAny> = {
  'rest.issues.create': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    milestone: z.number().optional(),
  }),

  'rest.issues.update': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    title: z.string().optional(),
    body: z.string().optional(),
    state: z.enum(['open', 'closed']).optional(),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  }),

  'rest.issues.list': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
    sort: z.enum(['created', 'updated', 'comments']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
  }),

  'rest.issues.get': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
  }),

  'rest.issues.listComments': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'rest.issues.createComment': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    issue_number: z.number().int().min(1, 'issue_number is required'),
    body: z.string().min(1, 'body is required'),
  }),

  'rest.pulls.create': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    title: z.string().min(1, 'title is required'),
    head: z.string().min(1, 'head branch is required'),
    base: z.string().min(1, 'base branch is required'),
    body: z.string().optional(),
    draft: z.boolean().optional(),
  }),

  'rest.pulls.list': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    state: z.enum(['open', 'closed', 'all']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'rest.repos.get': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
  }),

  'rest.repos.listForOrg': z.object({
    org: z.string().min(1, 'org is required'),
    type: z.enum(['all', 'public', 'private', 'forks', 'sources', 'member']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }),

  'rest.repos.listForAuthenticatedUser': z.object({
    visibility: z.enum(['all', 'public', 'private']).optional(),
    affiliation: z.string().optional(),
    type: z.enum(['all', 'owner', 'public', 'private', 'member']).optional(),
    sort: z.enum(['created', 'updated', 'pushed', 'full_name']).optional(),
    direction: z.enum(['asc', 'desc']).optional(),
    per_page: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(1).optional(),
  }).optional().default({}),

  'rest.repos.createRelease': z.object({
    owner: z.string().min(1, 'owner is required'),
    repo: z.string().min(1, 'repo is required'),
    tag_name: z.string().min(1, 'tag_name is required'),
    name: z.string().optional(),
    body: z.string().optional(),
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
  }),

  'rest.users.getAuthenticated': z.object({}).optional().default({}),
};
