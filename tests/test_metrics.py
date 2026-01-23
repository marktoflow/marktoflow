"""
Tests for the metrics module.
"""

from datetime import datetime
import time

import pytest

from marktoflow.core.metrics import (
    MetricsCollector,
    MetricsServer,
    WorkflowMetrics,
    MetricType,
    PROMETHEUS_AVAILABLE,
)


class TestMetricType:
    """Tests for MetricType enum."""

    def test_metric_type_values(self):
        """Test metric type values."""
        assert MetricType.COUNTER.value == "counter"
        assert MetricType.GAUGE.value == "gauge"
        assert MetricType.HISTOGRAM.value == "histogram"


class TestWorkflowMetrics:
    """Tests for WorkflowMetrics class."""

    def test_create_metrics(self):
        """Test creating workflow metrics."""
        metrics = WorkflowMetrics(
            workflow_id="my-workflow",
            run_id="run-123",
            agent_name="claude-code",
            started_at=datetime.now(),
        )

        assert metrics.workflow_id == "my-workflow"
        assert metrics.run_id == "run-123"
        assert metrics.agent_name == "claude-code"
        assert metrics.status == "running"
        assert metrics.total_steps == 0

    def test_metrics_with_all_fields(self):
        """Test metrics with all fields populated."""
        now = datetime.now()
        metrics = WorkflowMetrics(
            workflow_id="test-workflow",
            run_id="run-456",
            agent_name="opencode",
            started_at=now,
            completed_at=now,
            status="completed",
            total_steps=5,
            completed_steps=4,
            failed_steps=1,
            skipped_steps=0,
            total_duration_seconds=10.5,
            step_durations={"step-1": 2.0, "step-2": 3.5},
            retry_counts={"step-1": 2},
            failover_count=1,
        )

        assert metrics.status == "completed"
        assert metrics.total_steps == 5
        assert metrics.completed_steps == 4
        assert metrics.failed_steps == 1
        assert metrics.failover_count == 1

    def test_to_dict(self):
        """Test converting metrics to dictionary."""
        now = datetime.now()
        metrics = WorkflowMetrics(
            workflow_id="my-workflow",
            run_id="run-123",
            agent_name="claude-code",
            started_at=now,
        )

        result = metrics.to_dict()

        assert result["workflow_id"] == "my-workflow"
        assert result["run_id"] == "run-123"
        assert result["agent_name"] == "claude-code"
        assert result["started_at"] == now.isoformat()
        assert result["status"] == "running"


