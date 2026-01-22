"""
Rollback capabilities for aiworkflow framework.

Provides step undo registry and transaction-like semantics for workflow execution.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable, Generic, TypeVar

if TYPE_CHECKING:
    from aiworkflow.core.models import StepResult, WorkflowStep

T = TypeVar("T")


class RollbackStrategy(Enum):
    """Strategies for handling rollback."""

    NONE = "none"  # No rollback support
    COMPENSATE = "compensate"  # Execute compensation action
    RESTORE = "restore"  # Restore to previous state
    IDEMPOTENT = "idempotent"  # Action is idempotent, can be retried


class RollbackStatus(Enum):
    """Status of a rollback operation."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class RollbackAction:
    """
    Defines a rollback action for a step.

    Attributes:
        step_name: Name of the step this rollback is for
        step_index: Index of the step in workflow
        strategy: Rollback strategy to use
        compensate_action: Action to execute for compensation
        compensate_inputs: Inputs for compensation action
        state_snapshot: Snapshot of state before step execution
        executed_at: When the original step was executed
        rollback_status: Current status of rollback
        rollback_error: Error if rollback failed
        metadata: Additional metadata
    """

    step_name: str
    step_index: int
    strategy: RollbackStrategy = RollbackStrategy.COMPENSATE
    compensate_action: str | None = None
    compensate_inputs: dict[str, Any] = field(default_factory=dict)
    state_snapshot: dict[str, Any] = field(default_factory=dict)
    executed_at: datetime = field(default_factory=datetime.now)
    rollback_status: RollbackStatus = RollbackStatus.PENDING
    rollback_error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "step_name": self.step_name,
            "step_index": self.step_index,
            "strategy": self.strategy.value,
            "compensate_action": self.compensate_action,
            "compensate_inputs": self.compensate_inputs,
            "state_snapshot": self.state_snapshot,
            "executed_at": self.executed_at.isoformat(),
            "rollback_status": self.rollback_status.value,
            "rollback_error": self.rollback_error,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RollbackAction":
        """Create from dictionary."""
        return cls(
            step_name=data["step_name"],
            step_index=data["step_index"],
            strategy=RollbackStrategy(data.get("strategy", "compensate")),
            compensate_action=data.get("compensate_action"),
            compensate_inputs=data.get("compensate_inputs", {}),
            state_snapshot=data.get("state_snapshot", {}),
            executed_at=datetime.fromisoformat(data["executed_at"])
            if data.get("executed_at")
            else datetime.now(),
            rollback_status=RollbackStatus(data.get("rollback_status", "pending")),
            rollback_error=data.get("rollback_error"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class RollbackResult:
    """
    Result of a rollback operation.

    Attributes:
        success: Whether rollback completed successfully
        steps_rolled_back: Number of steps rolled back
        steps_failed: Number of steps that failed to rollback
        steps_skipped: Number of steps skipped
        errors: List of errors encountered
        duration_seconds: Total rollback duration
    """

    success: bool
    steps_rolled_back: int = 0
    steps_failed: int = 0
    steps_skipped: int = 0
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "steps_rolled_back": self.steps_rolled_back,
            "steps_failed": self.steps_failed,
            "steps_skipped": self.steps_skipped,
            "errors": self.errors,
            "duration_seconds": self.duration_seconds,
        }


class CompensationHandler(ABC):
    """
    Abstract base class for compensation handlers.

    Compensation handlers execute the undo logic for specific action types.
    """

    @property
    @abstractmethod
    def action_type(self) -> str:
        """The action type this handler compensates."""
        pass

    @abstractmethod
    def compensate(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """
        Execute compensation for a step.

        Args:
            action: The rollback action with compensation details
            context: Current execution context

        Returns:
            True if compensation succeeded
        """
        pass

    @abstractmethod
    async def compensate_async(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Async version of compensate."""
        pass


class DefaultCompensationHandler(CompensationHandler):
    """
    Default compensation handler that uses registered callbacks.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, Callable[..., bool]] = {}
        self._async_handlers: dict[str, Callable[..., Any]] = {}

    @property
    def action_type(self) -> str:
        return "*"  # Handles all types

    def register(
        self,
        action_type: str,
        handler: Callable[[RollbackAction, dict[str, Any]], bool],
    ) -> None:
        """Register a compensation handler for an action type."""
        self._handlers[action_type] = handler

    def register_async(
        self,
        action_type: str,
        handler: Callable[[RollbackAction, dict[str, Any]], Any],
    ) -> None:
        """Register an async compensation handler."""
        self._async_handlers[action_type] = handler

    def compensate(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Execute compensation using registered handler."""
        if action.compensate_action in self._handlers:
            return self._handlers[action.compensate_action](action, context)
        return False

    async def compensate_async(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Execute async compensation."""
        if action.compensate_action in self._async_handlers:
            result = self._async_handlers[action.compensate_action](action, context)
            if asyncio.iscoroutine(result):
                return await result
            return result
        # Fall back to sync handler
        return self.compensate(action, context)


class RollbackRegistry:
    """
    Registry for tracking rollback actions during workflow execution.

    Maintains a stack of executed steps that can be rolled back in reverse order.
    """

    def __init__(self, max_history: int = 100) -> None:
        """
        Initialize rollback registry.

        Args:
            max_history: Maximum number of rollback actions to keep
        """
        self.max_history = max_history
        self._actions: list[RollbackAction] = []
        self._compensation_handler = DefaultCompensationHandler()
        self._custom_handlers: dict[str, CompensationHandler] = {}

    def register_handler(self, handler: CompensationHandler) -> None:
        """Register a custom compensation handler."""
        self._custom_handlers[handler.action_type] = handler

    def register_compensation(
        self,
        action_type: str,
        handler: Callable[[RollbackAction, dict[str, Any]], bool],
    ) -> None:
        """Register a compensation callback for an action type."""
        self._compensation_handler.register(action_type, handler)

    def register_compensation_async(
        self,
        action_type: str,
        handler: Callable[[RollbackAction, dict[str, Any]], Any],
    ) -> None:
        """Register an async compensation callback."""
        self._compensation_handler.register_async(action_type, handler)

    def record(
        self,
        step_name: str,
        step_index: int,
        strategy: RollbackStrategy = RollbackStrategy.COMPENSATE,
        compensate_action: str | None = None,
        compensate_inputs: dict[str, Any] | None = None,
        state_snapshot: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> RollbackAction:
        """
        Record a step execution for potential rollback.

        Args:
            step_name: Name of the executed step
            step_index: Index of the step
            strategy: Rollback strategy
            compensate_action: Action to execute for compensation
            compensate_inputs: Inputs for compensation
            state_snapshot: State before step execution
            metadata: Additional metadata

        Returns:
            The recorded rollback action
        """
        action = RollbackAction(
            step_name=step_name,
            step_index=step_index,
            strategy=strategy,
            compensate_action=compensate_action,
            compensate_inputs=compensate_inputs or {},
            state_snapshot=state_snapshot or {},
            metadata=metadata or {},
        )

        self._actions.append(action)

        # Trim history if needed
        if len(self._actions) > self.max_history:
            self._actions = self._actions[-self.max_history :]

        return action

    def get_actions(self) -> list[RollbackAction]:
        """Get all recorded actions."""
        return list(self._actions)

    def get_rollback_order(self) -> list[RollbackAction]:
        """Get actions in rollback order (reverse execution order)."""
        return list(reversed(self._actions))

    def clear(self) -> None:
        """Clear all recorded actions."""
        self._actions.clear()

    def rollback_all(
        self,
        context: dict[str, Any] | None = None,
        stop_on_error: bool = False,
    ) -> RollbackResult:
        """
        Rollback all recorded steps in reverse order.

        Args:
            context: Execution context for compensation
            stop_on_error: Stop rollback on first error

        Returns:
            RollbackResult with summary
        """
        import time

        start_time = time.time()
        ctx = context or {}
        errors: list[str] = []
        rolled_back = 0
        failed = 0
        skipped = 0

        for action in self.get_rollback_order():
            if action.strategy == RollbackStrategy.NONE:
                action.rollback_status = RollbackStatus.SKIPPED
                skipped += 1
                continue

            action.rollback_status = RollbackStatus.IN_PROGRESS

            try:
                success = self._execute_compensation(action, ctx)

                if success:
                    action.rollback_status = RollbackStatus.COMPLETED
                    rolled_back += 1
                else:
                    action.rollback_status = RollbackStatus.FAILED
                    action.rollback_error = "Compensation returned False"
                    failed += 1
                    errors.append(f"Step {action.step_name}: Compensation failed")

                    if stop_on_error:
                        break

            except Exception as e:
                action.rollback_status = RollbackStatus.FAILED
                action.rollback_error = str(e)
                failed += 1
                errors.append(f"Step {action.step_name}: {e}")

                if stop_on_error:
                    break

        duration = time.time() - start_time

        return RollbackResult(
            success=failed == 0,
            steps_rolled_back=rolled_back,
            steps_failed=failed,
            steps_skipped=skipped,
            errors=errors,
            duration_seconds=duration,
        )

    async def rollback_all_async(
        self,
        context: dict[str, Any] | None = None,
        stop_on_error: bool = False,
    ) -> RollbackResult:
        """
        Async rollback all recorded steps.

        Args:
            context: Execution context for compensation
            stop_on_error: Stop rollback on first error

        Returns:
            RollbackResult with summary
        """
        import time

        start_time = time.time()
        ctx = context or {}
        errors: list[str] = []
        rolled_back = 0
        failed = 0
        skipped = 0

        for action in self.get_rollback_order():
            if action.strategy == RollbackStrategy.NONE:
                action.rollback_status = RollbackStatus.SKIPPED
                skipped += 1
                continue

            action.rollback_status = RollbackStatus.IN_PROGRESS

            try:
                success = await self._execute_compensation_async(action, ctx)

                if success:
                    action.rollback_status = RollbackStatus.COMPLETED
                    rolled_back += 1
                else:
                    action.rollback_status = RollbackStatus.FAILED
                    action.rollback_error = "Compensation returned False"
                    failed += 1
                    errors.append(f"Step {action.step_name}: Compensation failed")

                    if stop_on_error:
                        break

            except Exception as e:
                action.rollback_status = RollbackStatus.FAILED
                action.rollback_error = str(e)
                failed += 1
                errors.append(f"Step {action.step_name}: {e}")

                if stop_on_error:
                    break

        duration = time.time() - start_time

        return RollbackResult(
            success=failed == 0,
            steps_rolled_back=rolled_back,
            steps_failed=failed,
            steps_skipped=skipped,
            errors=errors,
            duration_seconds=duration,
        )

    def rollback_to(
        self,
        step_index: int,
        context: dict[str, Any] | None = None,
    ) -> RollbackResult:
        """
        Rollback to a specific step index.

        Args:
            step_index: Target step index to rollback to
            context: Execution context

        Returns:
            RollbackResult with summary
        """
        # Filter actions to rollback (those after step_index)
        actions_to_rollback = [a for a in self._actions if a.step_index > step_index]

        if not actions_to_rollback:
            return RollbackResult(success=True)

        # Temporarily replace actions list
        original_actions = self._actions
        self._actions = actions_to_rollback

        try:
            result = self.rollback_all(context)
        finally:
            # Restore and remove rolled back actions
            self._actions = [a for a in original_actions if a.step_index <= step_index]

        return result

    async def rollback_to_async(
        self,
        step_index: int,
        context: dict[str, Any] | None = None,
    ) -> RollbackResult:
        """Async version of rollback_to."""
        actions_to_rollback = [a for a in self._actions if a.step_index > step_index]

        if not actions_to_rollback:
            return RollbackResult(success=True)

        original_actions = self._actions
        self._actions = actions_to_rollback

        try:
            result = await self.rollback_all_async(context)
        finally:
            self._actions = [a for a in original_actions if a.step_index <= step_index]

        return result

    def _execute_compensation(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Execute compensation for an action."""
        # Check for custom handler
        if action.compensate_action and action.compensate_action in self._custom_handlers:
            return self._custom_handlers[action.compensate_action].compensate(action, context)

        # Check for restore strategy
        if action.strategy == RollbackStrategy.RESTORE:
            # Restore state from snapshot
            context.update(action.state_snapshot)
            return True

        # Check for idempotent strategy
        if action.strategy == RollbackStrategy.IDEMPOTENT:
            # Nothing to do, action can be safely retried
            return True

        # Use default compensation handler
        if action.compensate_action:
            return self._compensation_handler.compensate(action, context)

        return True

    async def _execute_compensation_async(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Execute async compensation for an action."""
        # Check for custom handler
        if action.compensate_action and action.compensate_action in self._custom_handlers:
            return await self._custom_handlers[action.compensate_action].compensate_async(
                action, context
            )

        # Check for restore strategy
        if action.strategy == RollbackStrategy.RESTORE:
            context.update(action.state_snapshot)
            return True

        # Check for idempotent strategy
        if action.strategy == RollbackStrategy.IDEMPOTENT:
            return True

        # Use default compensation handler
        if action.compensate_action:
            return await self._compensation_handler.compensate_async(action, context)

        return True


class TransactionContext:
    """
    Transaction-like context for workflow execution.

    Provides commit/rollback semantics for a group of steps.
    """

    def __init__(
        self,
        registry: RollbackRegistry | None = None,
        auto_rollback_on_error: bool = True,
    ) -> None:
        """
        Initialize transaction context.

        Args:
            registry: Rollback registry to use
            auto_rollback_on_error: Automatically rollback on error
        """
        self.registry = registry or RollbackRegistry()
        self.auto_rollback_on_error = auto_rollback_on_error
        self._committed = False
        self._rolled_back = False
        self._context: dict[str, Any] = {}
        self._savepoints: dict[str, int] = {}

    @property
    def is_active(self) -> bool:
        """Check if transaction is still active."""
        return not self._committed and not self._rolled_back

    def record_step(
        self,
        step_name: str,
        step_index: int,
        compensate_action: str | None = None,
        compensate_inputs: dict[str, Any] | None = None,
        state_snapshot: dict[str, Any] | None = None,
        strategy: RollbackStrategy = RollbackStrategy.COMPENSATE,
    ) -> RollbackAction:
        """Record a step execution within the transaction."""
        if not self.is_active:
            raise RuntimeError("Transaction is not active")

        return self.registry.record(
            step_name=step_name,
            step_index=step_index,
            strategy=strategy,
            compensate_action=compensate_action,
            compensate_inputs=compensate_inputs,
            state_snapshot=state_snapshot,
        )

    def savepoint(self, name: str) -> None:
        """
        Create a savepoint at current position.

        Args:
            name: Name for the savepoint
        """
        if not self.is_active:
            raise RuntimeError("Transaction is not active")

        actions = self.registry.get_actions()
        self._savepoints[name] = len(actions) - 1 if actions else -1

    def rollback_to_savepoint(self, name: str) -> RollbackResult:
        """
        Rollback to a named savepoint.

        Args:
            name: Savepoint name

        Returns:
            RollbackResult
        """
        if name not in self._savepoints:
            raise ValueError(f"Savepoint not found: {name}")

        return self.registry.rollback_to(
            self._savepoints[name],
            self._context,
        )

    async def rollback_to_savepoint_async(self, name: str) -> RollbackResult:
        """Async version of rollback_to_savepoint."""
        if name not in self._savepoints:
            raise ValueError(f"Savepoint not found: {name}")

        return await self.registry.rollback_to_async(
            self._savepoints[name],
            self._context,
        )

    def commit(self) -> None:
        """
        Commit the transaction.

        Clears all rollback history, making changes permanent.
        """
        if not self.is_active:
            raise RuntimeError("Transaction is not active")

        self._committed = True
        self.registry.clear()
        self._savepoints.clear()

    def rollback(self) -> RollbackResult:
        """
        Rollback the entire transaction.

        Returns:
            RollbackResult with summary
        """
        if not self.is_active:
            raise RuntimeError("Transaction is not active")

        result = self.registry.rollback_all(self._context)
        self._rolled_back = True
        self.registry.clear()
        self._savepoints.clear()

        return result

    async def rollback_async(self) -> RollbackResult:
        """Async version of rollback."""
        if not self.is_active:
            raise RuntimeError("Transaction is not active")

        result = await self.registry.rollback_all_async(self._context)
        self._rolled_back = True
        self.registry.clear()
        self._savepoints.clear()

        return result

    def set_context(self, key: str, value: Any) -> None:
        """Set a value in the transaction context."""
        self._context[key] = value

    def get_context(self, key: str, default: Any = None) -> Any:
        """Get a value from the transaction context."""
        return self._context.get(key, default)

    def __enter__(self) -> "TransactionContext":
        """Enter context manager."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        """Exit context manager, rollback on error if configured."""
        if exc_type is not None and self.auto_rollback_on_error and self.is_active:
            self.rollback()
            return False  # Re-raise the exception
        return False

    async def __aenter__(self) -> "TransactionContext":
        """Async enter."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        """Async exit with rollback on error."""
        if exc_type is not None and self.auto_rollback_on_error and self.is_active:
            await self.rollback_async()
            return False
        return False


# Pre-built compensation handlers for common operations
class FileCompensationHandler(CompensationHandler):
    """Compensation handler for file operations."""

    @property
    def action_type(self) -> str:
        return "file"

    def compensate(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Compensate file operations."""
        import os
        import shutil

        operation = action.compensate_inputs.get("operation")
        path = action.compensate_inputs.get("path")

        if operation == "delete" and path:
            # Delete created file
            if os.path.exists(path):
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
            return True

        elif operation == "restore" and path:
            # Restore from backup
            backup_path = action.compensate_inputs.get("backup_path")
            if backup_path and os.path.exists(backup_path):
                shutil.copy2(backup_path, path)
                return True

        return False

    async def compensate_async(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Async file compensation (delegates to sync)."""
        return self.compensate(action, context)


class GitCompensationHandler(CompensationHandler):
    """Compensation handler for git operations."""

    @property
    def action_type(self) -> str:
        return "git"

    def compensate(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Compensate git operations."""
        import subprocess

        operation = action.compensate_inputs.get("operation")
        repo_path = action.compensate_inputs.get("repo_path", ".")

        if operation == "reset_hard":
            # Reset to previous commit
            commit = action.compensate_inputs.get("commit", "HEAD~1")
            result = subprocess.run(
                ["git", "reset", "--hard", commit],
                cwd=repo_path,
                capture_output=True,
            )
            return result.returncode == 0

        elif operation == "delete_branch":
            # Delete created branch
            branch = action.compensate_inputs.get("branch")
            if branch:
                result = subprocess.run(
                    ["git", "branch", "-D", branch],
                    cwd=repo_path,
                    capture_output=True,
                )
                return result.returncode == 0

        elif operation == "revert_commit":
            # Revert a commit
            commit = action.compensate_inputs.get("commit")
            if commit:
                result = subprocess.run(
                    ["git", "revert", "--no-commit", commit],
                    cwd=repo_path,
                    capture_output=True,
                )
                return result.returncode == 0

        return False

    async def compensate_async(
        self,
        action: RollbackAction,
        context: dict[str, Any],
    ) -> bool:
        """Async git compensation."""
        return self.compensate(action, context)
