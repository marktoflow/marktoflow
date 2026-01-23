"""
Tests for the execution logging module.
"""

from datetime import datetime
from pathlib import Path

import pytest

from marktoflow.core.logging import (
    ExecutionLog,
    ExecutionLogger,
    LogEntry,
    LogLevel,
)


class TestLogLevel:
    """Tests for LogLevel enum."""

    def test_log_levels(self):
        """Test that all expected log levels exist."""
        assert LogLevel.DEBUG.value == "debug"
        assert LogLevel.INFO.value == "info"
        assert LogLevel.WARNING.value == "warning"
        assert LogLevel.ERROR.value == "error"
        assert LogLevel.CRITICAL.value == "critical"


class TestLogEntry:
    """Tests for LogEntry dataclass."""

    def test_create_entry(self):
        """Test creating a log entry."""
        entry = LogEntry(
            timestamp=datetime.now(),
            level=LogLevel.INFO,
            message="Test message",
        )

        assert entry.level == LogLevel.INFO
        assert entry.message == "Test message"
        assert entry.step_name is None

    def test_entry_with_step(self):
        """Test entry with step information."""
        entry = LogEntry(
            timestamp=datetime.now(),
            level=LogLevel.INFO,
            message="Step completed",
            step_name="Process Data",
            step_index=2,
        )

        assert entry.step_name == "Process Data"
        assert entry.step_index == 2

    def test_to_markdown_basic(self):
        """Test basic markdown output."""
        entry = LogEntry(
            timestamp=datetime(2025, 1, 22, 12, 30, 45),
            level=LogLevel.INFO,
            message="Test message",
        )

        md = entry.to_markdown()
        assert "12:30:45" in md
        assert "Test message" in md

    def test_to_markdown_with_details(self):
        """Test markdown output with details."""
        entry = LogEntry(
            timestamp=datetime(2025, 1, 22, 12, 30, 45),
            level=LogLevel.ERROR,
            message="Something failed",
            details={"duration": "1.5s", "error": "Connection refused"},
        )

        md = entry.to_markdown()
        assert "Something failed" in md
        assert "duration" in md
        assert "1.5s" in md


class TestExecutionLog:
    """Tests for ExecutionLog dataclass."""

    def test_create_log(self):
        """Test creating an execution log."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        assert log.run_id == "run-123"
        assert log.workflow_name == "Test Workflow"
        assert len(log.entries) == 0

    def test_log_methods(self):
        """Test logging at different levels."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        log.log_debug("Debug message")
        log.log_info("Info message")
        log.log_warning("Warning message")
        log.log_error("Error message")
        log.log_critical("Critical message")

        assert len(log.entries) == 5
        assert log.entries[0].level == LogLevel.DEBUG
        assert log.entries[1].level == LogLevel.INFO
        assert log.entries[2].level == LogLevel.WARNING
        assert log.entries[3].level == LogLevel.ERROR
        assert log.entries[4].level == LogLevel.CRITICAL

    def test_step_started(self):
        """Test logging step start."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        log.step_started("Process Data", 0)

        assert len(log.entries) == 1
        assert "Starting step 1" in log.entries[0].message
        assert log.entries[0].step_name == "Process Data"

    def test_step_completed(self):
        """Test logging step completion."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        log.step_completed("Process Data", 0, duration=2.5, output={"result": 42})

        assert len(log.entries) == 1
        assert "Completed step 1" in log.entries[0].message
        assert log.entries[0].details["duration"] == "2.50s"

    def test_step_failed(self):
        """Test logging step failure."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        log.step_failed("Process Data", 0, error_msg="Connection refused", duration=1.0)

        assert len(log.entries) == 1
        assert log.entries[0].level == LogLevel.ERROR
        assert "Connection refused" in log.entries[0].message

    def test_step_retrying(self):
        """Test logging step retry."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        log.step_retrying("Process Data", 0, attempt=2, max_attempts=3, wait_seconds=5.0)

        assert len(log.entries) == 1
        assert log.entries[0].level == LogLevel.WARNING
        assert "attempt 2/3" in log.entries[0].message

    def test_to_markdown(self):
        """Test generating markdown output."""
        log = ExecutionLog(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
            agent="opencode",
            inputs={"param": "value"},
        )

        log.log_info("Started execution")
        log.step_started("Step 1", 0)
        log.step_completed("Step 1", 0, duration=1.5)

        log.completed_at = datetime.now()
        log.success = True
        log.outputs = {"result": "done"}

        md = log.to_markdown()

        assert "# Workflow Execution Log" in md
        assert "Test Workflow" in md
        assert "run-123" in md
        assert "opencode" in md
        assert "Success" in md
        assert "## Inputs" in md
        assert "## Outputs" in md
        assert "## Execution Log" in md


