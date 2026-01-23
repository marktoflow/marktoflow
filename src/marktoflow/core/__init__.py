"""
Core module for marktoflow framework.
"""

from marktoflow.core.env import (
    load_env,
    ensure_env_loaded,
    get_env,
    get_env_bool,
    get_env_int,
    get_env_float,
    get_env_list,
    find_env_files,
    EnvConfig,
)
from marktoflow.core.models import (
    Workflow,
    WorkflowStep,
    WorkflowMetadata,
    ExecutionContext,
    StepResult,
    WorkflowResult,
    AgentCapabilities,
    ToolConfig,
)
from marktoflow.core.parser import WorkflowParser
from marktoflow.core.engine import (
    WorkflowEngine,
    WorkflowExecutionError,
    RetryPolicy,
    CircuitBreaker,
    FailoverConfig,
    FailoverReason,
    FailoverEvent,
    AgentHealth,
)
from marktoflow.core.scheduler import Scheduler, ScheduledJob, CronParser
from marktoflow.core.state import StateStore, ExecutionRecord, StepCheckpoint, ExecutionStatus
from marktoflow.core.logging import ExecutionLogger, ExecutionLog, LogLevel, LogEntry
from marktoflow.core.webhook import WebhookReceiver, WebhookEndpoint, WebhookEvent
from marktoflow.core.rollback import (
    RollbackRegistry,
    RollbackAction,
    RollbackResult,
    RollbackStrategy,
    RollbackStatus,
    TransactionContext,
    CompensationHandler,
    DefaultCompensationHandler,
    FileCompensationHandler,
    GitCompensationHandler,
)
from marktoflow.core.costs import (
    CostTracker,
    CostStore,
    CostRecord,
    CostSummary,
    CostLimit,
    CostAlert,
    CostAlertLevel,
    CostAlertHandler,
    CostUnit,
    TokenUsage,
    ModelPricing,
    PricingRegistry,
    PersistentCostTracker,
    WorkflowCostEstimator,
    LoggingAlertHandler,
    CallbackAlertHandler,
)
from marktoflow.core.security import (
    # RBAC
    Permission,
    Role,
    User,
    RBACManager,
    PermissionDeniedError,
    PREDEFINED_ROLES,
    require_permission,
    # Approval workflows
    ApprovalStatus,
    ApprovalRequest,
    ApprovalManager,
    ApprovalHandler,
    LoggingApprovalHandler,
    # Audit logging
    AuditEventType,
    AuditEvent,
    AuditStore,
    InMemoryAuditStore,
    SQLiteAuditStore,
    AuditLogger,
)
from marktoflow.core.credentials import (
    # Encryption
    EncryptionBackend,
    EncryptionError,
    KeyNotFoundError,
    Encryptor,
    FernetEncryptor,
    AgeEncryptor,
    GPGEncryptor,
    # Credentials
    Credential,
    CredentialType,
    CredentialNotFoundError,
    CredentialStore,
    InMemoryCredentialStore,
    SQLiteCredentialStore,
    CredentialManager,
    # Key management
    KeyManager,
    # Convenience functions
    create_credential_manager,
    get_available_backends,
)
from marktoflow.core.routing import (
    # Enums
    SelectionStrategy,
    RoutingDecision,
    # Data classes
    AgentScore,
    AgentProfile,
    RoutingContext,
    RoutingResult,
    BudgetConfig,
    LoadInfo,
    # Classes
    AgentSelector,
    BudgetTracker,
    AgentRouter,
    # Predefined profiles
    PREDEFINED_PROFILES,
    # Convenience functions
    create_default_selector,
    create_cost_optimized_selector,
    create_quality_optimized_selector,
)
from marktoflow.core.plugins import (
    # Enums
    PluginState,
    HookType,
    # Data classes
    PluginMetadata,
    HookContext,
    HookResult,
    # Classes
    Plugin,
    PluginInfo,
    HookRegistry,
    PluginManager,
    # Example plugins
    LoggingPlugin,
    MetricsPlugin,
    # Convenience functions
    create_plugin_manager,
)
from marktoflow.core.templates import (
    # Enums
    TemplateCategory,
    # Data classes
    TemplateVariable,
    TemplateMetadata,
    # Classes
    WorkflowTemplate,
    TemplateRegistry,
    # Built-in templates
    BUILTIN_TEMPLATES,
    PR_REVIEW_TEMPLATE,
    DEPLOYMENT_TEMPLATE,
    TEST_AUTOMATION_TEMPLATE,
    DOCUMENTATION_TEMPLATE,
    SECURITY_SCAN_TEMPLATE,
    INCIDENT_RESPONSE_TEMPLATE,
    DATA_PIPELINE_TEMPLATE,
    # Convenience functions
    create_template_registry,
)

