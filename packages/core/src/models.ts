/**
 * Core data models for marktoflow v2.0
 *
 * These models define the structure of workflows, steps, and execution context.
 * Uses Zod for runtime validation.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const StepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

export const WorkflowStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const TriggerType = {
  MANUAL: 'manual',
  SCHEDULE: 'schedule',
  WEBHOOK: 'webhook',
  EVENT: 'event',
} as const;

export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

// ============================================================================
// Zod Schemas
// ============================================================================

export const WorkflowMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default('1.0.0'),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const ToolConfigSchema = z.object({
  sdk: z.string(), // e.g., "@slack/web-api"
  auth: z.record(z.string()).optional(), // e.g., { token: "${SLACK_TOKEN}" }
  options: z.record(z.unknown()).optional(),
});

export const ErrorHandlingSchema = z.object({
  action: z.enum(['continue', 'stop', 'rollback']).default('stop'),
  maxRetries: z.number().default(3),
  retryDelaySeconds: z.number().default(1.0),
  fallbackAction: z.string().optional(),
});

export const WorkflowStepSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    action: z.string().optional(), // e.g., "slack.chat.postMessage"
    workflow: z.string().optional(), // Path to sub-workflow markdown file
    inputs: z.record(z.unknown()).default({}),
    outputVariable: z.string().optional(),
    conditions: z.array(z.string()).optional(),
    errorHandling: ErrorHandlingSchema.optional(),
    timeout: z.number().optional(), // seconds
  })
  .refine((data) => data.action || data.workflow, {
    message: 'Step must have either "action" or "workflow" field',
  });

export const TriggerSchema = z.object({
  type: z.enum(['manual', 'schedule', 'webhook', 'event']),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export const WorkflowInputSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  description: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
});

export const WorkflowSchema = z.object({
  metadata: WorkflowMetadataSchema,
  tools: z.record(ToolConfigSchema).default({}),
  inputs: z.record(WorkflowInputSchema).optional(),
  triggers: z.array(TriggerSchema).optional(),
  steps: z.array(WorkflowStepSchema),
  rawContent: z.string().optional(), // Original markdown content
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionContext {
  workflowId: string;
  runId: string;
  variables: Record<string, unknown>;
  inputs: Record<string, unknown>;
  startedAt: Date;
  currentStepIndex: number;
  status: WorkflowStatus;
  stepMetadata: Record<string, { status: string; error?: string; retryCount: number }>;
  [key: string]: unknown; // Allow index access for template resolution
}

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output: unknown;
  error: string | undefined;
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
  retryCount: number;
}

export interface WorkflowResult {
  workflowId: string;
  runId: string;
  status: WorkflowStatus;
  stepResults: StepResult[];
  output: Record<string, unknown>;
  error: string | undefined;
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createExecutionContext(
  workflow: Workflow,
  inputs: Record<string, unknown> = {}
): ExecutionContext {
  return {
    workflowId: workflow.metadata.id,
    runId: crypto.randomUUID(),
    variables: {},
    inputs,
    startedAt: new Date(),
    currentStepIndex: 0,
    status: WorkflowStatus.PENDING,
    stepMetadata: {},
  };
}

export function createStepResult(
  stepId: string,
  status: StepStatus,
  output: unknown,
  startedAt: Date,
  retryCount = 0,
  error?: string
): StepResult {
  const completedAt = new Date();
  return {
    stepId,
    status,
    output,
    error,
    startedAt,
    completedAt,
    duration: completedAt.getTime() - startedAt.getTime(),
    retryCount,
  };
}
