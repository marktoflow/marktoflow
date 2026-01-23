"""
State persistence for marktoflow framework.

Provides SQLite-based state storage for workflow checkpoints,
execution history, and recovery.
"""

from __future__ import annotations

import json
import sqlite3
import logging
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Generator

logger = logging.getLogger(__name__)


class ExecutionStatus(Enum):
    """Status of a workflow execution."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


@dataclass
class ExecutionRecord:
    """Record of a workflow execution."""

    run_id: str
    workflow_id: str
    workflow_path: str
    status: ExecutionStatus
    started_at: datetime
    completed_at: datetime | None = None
    current_step: int = 0
    total_steps: int = 0
    agent: str | None = None
    inputs: dict[str, Any] | None = None
    outputs: dict[str, Any] | None = None
    error: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for storage."""
        data = asdict(self)
        data["status"] = self.status.value
        data["started_at"] = self.started_at.isoformat()
        data["completed_at"] = self.completed_at.isoformat() if self.completed_at else None
        data["inputs"] = json.dumps(self.inputs) if self.inputs else None
        data["outputs"] = json.dumps(self.outputs) if self.outputs else None
        data["metadata"] = json.dumps(self.metadata) if self.metadata else None
        return data

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "ExecutionRecord":
        """Create from database row."""
        return cls(
            run_id=row["run_id"],
            workflow_id=row["workflow_id"],
            workflow_path=row["workflow_path"],
            status=ExecutionStatus(row["status"]),
            started_at=datetime.fromisoformat(row["started_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"])
            if row["completed_at"]
            else None,
            current_step=row["current_step"],
            total_steps=row["total_steps"],
            agent=row["agent"],
            inputs=json.loads(row["inputs"]) if row["inputs"] else None,
            outputs=json.loads(row["outputs"]) if row["outputs"] else None,
            error=row["error"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else None,
        )


@dataclass
class StepCheckpoint:
    """Checkpoint for a workflow step."""

    run_id: str
    step_index: int
    step_name: str
    status: ExecutionStatus
    started_at: datetime
    completed_at: datetime | None = None
    inputs: dict[str, Any] | None = None
    outputs: dict[str, Any] | None = None
    error: str | None = None
    retry_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "run_id": self.run_id,
            "step_index": self.step_index,
            "step_name": self.step_name,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "inputs": json.dumps(self.inputs) if self.inputs else None,
            "outputs": json.dumps(self.outputs) if self.outputs else None,
            "error": self.error,
            "retry_count": self.retry_count,
        }

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "StepCheckpoint":
        """Create from database row."""
        return cls(
            run_id=row["run_id"],
            step_index=row["step_index"],
            step_name=row["step_name"],
            status=ExecutionStatus(row["status"]),
            started_at=datetime.fromisoformat(row["started_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"])
            if row["completed_at"]
            else None,
            inputs=json.loads(row["inputs"]) if row["inputs"] else None,
            outputs=json.loads(row["outputs"]) if row["outputs"] else None,
            error=row["error"],
            retry_count=row["retry_count"],
        )


