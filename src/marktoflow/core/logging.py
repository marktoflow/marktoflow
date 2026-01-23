"""
Execution logging for marktoflow framework.

Provides structured markdown logging for workflow executions.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class LogLevel(Enum):
    """Log level for execution events."""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class LogEntry:
    """A single log entry."""

    timestamp: datetime
    level: LogLevel
    message: str
    step_name: str | None = None
    step_index: int | None = None
    details: dict[str, Any] | None = None

    def to_markdown(self) -> str:
        """Convert to markdown format."""
        time_str = self.timestamp.strftime("%H:%M:%S")
        level_icon = {
            LogLevel.DEBUG: "🔍",
            LogLevel.INFO: "ℹ️",
            LogLevel.WARNING: "⚠️",
            LogLevel.ERROR: "❌",
            LogLevel.CRITICAL: "🔥",
        }.get(self.level, "•")

        line = f"- `{time_str}` {level_icon} "

        if self.step_name:
            line += f"**[{self.step_name}]** "

        line += self.message

        if self.details:
            line += "\n"
            for key, value in self.details.items():
                line += f"  - {key}: `{value}`\n"

        return line


@dataclass
class ExecutionLog:
    """
    Log for a single workflow execution.

    Collects log entries and writes them as markdown.
    """

    run_id: str
    workflow_id: str
    workflow_name: str
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: datetime | None = None
    entries: list[LogEntry] = field(default_factory=list)
    agent: str | None = None
    inputs: dict[str, Any] | None = None
    outputs: dict[str, Any] | None = None
    success: bool | None = None
    error: str | None = None

    def log(
        self,
        level: LogLevel,
        message: str,
        step_name: str | None = None,
        step_index: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Add a log entry."""
        entry = LogEntry(
            timestamp=datetime.now(),
            level=level,
            message=message,
            step_name=step_name,
            step_index=step_index,
            details=details,
        )
        self.entries.append(entry)

    def log_debug(self, message: str, **kwargs) -> None:
        """Log at DEBUG level."""
        self.log(LogLevel.DEBUG, message, **kwargs)

    def log_info(self, message: str, **kwargs) -> None:
        """Log at INFO level."""
        self.log(LogLevel.INFO, message, **kwargs)

    def log_warning(self, message: str, **kwargs) -> None:
        """Log at WARNING level."""
        self.log(LogLevel.WARNING, message, **kwargs)

    def log_error(self, message: str, **kwargs) -> None:
        """Log at ERROR level."""
        self.log(LogLevel.ERROR, message, **kwargs)

    def log_critical(self, message: str, **kwargs) -> None:
        """Log at CRITICAL level."""
        self.log(LogLevel.CRITICAL, message, **kwargs)

    def step_started(self, step_name: str, step_index: int) -> None:
        """Log step start."""
        self.log_info(
            f"Starting step {step_index + 1}",
            step_name=step_name,
            step_index=step_index,
        )

    def step_completed(
        self,
        step_name: str,
        step_index: int,
        duration: float,
        output: Any = None,
    ) -> None:
        """Log step completion."""
        details = {"duration": f"{duration:.2f}s"}
        if output is not None:
            # Truncate large outputs
            output_str = str(output)
            if len(output_str) > 200:
                output_str = output_str[:200] + "..."
            details["output"] = output_str

        self.log_info(
            f"Completed step {step_index + 1}",
            step_name=step_name,
            step_index=step_index,
            details=details,
        )

    def step_failed(
        self,
        step_name: str,
        step_index: int,
        error_msg: str,
        duration: float,
    ) -> None:
        """Log step failure."""
        self.log_error(
            f"Step {step_index + 1} failed: {error_msg}",
            step_name=step_name,
            step_index=step_index,
            details={"duration": f"{duration:.2f}s", "error": error_msg},
        )

    def step_retrying(
        self,
        step_name: str,
        step_index: int,
        attempt: int,
        max_attempts: int,
        wait_seconds: float,
    ) -> None:
        """Log step retry."""
        self.log_warning(
            f"Retrying step {step_index + 1} (attempt {attempt}/{max_attempts})",
            step_name=step_name,
            step_index=step_index,
            details={"wait": f"{wait_seconds:.1f}s"},
        )

    def to_markdown(self) -> str:
        """Generate markdown log file content."""
        lines = []

        # Header
        lines.append(f"# Workflow Execution Log")
        lines.append("")
        lines.append(f"**Workflow:** {self.workflow_name}")
        lines.append(f"**Workflow ID:** `{self.workflow_id}`")
        lines.append(f"**Run ID:** `{self.run_id}`")
        lines.append(f"**Agent:** {self.agent or 'default'}")
        lines.append(f"**Started:** {self.started_at.strftime('%Y-%m-%d %H:%M:%S')}")

        if self.completed_at:
            duration = (self.completed_at - self.started_at).total_seconds()
            lines.append(f"**Completed:** {self.completed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"**Duration:** {duration:.2f}s")

        # Status
        lines.append("")
        if self.success is True:
            lines.append("**Status:** ✅ Success")
        elif self.success is False:
            lines.append("**Status:** ❌ Failed")
            if self.error:
                lines.append(f"**Error:** {self.error}")
        else:
            lines.append("**Status:** ⏳ In Progress")

        # Inputs
        if self.inputs:
            lines.append("")
            lines.append("## Inputs")
            lines.append("")
            lines.append("```json")
            import json

            lines.append(json.dumps(self.inputs, indent=2))
            lines.append("```")

        # Outputs
        if self.outputs:
            lines.append("")
            lines.append("## Outputs")
            lines.append("")
            lines.append("```json")
            import json

            lines.append(json.dumps(self.outputs, indent=2))
            lines.append("```")

        # Execution Log
        lines.append("")
        lines.append("## Execution Log")
        lines.append("")

        for entry in self.entries:
            lines.append(entry.to_markdown())

        lines.append("")
        lines.append("---")
        lines.append(f"*Generated by marktoflow*")

        return "\n".join(lines)


class ExecutionLogger:
    """
    Manages execution logs for the framework.

    Writes logs to markdown files in the configured log directory.
    """

    def __init__(
        self,
        log_dir: str | Path = ".marktoflow/state/execution-logs",
        min_level: LogLevel = LogLevel.INFO,
    ) -> None:
        """
        Initialize the execution logger.

        Args:
            log_dir: Directory to store log files
            min_level: Minimum log level to record
        """
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.min_level = min_level
        self._active_logs: dict[str, ExecutionLog] = {}

    def start_log(
        self,
        run_id: str,
        workflow_id: str,
        workflow_name: str,
        agent: str | None = None,
        inputs: dict[str, Any] | None = None,
    ) -> ExecutionLog:
        """
        Start a new execution log.

        Args:
            run_id: Unique run identifier
            workflow_id: Workflow identifier
            workflow_name: Human-readable workflow name
            agent: Agent being used
            inputs: Workflow inputs

        Returns:
            New ExecutionLog instance
        """
        log = ExecutionLog(
            run_id=run_id,
            workflow_id=workflow_id,
            workflow_name=workflow_name,
            agent=agent,
            inputs=inputs,
        )
        self._active_logs[run_id] = log
        log.log_info(f"Started workflow execution: {workflow_name}")
        return log

    def get_log(self, run_id: str) -> ExecutionLog | None:
        """Get an active execution log by run ID."""
        return self._active_logs.get(run_id)

    def finish_log(
        self,
        run_id: str,
        success: bool,
        outputs: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> Path | None:
        """
        Finish and save an execution log.

        Args:
            run_id: Run identifier
            success: Whether execution succeeded
            outputs: Workflow outputs
            error: Error message if failed

        Returns:
            Path to saved log file
        """
        log = self._active_logs.pop(run_id, None)
        if not log:
            return None

        log.completed_at = datetime.now()
        log.success = success
        log.outputs = outputs
        log.error = error

        if success:
            log.log_info("Workflow completed successfully")
        else:
            log.log_error(f"Workflow failed: {error}")

        return self.save_log(log)

    def save_log(self, log: ExecutionLog) -> Path:
        """
        Save an execution log to a markdown file.

        Args:
            log: ExecutionLog to save

        Returns:
            Path to saved log file
        """
        # Generate filename: YYYY-MM-DD_HHMMSS_workflow-id_run-id.md
        timestamp = log.started_at.strftime("%Y-%m-%d_%H%M%S")
        safe_workflow_id = log.workflow_id.replace("/", "-").replace(" ", "-")
        short_run_id = log.run_id[:8]

        filename = f"{timestamp}_{safe_workflow_id}_{short_run_id}.md"
        filepath = self.log_dir / filename

        content = log.to_markdown()
        filepath.write_text(content)

        logger.debug(f"Saved execution log to {filepath}")
        return filepath

    def list_logs(
        self,
        workflow_id: str | None = None,
        limit: int = 100,
    ) -> list[Path]:
        """
        List available log files.

        Args:
            workflow_id: Filter by workflow ID
            limit: Maximum number of logs to return

        Returns:
            List of log file paths (newest first)
        """
        pattern = "*.md"
        if workflow_id:
            safe_workflow_id = workflow_id.replace("/", "-").replace(" ", "-")
            pattern = f"*_{safe_workflow_id}_*.md"

        logs = sorted(self.log_dir.glob(pattern), reverse=True)
        return logs[:limit]

    def read_log(self, filepath: Path) -> str | None:
        """Read a log file's content."""
        if filepath.exists():
            return filepath.read_text()
        return None

    def cleanup_old_logs(self, days: int = 30) -> int:
        """
        Delete log files older than specified days.

        Args:
            days: Number of days to retain

        Returns:
            Number of files deleted
        """
        import time

        cutoff = time.time() - (days * 24 * 60 * 60)
        deleted = 0

        for logfile in self.log_dir.glob("*.md"):
            if logfile.stat().st_mtime < cutoff:
                logfile.unlink()
                deleted += 1

        return deleted
