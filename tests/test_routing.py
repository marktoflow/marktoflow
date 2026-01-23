"""Tests for agent selection and routing module."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest

from marktoflow.core.routing import (
    AgentProfile,
    AgentRouter,
    AgentScore,
    AgentSelector,
    BudgetConfig,
    BudgetTracker,
    LoadInfo,
    PREDEFINED_PROFILES,
    RoutingContext,
    RoutingDecision,
    RoutingResult,
    SelectionStrategy,
    create_cost_optimized_selector,
    create_default_selector,
    create_quality_optimized_selector,
)


# =============================================================================
# SelectionStrategy Tests
# =============================================================================


class TestSelectionStrategy:
    """Tests for SelectionStrategy enum."""

    def test_all_strategies_exist(self):
        """All expected strategies should exist."""
        assert SelectionStrategy.CAPABILITY_MATCH == "capability_match"
        assert SelectionStrategy.LOWEST_COST == "lowest_cost"
        assert SelectionStrategy.HIGHEST_QUALITY == "highest_quality"
        assert SelectionStrategy.BALANCED == "balanced"
        assert SelectionStrategy.ROUND_ROBIN == "round_robin"
        assert SelectionStrategy.RANDOM == "random"
        assert SelectionStrategy.PRIORITY == "priority"
        assert SelectionStrategy.LEAST_LOADED == "least_loaded"

    def test_strategy_count(self):
        """Should have 8 strategies."""
        assert len(SelectionStrategy) == 8


# =============================================================================
# RoutingDecision Tests
# =============================================================================


class TestRoutingDecision:
    """Tests for RoutingDecision enum."""

    def test_all_decisions_exist(self):
        """All expected decisions should exist."""
        assert RoutingDecision.USE_PRIMARY == "use_primary"
        assert RoutingDecision.USE_FALLBACK == "use_fallback"
        assert RoutingDecision.SWITCH_AGENT == "switch_agent"
        assert RoutingDecision.REJECT == "reject"
        assert RoutingDecision.QUEUE == "queue"

    def test_decision_count(self):
        """Should have 5 decisions."""
        assert len(RoutingDecision) == 5


# =============================================================================
# AgentScore Tests
# =============================================================================


class TestAgentScore:
    """Tests for AgentScore dataclass."""

    def test_create_score(self):
        """Create an agent score."""
        score = AgentScore(
            agent_name="test",
            capability_score=0.9,
            cost_score=0.8,
            quality_score=0.85,
            availability_score=1.0,
            load_score=0.9,
        )
        assert score.agent_name == "test"
        assert score.capability_score == 0.9

    def test_total_score(self):
        """Calculate total score with default weights."""
        score = AgentScore(
            agent_name="test",
            capability_score=1.0,
            cost_score=1.0,
            quality_score=1.0,
            availability_score=1.0,
            load_score=1.0,
        )
        # All 1.0 should give 1.0 total
        assert score.total_score == 1.0

    def test_weighted_score(self):
        """Calculate weighted score with custom weights."""
        score = AgentScore(
            agent_name="test",
            capability_score=1.0,
            cost_score=0.5,
            quality_score=0.8,
            availability_score=1.0,
            load_score=0.9,
        )
        weights = {
            "capability": 0.5,
            "cost": 0.3,
            "quality": 0.2,
            "availability": 0.0,
            "load": 0.0,
        }
        expected = 1.0 * 0.5 + 0.5 * 0.3 + 0.8 * 0.2
        assert score.weighted_score(weights) == expected


# =============================================================================
# AgentProfile Tests
# =============================================================================


class TestAgentProfile:
    """Tests for AgentProfile dataclass."""

    def test_create_profile(self):
        """Create an agent profile."""
        profile = AgentProfile(
            name="test-agent",
            provider="test",
            model="test-model",
            capabilities={"tool_calling", "streaming"},
        )
        assert profile.name == "test-agent"
        assert profile.provider == "test"
        assert "tool_calling" in profile.capabilities

    def test_has_capability(self):
        """Check single capability."""
        profile = AgentProfile(
            name="test",
            provider="test",
            capabilities={"a", "b", "c"},
        )
        assert profile.has_capability("a")
        assert profile.has_capability("b")
        assert not profile.has_capability("d")

    def test_has_all_capabilities(self):
        """Check multiple capabilities."""
        profile = AgentProfile(
            name="test",
            provider="test",
            capabilities={"a", "b", "c"},
        )
        assert profile.has_all_capabilities({"a", "b"})
        assert profile.has_all_capabilities({"a"})
        assert not profile.has_all_capabilities({"a", "d"})

    def test_quality_score(self):
        """Calculate combined quality score."""
        profile = AgentProfile(
            name="test",
            provider="test",
            accuracy_score=0.9,
            reliability_score=0.8,
            speed_score=0.7,
        )
        expected = (0.9 + 0.8 + 0.7) / 3
        assert profile.quality_score == expected

    def test_to_dict(self):
        """Serialize profile to dictionary."""
        profile = AgentProfile(
            name="test",
            provider="openai",
            model="gpt-4o",
            capabilities={"tool_calling"},
            tags=["test"],
        )
        data = profile.to_dict()
        assert data["name"] == "test"
        assert data["provider"] == "openai"
        assert "tool_calling" in data["capabilities"]
        assert "test" in data["tags"]

    def test_from_dict(self):
        """Deserialize profile from dictionary."""
        data = {
            "name": "test",
            "provider": "anthropic",
            "model": "claude-3",
            "capabilities": ["streaming", "analysis"],
            "cost_per_1k_tokens": "0.015",
            "accuracy_score": 0.95,
            "reliability_score": 0.9,
            "speed_score": 0.85,
            "priority": 5,
            "tags": ["premium"],
            "enabled": True,
        }
        profile = AgentProfile.from_dict(data)
        assert profile.name == "test"
        assert profile.provider == "anthropic"
        assert "streaming" in profile.capabilities
        assert profile.cost_per_1k_tokens == Decimal("0.015")
        assert profile.priority == 5


# =============================================================================
# RoutingContext Tests
# =============================================================================


class TestRoutingContext:
    """Tests for RoutingContext dataclass."""

    def test_create_context(self):
        """Create a routing context."""
        context = RoutingContext(
            workflow_id="wf-123",
            step_index=0,
            required_capabilities={"tool_calling"},
        )
        assert context.workflow_id == "wf-123"
        assert "tool_calling" in context.required_capabilities

    def test_context_with_constraints(self):
        """Create context with constraints."""
        context = RoutingContext(
            max_cost=Decimal("0.01"),
            max_latency_ms=1000,
            excluded_agents=["agent-a"],
        )
        assert context.max_cost == Decimal("0.01")
        assert context.max_latency_ms == 1000
        assert "agent-a" in context.excluded_agents


# =============================================================================
# AgentSelector Tests
# =============================================================================


class TestAgentSelector:
    """Tests for AgentSelector."""

    @pytest.fixture
    def profiles(self):
        """Create test profiles."""
        return [
            AgentProfile(
                name="cheap",
                provider="test",
                capabilities={"basic"},
                cost_per_1k_tokens=Decimal("0.001"),
                accuracy_score=0.7,
                priority=1,
            ),
            AgentProfile(
                name="premium",
                provider="test",
                capabilities={"basic", "advanced", "tool_calling"},
                cost_per_1k_tokens=Decimal("0.015"),
                accuracy_score=0.95,
                priority=10,
            ),
            AgentProfile(
                name="balanced",
                provider="test",
                capabilities={"basic", "tool_calling"},
                cost_per_1k_tokens=Decimal("0.005"),
                accuracy_score=0.85,
                priority=5,
            ),
        ]

    def test_register_agent(self, profiles):
        """Register agents with selector."""
        selector = AgentSelector()
        for profile in profiles:
            selector.register_agent(profile)

        assert len(selector.list_agents()) == 3
        assert "cheap" in selector.list_agents()

    def test_unregister_agent(self, profiles):
        """Unregister an agent."""
        selector = AgentSelector(profiles=profiles)
        assert selector.unregister_agent("cheap")
        assert "cheap" not in selector.list_agents()
        assert not selector.unregister_agent("nonexistent")

    def test_get_profile(self, profiles):
        """Get agent profile by name."""
        selector = AgentSelector(profiles=profiles)
        profile = selector.get_profile("premium")
        assert profile is not None
        assert profile.name == "premium"
        assert selector.get_profile("nonexistent") is None

    def test_select_lowest_cost(self, profiles):
        """Select cheapest agent."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.LOWEST_COST,
        )
        context = RoutingContext()
        result = selector.select(context)

        assert result.decision == RoutingDecision.USE_PRIMARY
        assert result.selected_agent == "cheap"

    def test_select_highest_quality(self, profiles):
        """Select highest quality agent."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.HIGHEST_QUALITY,
        )
        context = RoutingContext()
        result = selector.select(context)

        assert result.decision == RoutingDecision.USE_PRIMARY
        assert result.selected_agent == "premium"

    def test_select_by_priority(self, profiles):
        """Select by priority."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.PRIORITY,
        )
        context = RoutingContext()
        result = selector.select(context)

        assert result.selected_agent == "premium"  # Highest priority

    def test_select_with_capability_requirement(self, profiles):
        """Select with required capabilities."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.LOWEST_COST,
        )
        context = RoutingContext(
            required_capabilities={"advanced"},
        )
        result = selector.select(context)

        # Only premium has "advanced"
        assert result.selected_agent == "premium"

    def test_select_with_excluded_agents(self, profiles):
        """Exclude agents from selection."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.LOWEST_COST,
        )
        context = RoutingContext(
            excluded_agents=["cheap"],
        )
        result = selector.select(context)

        # Cheap is excluded, next cheapest is balanced
        assert result.selected_agent == "balanced"

    def test_select_with_cost_constraint(self, profiles):
        """Filter by cost constraint."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.HIGHEST_QUALITY,
        )
        context = RoutingContext(
            max_cost=Decimal("0.01"),
        )
        result = selector.select(context)

        # Premium costs 0.015, so should select balanced or cheap
        assert result.selected_agent in ["cheap", "balanced"]

    def test_select_no_eligible(self, profiles):
        """No eligible agents."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.BALANCED,
        )
        context = RoutingContext(
            required_capabilities={"nonexistent_capability"},
        )
        result = selector.select(context)

        assert result.decision == RoutingDecision.REJECT
        assert result.selected_agent is None

    def test_select_round_robin(self, profiles):
        """Round robin selection."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.ROUND_ROBIN,
        )
        context = RoutingContext()

        agents = []
        for _ in range(6):
            result = selector.select(context)
            agents.append(result.selected_agent)

        # Should cycle through all agents
        assert len(set(agents)) == 3

    def test_select_random(self, profiles):
        """Random selection."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.RANDOM,
        )
        context = RoutingContext()

        results = [selector.select(context) for _ in range(10)]
        agents = [r.selected_agent for r in results]

        # Should be valid agents
        for agent in agents:
            assert agent in ["cheap", "premium", "balanced"]

    def test_fallback_list(self, profiles):
        """Build fallback list."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.PRIORITY,
        )
        context = RoutingContext()
        result = selector.select(context)

        assert result.selected_agent == "premium"
        assert len(result.fallback_agents) > 0
        assert "premium" not in result.fallback_agents


# =============================================================================
# BudgetTracker Tests
# =============================================================================


class TestBudgetTracker:
    """Tests for BudgetTracker."""

    def test_create_tracker(self):
        """Create a budget tracker."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        assert tracker.total_budget == Decimal("10.00")
        assert tracker.spent == Decimal("0")
        assert tracker.remaining == Decimal("10.00")

    def test_record_cost(self):
        """Record costs."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        assert tracker.record_cost(Decimal("3.00"))
        assert tracker.spent == Decimal("3.00")
        assert tracker.remaining == Decimal("7.00")

    def test_record_exceeds_budget(self):
        """Reject cost that exceeds budget."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        tracker.record_cost(Decimal("8.00"))
        assert not tracker.record_cost(Decimal("5.00"))
        assert tracker.spent == Decimal("8.00")

    def test_can_afford(self):
        """Check if can afford cost."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        tracker.record_cost(Decimal("7.00"))
        assert tracker.can_afford(Decimal("3.00"))
        assert not tracker.can_afford(Decimal("4.00"))

    def test_usage_percentage(self):
        """Calculate usage percentage."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        tracker.record_cost(Decimal("5.00"))
        assert tracker.usage_percentage == 50.0

    def test_per_workflow_limit(self):
        """Per-workflow budget limits."""
        config = BudgetConfig(
            total_budget=Decimal("100.00"),
            per_workflow_limit=Decimal("10.00"),
        )
        tracker = BudgetTracker(config)

        assert tracker.record_cost(Decimal("8.00"), "wf-1")
        assert not tracker.record_cost(Decimal("5.00"), "wf-1")  # Exceeds per-workflow
        assert tracker.record_cost(Decimal("5.00"), "wf-2")  # Different workflow OK

    def test_workflow_tracking(self):
        """Track spending per workflow."""
        config = BudgetConfig(total_budget=Decimal("100.00"))
        tracker = BudgetTracker(config)

        tracker.record_cost(Decimal("5.00"), "wf-1")
        tracker.record_cost(Decimal("3.00"), "wf-1")
        tracker.record_cost(Decimal("7.00"), "wf-2")

        assert tracker.get_workflow_spent("wf-1") == Decimal("8.00")
        assert tracker.get_workflow_spent("wf-2") == Decimal("7.00")
        assert tracker.get_workflow_spent("wf-3") == Decimal("0")

    def test_reset(self):
        """Reset budget tracker."""
        config = BudgetConfig(total_budget=Decimal("10.00"))
        tracker = BudgetTracker(config)

        tracker.record_cost(Decimal("5.00"), "wf-1")
        tracker.reset()

        assert tracker.spent == Decimal("0")
        assert tracker.get_workflow_spent("wf-1") == Decimal("0")

    def test_alert_callbacks(self):
        """Test budget alert callbacks."""
        config = BudgetConfig(
            total_budget=Decimal("10.00"),
            alert_thresholds=[0.5, 0.8],
        )
        tracker = BudgetTracker(config)

        alerts = []
        tracker.add_alert_callback(lambda pct, amt: alerts.append((pct, amt)))

        tracker.record_cost(Decimal("5.01"))  # Cross 50%
        assert len(alerts) == 1


