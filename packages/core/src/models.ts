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

export const StepType = {
  ACTION: 'action',
  WORKFLOW: 'workflow',
  IF: 'if',
  SWITCH: 'switch',
  FOR_EACH: 'for_each',
  WHILE: 'while',
  MAP: 'map',
  FILTER: 'filter',
  REDUCE: 'reduce',
  PARALLEL: 'parallel',
  TRY: 'try',
} as const;

export type StepType = (typeof StepType)[keyof typeof StepType];

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

// Base step schema with shared fields
const BaseStepSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  outputVariable: z.string().optional(),
});

// Recursive step array schema (defined later after WorkflowStepUnionSchema)
const StepArraySchema: z.ZodTypeAny = z.lazy(() => z.array(WorkflowStepUnionSchema));

// Action step - executes an SDK action
const ActionStepSchema = BaseStepSchema.extend({
  type: z.literal('action'),
  action: z.string(),
  inputs: z.record(z.unknown()).default({}),
  errorHandling: ErrorHandlingSchema.optional(),
});

// Workflow step - executes a sub-workflow
const SubWorkflowStepSchema = BaseStepSchema.extend({
  type: z.literal('workflow'),
  workflow: z.string(),
  inputs: z.record(z.unknown()).default({}),
  errorHandling: ErrorHandlingSchema.optional(),
});

// If/else conditional step
const IfStepSchema = BaseStepSchema.extend({
  type: z.literal('if'),
  condition: z.string(),
  then: StepArraySchema.optional(),
  else: StepArraySchema.optional(),
  steps: StepArraySchema.optional(), // Alias for 'then'
});

// Switch/case step
const SwitchStepSchema = BaseStepSchema.extend({
  type: z.literal('switch'),
  expression: z.string(),
  cases: z.record(StepArraySchema),
  default: StepArraySchema.optional(),
});

// For-each loop step
const ForEachStepSchema = BaseStepSchema.extend({
  type: z.literal('for_each'),
  items: z.string(), // Template expression resolving to array
  itemVariable: z.string().default('item'),
  indexVariable: z.string().optional(),
  steps: StepArraySchema,
  errorHandling: ErrorHandlingSchema.optional(),
});

// While loop step
const WhileStepSchema = BaseStepSchema.extend({
  type: z.literal('while'),
  condition: z.string(),
  maxIterations: z.number().default(100),
  steps: StepArraySchema,
  errorHandling: ErrorHandlingSchema.optional(),
});

// Map transformation step
const MapStepSchema = BaseStepSchema.extend({
  type: z.literal('map'),
  items: z.string(), // Template expression resolving to array
  itemVariable: z.string().default('item'),
  expression: z.string(), // Template expression for transformation
});

// Filter step
const FilterStepSchema = BaseStepSchema.extend({
  type: z.literal('filter'),
  items: z.string(), // Template expression resolving to array
  itemVariable: z.string().default('item'),
  condition: z.string(), // Condition to evaluate for each item
});

// Reduce/aggregate step
const ReduceStepSchema = BaseStepSchema.extend({
  type: z.literal('reduce'),
  items: z.string(), // Template expression resolving to array
  itemVariable: z.string().default('item'),
  accumulatorVariable: z.string().default('accumulator'),
  initialValue: z.unknown().optional(),
  expression: z.string(), // Template expression for aggregation
});

// Parallel execution branch
const ParallelBranchSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  steps: StepArraySchema,
});

// Parallel step
const ParallelStepSchema = BaseStepSchema.extend({
  type: z.literal('parallel'),
  branches: z.array(ParallelBranchSchema),
  maxConcurrent: z.number().optional(),
  onError: z.enum(['stop', 'continue']).default('stop'),
});

// Try/catch error handling step
const TryStepSchema = BaseStepSchema.extend({
  type: z.literal('try'),
  try: StepArraySchema,
  catch: StepArraySchema.optional(),
  finally: StepArraySchema.optional(),
});

