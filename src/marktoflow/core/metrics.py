"""
Metrics collection for marktoflow framework.

Provides Prometheus-compatible metrics for monitoring workflow execution.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Callable

# Try to import prometheus_client, provide graceful fallback
try:
    from prometheus_client import (
        Counter,
        Gauge,
        Histogram,
        Info,
        CollectorRegistry,
        generate_latest,
        CONTENT_TYPE_LATEST,
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    Counter = None  # type: ignore
    Gauge = None  # type: ignore
    Histogram = None  # type: ignore
    Info = None  # type: ignore
    CollectorRegistry = None  # type: ignore
    generate_latest = None  # type: ignore
    CONTENT_TYPE_LATEST = "text/plain"


class MetricType(Enum):
    """Types of metrics."""

    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


@dataclass
class MetricValue:
    """A recorded metric value."""

    name: str
    value: float
    labels: dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    metric_type: MetricType = MetricType.GAUGE


@dataclass
class WorkflowMetrics:
    """Metrics for a single workflow execution."""

    workflow_id: str
    run_id: str
    agent_name: str
    started_at: datetime
    completed_at: datetime | None = None
    status: str = "running"
    total_steps: int = 0
    completed_steps: int = 0
    failed_steps: int = 0
    skipped_steps: int = 0
    total_duration_seconds: float = 0.0
    step_durations: dict[str, float] = field(default_factory=dict)
    retry_counts: dict[str, int] = field(default_factory=dict)
    failover_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "workflow_id": self.workflow_id,
            "run_id": self.run_id,
            "agent_name": self.agent_name,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "total_steps": self.total_steps,
            "completed_steps": self.completed_steps,
            "failed_steps": self.failed_steps,
            "skipped_steps": self.skipped_steps,
            "total_duration_seconds": self.total_duration_seconds,
            "step_durations": self.step_durations,
            "retry_counts": self.retry_counts,
            "failover_count": self.failover_count,
        }


class MetricsCollector:
    """
    Collects and exposes workflow metrics.

    This collector can work in two modes:
    1. Standalone mode: Uses internal storage for metrics
    2. Prometheus mode: Integrates with prometheus_client library

    Example:
        ```python
        collector = MetricsCollector()

        # Record workflow execution
        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.step_completed("my-workflow", "run-123", "step-1", 1.5)
        collector.workflow_completed("my-workflow", "run-123", success=True)

        # Get metrics
        stats = collector.get_stats("my-workflow")
        ```
    """

    def __init__(
        self,
        registry: Any = None,
        prefix: str = "marktoflow",
        use_prometheus: bool = True,
    ) -> None:
        """
        Initialize the metrics collector.

        Args:
            registry: Prometheus CollectorRegistry (optional)
            prefix: Prefix for metric names
            use_prometheus: Whether to use Prometheus client library
        """
        self.prefix = prefix
        self.use_prometheus = use_prometheus and PROMETHEUS_AVAILABLE
        self._lock = threading.Lock()

        # Internal storage for metrics
        self._workflow_metrics: dict[str, WorkflowMetrics] = {}
        self._aggregated_stats: dict[str, dict[str, Any]] = {}

        # Prometheus metrics (if available)
        if self.use_prometheus:
            self._registry = registry or CollectorRegistry()
            self._init_prometheus_metrics()
        else:
            self._registry = None

    def _init_prometheus_metrics(self) -> None:
        """Initialize Prometheus metric objects."""
        # Workflow counters
        self._workflows_total = Counter(
            f"{self.prefix}_workflows_total",
            "Total number of workflow executions",
            ["workflow_id", "agent", "status"],
            registry=self._registry,
        )

        self._steps_total = Counter(
            f"{self.prefix}_steps_total",
            "Total number of step executions",
            ["workflow_id", "step_name", "status"],
            registry=self._registry,
        )

        self._retries_total = Counter(
            f"{self.prefix}_retries_total",
            "Total number of step retries",
            ["workflow_id", "step_name"],
            registry=self._registry,
        )

        self._failovers_total = Counter(
            f"{self.prefix}_failovers_total",
            "Total number of agent failovers",
            ["workflow_id", "from_agent", "to_agent"],
            registry=self._registry,
        )

        # Gauges
        self._running_workflows = Gauge(
            f"{self.prefix}_running_workflows",
            "Number of currently running workflows",
            ["workflow_id"],
            registry=self._registry,
        )

        # Histograms
        self._workflow_duration = Histogram(
            f"{self.prefix}_workflow_duration_seconds",
            "Workflow execution duration in seconds",
            ["workflow_id", "agent", "status"],
            buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0),
            registry=self._registry,
        )

        self._step_duration = Histogram(
            f"{self.prefix}_step_duration_seconds",
            "Step execution duration in seconds",
            ["workflow_id", "step_name"],
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0),
            registry=self._registry,
        )

        # Info metric
        self._info = Info(
            f"{self.prefix}_info",
            "Information about the marktoflow instance",
            registry=self._registry,
        )
        self._info.info({"version": "0.1.0"})

    def workflow_started(
        self,
        workflow_id: str,
        run_id: str,
        agent_name: str,
        total_steps: int = 0,
    ) -> None:
        """
        Record workflow execution start.

        Args:
            workflow_id: Workflow identifier
            run_id: Unique run identifier
            agent_name: Name of the agent executing
            total_steps: Total number of steps in workflow
        """
        with self._lock:
            metrics = WorkflowMetrics(
                workflow_id=workflow_id,
                run_id=run_id,
                agent_name=agent_name,
                started_at=datetime.now(),
                total_steps=total_steps,
            )
            self._workflow_metrics[run_id] = metrics

            if self.use_prometheus:
                self._running_workflows.labels(workflow_id=workflow_id).inc()

    def workflow_completed(
        self,
        workflow_id: str,
        run_id: str,
        success: bool,
        agent_name: str | None = None,
    ) -> None:
        """
        Record workflow execution completion.

        Args:
            workflow_id: Workflow identifier
            run_id: Unique run identifier
            success: Whether workflow completed successfully
            agent_name: Agent that completed the workflow (may differ from start due to failover)
        """
        with self._lock:
            metrics = self._workflow_metrics.get(run_id)
            if metrics:
                metrics.completed_at = datetime.now()
                metrics.status = "completed" if success else "failed"
                metrics.total_duration_seconds = (
                    metrics.completed_at - metrics.started_at
                ).total_seconds()

                agent = agent_name or metrics.agent_name
                status = "success" if success else "failure"

                if self.use_prometheus:
                    self._workflows_total.labels(
                        workflow_id=workflow_id,
                        agent=agent,
                        status=status,
                    ).inc()

                    self._workflow_duration.labels(
                        workflow_id=workflow_id,
                        agent=agent,
                        status=status,
                    ).observe(metrics.total_duration_seconds)

                    self._running_workflows.labels(workflow_id=workflow_id).dec()

                # Update aggregated stats
                self._update_aggregated_stats(workflow_id, metrics)

    def step_started(
        self,
        workflow_id: str,
        run_id: str,
        step_name: str,
    ) -> None:
        """Record step execution start."""
        # Currently we track step completion, but this could be extended
        pass

    def step_completed(
        self,
        workflow_id: str,
        run_id: str,
        step_name: str,
        duration_seconds: float,
        success: bool = True,
    ) -> None:
        """
        Record step execution completion.

        Args:
            workflow_id: Workflow identifier
            run_id: Unique run identifier
            step_name: Name of the step
            duration_seconds: Step execution duration
            success: Whether step completed successfully
        """
        with self._lock:
            metrics = self._workflow_metrics.get(run_id)
            if metrics:
                metrics.step_durations[step_name] = duration_seconds
                if success:
                    metrics.completed_steps += 1
                else:
                    metrics.failed_steps += 1

            status = "success" if success else "failure"

            if self.use_prometheus:
                self._steps_total.labels(
                    workflow_id=workflow_id,
                    step_name=step_name,
                    status=status,
                ).inc()

                self._step_duration.labels(
                    workflow_id=workflow_id,
                    step_name=step_name,
                ).observe(duration_seconds)

    def step_skipped(
        self,
        workflow_id: str,
        run_id: str,
        step_name: str,
    ) -> None:
        """Record step skip."""
        with self._lock:
            metrics = self._workflow_metrics.get(run_id)
            if metrics:
                metrics.skipped_steps += 1

            if self.use_prometheus:
                self._steps_total.labels(
                    workflow_id=workflow_id,
                    step_name=step_name,
                    status="skipped",
                ).inc()

    def step_retried(
        self,
        workflow_id: str,
        run_id: str,
        step_name: str,
        attempt: int,
    ) -> None:
        """Record step retry."""
        with self._lock:
            metrics = self._workflow_metrics.get(run_id)
            if metrics:
                metrics.retry_counts[step_name] = attempt

            if self.use_prometheus:
                self._retries_total.labels(
                    workflow_id=workflow_id,
                    step_name=step_name,
                ).inc()

    def agent_failover(
        self,
        workflow_id: str,
        run_id: str,
        from_agent: str,
        to_agent: str,
    ) -> None:
        """Record agent failover event."""
        with self._lock:
            metrics = self._workflow_metrics.get(run_id)
            if metrics:
                metrics.failover_count += 1
                metrics.agent_name = to_agent

            if self.use_prometheus:
                self._failovers_total.labels(
                    workflow_id=workflow_id,
                    from_agent=from_agent,
                    to_agent=to_agent,
                ).inc()

    def _update_aggregated_stats(
        self,
        workflow_id: str,
        metrics: WorkflowMetrics,
    ) -> None:
        """Update aggregated statistics for a workflow."""
        if workflow_id not in self._aggregated_stats:
            self._aggregated_stats[workflow_id] = {
                "total_executions": 0,
                "successful_executions": 0,
                "failed_executions": 0,
                "total_duration_seconds": 0.0,
                "avg_duration_seconds": 0.0,
                "min_duration_seconds": float("inf"),
                "max_duration_seconds": 0.0,
                "total_retries": 0,
                "total_failovers": 0,
            }

        stats = self._aggregated_stats[workflow_id]
        stats["total_executions"] += 1

        if metrics.status == "completed":
            stats["successful_executions"] += 1
        else:
            stats["failed_executions"] += 1

        stats["total_duration_seconds"] += metrics.total_duration_seconds
        stats["avg_duration_seconds"] = stats["total_duration_seconds"] / stats["total_executions"]
        stats["min_duration_seconds"] = min(
            stats["min_duration_seconds"],
            metrics.total_duration_seconds,
        )
        stats["max_duration_seconds"] = max(
            stats["max_duration_seconds"],
            metrics.total_duration_seconds,
        )
        stats["total_retries"] += sum(metrics.retry_counts.values())
        stats["total_failovers"] += metrics.failover_count

    def get_stats(self, workflow_id: str | None = None) -> dict[str, Any]:
        """
        Get aggregated statistics.

        Args:
            workflow_id: Specific workflow to get stats for (None for all)

        Returns:
            Dictionary of statistics
        """
        with self._lock:
            if workflow_id:
                return self._aggregated_stats.get(workflow_id, {})

            return {
                "workflows": dict(self._aggregated_stats),
                "total_workflows": len(self._aggregated_stats),
                "running_executions": len(
                    [m for m in self._workflow_metrics.values() if m.status == "running"]
                ),
            }

    def get_workflow_metrics(self, run_id: str) -> WorkflowMetrics | None:
        """Get metrics for a specific workflow run."""
        return self._workflow_metrics.get(run_id)

    def get_prometheus_metrics(self) -> bytes:
        """
        Get metrics in Prometheus exposition format.

        Returns:
            Metrics as bytes in Prometheus format
        """
        if not self.use_prometheus:
            return b""

        return generate_latest(self._registry)

    def clear(self) -> None:
        """Clear all collected metrics."""
        with self._lock:
            self._workflow_metrics.clear()
            self._aggregated_stats.clear()


class _MetricsHandler(BaseHTTPRequestHandler):
    """HTTP handler for metrics endpoint."""

    collector: MetricsCollector | None = None

    def do_GET(self) -> None:
        """Handle GET request for metrics."""
        if self.path == "/metrics":
            if self.collector and self.collector.use_prometheus:
                content = self.collector.get_prometheus_metrics()
                self.send_response(200)
                self.send_header("Content-Type", CONTENT_TYPE_LATEST)
            else:
                import json

                content = json.dumps(self.collector.get_stats() if self.collector else {}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")

            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        elif self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")

        else:
            self.send_error(404)

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress default logging."""
        pass