# File watcher imports (optional, requires watchdog)
try:
    from marktoflow.core.filewatcher import (
        FileWatcher,
        AsyncFileWatcher,
        FileEvent,
        FileEventType,
        WatchConfig,
        WatchHandle,
        WATCHDOG_AVAILABLE,
    )
except ImportError:
    FileWatcher = None  # type: ignore
    AsyncFileWatcher = None  # type: ignore
    FileEvent = None  # type: ignore
    FileEventType = None  # type: ignore
    WatchConfig = None  # type: ignore
    WatchHandle = None  # type: ignore
    WATCHDOG_AVAILABLE = False

# Metrics imports (optional, requires prometheus-client)
try:
    from marktoflow.core.metrics import (
        MetricsCollector,
        MetricsServer,
        WorkflowMetrics,
        MetricType,
        PROMETHEUS_AVAILABLE,
    )
except ImportError:
    MetricsCollector = None  # type: ignore
    MetricsServer = None  # type: ignore
    WorkflowMetrics = None  # type: ignore
    MetricType = None  # type: ignore
    PROMETHEUS_AVAILABLE = False

# Queue imports (optional, requires redis or pika)
try:
    from marktoflow.core.queue import (
        MessageQueue,
        QueueMessage,
        QueueConfig,
        MessagePriority,
        MessageStatus,
        RedisQueue,
        AsyncRedisQueue,
        RabbitMQQueue,
        InMemoryQueue,
        WorkflowQueueManager,
        REDIS_AVAILABLE,
        RABBITMQ_AVAILABLE,
    )
except ImportError:
    MessageQueue = None  # type: ignore
    QueueMessage = None  # type: ignore
    QueueConfig = None  # type: ignore
    MessagePriority = None  # type: ignore
    MessageStatus = None  # type: ignore
    RedisQueue = None  # type: ignore
    AsyncRedisQueue = None  # type: ignore
    RabbitMQQueue = None  # type: ignore
    InMemoryQueue = None  # type: ignore
    WorkflowQueueManager = None  # type: ignore
    REDIS_AVAILABLE = False
    RABBITMQ_AVAILABLE = False

