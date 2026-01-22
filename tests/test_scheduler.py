"""
Tests for the scheduler module.
"""

from datetime import datetime

import pytest

from aiworkflow.core.scheduler import CronParser, ScheduledJob, Scheduler


class TestCronParser:
    """Tests for CronParser class."""

    def test_parse_simple_expression(self):
        """Test parsing a simple cron expression."""
        result = CronParser.parse("0 12 * * *")

        assert result["minute"] == [0]
        assert result["hour"] == [12]
        assert result["day"] == list(range(1, 32))
        assert result["month"] == list(range(1, 13))
        assert result["weekday"] == list(range(0, 7))

    def test_parse_every_5_minutes(self):
        """Test parsing */5 pattern."""
        result = CronParser.parse("*/5 * * * *")

        assert result["minute"] == [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

    def test_parse_range(self):
        """Test parsing a range pattern."""
        result = CronParser.parse("0 9-17 * * *")

        assert result["minute"] == [0]
        assert result["hour"] == [9, 10, 11, 12, 13, 14, 15, 16, 17]

    def test_parse_list(self):
        """Test parsing a list pattern."""
        result = CronParser.parse("0 9,12,18 * * *")

        assert result["minute"] == [0]
        assert result["hour"] == [9, 12, 18]

    def test_parse_weekday(self):
        """Test parsing specific weekdays."""
        result = CronParser.parse("0 9 * * 1-5")

        assert result["weekday"] == [1, 2, 3, 4, 5]

    def test_parse_invalid_expression(self):
        """Test that invalid expressions raise ValueError."""
        with pytest.raises(ValueError):
            CronParser.parse("invalid")

        with pytest.raises(ValueError):
            CronParser.parse("0 12 *")  # Too few fields

        with pytest.raises(ValueError):
            CronParser.parse("0 12 * * * *")  # Too many fields

    def test_matches_datetime(self):
        """Test matching a datetime against a cron expression."""
        # 12:00 PM on any day
        dt = datetime(2025, 1, 22, 12, 0, 0)
        assert CronParser.matches("0 12 * * *", dt) is True
        assert CronParser.matches("0 11 * * *", dt) is False

    def test_matches_weekday(self):
        """Test matching weekday in cron expression."""
        # Wednesday, Jan 22, 2025
        dt = datetime(2025, 1, 22, 12, 0, 0)
        assert dt.weekday() == 2  # Wednesday

        assert CronParser.matches("0 12 * * 2", dt) is True  # Wednesday
        assert CronParser.matches("0 12 * * 1", dt) is False  # Monday

    def test_next_run_basic(self):
        """Test calculating next run time."""
        after = datetime(2025, 1, 22, 11, 0, 0)
        next_run = CronParser.next_run("0 12 * * *", after)

        assert next_run is not None
        assert next_run.hour == 12
        assert next_run.minute == 0
        assert next_run.day == 22

    def test_next_run_crosses_day(self):
        """Test next run that crosses to next day."""
        after = datetime(2025, 1, 22, 13, 0, 0)
        next_run = CronParser.next_run("0 12 * * *", after)

        assert next_run is not None
        assert next_run.hour == 12
        assert next_run.day == 23

    def test_next_run_every_5_minutes(self):
        """Test next run for */5 pattern."""
        after = datetime(2025, 1, 22, 12, 3, 0)
        next_run = CronParser.next_run("*/5 * * * *", after)

        assert next_run is not None
        assert next_run.minute == 5


class TestScheduledJob:
    """Tests for ScheduledJob dataclass."""

    def test_create_job(self):
        """Test creating a scheduled job."""
        job = ScheduledJob(
            id="test-job",
            workflow_path="/workflows/test.md",
            schedule="0 12 * * *",
        )

        assert job.id == "test-job"
        assert job.workflow_path == "/workflows/test.md"
        assert job.schedule == "0 12 * * *"
        assert job.timezone == "UTC"
        assert job.enabled is True
        assert job.run_count == 0

    def test_job_with_inputs(self):
        """Test job with custom inputs."""
        job = ScheduledJob(
            id="test-job",
            workflow_path="/workflows/test.md",
            schedule="0 12 * * *",
            inputs={"email": "test@example.com"},
        )

        assert job.inputs == {"email": "test@example.com"}


class TestScheduler:
    """Tests for Scheduler class."""

    def test_create_scheduler(self, tmp_path):
        """Test creating a scheduler."""
        scheduler = Scheduler(workflows_path=tmp_path / "workflows")
        assert scheduler.workflows_path == tmp_path / "workflows"

    def test_add_job(self, tmp_path):
        """Test adding a job to scheduler."""
        scheduler = Scheduler(workflows_path=tmp_path / "workflows")

        job = ScheduledJob(
            id="test-job",
            workflow_path="/workflows/test.md",
            schedule="0 12 * * *",
        )
        scheduler.add_job(job)

        assert scheduler.get_job("test-job") == job
        assert len(scheduler.list_jobs()) == 1

    def test_remove_job(self, tmp_path):
        """Test removing a job from scheduler."""
        scheduler = Scheduler(workflows_path=tmp_path / "workflows")

        job = ScheduledJob(
            id="test-job",
            workflow_path="/workflows/test.md",
            schedule="0 12 * * *",
        )
        scheduler.add_job(job)
        assert scheduler.remove_job("test-job") is True
        assert scheduler.get_job("test-job") is None
        assert scheduler.remove_job("test-job") is False

    def test_list_jobs(self, tmp_path):
        """Test listing all jobs."""
        scheduler = Scheduler(workflows_path=tmp_path / "workflows")

        for i in range(3):
            scheduler.add_job(
                ScheduledJob(
                    id=f"job-{i}",
                    workflow_path=f"/workflows/test{i}.md",
                    schedule="0 12 * * *",
                )
            )

        jobs = scheduler.list_jobs()
        assert len(jobs) == 3

    def test_job_callback(self, tmp_path):
        """Test registering a job completion callback."""
        scheduler = Scheduler(workflows_path=tmp_path / "workflows")
        callback_data = []

        def on_complete(job, result):
            callback_data.append((job.id, result))

        scheduler.on_job_complete(on_complete)
        assert len(scheduler._callbacks) == 1