// Discriminated union of all step types
const WorkflowStepUnionSchema: z.ZodTypeAny = z.union([
  ActionStepSchema,
  SubWorkflowStepSchema,
  IfStepSchema,
  SwitchStepSchema,
  ForEachStepSchema,
  WhileStepSchema,
  MapStepSchema,
  FilterStepSchema,
  ReduceStepSchema,
  ParallelStepSchema,
  TryStepSchema,
  // Backward compatibility: steps without 'type' field
  z
    .object({
      id: z.string(),
      name: z.string().optional(),
      action: z.string().optional(),
      workflow: z.string().optional(),
      inputs: z.record(z.unknown()).default({}),
      outputVariable: z.string().optional(),
      conditions: z.array(z.string()).optional(),
      errorHandling: ErrorHandlingSchema.optional(),
      timeout: z.number().optional(),
    })
    .refine((data) => data.action || data.workflow, {
      message: 'Step must have either "action" or "workflow" field',
    })
    .transform((data) => ({
      ...data,
      type: data.action ? ('action' as const) : ('workflow' as const),
    })),
]);

export { WorkflowStepUnionSchema as WorkflowStepSchema };

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
  steps: z.array(WorkflowStepUnionSchema),
  rawContent: z.string().optional(), // Original markdown content
});

// ============================================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================================

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

// Step types
export type ActionStep = z.infer<typeof ActionStepSchema>;
export type SubWorkflowStep = z.infer<typeof SubWorkflowStepSchema>;
export type IfStep = z.infer<typeof IfStepSchema>;
export type SwitchStep = z.infer<typeof SwitchStepSchema>;
export type ForEachStep = z.infer<typeof ForEachStepSchema>;
export type WhileStep = z.infer<typeof WhileStepSchema>;
export type MapStep = z.infer<typeof MapStepSchema>;
export type FilterStep = z.infer<typeof FilterStepSchema>;
export type ReduceStep = z.infer<typeof ReduceStepSchema>;
export type ParallelStep = z.infer<typeof ParallelStepSchema>;
export type ParallelBranch = z.infer<typeof ParallelBranchSchema>;
export type TryStep = z.infer<typeof TryStepSchema>;

export type WorkflowStep = z.infer<typeof WorkflowStepUnionSchema>;

// ============================================================================
// Type Guards
// ============================================================================

export function isActionStep(step: WorkflowStep): step is ActionStep {
  return (step as ActionStep).type === 'action' || ((step as any).action !== undefined && (step as any).type === undefined);
}

export function isSubWorkflowStep(step: WorkflowStep): step is SubWorkflowStep {
  return (step as SubWorkflowStep).type === 'workflow' || ((step as any).workflow !== undefined && (step as any).type === undefined && (step as any).action === undefined);
}

export function isIfStep(step: WorkflowStep): step is IfStep {
  return (step as IfStep).type === 'if';
}

export function isSwitchStep(step: WorkflowStep): step is SwitchStep {
  return (step as SwitchStep).type === 'switch';
}

export function isForEachStep(step: WorkflowStep): step is ForEachStep {
  return (step as ForEachStep).type === 'for_each';
}

export function isWhileStep(step: WorkflowStep): step is WhileStep {
  return (step as WhileStep).type === 'while';
}

export function isMapStep(step: WorkflowStep): step is MapStep {
  return (step as MapStep).type === 'map';
}

export function isFilterStep(step: WorkflowStep): step is FilterStep {
  return (step as FilterStep).type === 'filter';
}

export function isReduceStep(step: WorkflowStep): step is ReduceStep {
  return (step as ReduceStep).type === 'reduce';
}

export function isParallelStep(step: WorkflowStep): step is ParallelStep {
  return (step as ParallelStep).type === 'parallel';
}

export function isTryStep(step: WorkflowStep): step is TryStep {
  return (step as TryStep).type === 'try';
}

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
