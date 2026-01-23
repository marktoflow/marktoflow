"""
Tests for the cost tracking module.
"""

import tempfile
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

from marktoflow.core.costs import (
    CallbackAlertHandler,
    CostAlert,
    CostAlertLevel,
    CostLimit,
    CostRecord,
    CostStore,
    CostSummary,
    CostTracker,
    CostUnit,
    LoggingAlertHandler,
    ModelPricing,
    PersistentCostTracker,
    PricingRegistry,
    TokenUsage,
    WorkflowCostEstimator,
    DEFAULT_MODEL_PRICING,
)


class TestCostUnit:
    """Tests for CostUnit enum."""

    def test_cost_unit_values(self):
        """Test cost unit values."""
        assert CostUnit.TOKENS.value == "tokens"
        assert CostUnit.REQUESTS.value == "requests"
        assert CostUnit.MINUTES.value == "minutes"
        assert CostUnit.CREDITS.value == "credits"


class TestCostAlertLevel:
    """Tests for CostAlertLevel enum."""

    def test_alert_level_values(self):
        """Test alert level values."""
        assert CostAlertLevel.INFO.value == "info"
        assert CostAlertLevel.WARNING.value == "warning"
        assert CostAlertLevel.CRITICAL.value == "critical"


class TestModelPricing:
    """Tests for ModelPricing dataclass."""

    def test_create_pricing(self):
        """Test creating model pricing."""
        pricing = ModelPricing(
            model_name="test-model",
            provider="test-provider",
            input_price_per_million=Decimal("1.00"),
            output_price_per_million=Decimal("2.00"),
        )
        assert pricing.model_name == "test-model"
        assert pricing.provider == "test-provider"
        assert pricing.currency == "USD"

    def test_calculate_cost(self):
        """Test cost calculation."""
        pricing = ModelPricing(
            model_name="test-model",
            provider="test-provider",
            input_price_per_million=Decimal("1.00"),
            output_price_per_million=Decimal("2.00"),
        )
        # 1M input tokens at $1/M = $1, 1M output at $2/M = $2
        cost = pricing.calculate_cost(1_000_000, 1_000_000)
        assert cost == Decimal("3.00")

        # 1000 tokens input, 500 output
        cost = pricing.calculate_cost(1000, 500)
        expected = Decimal("1000") * Decimal("1.00") / Decimal("1000000") + Decimal(
            "500"
        ) * Decimal("2.00") / Decimal("1000000")
        assert cost == expected

    def test_to_dict_from_dict(self):
        """Test serialization round-trip."""
        pricing = ModelPricing(
            model_name="test-model",
            provider="test-provider",
            input_price_per_million=Decimal("1.50"),
            output_price_per_million=Decimal("3.00"),
            effective_date=datetime(2026, 1, 1),
            notes="Test notes",
        )
        data = pricing.to_dict()
        restored = ModelPricing.from_dict(data)
        assert restored.model_name == pricing.model_name
        assert restored.input_price_per_million == pricing.input_price_per_million
        assert restored.notes == pricing.notes


class TestTokenUsage:
    """Tests for TokenUsage dataclass."""

    def test_create_usage(self):
        """Test creating token usage."""
        usage = TokenUsage(input_tokens=100, output_tokens=50)
        assert usage.input_tokens == 100
        assert usage.output_tokens == 50
        assert usage.total_tokens == 150

    def test_usage_with_cached(self):
        """Test usage with cached tokens."""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            cached_tokens=25,
            reasoning_tokens=10,
        )
        assert usage.total_tokens == 150
        assert usage.cached_tokens == 25
        assert usage.reasoning_tokens == 10

    def test_to_dict_from_dict(self):
        """Test serialization round-trip."""
        usage = TokenUsage(input_tokens=100, output_tokens=50, cached_tokens=20)
        data = usage.to_dict()
        restored = TokenUsage.from_dict(data)
        assert restored.input_tokens == usage.input_tokens
        assert restored.output_tokens == usage.output_tokens
        assert restored.cached_tokens == usage.cached_tokens


class TestCostRecord:
    """Tests for CostRecord dataclass."""

    def test_create_record(self):
        """Test creating a cost record."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)
        record = CostRecord(
            id="record-1",
            timestamp=datetime.now(),
            workflow_id="workflow-1",
            run_id="run-1",
            step_name="step-1",
            agent_name="claude",
            model_name="claude-3-sonnet",
            token_usage=usage,
            estimated_cost=Decimal("0.005"),
        )
        assert record.id == "record-1"
        assert record.token_usage.total_tokens == 1500

    def test_to_dict_from_dict(self):
        """Test serialization round-trip."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)
        record = CostRecord(
            id="record-1",
            timestamp=datetime.now(),
            workflow_id="workflow-1",
            run_id="run-1",
            step_name="step-1",
            agent_name="claude",
            model_name="claude-3-sonnet",
            token_usage=usage,
            estimated_cost=Decimal("0.005"),
            metadata={"key": "value"},
        )
        data = record.to_dict()
        restored = CostRecord.from_dict(data)
        assert restored.id == record.id
        assert restored.estimated_cost == record.estimated_cost
        assert restored.metadata == record.metadata


