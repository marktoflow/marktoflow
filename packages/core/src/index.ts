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
  PermissionsSchema,
  SubagentConfigSchema,
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
  type Permissions,
  type SubagentConfig,
  type ScriptStep,
  // Type guards
  isScriptStep,
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
  type StepExecutorContext,
  type CircuitState,
} from './engine.js';

// Permissions
export {
  mergePermissions,
  checkPermission,
  toSecurityPolicy,
  createDefaultPermissions,
  type EffectivePermissions,
  type PermissionCheckResult,
  type SecurityPolicy,
  type OperationType,
} from './permissions.js';

// Prompt Loader
export {
  loadPromptFile,
  resolvePromptTemplate,
  validatePromptInputs,
  extractPromptVariables,
  type LoadedPrompt,
  type PromptVariable,
  type ValidationResult,
  type ResolvedPrompt,
} from './prompt-loader.js';

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
  packageNameMappings,
  createSDKStepExecutor,
  type SDKInstance,
  type SDKLoader,
  type SDKInitializer,
} from './sdk-registry.js';

// Core Built-in Tools
export {
  CoreToolsClient,
  CoreInitializer,
} from './core-tools.js';

// Workflow Built-in Tools
export {
  WorkflowToolsClient,
  WorkflowInitializer,
} from './workflow-tools.js';

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
  verifySlackSignature,
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

// Routing
export {
  SelectionStrategy,
  RoutingDecision,
  AgentSelector,
  AgentRouter,
  BudgetTracker,
  PREDEFINED_PROFILES,
  createDefaultSelector,
  createCostOptimizedSelector,
  createQualityOptimizedSelector,
  type AgentProfile,
  type AgentScore,
  type RoutingContext,
  type RoutingResult,
  type BudgetConfig,
  type LoadInfo,
} from './routing.js';

// Failover
export {
  FailoverReason,
  AgentHealthTracker,
  DEFAULT_FAILOVER_CONFIG,
  type AgentHealth,
  type FailoverConfig,
  type FailoverEvent,
} from './failover.js';

// Trigger Manager
export {
  TriggerManager,
  type TriggerDefinition,
  type TriggerHandler,
} from './trigger-manager.js';

// Plugins
export {
  PluginState,
  HookType,
  HookRegistry,
  PluginManager,
  LoggingPlugin,
  MetricsPlugin,
  type PluginMetadata,
  type HookContext,
  type HookResult,
  type HookCallback,
  type Plugin,
  type PluginInfo,
} from './plugins.js';

// Templates
export {
  TemplateCategory,
  TemplateRegistry,
  WorkflowTemplate,
  HELLO_TEMPLATE,
  BUILTIN_TEMPLATES,
  type TemplateMetadata,
  type TemplateVariable,
} from './templates.js';

// Config
export { loadConfig, type MarktoflowConfig } from './config.js';

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

// Template Engine (Nunjucks-based)
export {
  renderTemplate,
  nunjucksEnv,
} from './template-engine.js';

// Nunjucks Custom Filters
export {
  registerFilters,
  // String filters
  split,
  slugify,
  prefix,
  suffix,
  truncate,
  substring,
  contains,
  // Regex filters
  match,
  notMatch,
  regexReplace,
  // Object filters
  path,
  keys,
  values,
  entries,
  pick,
  omit,
  merge,
  // Array filters
  nth,
  count,
  sum,
  unique,
  flatten,
  // Date filters
  now,
  format_date,
  add_days,
  subtract_days,
  diff_days,
  // JSON filters
  parse_json,
  to_json,
  // Type check filters
  is_array,
  is_object,
  is_string,
  is_number,
  is_empty,
  is_null,
  // Logic filters
  ternary,
  and,
  or,
  not,
  // Math filters
  round,
  floor,
  ceil,
  min,
  max,
} from './nunjucks-filters.js';

// Script Executor (inline JavaScript)
export {
  executeScript,
  executeScriptAsync,
  validateScript,
  type ScriptExecutorOptions,
  type ScriptContext,
  type ScriptResult,
} from './script-executor.js';
