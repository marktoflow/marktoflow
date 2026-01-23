"""
Tests for the state persistence module.
"""

from datetime import datetime, timedelta

import pytest

from marktoflow.core.state import (
    ExecutionRecord,
    ExecutionStatus,
    StateStore,
    StepCheckpoint,
)


def _create_execution(state_store, run_id: str, status: ExecutionStatus = ExecutionStatus.RUNNING) -> None:
    record = ExecutionRecord(
        run_id=run_id,
        workflow_id="wf-test",
        workflow_path="/workflows/test.md",
        status=status,
        started_at=datetime.now(),
        total_steps=3,
        agent="test-agent",
    )
    state_store.create_execution(record)


class TestExecutionStatus:
    """Tests for ExecutionStatus enum."""

    def test_status_values(self):
        """Test that all expected statuses exist."""
        assert ExecutionStatus.PENDING.value == "pending"
        assert ExecutionStatus.RUNNING.value == "running"
        assert ExecutionStatus.COMPLETED.value == "completed"
        assert ExecutionStatus.FAILED.value == "failed"
        assert ExecutionStatus.CANCELLED.value == "cancelled"
        assert ExecutionStatus.PAUSED.value == "paused"


class TestExecutionRecord:
    """Tests for ExecutionRecord dataclass."""

    def test_create_record(self):
        """Test creating an execution record."""
        record = ExecutionRecord(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.PENDING,
            started_at=datetime.now(),
        )

        assert record.run_id == "run-123"
        assert record.workflow_id == "wf-test"
        assert record.status == ExecutionStatus.PENDING
        assert record.current_step == 0

    def test_to_dict(self):
        """Test serializing record to dict."""
        started = datetime(2025, 1, 22, 12, 0, 0)
        record = ExecutionRecord(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.RUNNING,
            started_at=started,
            inputs={"key": "value"},
        )

        data = record.to_dict()
        assert data["run_id"] == "run-123"
        assert data["status"] == "running"
        assert data["started_at"] == "2025-01-22T12:00:00"
        assert '"key": "value"' in data["inputs"]


class TestStepCheckpoint:
    """Tests for StepCheckpoint dataclass."""

    def test_create_checkpoint(self):
        """Test creating a step checkpoint."""
        checkpoint = StepCheckpoint(
            run_id="run-123",
            step_index=0,
            step_name="Test Step",
            status=ExecutionStatus.RUNNING,
            started_at=datetime.now(),
        )

        assert checkpoint.run_id == "run-123"
        assert checkpoint.step_index == 0
        assert checkpoint.step_name == "Test Step"
        assert checkpoint.retry_count == 0

    def test_to_dict(self):
        """Test serializing checkpoint to dict."""
        started = datetime(2025, 1, 22, 12, 0, 0)
        checkpoint = StepCheckpoint(
            run_id="run-123",
            step_index=1,
            step_name="Process Data",
            status=ExecutionStatus.COMPLETED,
            started_at=started,
            outputs={"result": 42},
        )

        data = checkpoint.to_dict()
        assert data["step_index"] == 1
        assert data["status"] == "completed"
        assert '"result": 42' in data["outputs"]


