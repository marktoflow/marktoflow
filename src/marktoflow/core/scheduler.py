"""
Scheduler for marktoflow framework.

Handles cron-based scheduling of workflow execution.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from marktoflow.core.models import Workflow
from marktoflow.core.parser import WorkflowParser

logger = logging.getLogger(__name__)


@dataclass
class ScheduledJob:
    """A scheduled workflow job."""

    id: str
    workflow_path: str
    schedule: str  # Cron expression
    timezone: str = "UTC"
    enabled: bool = True
    last_run: datetime | None = None
    next_run: datetime | None = None
    run_count: int = 0
    inputs: dict[str, Any] = field(default_factory=dict)


class CronParser:
    """
    Simple cron expression parser.

    Supports: minute hour day_of_month month day_of_week
    Special values: * (any), */N (every N), N-M (range), N,M (list)
    """

    @staticmethod
    def parse(expression: str) -> dict[str, list[int]]:
        """
        Parse a cron expression into component values.

        Args:
            expression: Cron expression (5 fields)

        Returns:
            Dict with minute, hour, day, month, weekday lists
        """
        parts = expression.strip().split()

        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {expression}")

        ranges = {
            "minute": (0, 59),
            "hour": (0, 23),
            "day": (1, 31),
            "month": (1, 12),
            "weekday": (0, 6),
        }

        field_names = ["minute", "hour", "day", "month", "weekday"]
        result = {}

        for i, (name, (min_val, max_val)) in enumerate(zip(field_names, ranges.values())):
            result[name] = CronParser._parse_field(parts[i], min_val, max_val)

        return result

    @staticmethod
    def _parse_field(field: str, min_val: int, max_val: int) -> list[int]:
        """Parse a single cron field."""
        values = set()

        for part in field.split(","):
            if part == "*":
                values.update(range(min_val, max_val + 1))
            elif "/" in part:
                base, step = part.split("/")
                step = int(step)
                if base == "*":
                    start = min_val
                else:
                    start = int(base)
                values.update(range(start, max_val + 1, step))
            elif "-" in part:
                start, end = map(int, part.split("-"))
                values.update(range(start, end + 1))
            else:
                values.add(int(part))

        return sorted(values)

    @staticmethod
    def matches(expression: str, dt: datetime) -> bool:
        """Check if a datetime matches a cron expression."""
        try:
            parsed = CronParser.parse(expression)
        except ValueError:
            return False

        return (
            dt.minute in parsed["minute"]
            and dt.hour in parsed["hour"]
            and dt.day in parsed["day"]
            and dt.month in parsed["month"]
            and dt.weekday() in parsed["weekday"]
        )

    @staticmethod
    def next_run(expression: str, after: datetime | None = None) -> datetime | None:
        """
        Calculate the next run time for a cron expression.

        Args:
            expression: Cron expression
            after: Start time (defaults to now)

        Returns:
            Next matching datetime or None if invalid
        """
        from datetime import timedelta

        if after is None:
            after = datetime.now()

        try:
            parsed = CronParser.parse(expression)
        except ValueError:
            return None

        # Start from next minute
        current = after.replace(second=0, microsecond=0) + timedelta(minutes=1)

        # Search up to 1 year ahead
        max_iterations = 366 * 24 * 60

        for _ in range(max_iterations):
            if CronParser.matches(expression, current):
                return current
            current = current + timedelta(minutes=1)

        return None


class Scheduler:
    """
    Workflow scheduler.

    Manages scheduled execution of workflows based on cron expressions.
    """

    def __init__(
        self,
        workflows_path: str | Path = ".marktoflow/workflows",
        config: dict[str, Any] | None = None,
    ) -> None:
        """
        Initialize the scheduler.

        Args:
            workflows_path: Path to workflows directory
            config: Scheduler configuration
        """
        self.workflows_path = Path(workflows_path)
        self.config = config or {}
        self._jobs: dict[str, ScheduledJob] = {}
        self._running = False
        self._parser = WorkflowParser()
        self._callbacks: list[Callable[[ScheduledJob, Any], None]] = []

    def load_schedules(self) -> int:
        """
        Load scheduled workflows from the workflows directory.

        Returns:
            Number of scheduled jobs loaded
        """
        if not self.workflows_path.exists():
            return 0

        count = 0
        for workflow_file in self.workflows_path.glob("*.md"):
            try:
                workflow = self._parser.parse_file(workflow_file)
                schedules = self._extract_schedules(workflow)

                for i, schedule in enumerate(schedules):
                    job_id = f"{workflow.metadata.id}_{i}"
                    job = ScheduledJob(
                        id=job_id,
                        workflow_path=str(workflow_file),
                        schedule=schedule["schedule"],
                        timezone=schedule.get("timezone", "UTC"),
                        enabled=schedule.get("enabled", True),
                        next_run=CronParser.next_run(schedule["schedule"]),
                    )
                    self._jobs[job_id] = job
                    count += 1

            except Exception as e:
                logger.warning(f"Failed to load workflow {workflow_file}: {e}")

        return count

    def _extract_schedules(self, workflow: Workflow) -> list[dict[str, Any]]:
        """Extract schedule triggers from a workflow."""
        schedules = []

        for trigger in workflow.triggers:
            if trigger.type == "schedule" and trigger.enabled:
                schedule_config = trigger.config
                if "schedule" in schedule_config:
                    schedules.append(schedule_config)

        return schedules

    def add_job(self, job: ScheduledJob) -> None:
        """Add a scheduled job."""
        self._jobs[job.id] = job

    def remove_job(self, job_id: str) -> bool:
        """Remove a scheduled job."""
        if job_id in self._jobs:
            del self._jobs[job_id]
            return True
        return False

    def get_job(self, job_id: str) -> ScheduledJob | None:
        """Get a scheduled job by ID."""
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[ScheduledJob]:
        """List all scheduled jobs."""
        return list(self._jobs.values())

    def on_job_complete(
        self,
        callback: Callable[[ScheduledJob, Any], None],
    ) -> None:
        """Register a callback for job completion."""
        self._callbacks.append(callback)

    async def start(self) -> None:
        """Start the scheduler loop."""
        self._running = True
        logger.info(f"Scheduler started with {len(self._jobs)} jobs")

        while self._running:
            now = datetime.now()

            for job in self._jobs.values():
                if not job.enabled:
                    continue

                if job.next_run and now >= job.next_run:
                    # Time to run this job
                    await self._execute_job(job)

                    # Update next run time
                    job.last_run = now
                    job.run_count += 1
                    job.next_run = CronParser.next_run(job.schedule, now)

            # Sleep until next minute
            await asyncio.sleep(60 - now.second)

    async def _execute_job(self, job: ScheduledJob) -> None:
        """Execute a scheduled job."""
        logger.info(f"Executing scheduled job: {job.id}")

        try:
            # Load workflow
            workflow = self._parser.parse_file(job.workflow_path)

            # Create engine and execute
            from marktoflow.core.engine import WorkflowEngine

            engine = WorkflowEngine(config=self.config)
            result = await engine.execute(workflow, inputs=job.inputs)

            # Notify callbacks
            for callback in self._callbacks:
                try:
                    callback(job, result)
                except Exception as e:
                    logger.error(f"Callback error: {e}")

            if result.success:
                logger.info(f"Job {job.id} completed successfully")
            else:
                logger.error(f"Job {job.id} failed: {result.error}")

        except Exception as e:
            logger.error(f"Failed to execute job {job.id}: {e}")

    def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        logger.info("Scheduler stopped")

    async def run_once(self) -> dict[str, Any]:
        """
        Check and run any due jobs once (non-blocking).

        Returns:
            Dict with execution results
        """
        results = {}
        now = datetime.now()

        for job in self._jobs.values():
            if not job.enabled:
                continue

            if job.next_run and now >= job.next_run:
                await self._execute_job(job)
                job.last_run = now
                job.run_count += 1
                job.next_run = CronParser.next_run(job.schedule, now)
                results[job.id] = {"status": "executed", "time": now}

        return results
