"""
Cost tracking module for marktoflow framework.

Provides token usage monitoring, API cost estimation, and cost limits.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any, Callable


class CostUnit(str, Enum):
    """Unit of cost measurement."""

    TOKENS = "tokens"
    REQUESTS = "requests"
    MINUTES = "minutes"
    CREDITS = "credits"


class CostAlertLevel(str, Enum):
    """Alert level for cost thresholds."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class ModelPricing:
    """Pricing information for an AI model.

    Prices are in USD per 1M tokens unless otherwise specified.
    """

    model_name: str
    provider: str
    input_price_per_million: Decimal
    output_price_per_million: Decimal
    currency: str = "USD"
    effective_date: datetime | None = None
    notes: str = ""

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> Decimal:
        """Calculate cost for given token usage."""
        input_cost = Decimal(input_tokens) * self.input_price_per_million / Decimal(1_000_000)
        output_cost = Decimal(output_tokens) * self.output_price_per_million / Decimal(1_000_000)
        return input_cost + output_cost

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "model_name": self.model_name,
            "provider": self.provider,
            "input_price_per_million": str(self.input_price_per_million),
            "output_price_per_million": str(self.output_price_per_million),
            "currency": self.currency,
            "effective_date": self.effective_date.isoformat() if self.effective_date else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ModelPricing:
        """Create from dictionary."""
        return cls(
            model_name=data["model_name"],
            provider=data["provider"],
            input_price_per_million=Decimal(data["input_price_per_million"]),
            output_price_per_million=Decimal(data["output_price_per_million"]),
            currency=data.get("currency", "USD"),
            effective_date=datetime.fromisoformat(data["effective_date"])
            if data.get("effective_date")
            else None,
            notes=data.get("notes", ""),
        )


# Default pricing for common models (as of 2026-01, prices may change)
DEFAULT_MODEL_PRICING: dict[str, ModelPricing] = {
    # OpenAI
    "gpt-4o": ModelPricing("gpt-4o", "openai", Decimal("2.50"), Decimal("10.00")),
    "gpt-4o-mini": ModelPricing("gpt-4o-mini", "openai", Decimal("0.15"), Decimal("0.60")),
    "gpt-4-turbo": ModelPricing("gpt-4-turbo", "openai", Decimal("10.00"), Decimal("30.00")),
    "gpt-3.5-turbo": ModelPricing("gpt-3.5-turbo", "openai", Decimal("0.50"), Decimal("1.50")),
    # Anthropic
    "claude-3-5-sonnet": ModelPricing(
        "claude-3-5-sonnet", "anthropic", Decimal("3.00"), Decimal("15.00")
    ),
    "claude-3-opus": ModelPricing("claude-3-opus", "anthropic", Decimal("15.00"), Decimal("75.00")),
    "claude-3-sonnet": ModelPricing(
        "claude-3-sonnet", "anthropic", Decimal("3.00"), Decimal("15.00")
    ),
    "claude-3-haiku": ModelPricing("claude-3-haiku", "anthropic", Decimal("0.25"), Decimal("1.25")),
    # Google
    "gemini-1.5-pro": ModelPricing("gemini-1.5-pro", "google", Decimal("3.50"), Decimal("10.50")),
    "gemini-1.5-flash": ModelPricing(
        "gemini-1.5-flash", "google", Decimal("0.075"), Decimal("0.30")
    ),
}


@dataclass
class TokenUsage:
    """Token usage for a single operation."""

    input_tokens: int
    output_tokens: int
    cached_tokens: int = 0
    reasoning_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        """Total tokens used."""
        return self.input_tokens + self.output_tokens

    def to_dict(self) -> dict[str, int]:
        """Convert to dictionary."""
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cached_tokens": self.cached_tokens,
            "reasoning_tokens": self.reasoning_tokens,
            "total_tokens": self.total_tokens,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TokenUsage:
        """Create from dictionary."""
        return cls(
            input_tokens=data.get("input_tokens", 0),
            output_tokens=data.get("output_tokens", 0),
            cached_tokens=data.get("cached_tokens", 0),
            reasoning_tokens=data.get("reasoning_tokens", 0),
        )


