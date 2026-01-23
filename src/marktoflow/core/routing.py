"""Agent selection and routing module.

This module provides intelligent agent selection based on:
- Capability requirements
- Cost optimization
- Quality/performance metrics
- Load balancing
- Budget constraints

The routing system can dynamically switch agents during workflow execution
based on cost limits, performance, and availability.
"""

from __future__ import annotations

import random
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from marktoflow.agents.base import AgentAdapter, AgentConfig
    from marktoflow.core.models import AgentCapabilities, Workflow, WorkflowStep


class SelectionStrategy(str, Enum):
    """Strategy for selecting agents."""

    CAPABILITY_MATCH = "capability_match"  # Best capability match
    LOWEST_COST = "lowest_cost"  # Cheapest option
    HIGHEST_QUALITY = "highest_quality"  # Best quality score
    BALANCED = "balanced"  # Balance cost and quality
    ROUND_ROBIN = "round_robin"  # Rotate through agents
    RANDOM = "random"  # Random selection
    PRIORITY = "priority"  # Use priority order
    LEAST_LOADED = "least_loaded"  # Least current load


class RoutingDecision(str, Enum):
    """Decision made by the router."""

    USE_PRIMARY = "use_primary"
    USE_FALLBACK = "use_fallback"
    SWITCH_AGENT = "switch_agent"
    REJECT = "reject"  # No suitable agent
    QUEUE = "queue"  # Queue for later


@dataclass
class AgentScore:
    """Score for an agent on various dimensions."""

    agent_name: str
    capability_score: float = 0.0  # 0-1, how well capabilities match
    cost_score: float = 0.0  # 0-1, lower cost = higher score
    quality_score: float = 0.0  # 0-1, based on historical performance
    availability_score: float = 1.0  # 0-1, current availability
    load_score: float = 1.0  # 0-1, inverse of current load

    @property
    def total_score(self) -> float:
        """Calculate weighted total score."""
        return (
            self.capability_score * 0.3
            + self.cost_score * 0.2
            + self.quality_score * 0.25
            + self.availability_score * 0.15
            + self.load_score * 0.1
        )

    def weighted_score(self, weights: dict[str, float]) -> float:
        """Calculate score with custom weights."""
        total = 0.0
        total += self.capability_score * weights.get("capability", 0.3)
        total += self.cost_score * weights.get("cost", 0.2)
        total += self.quality_score * weights.get("quality", 0.25)
        total += self.availability_score * weights.get("availability", 0.15)
        total += self.load_score * weights.get("load", 0.1)
        return total


@dataclass
class AgentProfile:
    """Profile of an agent's characteristics."""

    name: str
    provider: str
    model: str | None = None
    capabilities: set[str] = field(default_factory=set)

    # Cost information
    cost_per_1k_tokens: Decimal = Decimal("0.01")
    cost_per_request: Decimal = Decimal("0")

    # Quality metrics (0-1)
    accuracy_score: float = 0.8
    reliability_score: float = 0.9
    speed_score: float = 0.7

    # Constraints
    max_tokens: int = 100000
    max_requests_per_minute: int = 60

    # Priority (higher = preferred)
    priority: int = 0

    # Tags for filtering
    tags: list[str] = field(default_factory=list)

    # Whether agent is currently enabled
    enabled: bool = True

    @property
    def quality_score(self) -> float:
        """Combined quality score."""
        return (self.accuracy_score + self.reliability_score + self.speed_score) / 3

    def has_capability(self, capability: str) -> bool:
        """Check if agent has a capability."""
        return capability in self.capabilities

    def has_all_capabilities(self, capabilities: set[str]) -> bool:
        """Check if agent has all required capabilities."""
        return capabilities.issubset(self.capabilities)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "provider": self.provider,
            "model": self.model,
            "capabilities": list(self.capabilities),
            "cost_per_1k_tokens": str(self.cost_per_1k_tokens),
            "cost_per_request": str(self.cost_per_request),
            "accuracy_score": self.accuracy_score,
            "reliability_score": self.reliability_score,
            "speed_score": self.speed_score,
            "max_tokens": self.max_tokens,
            "max_requests_per_minute": self.max_requests_per_minute,
            "priority": self.priority,
            "tags": self.tags,
            "enabled": self.enabled,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentProfile:
        """Deserialize from dictionary."""
        return cls(
            name=data["name"],
            provider=data["provider"],
            model=data.get("model"),
            capabilities=set(data.get("capabilities", [])),
            cost_per_1k_tokens=Decimal(data.get("cost_per_1k_tokens", "0.01")),
            cost_per_request=Decimal(data.get("cost_per_request", "0")),
            accuracy_score=data.get("accuracy_score", 0.8),
            reliability_score=data.get("reliability_score", 0.9),
            speed_score=data.get("speed_score", 0.7),
            max_tokens=data.get("max_tokens", 100000),
            max_requests_per_minute=data.get("max_requests_per_minute", 60),
            priority=data.get("priority", 0),
            tags=data.get("tags", []),
            enabled=data.get("enabled", True),
        )