class TestCostSummary:
    """Tests for CostSummary dataclass."""

    def test_create_summary(self):
        """Test creating a cost summary."""
        summary = CostSummary(
            start_time=datetime.now() - timedelta(days=1),
            end_time=datetime.now(),
            total_cost=Decimal("10.50"),
            total_input_tokens=100000,
            total_output_tokens=50000,
            total_requests=100,
            by_workflow={"wf-1": Decimal("5.25"), "wf-2": Decimal("5.25")},
            by_agent={"claude": Decimal("10.50")},
            by_model={"claude-3-sonnet": Decimal("10.50")},
        )
        assert summary.total_cost == Decimal("10.50")
        assert summary.total_requests == 100

    def test_to_dict(self):
        """Test serialization."""
        summary = CostSummary(
            start_time=datetime.now(),
            end_time=datetime.now(),
            total_cost=Decimal("5.00"),
            total_input_tokens=10000,
            total_output_tokens=5000,
            total_requests=10,
        )
        data = summary.to_dict()
        assert data["total_cost"] == "5.00"
        assert data["total_requests"] == 10


class TestPricingRegistry:
    """Tests for PricingRegistry."""

    def test_default_pricing(self):
        """Test that default pricing is loaded."""
        registry = PricingRegistry()
        assert "gpt-4o" in registry.list_models()
        assert "claude-3-5-sonnet" in registry.list_models()

    def test_register_custom_pricing(self):
        """Test registering custom pricing."""
        registry = PricingRegistry()
        pricing = ModelPricing(
            model_name="custom-model",
            provider="custom",
            input_price_per_million=Decimal("0.50"),
            output_price_per_million=Decimal("1.00"),
        )
        registry.register(pricing)
        assert "custom-model" in registry.list_models()
        assert registry.get("custom-model") is not None

    def test_partial_match(self):
        """Test partial model name matching."""
        registry = PricingRegistry()
        # Should match "gpt-4o" for "gpt-4o-2024-05-13"
        pricing = registry.get("gpt-4o-2024-05-13")
        assert pricing is not None
        assert pricing.model_name == "gpt-4o"

    def test_calculate_cost(self):
        """Test cost calculation through registry."""
        registry = PricingRegistry()
        cost = registry.calculate_cost("gpt-4o", 1000, 500)
        assert cost is not None
        assert cost > 0

    def test_unknown_model_returns_none(self):
        """Test that unknown model returns None."""
        registry = PricingRegistry()
        assert registry.get("unknown-model") is None
        assert registry.calculate_cost("unknown-model", 1000, 500) is None


class TestCostTracker:
    """Tests for CostTracker."""

    def test_record_usage(self):
        """Test recording usage."""
        tracker = CostTracker()
        usage = TokenUsage(input_tokens=1000, output_tokens=500)
        record = tracker.record_usage(
            record_id=str(uuid.uuid4()),
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
            step_name="step-1",
        )
        assert record.estimated_cost > 0

    def test_get_records_filtering(self):
        """Test filtering records."""
        tracker = CostTracker()
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        # Record for workflow 1
        tracker.record_usage(
            record_id="r1",
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
        )
        # Record for workflow 2
        tracker.record_usage(
            record_id="r2",
            workflow_id="wf-2",
            run_id="run-2",
            agent_name="opencode",
            model_name="gpt-4o",
            token_usage=usage,
        )

        wf1_records = tracker.get_records(workflow_id="wf-1")
        assert len(wf1_records) == 1
        assert wf1_records[0].workflow_id == "wf-1"

        claude_records = tracker.get_records(agent_name="claude")
        assert len(claude_records) == 1

    def test_get_summary(self):
        """Test getting summary."""
        tracker = CostTracker()
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        for i in range(5):
            tracker.record_usage(
                record_id=f"r{i}",
                workflow_id="wf-1" if i < 3 else "wf-2",
                run_id=f"run-{i}",
                agent_name="claude",
                model_name="claude-3-5-sonnet",
                token_usage=usage,
            )

        summary = tracker.get_summary()
        assert summary.total_requests == 5
        assert len(summary.by_workflow) == 2
        assert "wf-1" in summary.by_workflow
        assert "wf-2" in summary.by_workflow

    def test_get_workflow_cost(self):
        """Test getting workflow cost."""
        tracker = CostTracker()
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        tracker.record_usage(
            record_id="r1",
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
        )
        tracker.record_usage(
            record_id="r2",
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
        )

        cost = tracker.get_workflow_cost("wf-1")
        records = tracker.get_records(workflow_id="wf-1")
        expected = sum(r.estimated_cost for r in records)
        assert cost == expected

    def test_clear(self):
        """Test clearing records."""
        tracker = CostTracker()
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        tracker.record_usage(
            record_id="r1",
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
        )

        assert len(tracker.get_records()) == 1
        tracker.clear()
        assert len(tracker.get_records()) == 0