class MetricsServer:
    """
    HTTP server for exposing Prometheus metrics endpoint.

    Example:
        ```python
        collector = MetricsCollector()
        server = MetricsServer(collector, port=9090)
        server.start()
        # ... metrics available at http://localhost:9090/metrics
        server.stop()
        ```
    """

    def __init__(
        self,
        collector: MetricsCollector,
        host: str = "0.0.0.0",
        port: int = 9090,
    ) -> None:
        """
        Initialize the metrics server.

        Args:
            collector: MetricsCollector to expose
            host: Host to bind to
            port: Port to listen on
        """
        self.collector = collector
        self.host = host
        self.port = port
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._running = False

    def start(self, blocking: bool = False) -> None:
        """
        Start the metrics server.

        Args:
            blocking: If True, block until stop() is called
        """
        if self._running:
            return

        # Create handler class with collector reference
        handler_class = type(
            "MetricsHandlerWithCollector",
            (_MetricsHandler,),
            {"collector": self.collector},
        )

        self._server = HTTPServer((self.host, self.port), handler_class)
        self._running = True

        if blocking:
            try:
                self._server.serve_forever()
            except KeyboardInterrupt:
                self.stop()
        else:
            self._thread = threading.Thread(
                target=self._server.serve_forever,
                daemon=True,
            )
            self._thread.start()

    def stop(self) -> None:
        """Stop the metrics server."""
        if not self._running:
            return

        self._running = False
        if self._server:
            self._server.shutdown()
            self._server = None

    def is_running(self) -> bool:
        """Check if server is running."""
        return self._running

    def get_url(self) -> str:
        """Get the metrics endpoint URL."""
        return f"http://{self.host}:{self.port}/metrics"

    def __enter__(self) -> "MetricsServer":
        self.start()
        return self

    def __exit__(self, *args: Any) -> None:
        self.stop()