@dataclass
class CostRecord:
    """Record of cost incurred for an operation."""

    id: str
    timestamp: datetime
    workflow_id: str
    run_id: str
    step_name: str | None
    agent_name: str
    model_name: str
    token_usage: TokenUsage
    estimated_cost: Decimal
    currency: str = "USD"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "workflow_id": self.workflow_id,
            "run_id": self.run_id,
            "step_name": self.step_name,
            "agent_name": self.agent_name,
            "model_name": self.model_name,
            "token_usage": self.token_usage.to_dict(),
            "estimated_cost": str(self.estimated_cost),
            "currency": self.currency,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CostRecord:
        """Create from dictionary."""
        return cls(
            id=data["id"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            workflow_id=data["workflow_id"],
            run_id=data["run_id"],
            step_name=data.get("step_name"),
            agent_name=data["agent_name"],
            model_name=data["model_name"],
            token_usage=TokenUsage.from_dict(data["token_usage"]),
            estimated_cost=Decimal(data["estimated_cost"]),
            currency=data.get("currency", "USD"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class CostSummary:
    """Summary of costs over a period."""

    start_time: datetime
    end_time: datetime
    total_cost: Decimal
    total_input_tokens: int
    total_output_tokens: int
    total_requests: int
    by_workflow: dict[str, Decimal] = field(default_factory=dict)
    by_agent: dict[str, Decimal] = field(default_factory=dict)
    by_model: dict[str, Decimal] = field(default_factory=dict)
    currency: str = "USD"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "total_cost": str(self.total_cost),
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_requests": self.total_requests,
            "by_workflow": {k: str(v) for k, v in self.by_workflow.items()},
            "by_agent": {k: str(v) for k, v in self.by_agent.items()},
            "by_model": {k: str(v) for k, v in self.by_model.items()},
            "currency": self.currency,
        }


@dataclass
class CostLimit:
    """Cost limit configuration."""

    name: str
    max_cost: Decimal
    period: timedelta | None = None  # None means lifetime limit
    scope: str = "global"  # "global", "workflow", "agent", "model"
    scope_id: str | None = None  # ID for scoped limits
    alert_threshold: Decimal | None = None  # Alert when this percentage is reached
    action_on_limit: str = "warn"  # "warn", "block", "notify"


@dataclass
class CostAlert:
    """Alert triggered by cost threshold."""

    timestamp: datetime
    level: CostAlertLevel
    limit_name: str
    current_cost: Decimal
    limit_cost: Decimal
    percentage: Decimal
    message: str


class CostAlertHandler(ABC):
    """Abstract handler for cost alerts."""

    @abstractmethod
    def handle_alert(self, alert: CostAlert) -> None:
        """Handle a cost alert."""
        pass


class LoggingAlertHandler(CostAlertHandler):
    """Alert handler that logs alerts."""

    def __init__(self, log_func: Callable[[str], None] | None = None):
        self.log_func = log_func or print

    def handle_alert(self, alert: CostAlert) -> None:
        """Log the alert."""
        self.log_func(f"[{alert.level.value.upper()}] {alert.message}")


class CallbackAlertHandler(CostAlertHandler):
    """Alert handler that calls a callback function."""

    def __init__(self, callback: Callable[[CostAlert], None]):
        self.callback = callback

    def handle_alert(self, alert: CostAlert) -> None:
        """Call the callback with the alert."""
        self.callback(alert)


class PricingRegistry:
    """Registry for model pricing information."""

    def __init__(self):
        self._pricing: dict[str, ModelPricing] = {}
        self._lock = threading.Lock()
        # Load defaults
        self._pricing.update(DEFAULT_MODEL_PRICING)

    def register(self, pricing: ModelPricing) -> None:
        """Register pricing for a model."""
        with self._lock:
            self._pricing[pricing.model_name] = pricing

    def get(self, model_name: str) -> ModelPricing | None:
        """Get pricing for a model."""
        with self._lock:
            # Try exact match
            if model_name in self._pricing:
                return self._pricing[model_name]
            # Try partial match (e.g., "gpt-4o-2024-05-13" -> "gpt-4o")
            for key, pricing in self._pricing.items():
                if model_name.startswith(key):
                    return pricing
            return None

    def list_models(self) -> list[str]:
        """List all registered models."""
        with self._lock:
            return list(self._pricing.keys())

    def calculate_cost(
        self, model_name: str, input_tokens: int, output_tokens: int
    ) -> Decimal | None:
        """Calculate cost for given model and token usage."""
        pricing = self.get(model_name)
        if pricing:
            return pricing.calculate_cost(input_tokens, output_tokens)
        return None


class CostTracker:
    """Tracks costs for workflow executions."""

    def __init__(
        self,
        pricing_registry: PricingRegistry | None = None,
        alert_handlers: list[CostAlertHandler] | None = None,
    ):
        self.pricing_registry = pricing_registry or PricingRegistry()
        self.alert_handlers = alert_handlers or []
        self._records: list[CostRecord] = []
        self._limits: list[CostLimit] = []
        self._lock = threading.Lock()

    def add_alert_handler(self, handler: CostAlertHandler) -> None:
        """Add an alert handler."""
        self.alert_handlers.append(handler)

    def add_limit(self, limit: CostLimit) -> None:
        """Add a cost limit."""
        with self._lock:
            self._limits.append(limit)

    def remove_limit(self, name: str) -> bool:
        """Remove a cost limit by name."""
        with self._lock:
            for i, limit in enumerate(self._limits):
                if limit.name == name:
                    self._limits.pop(i)
                    return True
            return False

    def record_usage(
        self,
        record_id: str,
        workflow_id: str,
        run_id: str,
        agent_name: str,
        model_name: str,
        token_usage: TokenUsage,
        step_name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CostRecord:
        """Record token usage and calculate cost."""
        # Calculate cost
        cost = self.pricing_registry.calculate_cost(
            model_name, token_usage.input_tokens, token_usage.output_tokens
        )
        if cost is None:
            cost = Decimal("0")

        record = CostRecord(
            id=record_id,
            timestamp=datetime.now(),
            workflow_id=workflow_id,
            run_id=run_id,
            step_name=step_name,
            agent_name=agent_name,
            model_name=model_name,
            token_usage=token_usage,
            estimated_cost=cost,
            metadata=metadata or {},
        )

        with self._lock:
            self._records.append(record)

        # Check limits
        self._check_limits(record)

        return record

    def _check_limits(self, record: CostRecord) -> None:
        """Check if any limits are exceeded after recording."""
        with self._lock:
            for limit in self._limits:
                # Calculate current usage for this limit
                current_cost = self._calculate_limit_usage(limit)
                percentage = (
                    (current_cost / limit.max_cost) * 100 if limit.max_cost > 0 else Decimal(0)
                )

                # Check alert threshold
                if limit.alert_threshold and percentage >= limit.alert_threshold:
                    level = CostAlertLevel.WARNING
                    if percentage >= Decimal(100):
                        level = CostAlertLevel.CRITICAL

                    alert = CostAlert(
                        timestamp=datetime.now(),
                        level=level,
                        limit_name=limit.name,
                        current_cost=current_cost,
                        limit_cost=limit.max_cost,
                        percentage=percentage,
                        message=f"Cost limit '{limit.name}' at {percentage:.1f}%: ${current_cost:.4f} / ${limit.max_cost:.4f}",
                    )

                    # Fire alert handlers (outside lock would be better, but keeping simple)
                    for handler in self.alert_handlers:
                        try:
                            handler.handle_alert(alert)
                        except Exception:
                            pass  # Don't let handler errors break tracking

    def _calculate_limit_usage(self, limit: CostLimit) -> Decimal:
        """Calculate current usage against a limit."""
        now = datetime.now()
        start_time = now - limit.period if limit.period else datetime.min

        total = Decimal("0")
        for record in self._records:
            if record.timestamp < start_time:
                continue

            # Check scope
            if limit.scope == "workflow" and limit.scope_id:
                if record.workflow_id != limit.scope_id:
                    continue
            elif limit.scope == "agent" and limit.scope_id:
                if record.agent_name != limit.scope_id:
                    continue
            elif limit.scope == "model" and limit.scope_id:
                if record.model_name != limit.scope_id:
                    continue

            total += record.estimated_cost

        return total

    def get_records(
        self,
        workflow_id: str | None = None,
        run_id: str | None = None,
        agent_name: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[CostRecord]:
        """Get cost records with optional filtering."""
        with self._lock:
            records = self._records.copy()

        result = []
        for record in records:
            if workflow_id and record.workflow_id != workflow_id:
                continue
            if run_id and record.run_id != run_id:
                continue
            if agent_name and record.agent_name != agent_name:
                continue
            if start_time and record.timestamp < start_time:
                continue
            if end_time and record.timestamp > end_time:
                continue
            result.append(record)

        return result

    def get_summary(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> CostSummary:
        """Get a summary of costs over a period."""
        now = datetime.now()
        start = start_time or datetime.min
        end = end_time or now

        records = self.get_records(start_time=start, end_time=end)

        total_cost = Decimal("0")
        total_input = 0
        total_output = 0
        by_workflow: dict[str, Decimal] = {}
        by_agent: dict[str, Decimal] = {}
        by_model: dict[str, Decimal] = {}

        for record in records:
            total_cost += record.estimated_cost
            total_input += record.token_usage.input_tokens
            total_output += record.token_usage.output_tokens

            # Aggregate by dimensions
            by_workflow[record.workflow_id] = (
                by_workflow.get(record.workflow_id, Decimal("0")) + record.estimated_cost
            )
            by_agent[record.agent_name] = (
                by_agent.get(record.agent_name, Decimal("0")) + record.estimated_cost
            )
            by_model[record.model_name] = (
                by_model.get(record.model_name, Decimal("0")) + record.estimated_cost
            )

        return CostSummary(
            start_time=start,
            end_time=end,
            total_cost=total_cost,
            total_input_tokens=total_input,
            total_output_tokens=total_output,
            total_requests=len(records),
            by_workflow=by_workflow,
            by_agent=by_agent,
            by_model=by_model,
        )

    def get_workflow_cost(self, workflow_id: str, run_id: str | None = None) -> Decimal:
        """Get total cost for a workflow (optionally for a specific run)."""
        records = self.get_records(workflow_id=workflow_id, run_id=run_id)
        return sum((r.estimated_cost for r in records), Decimal("0"))

    def clear(self) -> None:
        """Clear all records."""
        with self._lock:
            self._records.clear()


class CostStore:
    """Persistent storage for cost records using SQLite."""

    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the database schema."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cost_records (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    workflow_id TEXT NOT NULL,
                    run_id TEXT NOT NULL,
                    step_name TEXT,
                    agent_name TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    input_tokens INTEGER NOT NULL,
                    output_tokens INTEGER NOT NULL,
                    cached_tokens INTEGER DEFAULT 0,
                    reasoning_tokens INTEGER DEFAULT 0,
                    estimated_cost TEXT NOT NULL,
                    currency TEXT DEFAULT 'USD',
                    metadata TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cost_workflow_id ON cost_records(workflow_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_records(timestamp)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_records(agent_name)
            """)
            conn.commit()

    def save(self, record: CostRecord) -> None:
        """Save a cost record."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO cost_records
                (id, timestamp, workflow_id, run_id, step_name, agent_name, model_name,
                 input_tokens, output_tokens, cached_tokens, reasoning_tokens,
                 estimated_cost, currency, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.timestamp.isoformat(),
                    record.workflow_id,
                    record.run_id,
                    record.step_name,
                    record.agent_name,
                    record.model_name,
                    record.token_usage.input_tokens,
                    record.token_usage.output_tokens,
                    record.token_usage.cached_tokens,
                    record.token_usage.reasoning_tokens,
                    str(record.estimated_cost),
                    record.currency,
                    json.dumps(record.metadata) if record.metadata else None,
                ),
            )
            conn.commit()

    def get(self, record_id: str) -> CostRecord | None:
        """Get a cost record by ID."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM cost_records WHERE id = ?", (record_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_record(row)
            return None

    def query(
        self,
        workflow_id: str | None = None,
        run_id: str | None = None,
        agent_name: str | None = None,
        model_name: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int | None = None,
    ) -> list[CostRecord]:
        """Query cost records with filtering."""
        conditions = []
        params: list[Any] = []

        if workflow_id:
            conditions.append("workflow_id = ?")
            params.append(workflow_id)
        if run_id:
            conditions.append("run_id = ?")
            params.append(run_id)
        if agent_name:
            conditions.append("agent_name = ?")
            params.append(agent_name)
        if model_name:
            conditions.append("model_name = ?")
            params.append(model_name)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time.isoformat())

        query = "SELECT * FROM cost_records"
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY timestamp DESC"
        if limit:
            query += f" LIMIT {limit}"

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            return [self._row_to_record(row) for row in cursor.fetchall()]

    def _row_to_record(self, row: sqlite3.Row) -> CostRecord:
        """Convert a database row to a CostRecord."""
        return CostRecord(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            workflow_id=row["workflow_id"],
            run_id=row["run_id"],
            step_name=row["step_name"],
            agent_name=row["agent_name"],
            model_name=row["model_name"],
            token_usage=TokenUsage(
                input_tokens=row["input_tokens"],
                output_tokens=row["output_tokens"],
                cached_tokens=row["cached_tokens"] or 0,
                reasoning_tokens=row["reasoning_tokens"] or 0,
            ),
            estimated_cost=Decimal(row["estimated_cost"]),
            currency=row["currency"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
        )

    def get_summary(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> CostSummary:
        """Get aggregated summary from database."""
        conditions = []
        params: list[Any] = []

        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time.isoformat())
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time.isoformat())

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""

        with sqlite3.connect(self.db_path) as conn:
            # Total aggregates
            cursor = conn.execute(
                f"""
                SELECT
                    COALESCE(SUM(CAST(estimated_cost AS REAL)), 0) as total_cost,
                    COALESCE(SUM(input_tokens), 0) as total_input,
                    COALESCE(SUM(output_tokens), 0) as total_output,
                    COUNT(*) as total_requests,
                    MIN(timestamp) as min_time,
                    MAX(timestamp) as max_time
                FROM cost_records
                {where_clause}
                """,
                params,
            )
            row = cursor.fetchone()

            # By workflow
            cursor = conn.execute(
                f"""
                SELECT workflow_id, SUM(CAST(estimated_cost AS REAL)) as cost
                FROM cost_records
                {where_clause}
                GROUP BY workflow_id
                """,
                params,
            )
            by_workflow = {row[0]: Decimal(str(row[1])) for row in cursor.fetchall()}

            # By agent
            cursor = conn.execute(
                f"""
                SELECT agent_name, SUM(CAST(estimated_cost AS REAL)) as cost
                FROM cost_records
                {where_clause}
                GROUP BY agent_name
                """,
                params,
            )
            by_agent = {row[0]: Decimal(str(row[1])) for row in cursor.fetchall()}

            # By model
            cursor = conn.execute(
                f"""
                SELECT model_name, SUM(CAST(estimated_cost AS REAL)) as cost
                FROM cost_records
                {where_clause}
                GROUP BY model_name
                """,
                params,
            )
            by_model = {row[0]: Decimal(str(row[1])) for row in cursor.fetchall()}

            return CostSummary(
                start_time=datetime.fromisoformat(row[4])
                if row[4]
                else (start_time or datetime.min),
                end_time=datetime.fromisoformat(row[5]) if row[5] else (end_time or datetime.now()),
                total_cost=Decimal(str(row[0])),
                total_input_tokens=int(row[1]),
                total_output_tokens=int(row[2]),
                total_requests=int(row[3]),
                by_workflow=by_workflow,
                by_agent=by_agent,
                by_model=by_model,
            )

    def delete_before(self, before: datetime) -> int:
        """Delete records older than a given time. Returns count deleted."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM cost_records WHERE timestamp < ?",
                (before.isoformat(),),
            )
            conn.commit()
            return cursor.rowcount


class PersistentCostTracker(CostTracker):
    """Cost tracker with persistent storage."""

    def __init__(
        self,
        store: CostStore,
        pricing_registry: PricingRegistry | None = None,
        alert_handlers: list[CostAlertHandler] | None = None,
    ):
        super().__init__(pricing_registry, alert_handlers)
        self.store = store

    def record_usage(
        self,
        record_id: str,
        workflow_id: str,
        run_id: str,
        agent_name: str,
        model_name: str,
        token_usage: TokenUsage,
        step_name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CostRecord:
        """Record usage and persist to store."""
        record = super().record_usage(
            record_id=record_id,
            workflow_id=workflow_id,
            run_id=run_id,
            agent_name=agent_name,
            model_name=model_name,
            token_usage=token_usage,
            step_name=step_name,
            metadata=metadata,
        )
        self.store.save(record)
        return record

    def get_summary(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> CostSummary:
        """Get summary from persistent store."""
        return self.store.get_summary(start_time, end_time)


class WorkflowCostEstimator:
    """Estimates costs for workflow execution before running."""

    def __init__(self, pricing_registry: PricingRegistry | None = None):
        self.pricing_registry = pricing_registry or PricingRegistry()

    def estimate_step_cost(
        self,
        model_name: str,
        estimated_input_tokens: int,
        estimated_output_tokens: int,
    ) -> Decimal | None:
        """Estimate cost for a single step."""
        return self.pricing_registry.calculate_cost(
            model_name, estimated_input_tokens, estimated_output_tokens
        )

    def estimate_workflow_cost(
        self,
        model_name: str,
        step_count: int,
        avg_input_tokens_per_step: int = 1000,
        avg_output_tokens_per_step: int = 500,
    ) -> Decimal | None:
        """Estimate total cost for a workflow."""
        step_cost = self.estimate_step_cost(
            model_name, avg_input_tokens_per_step, avg_output_tokens_per_step
        )
        if step_cost is not None:
            return step_cost * step_count
        return None

    def compare_models(
        self,
        models: list[str],
        input_tokens: int,
        output_tokens: int,
    ) -> dict[str, Decimal | None]:
        """Compare costs across multiple models."""
        return {
            model: self.pricing_registry.calculate_cost(model, input_tokens, output_tokens)
            for model in models
        }