class TestCostLimits:
    """Tests for cost limits and alerts."""

    def test_add_remove_limit(self):
        """Test adding and removing limits."""
        tracker = CostTracker()
        limit = CostLimit(
            name="daily-limit",
            max_cost=Decimal("10.00"),
            period=timedelta(days=1),
        )
        tracker.add_limit(limit)
        assert tracker.remove_limit("daily-limit")
        assert not tracker.remove_limit("nonexistent")

    def test_alert_on_threshold(self):
        """Test that alerts are triggered on threshold."""
        alerts: list[CostAlert] = []

        def capture_alert(alert: CostAlert):
            alerts.append(alert)

        tracker = CostTracker(alert_handlers=[CallbackAlertHandler(capture_alert)])
        limit = CostLimit(
            name="test-limit",
            max_cost=Decimal("0.01"),  # Very low limit
            period=timedelta(days=1),
            alert_threshold=Decimal("50"),  # Alert at 50%
        )
        tracker.add_limit(limit)

        usage = TokenUsage(input_tokens=10000, output_tokens=5000)
        tracker.record_usage(
            record_id="r1",
            workflow_id="wf-1",
            run_id="run-1",
            agent_name="claude",
            model_name="claude-3-5-sonnet",
            token_usage=usage,
        )

        assert len(alerts) >= 1
        assert alerts[0].level in (CostAlertLevel.WARNING, CostAlertLevel.CRITICAL)


class TestAlertHandlers:
    """Tests for alert handlers."""

    def test_logging_handler(self):
        """Test logging alert handler."""
        logs: list[str] = []
        handler = LoggingAlertHandler(log_func=logs.append)

        alert = CostAlert(
            timestamp=datetime.now(),
            level=CostAlertLevel.WARNING,
            limit_name="test",
            current_cost=Decimal("5.00"),
            limit_cost=Decimal("10.00"),
            percentage=Decimal("50"),
            message="Test alert",
        )
        handler.handle_alert(alert)
        assert len(logs) == 1
        assert "WARNING" in logs[0]

    def test_callback_handler(self):
        """Test callback alert handler."""
        alerts: list[CostAlert] = []
        handler = CallbackAlertHandler(callback=alerts.append)

        alert = CostAlert(
            timestamp=datetime.now(),
            level=CostAlertLevel.INFO,
            limit_name="test",
            current_cost=Decimal("1.00"),
            limit_cost=Decimal("10.00"),
            percentage=Decimal("10"),
            message="Test",
        )
        handler.handle_alert(alert)
        assert len(alerts) == 1
        assert alerts[0].level == CostAlertLevel.INFO


