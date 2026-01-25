// Shared types between client and server

export interface WorkflowMetadata {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
}

export interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  workflow?: string;
  inputs: Record<string, unknown>;
  outputVariable?: string;
  conditions?: string[];
  errorHandling?: {
    action: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
    retryDelay?: number;
    fallbackStep?: string;
  };
  timeout?: number;
}

export interface WorkflowTool {
  sdk: string;
  auth?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface WorkflowInput {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: unknown;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  cron?: string;
  path?: string;
  events?: string[];
}

export interface Workflow {
  metadata: WorkflowMetadata;
  steps: WorkflowStep[];
  tools?: Record<string, WorkflowTool>;
  inputs?: Record<string, WorkflowInput>;
  triggers?: WorkflowTrigger[];
}

export interface WorkflowListItem {
  path: string;
  name: string;
  description?: string;
  version?: string;
}

// Execution types

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  retryCount: number;
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  workflowPath: string;
  status: WorkflowStatus;
  stepResults: StepResult[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
}

// Canvas types

export interface CanvasNode {
  id: string;
  type: 'step' | 'subworkflow' | 'trigger' | 'output';
  position: { x: number; y: number };
  data: StepNodeData | SubWorkflowNodeData;
}

export interface StepNodeData {
  id: string;
  name?: string;
  action: string;
  status?: StepStatus;
  retryCount?: number;
  error?: string;
  inputs?: Record<string, unknown>;
  outputVariable?: string;
}

export interface SubWorkflowNodeData {
  id: string;
  name?: string;
  workflowPath: string;
  stepCount?: number;
  status?: WorkflowStatus;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: 'sequence' | 'dataflow';
  label?: string;
  animated?: boolean;
}

// API types

export interface APIResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PromptRequest {
  prompt: string;
  workflow: Workflow;
}

export interface PromptResponse {
  explanation: string;
  workflow?: Workflow;
  diff?: string;
}

// WebSocket events

export interface WorkflowUpdatedEvent {
  path: string;
  event: 'change' | 'add' | 'remove';
  timestamp: string;
}

export interface ExecutionStepEvent {
  runId: string;
  stepId: string;
  status: StepStatus;
  output?: unknown;
  error?: string;
  duration?: number;
}

export interface ExecutionCompletedEvent {
  runId: string;
  status: WorkflowStatus;
  outputs: Record<string, unknown>;
  duration: number;
  error?: string;
}