@dataclass
class RoutingContext:
    """Context for making routing decisions."""

    workflow_id: str | None = None
    step_index: int = 0
    step_name: str | None = None

    # Requirements
    required_capabilities: set[str] = field(default_factory=set)
    preferred_agents: list[str] = field(default_factory=list)
    excluded_agents: list[str] = field(default_factory=list)

    # Constraints
    max_cost: Decimal | None = None
    max_latency_ms: int | None = None

    # Current state
    current_agent: str | None = None
    budget_remaining: Decimal | None = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RoutingResult:
    """Result of a routing decision."""

    decision: RoutingDecision
    selected_agent: str | None = None
    fallback_agents: list[str] = field(default_factory=list)
    reason: str = ""
    scores: dict[str, AgentScore] = field(default_factory=dict)
    estimated_cost: Decimal | None = None


@dataclass
class BudgetConfig:
    """Budget configuration for cost-based routing."""

    # Total budget
    total_budget: Decimal

    # Time period for budget (None = lifetime)
    period: timedelta | None = None

    # Per-workflow budget limit
    per_workflow_limit: Decimal | None = None

    # Per-step budget limit
    per_step_limit: Decimal | None = None

    # Action when budget exceeded
    on_exceed: str = "reject"  # reject, switch_agent, queue

    # Alert thresholds (percentage of budget)
    alert_thresholds: list[float] = field(default_factory=lambda: [0.5, 0.8, 0.95])


@dataclass
class LoadInfo:
    """Load information for an agent."""

    agent_name: str
    current_requests: int = 0
    requests_per_minute: float = 0.0
    queue_depth: int = 0
    last_updated: datetime = field(default_factory=datetime.now)

    @property
    def load_factor(self) -> float:
        """Calculate load factor (0-1, higher = more loaded)."""
        # Simple heuristic based on current requests
        if self.current_requests == 0:
            return 0.0
        return min(1.0, self.current_requests / 10)