class StateStore:
    """
    SQLite-based state store for workflow execution.

    Provides:
    - Execution history tracking
    - Step-level checkpoints for recovery
    - Query capabilities for monitoring
    """

    SCHEMA_VERSION = 1

    def __init__(
        self,
        db_path: str | Path = ".marktoflow/state/workflow-state/state.db",
    ) -> None:
        """
        Initialize the state store.

        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Get a database connection with row factory."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Initialize database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Schema version table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY
                )
            """)

            # Check if we need to create/migrate
            cursor.execute("SELECT version FROM schema_version LIMIT 1")
            row = cursor.fetchone()

            if row is None:
                # Fresh database, create schema
                self._create_schema(cursor)
                cursor.execute(
                    "INSERT INTO schema_version (version) VALUES (?)", (self.SCHEMA_VERSION,)
                )
            elif row["version"] < self.SCHEMA_VERSION:
                # Need migration
                self._migrate_schema(cursor, row["version"])

    def _create_schema(self, cursor: sqlite3.Cursor) -> None:
        """Create database tables."""
        # Executions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS executions (
                run_id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                workflow_path TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                current_step INTEGER DEFAULT 0,
                total_steps INTEGER DEFAULT 0,
                agent TEXT,
                inputs TEXT,
                outputs TEXT,
                error TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Checkpoints table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS checkpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                step_index INTEGER NOT NULL,
                step_name TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                inputs TEXT,
                outputs TEXT,
                error TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES executions(run_id),
                UNIQUE(run_id, step_index)
            )
        """)

        # Indexes for common queries
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id)"
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status)")
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at)"
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_checkpoints_run_id ON checkpoints(run_id)")

    def _migrate_schema(self, cursor: sqlite3.Cursor, from_version: int) -> None:
        """Migrate schema from older version."""
        # Add migration logic here as needed
        logger.info(f"Migrating schema from version {from_version} to {self.SCHEMA_VERSION}")
        cursor.execute("UPDATE schema_version SET version = ?", (self.SCHEMA_VERSION,))

    # Execution management

    def create_execution(self, record: ExecutionRecord) -> None:
        """Create a new execution record."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = record.to_dict()
            cursor.execute(
                """
                INSERT INTO executions (
                    run_id, workflow_id, workflow_path, status, started_at,
                    completed_at, current_step, total_steps, agent, inputs,
                    outputs, error, metadata
                ) VALUES (
                    :run_id, :workflow_id, :workflow_path, :status, :started_at,
                    :completed_at, :current_step, :total_steps, :agent, :inputs,
                    :outputs, :error, :metadata
                )
            """,
                data,
            )

    def update_execution(self, record: ExecutionRecord) -> None:
        """Update an existing execution record."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = record.to_dict()
            cursor.execute(
                """
                UPDATE executions SET
                    status = :status,
                    completed_at = :completed_at,
                    current_step = :current_step,
                    outputs = :outputs,
                    error = :error,
                    metadata = :metadata
                WHERE run_id = :run_id
            """,
                data,
            )

    def get_execution(self, run_id: str) -> ExecutionRecord | None:
        """Get an execution record by run ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM executions WHERE run_id = ?", (run_id,))
            row = cursor.fetchone()
            return ExecutionRecord.from_row(row) if row else None

    def list_executions(
        self,
        workflow_id: str | None = None,
        status: ExecutionStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ExecutionRecord]:
        """List execution records with optional filters."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            query = "SELECT * FROM executions WHERE 1=1"
            params: list[Any] = []

            if workflow_id:
                query += " AND workflow_id = ?"
                params.append(workflow_id)

            if status:
                query += " AND status = ?"
                params.append(status.value)

            query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])

            cursor.execute(query, params)
            return [ExecutionRecord.from_row(row) for row in cursor.fetchall()]

    def get_running_executions(self) -> list[ExecutionRecord]:
        """Get all currently running executions."""
        return self.list_executions(status=ExecutionStatus.RUNNING)

    def get_failed_executions(
        self,
        workflow_id: str | None = None,
        limit: int = 100,
    ) -> list[ExecutionRecord]:
        """Get failed executions for potential retry."""
        return self.list_executions(
            workflow_id=workflow_id,
            status=ExecutionStatus.FAILED,
            limit=limit,
        )

    # Checkpoint management

    def save_checkpoint(self, checkpoint: StepCheckpoint) -> None:
        """Save or update a step checkpoint."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            data = checkpoint.to_dict()
            cursor.execute(
                """
                INSERT OR REPLACE INTO checkpoints (
                    run_id, step_index, step_name, status, started_at,
                    completed_at, inputs, outputs, error, retry_count
                ) VALUES (
                    :run_id, :step_index, :step_name, :status, :started_at,
                    :completed_at, :inputs, :outputs, :error, :retry_count
                )
            """,
                data,
            )

    def get_checkpoints(self, run_id: str) -> list[StepCheckpoint]:
        """Get all checkpoints for an execution."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM checkpoints WHERE run_id = ? ORDER BY step_index", (run_id,)
            )
            return [StepCheckpoint.from_row(row) for row in cursor.fetchall()]

    def get_last_checkpoint(self, run_id: str) -> StepCheckpoint | None:
        """Get the last checkpoint for an execution."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM checkpoints WHERE run_id = ? ORDER BY step_index DESC LIMIT 1",
                (run_id,),
            )
            row = cursor.fetchone()
            return StepCheckpoint.from_row(row) if row else None

    def get_resume_point(self, run_id: str) -> int:
        """
        Get the step index to resume from after a failure.

        Returns:
            Step index to resume from (0 if should restart)
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Find the last successful step
            cursor.execute(
                """
                SELECT MAX(step_index) as last_success
                FROM checkpoints
                WHERE run_id = ? AND status = 'completed'
            """,
                (run_id,),
            )

            row = cursor.fetchone()
            if row and row["last_success"] is not None:
                # Resume from the next step
                return row["last_success"] + 1

            return 0

    # Cleanup

    def cleanup_old_records(self, days: int = 30) -> int:
        """
        Delete execution records older than specified days.

        Args:
            days: Number of days to retain

        Returns:
            Number of records deleted
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Calculate cutoff date
            cutoff = datetime.now() - timedelta(days=days)

            # Delete old checkpoints first (foreign key)
            cursor.execute(
                """
                DELETE FROM checkpoints
                WHERE run_id IN (
                    SELECT run_id FROM executions
                    WHERE started_at < ?
                )
            """,
                (cutoff.isoformat(),),
            )

            # Delete old executions
            cursor.execute("DELETE FROM executions WHERE started_at < ?", (cutoff.isoformat(),))

            return cursor.rowcount

    # Statistics

    def get_stats(self, workflow_id: str | None = None) -> dict[str, Any]:
        """Get execution statistics."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            where_clause = "WHERE workflow_id = ?" if workflow_id else ""
            params = [workflow_id] if workflow_id else []

            # Total executions
            cursor.execute(f"SELECT COUNT(*) as total FROM executions {where_clause}", params)
            total = cursor.fetchone()["total"]

            # By status
            cursor.execute(
                f"""
                SELECT status, COUNT(*) as count
                FROM executions {where_clause}
                GROUP BY status
            """,
                params,
            )
            by_status = {row["status"]: row["count"] for row in cursor.fetchall()}

            # Success rate
            completed = by_status.get("completed", 0)
            failed = by_status.get("failed", 0)
            success_rate = completed / (completed + failed) if (completed + failed) > 0 else 0

            return {
                "total_executions": total,
                "by_status": by_status,
                "success_rate": round(success_rate * 100, 2),
                "completed": completed,
                "failed": failed,
                "running": by_status.get("running", 0),
            }
