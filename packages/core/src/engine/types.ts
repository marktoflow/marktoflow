/**
 * Shared types for the marktoflow workflow engine modules.
 */

import type { WorkflowStep, ExecutionContext } from '../models.js';
import type { EffectivePermissions, SecurityPolicy } from '../permissions.js';
import type { RollbackRegistry } from '../rollback.js';
import type { FailoverConfig } from '../failover.js';
import type { AgentHealthTracker } from '../failover.js';

export interface EngineConfig {
  /** Default timeout for steps in milliseconds */
  defaultTimeout?: number;
  /** Maximum retries for failed steps */
  maxRetries?: number;
  /** Base delay for retry backoff in milliseconds */
  retryBaseDelay?: number;
  /** Maximum delay for retry backoff in milliseconds */
  retryMaxDelay?: number;
  /** Optional rollback registry for rollback error handling */
  rollbackRegistry?: RollbackRegistry;
  /** Failover configuration for step execution */
  failoverConfig?: Partial<FailoverConfig>;
  /** Optional agent health tracker */
  healthTracker?: AgentHealthTracker;
  /** Default agent for AI steps */
  defaultAgent?: string;
  /** Default model for AI steps */
  defaultModel?: string;
}

export interface SDKRegistryLike {
  /** Load an SDK by name */
  load(sdkName: string): Promise<unknown>;
  /** Check if SDK is available */
  has(sdkName: string): boolean;
}

export interface StepExecutorContext {
  /** Effective model for this step (from step override or workflow default) */
  model: string | undefined;
  /** Effective agent for this step (from step override or workflow default) */
  agent: string | undefined;
  /** Effective permissions for this step */
  permissions: EffectivePermissions | undefined;
  /** Security policy derived from permissions */
  securityPolicy: SecurityPolicy | undefined;
  /** Base path for resolving relative paths */
  basePath: string | undefined;
}

export type StepExecutor = (
  step: WorkflowStep,
  context: ExecutionContext,
  sdkRegistry: SDKRegistryLike,
  executorContext?: StepExecutorContext,
) => Promise<unknown>;

export interface EngineEvents {
  onStepStart?: (step: WorkflowStep, context: ExecutionContext) => void;
  onStepComplete?: (step: WorkflowStep, result: import('../models.js').StepResult) => void;
  onStepError?: (step: WorkflowStep, error: Error, retryCount: number) => void;
  onWorkflowStart?: (workflow: import('../models.js').Workflow, context: ExecutionContext) => void;
  onWorkflowComplete?: (workflow: import('../models.js').Workflow, result: import('../models.js').WorkflowResult) => void;
}