class AgentSelector:
    """Selects the best agent for a given context."""

    def __init__(
        self,
        profiles: list[AgentProfile] | None = None,
        strategy: SelectionStrategy = SelectionStrategy.BALANCED,
        weights: dict[str, float] | None = None,
    ):
        """Initialize agent selector.

        Args:
            profiles: List of agent profiles
            strategy: Selection strategy to use
            weights: Custom weights for scoring (capability, cost, quality, availability, load)
        """
        self._profiles: dict[str, AgentProfile] = {}
        self._load_info: dict[str, LoadInfo] = {}
        self._round_robin_index = 0
        self._lock = threading.Lock()

        self.strategy = strategy
        self.weights = weights or {
            "capability": 0.3,
            "cost": 0.2,
            "quality": 0.25,
            "availability": 0.15,
            "load": 0.1,
        }

        if profiles:
            for profile in profiles:
                self.register_agent(profile)

    def register_agent(self, profile: AgentProfile) -> None:
        """Register an agent profile."""
        self._profiles[profile.name] = profile
        self._load_info[profile.name] = LoadInfo(agent_name=profile.name)

    def unregister_agent(self, name: str) -> bool:
        """Unregister an agent. Returns True if removed."""
        if name in self._profiles:
            del self._profiles[name]
            if name in self._load_info:
                del self._load_info[name]
            return True
        return False

    def get_profile(self, name: str) -> AgentProfile | None:
        """Get an agent profile by name."""
        return self._profiles.get(name)

    def list_agents(self) -> list[str]:
        """List all registered agent names."""
        return list(self._profiles.keys())

    def list_profiles(self) -> list[AgentProfile]:
        """List all agent profiles."""
        return list(self._profiles.values())

    def update_load(self, agent_name: str, load_info: LoadInfo) -> None:
        """Update load information for an agent."""
        self._load_info[agent_name] = load_info

    def _calculate_capability_score(self, profile: AgentProfile, required: set[str]) -> float:
        """Calculate capability match score."""
        if not required:
            return 1.0

        if not profile.has_all_capabilities(required):
            return 0.0

        # Bonus for having more capabilities
        extra = len(profile.capabilities - required)
        return min(1.0, 1.0 + extra * 0.05)

    def _calculate_cost_score(
        self, profile: AgentProfile, all_profiles: list[AgentProfile]
    ) -> float:
        """Calculate cost score (lower cost = higher score)."""
        if not all_profiles:
            return 1.0

        costs = [p.cost_per_1k_tokens for p in all_profiles]
        min_cost = min(costs)
        max_cost = max(costs)

        if max_cost == min_cost:
            return 1.0

        # Normalize: min cost = 1.0, max cost = 0.0
        cost_range = max_cost - min_cost
        normalized = (profile.cost_per_1k_tokens - min_cost) / cost_range
        return float(Decimal("1.0") - normalized)

    def _calculate_availability_score(self, profile: AgentProfile) -> float:
        """Calculate availability score."""
        if not profile.enabled:
            return 0.0

        load_info = self._load_info.get(profile.name)
        if load_info:
            # Check if rate limited
            if load_info.requests_per_minute >= profile.max_requests_per_minute:
                return 0.1

        return 1.0

    def _calculate_load_score(self, profile: AgentProfile) -> float:
        """Calculate load score (less loaded = higher score)."""
        load_info = self._load_info.get(profile.name)
        if not load_info:
            return 1.0

        return 1.0 - load_info.load_factor

    def score_agent(self, profile: AgentProfile, context: RoutingContext) -> AgentScore:
        """Calculate comprehensive score for an agent."""
        all_profiles = [p for p in self._profiles.values() if p.enabled]

        return AgentScore(
            agent_name=profile.name,
            capability_score=self._calculate_capability_score(
                profile, context.required_capabilities
            ),
            cost_score=self._calculate_cost_score(profile, all_profiles),
            quality_score=profile.quality_score,
            availability_score=self._calculate_availability_score(profile),
            load_score=self._calculate_load_score(profile),
        )

    def select(self, context: RoutingContext) -> RoutingResult:
        """Select the best agent for the given context.

        Args:
            context: Routing context with requirements and constraints

        Returns:
            RoutingResult with selected agent and reasoning
        """
        # Get eligible agents
        eligible = self._get_eligible_agents(context)

        if not eligible:
            return RoutingResult(
                decision=RoutingDecision.REJECT,
                reason="No eligible agents found",
            )

        # Score all eligible agents
        scores = {p.name: self.score_agent(p, context) for p in eligible}

        # Select based on strategy
        selected = self._select_by_strategy(eligible, scores, context)

        if not selected:
            return RoutingResult(
                decision=RoutingDecision.REJECT,
                reason="No agent matched selection criteria",
                scores=scores,
            )

        # Build fallback list
        fallbacks = self._build_fallback_list(eligible, selected, scores)

        return RoutingResult(
            decision=RoutingDecision.USE_PRIMARY,
            selected_agent=selected.name,
            fallback_agents=[p.name for p in fallbacks],
            reason=f"Selected by {self.strategy.value} strategy",
            scores=scores,
            estimated_cost=selected.cost_per_1k_tokens,
        )

    def _get_eligible_agents(self, context: RoutingContext) -> list[AgentProfile]:
        """Get list of eligible agents based on context."""
        eligible = []

        for profile in self._profiles.values():
            # Skip disabled agents
            if not profile.enabled:
                continue

            # Skip excluded agents
            if profile.name in context.excluded_agents:
                continue

            # Check required capabilities
            if context.required_capabilities:
                if not profile.has_all_capabilities(context.required_capabilities):
                    continue

            # Check cost constraint
            if context.max_cost is not None:
                if profile.cost_per_1k_tokens > context.max_cost:
                    continue

            eligible.append(profile)

        # Sort preferred agents first
        if context.preferred_agents:
            eligible.sort(
                key=lambda p: (
                    0 if p.name in context.preferred_agents else 1,
                    -p.priority,
                )
            )

        return eligible

    def _select_by_strategy(
        self,
        eligible: list[AgentProfile],
        scores: dict[str, AgentScore],
        context: RoutingContext,
    ) -> AgentProfile | None:
        """Select agent based on strategy."""
        if not eligible:
            return None

        if self.strategy == SelectionStrategy.CAPABILITY_MATCH:
            # Sort by capability score
            return max(eligible, key=lambda p: scores[p.name].capability_score)

        elif self.strategy == SelectionStrategy.LOWEST_COST:
            # Sort by cost (lowest first)
            return min(eligible, key=lambda p: p.cost_per_1k_tokens)

        elif self.strategy == SelectionStrategy.HIGHEST_QUALITY:
            # Sort by quality score
            return max(eligible, key=lambda p: p.quality_score)

        elif self.strategy == SelectionStrategy.BALANCED:
            # Sort by weighted total score
            return max(
                eligible,
                key=lambda p: scores[p.name].weighted_score(self.weights),
            )

        elif self.strategy == SelectionStrategy.ROUND_ROBIN:
            # Rotate through agents
            with self._lock:
                index = self._round_robin_index % len(eligible)
                self._round_robin_index += 1
                return eligible[index]

        elif self.strategy == SelectionStrategy.RANDOM:
            return random.choice(eligible)

        elif self.strategy == SelectionStrategy.PRIORITY:
            # Sort by priority (highest first)
            return max(eligible, key=lambda p: p.priority)

        elif self.strategy == SelectionStrategy.LEAST_LOADED:
            # Sort by load (least loaded first)
            return max(eligible, key=lambda p: scores[p.name].load_score)

        return eligible[0]

    def _build_fallback_list(
        self,
        eligible: list[AgentProfile],
        selected: AgentProfile,
        scores: dict[str, AgentScore],
    ) -> list[AgentProfile]:
        """Build ordered fallback list."""
        others = [p for p in eligible if p.name != selected.name]

        # Sort by weighted score descending
        others.sort(
            key=lambda p: scores[p.name].weighted_score(self.weights),
            reverse=True,
        )

        return others[:3]  # Top 3 fallbacks