class TestExecutionLogger:
    """Tests for ExecutionLogger class."""

    @pytest.fixture
    def logger(self, tmp_path):
        """Create a temporary execution logger."""
        return ExecutionLogger(log_dir=tmp_path / "logs")

    def test_create_logger(self, tmp_path):
        """Test creating an execution logger."""
        log_dir = tmp_path / "test_logs"
        logger = ExecutionLogger(log_dir=log_dir)
        assert log_dir.exists()

    def test_start_log(self, logger):
        """Test starting a new log."""
        log = logger.start_log(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
            agent="opencode",
        )

        assert log.run_id == "run-123"
        assert len(log.entries) == 1  # Initial "Started" message

    def test_get_log(self, logger):
        """Test getting an active log."""
        log = logger.start_log(
            run_id="run-456",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        retrieved = logger.get_log("run-456")
        assert retrieved == log

        # Non-existent log
        assert logger.get_log("run-999") is None

    def test_finish_log(self, logger):
        """Test finishing and saving a log."""
        log = logger.start_log(
            run_id="run-789",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )
        log.step_started("Step 1", 0)
        log.step_completed("Step 1", 0, duration=1.0)

        filepath = logger.finish_log(
            run_id="run-789",
            success=True,
            outputs={"result": "done"},
        )

        assert filepath is not None
        assert filepath.exists()
        assert filepath.suffix == ".md"

        # Log should no longer be active
        assert logger.get_log("run-789") is None

    def test_finish_failed_log(self, logger):
        """Test finishing a failed execution log."""
        logger.start_log(
            run_id="run-fail",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )

        filepath = logger.finish_log(
            run_id="run-fail",
            success=False,
            error="Something went wrong",
        )

        assert filepath is not None
        content = filepath.read_text()
        assert "Failed" in content
        assert "Something went wrong" in content

    def test_list_logs(self, logger):
        """Test listing log files."""
        # Create and finish multiple logs
        for i in range(3):
            logger.start_log(
                run_id=f"run-{i}",
                workflow_id="wf-test",
                workflow_name="Test Workflow",
            )
            logger.finish_log(run_id=f"run-{i}", success=True)

        logs = logger.list_logs()
        assert len(logs) == 3

    def test_list_logs_with_limit(self, logger):
        """Test listing logs with limit."""
        for i in range(10):
            logger.start_log(
                run_id=f"run-{i}",
                workflow_id="wf-test",
                workflow_name="Test Workflow",
            )
            logger.finish_log(run_id=f"run-{i}", success=True)

        logs = logger.list_logs(limit=5)
        assert len(logs) == 5

    def test_read_log(self, logger):
        """Test reading a log file."""
        logger.start_log(
            run_id="run-read",
            workflow_id="wf-test",
            workflow_name="Test Workflow",
        )
        filepath = logger.finish_log(run_id="run-read", success=True)

        content = logger.read_log(filepath)
        assert content is not None
        assert "Test Workflow" in content

    def test_read_nonexistent_log(self, logger):
        """Test reading a non-existent log file."""
        content = logger.read_log(Path("/nonexistent/log.md"))
        assert content is None
