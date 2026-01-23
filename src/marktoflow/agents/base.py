"""
Base Agent Adapter for marktoflow framework.

Defines the abstract interface that all agent adapters must implement.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from marktoflow.core.models import (
        AgentCapabilities,
        ExecutionContext,
        StepResult,
        WorkflowStep,
    )


@dataclass
class AgentConfig:
    """Configuration for an agent adapter."""

    name: str
    provider: str
    version: str = "1.0.0"
    api_key: str | None = None
    api_base_url: str | None = None
    model: str | None = None
    timeout: int = 120
    max_retries: int = 3
    extra: dict[str, Any] = field(default_factory=dict)


class AgentAdapter(ABC):
    """
    Abstract base class for AI agent adapters.

    Each supported AI agent (Claude Code, OpenCode, Aider, etc.) has an adapter
    that translates workflow steps into agent-specific execution.

    The adapter is responsible for:
    - Executing workflow steps using the agent's capabilities
    - Translating tool calls appropriately
    - Handling agent-specific features (reasoning, streaming, etc.)
    - Managing authentication and API communication
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the agent adapter.

        Args:
            config: Agent configuration
        """
        self.config = config
        self._initialized = False

    @property
    @abstractmethod
    def name(self) -> str:
        """Get the agent's name identifier."""
        pass

    @property
    @abstractmethod
    def capabilities(self) -> AgentCapabilities:
        """Get the agent's capabilities."""
        pass

    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the agent connection.

        This is called once before execution begins.
        """
        pass

    @abstractmethod
    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a single workflow step.

        Args:
            step: The workflow step to execute
            context: Execution context with variables and state

        Returns:
            StepResult with execution outcome
        """
        pass

    @abstractmethod
    def supports_feature(self, feature: str) -> bool:
        """
        Check if the agent supports a specific feature.

        Args:
            feature: Feature name to check

        Returns:
            True if feature is supported
        """
        pass

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Have the agent analyze/reason about something.

        This is used for agent.analyze steps where the agent
        needs to make decisions or generate structured output.

        Args:
            prompt: Analysis prompt
            context: Execution context
            output_schema: Optional JSON schema for structured output

        Returns:
            Analysis result (may be structured based on schema)
        """
        raise NotImplementedError("Agent does not support analysis tasks")

    async def generate(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ) -> str:
        """
        Generate text content using the agent.

        Args:
            prompt: Generation prompt
            context: Execution context
            **kwargs: Additional generation parameters

        Returns:
            Generated text
        """
        raise NotImplementedError("Agent does not support generation tasks")

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool through the agent.

        Some agents have native tool calling (like Claude with MCP).
        Others need the adapter to handle tool execution.

        Args:
            tool_name: Name of the tool
            operation: Operation to perform
            params: Operation parameters
            context: Execution context

        Returns:
            Tool call result
        """
        raise NotImplementedError("Agent does not support tool calling")

    async def shutdown(self) -> None:
        """
        Clean up agent resources.

        Called when execution is complete.
        """
        self._initialized = False

    def get_model(self) -> str:
        """Get the model being used by this agent."""
        return self.config.model or "default"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r})"


class AgentRegistry:
    """
    Registry of available agent adapters.

    Manages agent adapter discovery, instantiation, and selection.
    """

    _adapters: dict[str, type[AgentAdapter]] = {}
    _instances: dict[str, AgentAdapter] = {}

    @classmethod
    def register(cls, name: str, adapter_class: type[AgentAdapter]) -> None:
        """
        Register an agent adapter class.

        Args:
            name: Agent name identifier
            adapter_class: Agent adapter class
        """
        cls._adapters[name] = adapter_class

    @classmethod
    def get_adapter_class(cls, name: str) -> type[AgentAdapter] | None:
        """
        Get an agent adapter class by name.

        Args:
            name: Agent name identifier

        Returns:
            Agent adapter class or None if not found
        """
        return cls._adapters.get(name)

    @classmethod
    def create_adapter(cls, name: str, config: AgentConfig) -> AgentAdapter:
        """
        Create an agent adapter instance.

        Args:
            name: Agent name identifier
            config: Agent configuration

        Returns:
            Agent adapter instance

        Raises:
            ValueError: If agent not found
        """
        adapter_class = cls._adapters.get(name)
        if adapter_class is None:
            raise ValueError(f"Unknown agent: {name}")

        return adapter_class(config)

    @classmethod
    def get_or_create(cls, name: str, config: AgentConfig) -> AgentAdapter:
        """
        Get existing adapter instance or create new one.

        Args:
            name: Agent name identifier
            config: Agent configuration

        Returns:
            Agent adapter instance
        """
        if name not in cls._instances:
            cls._instances[name] = cls.create_adapter(name, config)
        return cls._instances[name]

    @classmethod
    def list_agents(cls) -> list[str]:
        """
        List all registered agent names.

        Returns:
            List of agent names
        """
        return list(cls._adapters.keys())

    @classmethod
    def clear(cls) -> None:
        """Clear all registered adapters and instances."""
        cls._adapters.clear()
        cls._instances.clear()


def register_agent(name: str):
    """
    Decorator to register an agent adapter class.

    Usage:
        @register_agent("my-agent")
        class MyAgentAdapter(AgentAdapter):
            ...
    """

    def decorator(cls: type[AgentAdapter]) -> type[AgentAdapter]:
        AgentRegistry.register(name, cls)
        return cls

    return decorator