__all__ = [
    # Environment
    "load_env",
    "ensure_env_loaded",
    "get_env",
    "get_env_bool",
    "get_env_int",
    "get_env_float",
    "get_env_list",
    "find_env_files",
    "EnvConfig",
    # Models
    "Workflow",
    "WorkflowStep",
    "WorkflowMetadata",
    "ExecutionContext",
    "StepResult",
    "WorkflowResult",
    "AgentCapabilities",
    "ToolConfig",
    "WorkflowParser",
    "WorkflowEngine",
    "WorkflowExecutionError",
    "RetryPolicy",
    "CircuitBreaker",
    "FailoverConfig",
    "FailoverReason",
    "FailoverEvent",
    "AgentHealth",
    "Scheduler",
    "ScheduledJob",
    "CronParser",
    "StateStore",
    "ExecutionRecord",
    "StepCheckpoint",
    "ExecutionStatus",
    "ExecutionLogger",
    "ExecutionLog",
    "LogLevel",
    "LogEntry",
    "WebhookReceiver",
    "WebhookEndpoint",
    "WebhookEvent",
    # Rollback
    "RollbackRegistry",
    "RollbackAction",
    "RollbackResult",
    "RollbackStrategy",
    "RollbackStatus",
    "TransactionContext",
    "CompensationHandler",
    "DefaultCompensationHandler",
    "FileCompensationHandler",
    "GitCompensationHandler",
    # Cost tracking
    "CostTracker",
    "CostStore",
    "CostRecord",
    "CostSummary",
    "CostLimit",
    "CostAlert",
    "CostAlertLevel",
    "CostAlertHandler",
    "CostUnit",
    "TokenUsage",
    "ModelPricing",
    "PricingRegistry",
    "PersistentCostTracker",
    "WorkflowCostEstimator",
    "LoggingAlertHandler",
    "CallbackAlertHandler",
    # File watcher (optional)
    "FileWatcher",
    "AsyncFileWatcher",
    "FileEvent",
    "FileEventType",
    "WatchConfig",
    "WatchHandle",
    "WATCHDOG_AVAILABLE",
    # Metrics (optional)
    "MetricsCollector",
    "MetricsServer",
    "WorkflowMetrics",
    "MetricType",
    "PROMETHEUS_AVAILABLE",
    # Message Queue (optional)
    "MessageQueue",
    "QueueMessage",
    "QueueConfig",
    "MessagePriority",
    "MessageStatus",
    "RedisQueue",
    "AsyncRedisQueue",
    "RabbitMQQueue",
    "InMemoryQueue",
    "WorkflowQueueManager",
    "REDIS_AVAILABLE",
    "RABBITMQ_AVAILABLE",
    # Security (RBAC, Approvals, Audit)
    "Permission",
    "Role",
    "User",
    "RBACManager",
    "PermissionDeniedError",
    "PREDEFINED_ROLES",
    "require_permission",
    "ApprovalStatus",
    "ApprovalRequest",
    "ApprovalManager",
    "ApprovalHandler",
    "LoggingApprovalHandler",
    "AuditEventType",
    "AuditEvent",
    "AuditStore",
    "InMemoryAuditStore",
    "SQLiteAuditStore",
    "AuditLogger",
    # Credentials
    "EncryptionBackend",
    "EncryptionError",
    "KeyNotFoundError",
    "Encryptor",
    "FernetEncryptor",
    "AgeEncryptor",
    "GPGEncryptor",
    "Credential",
    "CredentialType",
    "CredentialNotFoundError",
    "CredentialStore",
    "InMemoryCredentialStore",
    "SQLiteCredentialStore",
    "CredentialManager",
    "KeyManager",
    "create_credential_manager",
    "get_available_backends",
    # Routing
    "SelectionStrategy",
    "RoutingDecision",
    "AgentScore",
    "AgentProfile",
    "RoutingContext",
    "RoutingResult",
    "BudgetConfig",
    "LoadInfo",
    "AgentSelector",
    "BudgetTracker",
    "AgentRouter",
    "PREDEFINED_PROFILES",
    "create_default_selector",
    "create_cost_optimized_selector",
    "create_quality_optimized_selector",
    # Plugins
    "PluginState",
    "HookType",
    "PluginMetadata",
    "HookContext",
    "HookResult",
    "Plugin",
    "PluginInfo",
    "HookRegistry",
    "PluginManager",
    "LoggingPlugin",
    "MetricsPlugin",
    "create_plugin_manager",
    # Templates
    "TemplateCategory",
    "TemplateVariable",
    "TemplateMetadata",
    "WorkflowTemplate",
    "TemplateRegistry",
    "BUILTIN_TEMPLATES",
    "PR_REVIEW_TEMPLATE",
    "DEPLOYMENT_TEMPLATE",
    "TEST_AUTOMATION_TEMPLATE",
    "DOCUMENTATION_TEMPLATE",
    "SECURITY_SCAN_TEMPLATE",
    "INCIDENT_RESPONSE_TEMPLATE",
    "DATA_PIPELINE_TEMPLATE",
    "create_template_registry",
]