# =============================================================================
# AgentRouter Tests
# =============================================================================


class TestAgentRouter:
    """Tests for AgentRouter."""

    @pytest.fixture
    def profiles(self):
        """Create test profiles."""
        return [
            AgentProfile(
                name="cheap",
                provider="test",
                cost_per_1k_tokens=Decimal("0.001"),
                accuracy_score=0.7,
            ),
            AgentProfile(
                name="premium",
                provider="test",
                cost_per_1k_tokens=Decimal("0.015"),
                accuracy_score=0.95,
            ),
        ]

    def test_route_without_budget(self, profiles):
        """Route without budget constraints."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.HIGHEST_QUALITY,
        )
        router = AgentRouter(selector)

        context = RoutingContext()
        result = router.route(context)

        assert result.decision == RoutingDecision.USE_PRIMARY
        assert result.selected_agent == "premium"

    def test_route_with_budget(self, profiles):
        """Route with budget constraints."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.HIGHEST_QUALITY,
        )
        budget = BudgetTracker(BudgetConfig(total_budget=Decimal("0.01")))
        router = AgentRouter(selector, budget)

        context = RoutingContext()
        result = router.route(context)

        # Premium exceeds budget, should fall back to cheap
        assert result.decision == RoutingDecision.USE_FALLBACK
        assert result.selected_agent == "cheap"

    def test_route_no_affordable_agent(self, profiles):
        """No agents within budget."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.BALANCED,
        )
        budget = BudgetTracker(BudgetConfig(total_budget=Decimal("0.0001")))
        router = AgentRouter(selector, budget)

        context = RoutingContext()
        result = router.route(context)

        assert result.decision == RoutingDecision.REJECT

    def test_record_completion(self, profiles):
        """Record request completion."""
        selector = AgentSelector(profiles=profiles)
        budget = BudgetTracker(BudgetConfig(total_budget=Decimal("10.00")))
        router = AgentRouter(selector, budget)

        router.record_completion("cheap", Decimal("0.05"), "wf-1")
        assert budget.spent == Decimal("0.05")

    def test_record_start_and_load(self, profiles):
        """Track request starts for load."""
        selector = AgentSelector(profiles=profiles)
        router = AgentRouter(selector)

        router.record_start("cheap")
        router.record_start("cheap")

        load_info = selector._load_info["cheap"]
        assert load_info.current_requests == 2

    def test_routing_stats(self, profiles):
        """Get routing statistics."""
        selector = AgentSelector(
            profiles=profiles,
            strategy=SelectionStrategy.ROUND_ROBIN,
        )
        router = AgentRouter(selector)

        for _ in range(5):
            router.route(RoutingContext())

        stats = router.get_routing_stats()
        assert stats["total_decisions"] == 5
        assert RoutingDecision.USE_PRIMARY.value in stats["by_decision"]


# =============================================================================
# Predefined Profiles Tests
# =============================================================================


class TestPredefinedProfiles:
    """Tests for predefined agent profiles."""

    def test_profiles_exist(self):
        """Check predefined profiles exist."""
        assert "claude-code" in PREDEFINED_PROFILES
        assert "opencode-gpt4o" in PREDEFINED_PROFILES
        assert "opencode-gpt4o-mini" in PREDEFINED_PROFILES
        assert "opencode-claude" in PREDEFINED_PROFILES

    def test_claude_code_profile(self):
        """Claude Code profile has expected capabilities."""
        profile = PREDEFINED_PROFILES["claude-code"]
        assert profile.provider == "anthropic"
        assert "mcp_native" in profile.capabilities
        assert "extended_reasoning" in profile.capabilities
        assert profile.accuracy_score >= 0.9

    def test_gpt4o_mini_is_cheapest(self):
        """GPT-4o mini should be cheapest."""
        costs = {name: profile.cost_per_1k_tokens for name, profile in PREDEFINED_PROFILES.items()}
        cheapest = min(costs, key=costs.get)
        assert cheapest == "opencode-gpt4o-mini"


# =============================================================================
# Convenience Function Tests
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_create_default_selector(self):
        """Create default selector."""
        selector = create_default_selector()
        assert len(selector.list_agents()) > 0
        assert selector.strategy == SelectionStrategy.BALANCED

    def test_create_cost_optimized_selector(self):
        """Create cost-optimized selector."""
        selector = create_cost_optimized_selector()
        assert selector.strategy == SelectionStrategy.LOWEST_COST

    def test_create_quality_optimized_selector(self):
        """Create quality-optimized selector."""
        selector = create_quality_optimized_selector()
        assert selector.strategy == SelectionStrategy.HIGHEST_QUALITY


# =============================================================================
# LoadInfo Tests
# =============================================================================


class TestLoadInfo:
    """Tests for LoadInfo dataclass."""

    def test_create_load_info(self):
        """Create load info."""
        load = LoadInfo(agent_name="test", current_requests=5)
        assert load.agent_name == "test"
        assert load.current_requests == 5

    def test_load_factor_zero(self):
        """Load factor is 0 when no requests."""
        load = LoadInfo(agent_name="test", current_requests=0)
        assert load.load_factor == 0.0

    def test_load_factor_partial(self):
        """Load factor is proportional to requests."""
        load = LoadInfo(agent_name="test", current_requests=5)
        assert load.load_factor == 0.5

    def test_load_factor_max(self):
        """Load factor caps at 1.0."""
        load = LoadInfo(agent_name="test", current_requests=100)
        assert load.load_factor == 1.0
