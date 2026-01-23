"""
Tests for rollback capabilities.
"""

import pytest
from datetime import datetime

from marktoflow.core.rollback import (
    RollbackAction,
    RollbackResult,
    RollbackStrategy,
    RollbackStatus,
    RollbackRegistry,
    TransactionContext,
    DefaultCompensationHandler,
)


class TestRollbackStrategy:
    """Tests for RollbackStrategy enum."""

    def test_strategy_values(self):
        """Test strategy enum values."""
        assert RollbackStrategy.NONE.value == "none"
        assert RollbackStrategy.COMPENSATE.value == "compensate"
        assert RollbackStrategy.RESTORE.value == "restore"
        assert RollbackStrategy.IDEMPOTENT.value == "idempotent"


class TestRollbackStatus:
    """Tests for RollbackStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        assert RollbackStatus.PENDING.value == "pending"
        assert RollbackStatus.IN_PROGRESS.value == "in_progress"
        assert RollbackStatus.COMPLETED.value == "completed"
        assert RollbackStatus.FAILED.value == "failed"
        assert RollbackStatus.SKIPPED.value == "skipped"


class TestRollbackAction:
    """Tests for RollbackAction dataclass."""

    def test_default_values(self):
        """Test default action values."""
        action = RollbackAction(step_name="test", step_index=0)
        assert action.step_name == "test"
        assert action.step_index == 0
        assert action.strategy == RollbackStrategy.COMPENSATE
        assert action.compensate_action is None
        assert action.compensate_inputs == {}
        assert action.state_snapshot == {}
        assert action.rollback_status == RollbackStatus.PENDING
        assert action.rollback_error is None

    def test_custom_values(self):
        """Test action with custom values."""
        action = RollbackAction(
            step_name="create_file",
            step_index=1,
            strategy=RollbackStrategy.COMPENSATE,
            compensate_action="delete_file",
            compensate_inputs={"path": "/tmp/test.txt"},
            metadata={"created_by": "workflow"},
        )
        assert action.step_name == "create_file"
        assert action.compensate_action == "delete_file"
        assert action.compensate_inputs["path"] == "/tmp/test.txt"

    def test_to_dict(self):
        """Test serialization to dictionary."""
        action = RollbackAction(
            step_name="test",
            step_index=0,
            strategy=RollbackStrategy.RESTORE,
        )
        data = action.to_dict()
        assert data["step_name"] == "test"
        assert data["step_index"] == 0
        assert data["strategy"] == "restore"
        assert data["rollback_status"] == "pending"

    def test_from_dict(self):
        """Test deserialization from dictionary."""
        data = {
            "step_name": "test",
            "step_index": 1,
            "strategy": "compensate",
            "compensate_action": "undo_test",
            "executed_at": "2026-01-22T10:00:00",
            "rollback_status": "completed",
        }
        action = RollbackAction.from_dict(data)
        assert action.step_name == "test"
        assert action.step_index == 1
        assert action.strategy == RollbackStrategy.COMPENSATE
        assert action.compensate_action == "undo_test"
        assert action.rollback_status == RollbackStatus.COMPLETED


class TestRollbackResult:
    """Tests for RollbackResult dataclass."""

    def test_success_result(self):
        """Test successful rollback result."""
        result = RollbackResult(
            success=True,
            steps_rolled_back=3,
            steps_failed=0,
            steps_skipped=1,
            duration_seconds=0.5,
        )
        assert result.success is True
        assert result.steps_rolled_back == 3
        assert result.steps_failed == 0

    def test_failed_result(self):
        """Test failed rollback result."""
        result = RollbackResult(
            success=False,
            steps_rolled_back=2,
            steps_failed=1,
            errors=["Step X failed"],
        )
        assert result.success is False
        assert result.steps_failed == 1
        assert len(result.errors) == 1

    def test_to_dict(self):
        """Test result serialization."""
        result = RollbackResult(success=True, steps_rolled_back=5)
        data = result.to_dict()
        assert data["success"] is True
        assert data["steps_rolled_back"] == 5


class TestDefaultCompensationHandler:
    """Tests for DefaultCompensationHandler."""

    def test_register_handler(self):
        """Test registering a compensation handler."""
        handler = DefaultCompensationHandler()

        def undo_action(action, context):
            context["undone"] = True
            return True

        handler.register("my_action", undo_action)
        action = RollbackAction(
            step_name="test",
            step_index=0,
            compensate_action="my_action",
        )
        context = {}
        result = handler.compensate(action, context)
        assert result is True
        assert context.get("undone") is True

    def test_unregistered_handler(self):
        """Test compensation with unregistered handler."""
        handler = DefaultCompensationHandler()
        action = RollbackAction(
            step_name="test",
            step_index=0,
            compensate_action="unknown_action",
        )
        result = handler.compensate(action, {})
        assert result is False


class TestRollbackRegistry:
    """Tests for RollbackRegistry."""

    def test_record_action(self):
        """Test recording a rollback action."""
        registry = RollbackRegistry()
        action = registry.record(
            step_name="step1",
            step_index=0,
            compensate_action="undo_step1",
        )
        assert action.step_name == "step1"
        assert len(registry.get_actions()) == 1

    def test_record_multiple_actions(self):
        """Test recording multiple actions."""
        registry = RollbackRegistry()
        for i in range(5):
            registry.record(step_name=f"step{i}", step_index=i)
        assert len(registry.get_actions()) == 5

    def test_get_rollback_order(self):
        """Test actions are returned in reverse order for rollback."""
        registry = RollbackRegistry()
        registry.record(step_name="step0", step_index=0)
        registry.record(step_name="step1", step_index=1)
        registry.record(step_name="step2", step_index=2)

        rollback_order = registry.get_rollback_order()
        assert rollback_order[0].step_name == "step2"
        assert rollback_order[1].step_name == "step1"
        assert rollback_order[2].step_name == "step0"

    def test_max_history(self):
        """Test max history limit."""
        registry = RollbackRegistry(max_history=3)
        for i in range(5):
            registry.record(step_name=f"step{i}", step_index=i)
        assert len(registry.get_actions()) == 3
        # Should keep the last 3
        actions = registry.get_actions()
        assert actions[0].step_name == "step2"
        assert actions[2].step_name == "step4"

    def test_clear(self):
        """Test clearing the registry."""
        registry = RollbackRegistry()
        registry.record(step_name="step0", step_index=0)
        registry.record(step_name="step1", step_index=1)
        registry.clear()
        assert len(registry.get_actions()) == 0

    def test_rollback_all_with_restore_strategy(self):
        """Test rollback with restore strategy."""
        registry = RollbackRegistry()
        registry.record(
            step_name="step0",
            step_index=0,
            strategy=RollbackStrategy.RESTORE,
            state_snapshot={"key": "original_value"},
        )

        context = {"key": "modified_value"}
        result = registry.rollback_all(context)

        assert result.success is True
        assert result.steps_rolled_back == 1
        assert context["key"] == "original_value"

    def test_rollback_all_with_none_strategy(self):
        """Test rollback skips NONE strategy."""
        registry = RollbackRegistry()
        registry.record(
            step_name="step0",
            step_index=0,
            strategy=RollbackStrategy.NONE,
        )

        result = registry.rollback_all()
        assert result.success is True
        assert result.steps_skipped == 1
        assert result.steps_rolled_back == 0

    def test_rollback_all_with_idempotent_strategy(self):
        """Test rollback with idempotent strategy."""
        registry = RollbackRegistry()
        registry.record(
            step_name="step0",
            step_index=0,
            strategy=RollbackStrategy.IDEMPOTENT,
        )

        result = registry.rollback_all()
        assert result.success is True
        assert result.steps_rolled_back == 1

    def test_rollback_with_compensation(self):
        """Test rollback with compensation handler."""
        registry = RollbackRegistry()
        compensated = []

        def undo_action(action, context):
            compensated.append(action.step_name)
            return True

        registry.register_compensation("undo_step", undo_action)
        registry.record(
            step_name="step0",
            step_index=0,
            compensate_action="undo_step",
        )

        result = registry.rollback_all()
        assert result.success is True
        assert "step0" in compensated

    def test_rollback_to_step(self):
        """Test rollback to specific step index."""
        registry = RollbackRegistry()
        for i in range(5):
            registry.record(
                step_name=f"step{i}",
                step_index=i,
                strategy=RollbackStrategy.RESTORE,
                state_snapshot={},
            )

        # Rollback to step 2 (should rollback steps 3 and 4)
        result = registry.rollback_to(step_index=2)
        assert result.success is True
        assert result.steps_rolled_back == 2

        # Should have steps 0, 1, 2 remaining
        remaining = registry.get_actions()
        assert len(remaining) == 3
        assert remaining[-1].step_index == 2

    def test_rollback_stop_on_error(self):
        """Test rollback stops on error when configured."""
        registry = RollbackRegistry()

        def fail_compensation(action, context):
            raise RuntimeError("Compensation failed")

        registry.register_compensation("fail", fail_compensation)

        registry.record(step_name="step0", step_index=0, strategy=RollbackStrategy.RESTORE)
        registry.record(step_name="step1", step_index=1, compensate_action="fail")
        registry.record(step_name="step2", step_index=2, strategy=RollbackStrategy.RESTORE)

        result = registry.rollback_all(stop_on_error=True)
        assert result.success is False
        assert result.steps_failed >= 1
        # Should stop after step1 fails (which is first in rollback order after step2)


class TestTransactionContext:
    """Tests for TransactionContext."""

    def test_is_active(self):
        """Test transaction is active initially."""
        tx = TransactionContext()
        assert tx.is_active is True

    def test_commit(self):
        """Test transaction commit."""
        tx = TransactionContext()
        tx.record_step("step0", 0)
        tx.commit()

        assert tx.is_active is False
        assert len(tx.registry.get_actions()) == 0

    def test_rollback(self):
        """Test transaction rollback."""
        tx = TransactionContext()
        tx.record_step("step0", 0, strategy=RollbackStrategy.RESTORE)
        tx.record_step("step1", 1, strategy=RollbackStrategy.RESTORE)

        result = tx.rollback()
        assert result.success is True
        assert result.steps_rolled_back == 2
        assert tx.is_active is False

    def test_savepoint(self):
        """Test savepoint creation and rollback."""
        tx = TransactionContext()
        tx.record_step("step0", 0, strategy=RollbackStrategy.RESTORE)
        tx.savepoint("before_risky")
        tx.record_step("step1", 1, strategy=RollbackStrategy.RESTORE)
        tx.record_step("step2", 2, strategy=RollbackStrategy.RESTORE)

        result = tx.rollback_to_savepoint("before_risky")
        assert result.success is True
        assert result.steps_rolled_back == 2

    def test_context_manager_commit(self):
        """Test context manager with successful execution."""
        with TransactionContext() as tx:
            tx.record_step("step0", 0)
            tx.commit()

        assert tx.is_active is False

    def test_context_manager_auto_rollback(self):
        """Test context manager auto rollback on error."""
        try:
            with TransactionContext() as tx:
                tx.record_step("step0", 0, strategy=RollbackStrategy.RESTORE)
                raise ValueError("Something went wrong")
        except ValueError:
            pass

        assert tx.is_active is False

    def test_record_step_not_active(self):
        """Test recording step on inactive transaction fails."""
        tx = TransactionContext()
        tx.commit()

        with pytest.raises(RuntimeError, match="not active"):
            tx.record_step("step0", 0)

    def test_set_get_context(self):
        """Test transaction context storage."""
        tx = TransactionContext()
        tx.set_context("key", "value")
        assert tx.get_context("key") == "value"
        assert tx.get_context("missing", "default") == "default"

    def test_invalid_savepoint(self):
        """Test rollback to invalid savepoint."""
        tx = TransactionContext()
        with pytest.raises(ValueError, match="Savepoint not found"):
            tx.rollback_to_savepoint("nonexistent")


class TestRollbackIntegration:
    """Integration tests for rollback functionality."""

    def test_full_workflow_rollback(self):
        """Test complete workflow rollback scenario."""
        registry = RollbackRegistry()
        context = {"files_created": [], "commits_made": []}

        # Register compensation handlers
        def undo_file_create(action, ctx):
            path = action.compensate_inputs.get("path")
            if path in ctx["files_created"]:
                ctx["files_created"].remove(path)
            return True

        def undo_commit(action, ctx):
            commit = action.compensate_inputs.get("commit")
            if commit in ctx["commits_made"]:
                ctx["commits_made"].remove(commit)
            return True

        registry.register_compensation("delete_file", undo_file_create)
        registry.register_compensation("revert_commit", undo_commit)

        # Simulate workflow execution
        context["files_created"].append("/tmp/file1.txt")
        registry.record(
            step_name="create_file",
            step_index=0,
            compensate_action="delete_file",
            compensate_inputs={"path": "/tmp/file1.txt"},
        )

        context["commits_made"].append("abc123")
        registry.record(
            step_name="git_commit",
            step_index=1,
            compensate_action="revert_commit",
            compensate_inputs={"commit": "abc123"},
        )

        # Rollback everything
        result = registry.rollback_all(context)

        assert result.success is True
        assert result.steps_rolled_back == 2
        assert len(context["files_created"]) == 0
        assert len(context["commits_made"]) == 0

    def test_partial_rollback_on_failure(self):
        """Test partial rollback when a step fails."""
        registry = RollbackRegistry()
        executed_steps = []

        def track_compensation(action, ctx):
            executed_steps.append(action.step_name)
            return True

        registry.register_compensation("track", track_compensation)

        # Record 3 successful steps
        for i in range(3):
            registry.record(
                step_name=f"step{i}",
                step_index=i,
                compensate_action="track",
            )

        # Rollback to step 0
        result = registry.rollback_to(step_index=0)

        assert result.success is True
        assert result.steps_rolled_back == 2
        assert "step2" in executed_steps
        assert "step1" in executed_steps
        assert "step0" not in executed_steps

    def test_transaction_with_mixed_strategies(self):
        """Test transaction with different rollback strategies."""
        with TransactionContext() as tx:
            # Step that cannot be rolled back
            tx.record_step("read_config", 0, strategy=RollbackStrategy.NONE)

            # Step that restores state
            tx.registry.record(
                step_name="modify_state",
                step_index=1,
                strategy=RollbackStrategy.RESTORE,
                state_snapshot={"original": "value"},
            )

            # Step that is idempotent
            tx.record_step("idempotent_action", 2, strategy=RollbackStrategy.IDEMPOTENT)

            result = tx.rollback()

            assert result.success is True
            assert result.steps_skipped == 1  # NONE
            assert result.steps_rolled_back == 2  # RESTORE + IDEMPOTENT