class TestStateStore:
    """Tests for StateStore class."""

    @pytest.fixture
    def state_store(self, tmp_path):
        """Create a temporary state store."""
        db_path = tmp_path / "state.db"
        return StateStore(db_path=db_path)

    def test_create_store(self, tmp_path):
        """Test creating a state store."""
        db_path = tmp_path / "test_state.db"
        store = StateStore(db_path=db_path)
        assert db_path.exists()

    def test_create_execution(self, state_store):
        """Test creating an execution record."""
        record = ExecutionRecord(
            run_id="run-123",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.RUNNING,
            started_at=datetime.now(),
            total_steps=5,
        )

        state_store.create_execution(record)
        retrieved = state_store.get_execution("run-123")

        assert retrieved is not None
        assert retrieved.run_id == "run-123"
        assert retrieved.workflow_id == "wf-test"
        assert retrieved.status == ExecutionStatus.RUNNING

    def test_update_execution(self, state_store):
        """Test updating an execution record."""
        record = ExecutionRecord(
            run_id="run-456",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.RUNNING,
            started_at=datetime.now(),
            total_steps=3,
        )
        state_store.create_execution(record)

        # Update the record
        record.status = ExecutionStatus.COMPLETED
        record.completed_at = datetime.now()
        record.current_step = 3
        state_store.update_execution(record)

        retrieved = state_store.get_execution("run-456")
        assert retrieved.status == ExecutionStatus.COMPLETED
        assert retrieved.current_step == 3
        assert retrieved.completed_at is not None

    def test_list_executions(self, state_store):
        """Test listing execution records."""
        # Create multiple executions
        for i in range(5):
            record = ExecutionRecord(
                run_id=f"run-{i}",
                workflow_id="wf-test",
                workflow_path="/workflows/test.md",
                status=ExecutionStatus.COMPLETED if i % 2 == 0 else ExecutionStatus.FAILED,
                started_at=datetime.now(),
            )
            state_store.create_execution(record)

        # List all
        all_records = state_store.list_executions()
        assert len(all_records) == 5

        # Filter by status
        completed = state_store.list_executions(status=ExecutionStatus.COMPLETED)
        assert len(completed) == 3

        failed = state_store.list_executions(status=ExecutionStatus.FAILED)
        assert len(failed) == 2

    def test_list_executions_with_limit(self, state_store):
        """Test listing executions with limit."""
        for i in range(10):
            record = ExecutionRecord(
                run_id=f"run-{i}",
                workflow_id="wf-test",
                workflow_path="/workflows/test.md",
                status=ExecutionStatus.COMPLETED,
                started_at=datetime.now(),
            )
            state_store.create_execution(record)

        limited = state_store.list_executions(limit=5)
        assert len(limited) == 5

    def test_save_checkpoint(self, state_store):
        """Test saving a step checkpoint."""
        # First create an execution
        _create_execution(state_store, "run-789")

        # Save checkpoint
        checkpoint = StepCheckpoint(
            run_id="run-789",
            step_index=0,
            step_name="Step 1",
            status=ExecutionStatus.COMPLETED,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            outputs={"data": "processed"},
        )
        state_store.save_checkpoint(checkpoint)

        # Retrieve checkpoints
        checkpoints = state_store.get_checkpoints("run-789")
        assert len(checkpoints) == 1
        assert checkpoints[0].step_name == "Step 1"

    def test_get_last_checkpoint(self, state_store):
        """Test getting the last checkpoint."""
        # Create execution and multiple checkpoints
        _create_execution(state_store, "run-abc")

        for i in range(3):
            checkpoint = StepCheckpoint(
                run_id="run-abc",
                step_index=i,
                step_name=f"Step {i + 1}",
                status=ExecutionStatus.COMPLETED,
                started_at=datetime.now(),
            )
            state_store.save_checkpoint(checkpoint)

        last = state_store.get_last_checkpoint("run-abc")
        assert last is not None
        assert last.step_index == 2
        assert last.step_name == "Step 3"

    def test_get_resume_point(self, state_store):
        """Test getting resume point after failure."""
        _create_execution(state_store, "run-resume", ExecutionStatus.FAILED)

        # Save completed checkpoints
        for i in range(2):
            checkpoint = StepCheckpoint(
                run_id="run-resume",
                step_index=i,
                step_name=f"Step {i + 1}",
                status=ExecutionStatus.COMPLETED,
                started_at=datetime.now(),
            )
            state_store.save_checkpoint(checkpoint)

        # Save failed checkpoint
        failed = StepCheckpoint(
            run_id="run-resume",
            step_index=2,
            step_name="Step 3",
            status=ExecutionStatus.FAILED,
            started_at=datetime.now(),
            error="Something went wrong",
        )
        state_store.save_checkpoint(failed)

        # Resume point should be step 2 (0-indexed)
        resume_point = state_store.get_resume_point("run-resume")
        assert resume_point == 2

    def test_cleanup_old_records(self, state_store):
        """Test cleanup of old execution records."""
        now = datetime.now()
        old_record = ExecutionRecord(
            run_id="run-old",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.COMPLETED,
            started_at=now - timedelta(days=40),
            completed_at=now - timedelta(days=39),
        )
        new_record = ExecutionRecord(
            run_id="run-new",
            workflow_id="wf-test",
            workflow_path="/workflows/test.md",
            status=ExecutionStatus.COMPLETED,
            started_at=now - timedelta(days=5),
            completed_at=now - timedelta(days=4),
        )
        state_store.create_execution(old_record)
        state_store.create_execution(new_record)

        deleted = state_store.cleanup_old_records(days=30)
        assert deleted == 1

        assert state_store.get_execution("run-old") is None
        assert state_store.get_execution("run-new") is not None

    def test_get_stats(self, state_store):
        """Test getting execution statistics."""
        # Create mixed executions
        statuses = [
            ExecutionStatus.COMPLETED,
            ExecutionStatus.COMPLETED,
            ExecutionStatus.COMPLETED,
            ExecutionStatus.FAILED,
            ExecutionStatus.RUNNING,
        ]

        for i, status in enumerate(statuses):
            record = ExecutionRecord(
                run_id=f"run-stat-{i}",
                workflow_id="wf-stats",
                workflow_path="/workflows/test.md",
                status=status,
                started_at=datetime.now(),
            )
            state_store.create_execution(record)

        stats = state_store.get_stats()

        assert stats["total_executions"] == 5
        assert stats["completed"] == 3
        assert stats["failed"] == 1
        assert stats["running"] == 1
        assert stats["success_rate"] == 75.0  # 3 / (3 + 1) * 100

    def test_get_stats_by_workflow(self, state_store):
        """Test getting stats filtered by workflow."""
        # Create executions for different workflows
        for i in range(3):
            record = ExecutionRecord(
                run_id=f"run-wf1-{i}",
                workflow_id="workflow-1",
                workflow_path="/workflows/wf1.md",
                status=ExecutionStatus.COMPLETED,
                started_at=datetime.now(),
            )
            state_store.create_execution(record)

        for i in range(2):
            record = ExecutionRecord(
                run_id=f"run-wf2-{i}",
                workflow_id="workflow-2",
                workflow_path="/workflows/wf2.md",
                status=ExecutionStatus.FAILED,
                started_at=datetime.now(),
            )
            state_store.create_execution(record)

        stats1 = state_store.get_stats(workflow_id="workflow-1")
        assert stats1["total_executions"] == 3
        assert stats1["success_rate"] == 100.0

        stats2 = state_store.get_stats(workflow_id="workflow-2")
        assert stats2["total_executions"] == 2
        assert stats2["success_rate"] == 0.0