class BudgetTracker:
    """Tracks budget consumption for cost-based routing."""

    def __init__(self, config: BudgetConfig):
        """Initialize budget tracker.

        Args:
            config: Budget configuration
        """
        self.config = config
        self._spent: Decimal = Decimal("0")
        self._workflow_spent: dict[str, Decimal] = {}
        self._period_start: datetime = datetime.now()
        self._lock = threading.Lock()
        self._alert_callbacks: list[Callable[[float, Decimal], None]] = []

    @property
    def total_budget(self) -> Decimal:
        """Get total budget."""
        return self.config.total_budget

    @property
    def spent(self) -> Decimal:
        """Get total amount spent."""
        with self._lock:
            self._check_period_reset()
            return self._spent

    @property
    def remaining(self) -> Decimal:
        """Get remaining budget."""
        return self.total_budget - self.spent

    @property
    def usage_percentage(self) -> float:
        """Get budget usage as percentage."""
        if self.total_budget == 0:
            return 0.0
        return float(self.spent / self.total_budget * 100)

    def _check_period_reset(self) -> None:
        """Reset budget if period has elapsed."""
        if self.config.period is None:
            return

        if datetime.now() - self._period_start > self.config.period:
            self._spent = Decimal("0")
            self._workflow_spent.clear()
            self._period_start = datetime.now()

    def record_cost(self, cost: Decimal, workflow_id: str | None = None) -> bool:
        """Record a cost and check if within budget.

        Args:
            cost: Cost to record
            workflow_id: Optional workflow ID for per-workflow tracking

        Returns:
            True if within budget, False if exceeded
        """
        with self._lock:
            self._check_period_reset()

            # Check total budget
            if self._spent + cost > self.config.total_budget:
                return False

            # Check per-workflow budget
            if workflow_id and self.config.per_workflow_limit:
                workflow_spent = self._workflow_spent.get(workflow_id, Decimal("0"))
                if workflow_spent + cost > self.config.per_workflow_limit:
                    return False

            # Record the cost
            self._spent += cost
            if workflow_id:
                self._workflow_spent[workflow_id] = (
                    self._workflow_spent.get(workflow_id, Decimal("0")) + cost
                )

            # Check alert thresholds
            self._check_alerts()

            return True

    def can_afford(self, estimated_cost: Decimal) -> bool:
        """Check if we can afford an estimated cost."""
        with self._lock:
            self._check_period_reset()
            return self._spent + estimated_cost <= self.config.total_budget

    def get_workflow_spent(self, workflow_id: str) -> Decimal:
        """Get amount spent on a specific workflow."""
        with self._lock:
            return self._workflow_spent.get(workflow_id, Decimal("0"))

    def get_workflow_remaining(self, workflow_id: str) -> Decimal | None:
        """Get remaining budget for a workflow."""
        if self.config.per_workflow_limit is None:
            return None

        spent = self.get_workflow_spent(workflow_id)
        return self.config.per_workflow_limit - spent

    def add_alert_callback(self, callback: Callable[[float, Decimal], None]) -> None:
        """Add callback for budget alerts.

        Callback receives (percentage_used, amount_spent).
        """
        self._alert_callbacks.append(callback)

    def _check_alerts(self) -> None:
        """Check and trigger alert callbacks."""
        if not self._alert_callbacks:
            return

        percentage = self.usage_percentage / 100

        for threshold in self.config.alert_thresholds:
            # Check if we just crossed this threshold
            prev_percentage = float((self._spent - Decimal("0.01")) / self.config.total_budget)
            if prev_percentage < threshold <= percentage:
                for callback in self._alert_callbacks:
                    try:
                        callback(percentage * 100, self._spent)
                    except Exception:
                        pass

    def reset(self) -> None:
        """Reset all budget tracking."""
        with self._lock:
            self._spent = Decimal("0")
            self._workflow_spent.clear()
            self._period_start = datetime.now()


