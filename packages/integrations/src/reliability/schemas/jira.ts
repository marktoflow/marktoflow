/**
 * Zod input schemas for Jira API actions.
 */

import { z } from 'zod';

export const jiraSchemas: Record<string, z.ZodTypeAny> = {
  'issues.createIssue': z.object({
    fields: z.object({
      project: z.object({ key: z.string().min(1) }).or(z.object({ id: z.string().min(1) })),
      summary: z.string().min(1, 'summary is required'),
      issuetype: z.object({ name: z.string().min(1) }).or(z.object({ id: z.string().min(1) })),
      description: z.unknown().optional(),
      assignee: z.object({ accountId: z.string() }).optional(),
      priority: z.object({ name: z.string() }).or(z.object({ id: z.string() })).optional(),
      labels: z.array(z.string()).optional(),
    }),
  }),

  'issues.getIssue': z.object({
    issueIdOrKey: z.string().min(1, 'issueIdOrKey is required'),
    fields: z.array(z.string()).optional(),
    expand: z.string().optional(),
  }),

  'issues.editIssue': z.object({
    issueIdOrKey: z.string().min(1, 'issueIdOrKey is required'),
    fields: z.record(z.unknown()).optional(),
    update: z.record(z.unknown()).optional(),
  }),

  'issues.doTransition': z.object({
    issueIdOrKey: z.string().min(1, 'issueIdOrKey is required'),
    transition: z.object({ id: z.string().min(1) }),
  }),

  'issueSearch.searchForIssuesUsingJql': z.object({
    jql: z.string().min(1, 'JQL query is required'),
    maxResults: z.number().int().min(1).max(100).optional(),
    startAt: z.number().int().min(0).optional(),
    fields: z.array(z.string()).optional(),
  }),

  'issues.addComment': z.object({
    issueIdOrKey: z.string().min(1, 'issueIdOrKey is required'),
    body: z.unknown(),
  }),

  'projects.getAllProjects': z.object({
    maxResults: z.number().int().min(1).max(100).optional(),
    startAt: z.number().int().min(0).optional(),
  }).optional().default({}),
};