class TestCostStore:
    """Tests for CostStore."""

    @pytest.fixture
    def store(self):
        """Create a temporary store."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield CostStore(Path(tmpdir) / "costs.db")

    def test_save_and_get(self, store):
        """Test saving and retrieving a record."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)
        record = CostRecord(
            id="r1",
            timestamp=datetime.now(),
            workflow_id="wf-1",
            run_id="run-1",
            step_name="step-1",
            agent_name="claude",
            model_name="claude-3-sonnet",
            token_usage=usage,
            estimated_cost=Decimal("0.005"),
            metadata={"key": "value"},
        )
        store.save(record)

        retrieved = store.get("r1")
        assert retrieved is not None
        assert retrieved.id == "r1"
        assert retrieved.estimated_cost == Decimal("0.005")
        assert retrieved.metadata == {"key": "value"}

    def test_query(self, store):
        """Test querying records."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        for i in range(5):
            record = CostRecord(
                id=f"r{i}",
                timestamp=datetime.now() - timedelta(hours=i),
                workflow_id="wf-1" if i < 3 else "wf-2",
                run_id=f"run-{i}",
                step_name=None,
                agent_name="claude" if i % 2 == 0 else "opencode",
                model_name="claude-3-sonnet",
                token_usage=usage,
                estimated_cost=Decimal("0.005"),
            )
            store.save(record)

        # Query by workflow
        wf1_records = store.query(workflow_id="wf-1")
        assert len(wf1_records) == 3

        # Query by agent
        claude_records = store.query(agent_name="claude")
        assert len(claude_records) == 3

        # Query with limit
        limited = store.query(limit=2)
        assert len(limited) == 2

    def test_get_summary(self, store):
        """Test getting summary from store."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        for i in range(3):
            record = CostRecord(
                id=f"r{i}",
                timestamp=datetime.now(),
                workflow_id="wf-1",
                run_id=f"run-{i}",
                step_name=None,
                agent_name="claude",
                model_name="claude-3-sonnet",
                token_usage=usage,
                estimated_cost=Decimal("0.010"),
            )
            store.save(record)

        summary = store.get_summary()
        assert summary.total_requests == 3
        assert summary.total_cost == Decimal("0.030")

    def test_delete_before(self, store):
        """Test deleting old records."""
        usage = TokenUsage(input_tokens=1000, output_tokens=500)

        # Old record
        old_record = CostRecord(
            id="old",
            timestamp=datetime.now() - timedelta(days=30),
            workflow_id="wf-1",
            run_id="run-1",
            step_name=None,
            agent_name="claude",
            model_name="claude-3-sonnet",
            token_usage=usage,
            estimated_cost=Decimal("0.005"),
        )
        store.save(old_record)

        # New record
        new_record = CostRecord(
            id="new",
            timestamp=datetime.now(),
            workflow_id="wf-1",
            run_id="run-2",
            step_name=None,
            agent_name="claude",
            model_name="claude-3-sonnet",
            token_usage=usage,
            estimated_cost=Decimal("0.005"),
        )
        store.save(new_record)

        deleted = store.delete_before(datetime.now() - timedelta(days=7))
        assert deleted == 1
        assert store.get("old") is None
        assert store.get("new") is not None


class TestPersistentCostTracker:
    """Tests for PersistentCostTracker."""

    def test_record_persists(self):
        """Test that records are persisted."""
        with tempfile.TemporaryDirectory() as tmpdir:
            store = CostStore(Path(tmpdir) / "costs.db")
            tracker = PersistentCostTracker(store)

            usage = TokenUsage(input_tokens=1000, output_tokens=500)
            tracker.record_usage(
                record_id="r1",
                workflow_id="wf-1",
                run_id="run-1",
                agent_name="claude",
                model_name="claude-3-5-sonnet",
                token_usage=usage,
            )

            # Verify in store
            record = store.get("r1")
            assert record is not None
            assert record.workflow_id == "wf-1"


class TestWorkflowCostEstimator:
    """Tests for WorkflowCostEstimator."""

    def test_estimate_step_cost(self):
        """Test estimating step cost."""
        estimator = WorkflowCostEstimator()
        cost = estimator.estimate_step_cost("gpt-4o", 1000, 500)
        assert cost is not None
        assert cost > 0

    def test_estimate_workflow_cost(self):
        """Test estimating workflow cost."""
        estimator = WorkflowCostEstimator()
        cost = estimator.estimate_workflow_cost(
            "gpt-4o",
            step_count=10,
            avg_input_tokens_per_step=1000,
            avg_output_tokens_per_step=500,
        )
        assert cost is not None

        step_cost = estimator.estimate_step_cost("gpt-4o", 1000, 500)
        assert cost == step_cost * 10

    def test_compare_models(self):
        """Test comparing model costs."""
        estimator = WorkflowCostEstimator()
        comparison = estimator.compare_models(
            ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"],
            input_tokens=1000,
            output_tokens=500,
        )
        assert len(comparison) == 3
        assert all(v is not None for v in comparison.values())
        # gpt-4o-mini should be cheapest
        assert comparison["gpt-4o-mini"] < comparison["gpt-4o"]

    def test_unknown_model_returns_none(self):
        """Test that unknown model returns None."""
        estimator = WorkflowCostEstimator()
        cost = estimator.estimate_step_cost("unknown-model", 1000, 500)
        assert cost is None


class TestDefaultPricing:
    """Tests for default pricing data."""

    def test_default_models_exist(self):
        """Test that expected models have default pricing."""
        expected_models = [
            "gpt-4o",
            "gpt-4o-mini",
            "claude-3-5-sonnet",
            "claude-3-opus",
            "gemini-1.5-pro",
        ]
        for model in expected_models:
            assert model in DEFAULT_MODEL_PRICING

    def test_default_prices_reasonable(self):
        """Test that default prices are reasonable."""
        for model, pricing in DEFAULT_MODEL_PRICING.items():
            assert pricing.input_price_per_million > 0
            assert pricing.output_price_per_million > 0
            # Output should generally be more expensive than input
            assert pricing.output_price_per_million >= pricing.input_price_per_million