class AgentRouter:
    """Routes workflow steps to appropriate agents.

    Combines agent selection with budget tracking and load balancing.
    """

    def __init__(
        self,
        selector: AgentSelector,
        budget_tracker: BudgetTracker | None = None,
    ):
        """Initialize agent router.

        Args:
            selector: Agent selector for choosing agents
            budget_tracker: Optional budget tracker for cost control
        """
        self.selector = selector
        self.budget = budget_tracker
        self._routing_history: list[tuple[datetime, RoutingResult]] = []
        self._lock = threading.Lock()

    def route(self, context: RoutingContext) -> RoutingResult:
        """Route a request to the best agent.

        Args:
            context: Routing context

        Returns:
            Routing result with selected agent
        """
        # Update context with budget info
        if self.budget and context.budget_remaining is None:
            context.budget_remaining = self.budget.remaining

        # Get selection result
        result = self.selector.select(context)

        # Check budget constraints
        if result.decision == RoutingDecision.USE_PRIMARY and self.budget:
            if result.estimated_cost and not self.budget.can_afford(result.estimated_cost):
                # Try fallback agents
                for fallback in result.fallback_agents:
                    profile = self.selector.get_profile(fallback)
                    if profile and self.budget.can_afford(profile.cost_per_1k_tokens):
                        result = RoutingResult(
                            decision=RoutingDecision.USE_FALLBACK,
                            selected_agent=fallback,
                            fallback_agents=[a for a in result.fallback_agents if a != fallback],
                            reason="Primary agent exceeds budget, using fallback",
                            scores=result.scores,
                            estimated_cost=profile.cost_per_1k_tokens,
                        )
                        break
                else:
                    # No affordable agent
                    result = RoutingResult(
                        decision=RoutingDecision.REJECT,
                        reason="No agents within budget",
                        scores=result.scores,
                    )

        # Record routing decision
        with self._lock:
            self._routing_history.append((datetime.now(), result))
            # Keep last 1000 decisions
            if len(self._routing_history) > 1000:
                self._routing_history = self._routing_history[-1000:]

        return result

    def record_completion(
        self,
        agent_name: str,
        cost: Decimal,
        workflow_id: str | None = None,
    ) -> None:
        """Record completion of a routed request.

        Args:
            agent_name: Name of agent that completed the request
            cost: Actual cost incurred
            workflow_id: Optional workflow ID
        """
        if self.budget:
            self.budget.record_cost(cost, workflow_id)

        # Update load info
        load_info = self.selector._load_info.get(agent_name)
        if load_info:
            load_info.current_requests = max(0, load_info.current_requests - 1)

    def record_start(self, agent_name: str) -> None:
        """Record start of a request to an agent."""
        load_info = self.selector._load_info.get(agent_name)
        if load_info:
            load_info.current_requests += 1
            load_info.last_updated = datetime.now()

    def get_routing_stats(self) -> dict[str, Any]:
        """Get routing statistics."""
        with self._lock:
            if not self._routing_history:
                return {
                    "total_decisions": 0,
                    "by_decision": {},
                    "by_agent": {},
                }

            by_decision: dict[str, int] = {}
            by_agent: dict[str, int] = {}

            for _, result in self._routing_history:
                decision = result.decision.value
                by_decision[decision] = by_decision.get(decision, 0) + 1

                if result.selected_agent:
                    by_agent[result.selected_agent] = by_agent.get(result.selected_agent, 0) + 1

            return {
                "total_decisions": len(self._routing_history),
                "by_decision": by_decision,
                "by_agent": by_agent,
            }


