/**
 * Zod input schemas for Asana API actions.
 * Validates inputs BEFORE they reach the SDK to provide clear error messages.
 */

import { z } from 'zod';

export const asanaSchemas: Record<string, z.ZodTypeAny> = {
  getTask: z.object({
    taskGid: z.string().min(1, 'taskGid is required'),
  }),

  createTask: z.object({
    name: z.string().min(1, 'name is required'),
    workspace: z.string().min(1, 'workspace is required'),
    projects: z.array(z.string()).optional(),
    assignee: z.string().optional(),
    notes: z.string().optional(),
    dueOn: z.string().optional(),
  }),

  updateTask: z.object({
    taskGid: z.string().min(1, 'taskGid is required'),
    name: z.string().optional(),
    notes: z.string().optional(),
    dueOn: z.string().optional(),
    completed: z.boolean().optional(),
  }),

  deleteTask: z.object({
    taskGid: z.string().min(1, 'taskGid is required'),
  }),

  getTasksInProject: z.object({
    projectGid: z.string().min(1, 'projectGid is required'),
  }),

  addComment: z.object({
    taskGid: z.string().min(1, 'taskGid is required'),
    text: z.string().min(1, 'text is required'),
  }),

  getProject: z.object({
    projectGid: z.string().min(1, 'projectGid is required'),
  }),

  createProject: z.object({
    name: z.string().min(1, 'name is required'),
    workspace: z.string().min(1, 'workspace is required'),
    notes: z.string().optional(),
  }),

  getWorkspaces: z.object({}).optional().default({}),
};
