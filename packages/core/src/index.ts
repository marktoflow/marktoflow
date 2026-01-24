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

// Env
export {
  findEnvFiles,
  findProjectRoot,
  loadEnv,
  ensureEnvLoaded,
  getEnv,
  getEnvBool,
  getEnvInt,
  getEnvFloat,
  getEnvList,
  EnvConfig,
  config,
} from './env.js';

// Credentials
export {
  EncryptionBackend,
  CredentialType,
  EncryptionError,
  KeyNotFoundError,
  CredentialNotFoundError,
  FernetEncryptor,
  AgeEncryptor,
  GPGEncryptor,
  InMemoryCredentialStore,
  SQLiteCredentialStore,
  CredentialManager,
  KeyManager,
  createCredentialManager,
  getAvailableBackends,
  type Credential,
  type Encryptor,
  type CredentialStore,
} from './credentials.js';

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

// Tool Registry
export {
  ToolRegistry,
} from './tool-registry.js';

export {
  ToolType,
  ToolCompatibility,
  type ToolImplementation,
  type ToolAuth,
  type ToolDefinition,
  type Tool,
} from './tool-base.js';

// Tool Implementations
export { OpenAPITool } from './tools/openapi-tool.js';
export { CustomTool, operation as customOperation } from './tools/custom-tool.js';
export { MCPTool } from './tools/mcp-tool.js';

// Bundle support
export {
  WorkflowBundle,
  BundleToolRegistry,
  loadBundleConfig,
  type BundleConfig,
} from './bundle.js';

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

// Queue Integration
export {
  MessagePriority,
  MessageStatus,
  MessageQueue,
  InMemoryQueue,
  RedisQueue,
  RabbitMQQueue,
  WorkflowQueueManager,
  type QueueMessage,
  type QueueConfig,
  type MessageHandler,
} from './queue.js';

// Security (RBAC, Approval, Audit)
export {
  Permission,
  RBACManager,
  ApprovalStatus,
  ApprovalManager,
  AuditEventType,
  AuditLogger,
  SQLiteAuditStore,
  InMemoryAuditStore,
  type Role,
  type User,
  type ApprovalRequest,
  type ApprovalHandler,
  type AuditEvent,
  type AuditStore,
} from './security.js';

// Cost Tracking
export {
  DEFAULT_PRICING,
  CostStore,
  CostTracker,
  PersistentCostTracker,
  PricingRegistry,
  WorkflowCostEstimator,
  LoggingAlertHandler,
  CallbackAlertHandler,
  CostAlertLevel,
  CostUnit,
  type ModelPricing,
  type TokenUsage,
  type CostRecord,
  type CostSummary,
  type CostLimit,
  type CostAlert,
  type CostAlertHandler,
} from './costs.js';

// Metrics
export {
  MetricsCollector,
} from './metrics.js';

// Rollback
export {
  RollbackStrategy,
  RollbackStatus,
  RollbackRegistry,
  DefaultCompensationHandler,
  TransactionContext,
  FileCompensationHandler,
  GitCompensationHandler,
  type RollbackAction,
  type RollbackResult,
  type CompensationHandler,
} from './rollback.js';