# Predefined agent profiles for common agents
PREDEFINED_PROFILES: dict[str, AgentProfile] = {
    "claude-code": AgentProfile(
        name="claude-code",
        provider="anthropic",
        model="claude-3-5-sonnet",
        capabilities={
            "tool_calling",
            "mcp_native",
            "extended_reasoning",
            "streaming",
            "code_generation",
            "code_review",
            "analysis",
        },
        cost_per_1k_tokens=Decimal("0.015"),
        accuracy_score=0.95,
        reliability_score=0.95,
        speed_score=0.85,
        priority=10,
        tags=["premium", "coding"],
    ),
    "opencode-gpt4o": AgentProfile(
        name="opencode-gpt4o",
        provider="openai",
        model="gpt-4o",
        capabilities={
            "tool_calling",
            "streaming",
            "code_generation",
            "code_review",
            "analysis",
            "multi_model",
        },
        cost_per_1k_tokens=Decimal("0.0125"),
        accuracy_score=0.90,
        reliability_score=0.92,
        speed_score=0.90,
        priority=8,
        tags=["standard", "coding"],
    ),
    "opencode-gpt4o-mini": AgentProfile(
        name="opencode-gpt4o-mini",
        provider="openai",
        model="gpt-4o-mini",
        capabilities={
            "tool_calling",
            "streaming",
            "code_generation",
            "analysis",
            "multi_model",
        },
        cost_per_1k_tokens=Decimal("0.00075"),
        accuracy_score=0.80,
        reliability_score=0.90,
        speed_score=0.95,
        priority=5,
        tags=["economy", "fast"],
    ),
    "opencode-claude": AgentProfile(
        name="opencode-claude",
        provider="anthropic",
        model="claude-3-5-sonnet",
        capabilities={
            "tool_calling",
            "streaming",
            "code_generation",
            "code_review",
            "analysis",
            "multi_model",
        },
        cost_per_1k_tokens=Decimal("0.015"),
        accuracy_score=0.92,
        reliability_score=0.93,
        speed_score=0.85,
        priority=9,
        tags=["standard", "coding"],
    ),
}


def create_default_selector() -> AgentSelector:
    """Create a selector with predefined agent profiles."""
    return AgentSelector(
        profiles=list(PREDEFINED_PROFILES.values()),
        strategy=SelectionStrategy.BALANCED,
    )


def create_cost_optimized_selector() -> AgentSelector:
    """Create a selector optimized for cost."""
    return AgentSelector(
        profiles=list(PREDEFINED_PROFILES.values()),
        strategy=SelectionStrategy.LOWEST_COST,
    )


def create_quality_optimized_selector() -> AgentSelector:
    """Create a selector optimized for quality."""
    return AgentSelector(
        profiles=list(PREDEFINED_PROFILES.values()),
        strategy=SelectionStrategy.HIGHEST_QUALITY,
    )
