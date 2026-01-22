"""
Core module for aiworkflow framework.
"""

from aiworkflow.core.models import (
    Workflow,
    WorkflowStep,
    WorkflowMetadata,
    ExecutionContext,
    StepResult,
    WorkflowResult,
    AgentCapabilities,
    ToolConfig,
)
from aiworkflow.core.parser import WorkflowParser
from aiworkflow.core.engine import (
    WorkflowEngine,
    WorkflowExecutionError,
    RetryPolicy,
    CircuitBreaker,
    FailoverConfig,
    FailoverReason,
    FailoverEvent,
    AgentHealth,
)
from aiworkflow.core.scheduler import Scheduler, ScheduledJob, CronParser
from aiworkflow.core.state import StateStore, ExecutionRecord, StepCheckpoint, ExecutionStatus
from aiworkflow.core.logging import ExecutionLogger, ExecutionLog, LogLevel, LogEntry
from aiworkflow.core.webhook import WebhookReceiver, WebhookEndpoint, WebhookEvent

# File watcher imports (optional, requires watchdog)
try:
    from aiworkflow.core.filewatcher import (
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
    from aiworkflow.core.metrics import (
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

__all__ = [
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
]