class TestMetricsCollector:
    """Tests for MetricsCollector class."""

    def test_create_collector(self):
        """Test creating a metrics collector."""
        collector = MetricsCollector(use_prometheus=False)

        assert collector.prefix == "marktoflow"
        assert collector.use_prometheus is False

    def test_create_collector_with_prometheus(self):
        """Test creating collector with Prometheus enabled."""
        collector = MetricsCollector(use_prometheus=True)

        # Should use Prometheus if available
        assert collector.use_prometheus == PROMETHEUS_AVAILABLE

    def test_workflow_started(self):
        """Test recording workflow start."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started(
            workflow_id="my-workflow",
            run_id="run-123",
            agent_name="claude-code",
            total_steps=5,
        )

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics is not None
        assert metrics.workflow_id == "my-workflow"
        assert metrics.run_id == "run-123"
        assert metrics.agent_name == "claude-code"
        assert metrics.total_steps == 5
        assert metrics.status == "running"

    def test_workflow_completed_success(self):
        """Test recording successful workflow completion."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.workflow_completed("my-workflow", "run-123", success=True)

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.status == "completed"
        assert metrics.completed_at is not None
        assert metrics.total_duration_seconds >= 0

    def test_workflow_completed_failure(self):
        """Test recording failed workflow completion."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.workflow_completed("my-workflow", "run-123", success=False)

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.status == "failed"

    def test_step_completed(self):
        """Test recording step completion."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.step_completed(
            workflow_id="my-workflow",
            run_id="run-123",
            step_name="step-1",
            duration_seconds=1.5,
            success=True,
        )

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.completed_steps == 1
        assert "step-1" in metrics.step_durations
        assert metrics.step_durations["step-1"] == 1.5

    def test_step_failed(self):
        """Test recording step failure."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.step_completed(
            workflow_id="my-workflow",
            run_id="run-123",
            step_name="step-1",
            duration_seconds=2.0,
            success=False,
        )

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.failed_steps == 1
        assert metrics.completed_steps == 0

    def test_step_skipped(self):
        """Test recording skipped step."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.step_skipped("my-workflow", "run-123", "step-1")

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.skipped_steps == 1

    def test_step_retried(self):
        """Test recording step retry."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.step_retried("my-workflow", "run-123", "step-1", attempt=2)

        metrics = collector.get_workflow_metrics("run-123")

        assert "step-1" in metrics.retry_counts
        assert metrics.retry_counts["step-1"] == 2

    def test_agent_failover(self):
        """Test recording agent failover."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.agent_failover(
            workflow_id="my-workflow",
            run_id="run-123",
            from_agent="claude-code",
            to_agent="opencode",
        )

        metrics = collector.get_workflow_metrics("run-123")

        assert metrics.failover_count == 1
        assert metrics.agent_name == "opencode"

    def test_get_stats(self):
        """Test getting aggregated statistics."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-1", "claude-code")
        collector.workflow_completed("my-workflow", "run-1", success=True)

        collector.workflow_started("my-workflow", "run-2", "claude-code")
        collector.workflow_completed("my-workflow", "run-2", success=False)

        stats = collector.get_stats("my-workflow")

        assert stats["total_executions"] == 2
        assert stats["successful_executions"] == 1
        assert stats["failed_executions"] == 1

    def test_get_all_stats(self):
        """Test getting all statistics."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("workflow-1", "run-1", "claude-code")
        collector.workflow_completed("workflow-1", "run-1", success=True)

        collector.workflow_started("workflow-2", "run-2", "opencode")
        collector.workflow_completed("workflow-2", "run-2", success=True)

        stats = collector.get_stats()

        assert "workflows" in stats
        assert "workflow-1" in stats["workflows"]
        assert "workflow-2" in stats["workflows"]
        assert stats["total_workflows"] == 2

    def test_clear(self):
        """Test clearing metrics."""
        collector = MetricsCollector(use_prometheus=False)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.clear()

        metrics = collector.get_workflow_metrics("run-123")
        stats = collector.get_stats()

        assert metrics is None
        assert stats["total_workflows"] == 0


@pytest.mark.skipif(not PROMETHEUS_AVAILABLE, reason="prometheus_client not installed")
class TestMetricsCollectorPrometheus:
    """Tests for MetricsCollector with Prometheus."""

    def test_prometheus_metrics_format(self):
        """Test getting metrics in Prometheus format."""
        collector = MetricsCollector(use_prometheus=True)

        collector.workflow_started("my-workflow", "run-123", "claude-code")
        collector.workflow_completed("my-workflow", "run-123", success=True)

        prometheus_output = collector.get_prometheus_metrics()

        assert isinstance(prometheus_output, bytes)
        assert b"marktoflow_workflows_total" in prometheus_output
        assert b"marktoflow_workflow_duration_seconds" in prometheus_output


class TestMetricsServer:
    """Tests for MetricsServer class."""

    def test_create_server(self):
        """Test creating a metrics server."""
        collector = MetricsCollector(use_prometheus=False)
        server = MetricsServer(collector, port=9999)

        assert server.port == 9999
        assert server.host == "0.0.0.0"
        assert server.is_running() is False

    def test_start_stop_server(self):
        """Test starting and stopping the server."""
        collector = MetricsCollector(use_prometheus=False)
        server = MetricsServer(collector, port=9998)

        try:
            server.start()
        except PermissionError:
            pytest.skip("Metrics server port binding not permitted in this environment")
        assert server.is_running() is True

        server.stop()
        assert server.is_running() is False

    def test_context_manager(self):
        """Test using server as context manager."""
        collector = MetricsCollector(use_prometheus=False)

        try:
            with MetricsServer(collector, port=9997) as server:
                assert server.is_running() is True
        except PermissionError:
            pytest.skip("Metrics server port binding not permitted in this environment")

        assert server.is_running() is False

    def test_get_url(self):
        """Test getting metrics endpoint URL."""
        collector = MetricsCollector(use_prometheus=False)
        server = MetricsServer(collector, host="localhost", port=9096)

        assert server.get_url() == "http://localhost:9096/metrics"


class TestPrometheusAvailable:
    """Tests for prometheus availability flag."""

    def test_prometheus_available_flag(self):
        """Test PROMETHEUS_AVAILABLE flag."""
        assert isinstance(PROMETHEUS_AVAILABLE, bool)
