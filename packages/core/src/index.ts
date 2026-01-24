/**
 * @marktoflow/core
 *
 * Core engine for marktoflow v2.0 - parser, executor, state management.
 */

// Models
export {
  // Enums
  StepStatus,
  WorkflowStatus,
  TriggerType,
  // Schemas (for validation)
  WorkflowMetadataSchema,
  ToolConfigSchema,
  ErrorHandlingSchema,
  WorkflowStepSchema,
  TriggerSchema,
  WorkflowInputSchema,
  WorkflowSchema,
  // Types
  type WorkflowMetadata,
  type ToolConfig,
  type ErrorHandling,
  type WorkflowStep,
  type Trigger,
  type WorkflowInput,
  type Workflow,
  type ExecutionContext,
  type StepResult,
  type WorkflowResult,
  // Helpers
  createExecutionContext,
  createStepResult,
} from './models.js';

// Parser
export {
  parseFile,
  parseContent,
  extractVariableReferences,
  validateVariableReferences,
  ParseError,
  type ParseResult,
  type ParseOptions,
} from './parser.js';

// Engine
export {
  WorkflowEngine,
  RetryPolicy,
  CircuitBreaker,
  resolveTemplates,
  type EngineConfig,
  type EngineEvents,
  type StepExecutor,
  type CircuitState,
} from './engine.js';

// SDK Registry
export {
  SDKRegistry,
  defaultSDKLoader,
  defaultInitializers,
  createSDKStepExecutor,
  type SDKInstance,
  type SDKLoader,
  type SDKInitializer,
} from './sdk-registry.js';

// State Persistence
export {
  StateStore,
  type ExecutionRecord,
  type StepCheckpoint,
  type ExecutionStats,
} from './state.js';

// Execution Logging
export {
  LogLevel,
  ExecutionLogger,
  createExecutionLog,
  addLogEntry,
  completeLog,
  logToMarkdown,
  type LogEntry,
  type ExecutionLog,
} from './logging.js';

// Scheduler
export {
  Scheduler,
  CronParser,
  createJob,
  type ScheduledJob,
  type CronFields,
  type JobCallback,
} from './scheduler.js';

// Webhook Receiver
export {
  WebhookReceiver,
  verifyGitHubSignature,
  verifyHmacSignature,
  generateSignature,
  createEndpoint,
  parseWebhookBody,
  type WebhookEndpoint,
  type WebhookEvent,
  type WebhookHandler,
  type WebhookResponse,
  type WebhookReceiverOptions,
} from './webhook.js';

// MCP Loader
export {
  McpLoader,
  type McpModule,
} from './mcp-loader.js';

// Script Tool
export {
  ScriptTool,
  type ScriptOperation,
  type ScriptToolConfig,
} from './script-tool.js';

// File Watcher Trigger
export {
  FileWatcher,
  type FileWatcherOptions,
  type FileEvent,
  type FileEventHandler,
} from './filewatcher.js';
