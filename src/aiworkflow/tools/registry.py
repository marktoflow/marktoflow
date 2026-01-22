"""
Tool Registry for aiworkflow framework.

Manages tool discovery, registration, and selection based on agent compatibility.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import yaml


class ToolType(str, Enum):
    """Type of tool implementation."""

    MCP = "mcp"
    OPENAPI = "openapi"
    CUSTOM = "custom"


class ToolCompatibility(str, Enum):
    """Tool compatibility level with an agent."""

    NATIVE = "native"
    SUPPORTED = "supported"
    VIA_BRIDGE = "via_bridge"
    NOT_SUPPORTED = "not_supported"


@dataclass
class ToolImplementation:
    """A specific implementation of a tool."""

    type: ToolType
    priority: int
    config_path: str = ""
    spec_path: str = ""
    spec_url: str = ""
    adapter_path: str = ""
    package: str = ""
    agent_compatibility: dict[str, str] = field(default_factory=dict)

    def is_compatible_with(self, agent: str) -> bool:
        """Check if this implementation is compatible with an agent."""
        compat = self.agent_compatibility.get(agent, "supported")
        return compat not in ("not_supported", "none")

    def get_compatibility(self, agent: str) -> ToolCompatibility:
        """Get compatibility level for an agent."""
        compat_str = self.agent_compatibility.get(agent, "supported")
        try:
            return ToolCompatibility(compat_str)
        except ValueError:
            return ToolCompatibility.SUPPORTED


@dataclass
class ToolAuth:
    """Authentication configuration for a tool."""

    type: str  # "oauth2", "bearer_token", "api_key", "none"
    token_env: str = ""
    scopes: list[str] = field(default_factory=list)
    provider: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolDefinition:
    """Complete definition of a tool from the registry."""

    name: str
    description: str = ""
    category: str = ""
    implementations: list[ToolImplementation] = field(default_factory=list)
    authentication: ToolAuth | None = None
    rate_limits: dict[str, Any] = field(default_factory=dict)

    def get_best_implementation(self, agent: str) -> ToolImplementation | None:
        """
        Get the best compatible implementation for an agent.

        Returns the highest priority implementation that is compatible.
        """
        compatible = [impl for impl in self.implementations if impl.is_compatible_with(agent)]

        if not compatible:
            return None

        # Sort by priority (lower is better) and prefer native/supported
        def sort_key(impl: ToolImplementation) -> tuple[int, int]:
            compat = impl.get_compatibility(agent)
            compat_order = {
                ToolCompatibility.NATIVE: 0,
                ToolCompatibility.SUPPORTED: 1,
                ToolCompatibility.VIA_BRIDGE: 2,
            }
            return (impl.priority, compat_order.get(compat, 3))

        compatible.sort(key=sort_key)
        return compatible[0]


class Tool(ABC):
    """
    Abstract base class for tool implementations.

    A Tool provides a way to execute operations against an external service.
    """

    def __init__(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
    ) -> None:
        """
        Initialize the tool.

        Args:
            definition: Tool definition from registry
            implementation: Specific implementation to use
        """
        self.definition = definition
        self.implementation = implementation
        self._initialized = False

    @property
    def name(self) -> str:
        """Get the tool name."""
        return self.definition.name

    @property
    def tool_type(self) -> ToolType:
        """Get the tool implementation type."""
        return self.implementation.type

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the tool (connect, authenticate, etc.)."""
        pass

    @abstractmethod
    async def execute(
        self,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """
        Execute a tool operation.

        Args:
            operation: Operation name (e.g., "create_issue", "send_message")
            params: Operation parameters

        Returns:
            Operation result
        """
        pass

    @abstractmethod
    def list_operations(self) -> list[str]:
        """
        List available operations.

        Returns:
            List of operation names
        """
        pass

    @abstractmethod
    def get_operation_schema(self, operation: str) -> dict[str, Any]:
        """
        Get the schema for an operation.

        Args:
            operation: Operation name

        Returns:
            JSON Schema for the operation parameters
        """
        pass

    async def shutdown(self) -> None:
        """Clean up tool resources."""
        self._initialized = False

    def to_function_schema(self, operation: str) -> dict[str, Any]:
        """
        Convert an operation to OpenAI function calling schema.

        Args:
            operation: Operation name

        Returns:
            Function schema compatible with OpenAI/Anthropic APIs
        """
        op_schema = self.get_operation_schema(operation)
        return {
            "name": f"{self.name}.{operation}",
            "description": op_schema.get("description", ""),
            "parameters": op_schema.get("parameters", {}),
        }


class ToolRegistry:
    """
    Registry of available tools.

    Manages tool discovery, loading, and selection based on agent compatibility.
    """

    def __init__(self, registry_path: str | Path | None = None) -> None:
        """
        Initialize the tool registry.

        Args:
            registry_path: Path to registry.yaml file
        """
        self._definitions: dict[str, ToolDefinition] = {}
        self._tools: dict[str, dict[str, Tool]] = {}  # name -> {agent -> Tool}
        self._registry_path = Path(registry_path) if registry_path else None

        if self._registry_path and self._registry_path.exists():
            self.load_registry(self._registry_path)

    def load_registry(self, path: Path) -> None:
        """
        Load tool definitions from a registry file.

        Args:
            path: Path to registry.yaml
        """
        content = path.read_text(encoding="utf-8")
        data = yaml.safe_load(content)

        for tool_data in data.get("tools", []):
            definition = self._parse_tool_definition(tool_data)
            self._definitions[definition.name] = definition

    def _parse_tool_definition(self, data: dict[str, Any]) -> ToolDefinition:
        """Parse a tool definition from YAML data."""
        implementations = []
        for impl_data in data.get("implementations", []):
            implementations.append(
                ToolImplementation(
                    type=ToolType(impl_data.get("type", "custom")),
                    priority=impl_data.get("priority", 1),
                    config_path=impl_data.get("config_path", ""),
                    spec_path=impl_data.get("spec_path", ""),
                    spec_url=impl_data.get("spec_url", ""),
                    adapter_path=impl_data.get("adapter_path", ""),
                    package=impl_data.get("package", ""),
                    agent_compatibility=impl_data.get("agent_compatibility", {}),
                )
            )

        auth_data = data.get("authentication", {})
        auth = None
        if auth_data:
            auth = ToolAuth(
                type=auth_data.get("type", "none"),
                token_env=auth_data.get("token_env", ""),
                scopes=auth_data.get("scopes", []),
                provider=auth_data.get("provider", ""),
            )

        return ToolDefinition(
            name=data.get("name", ""),
            description=data.get("description", ""),
            category=data.get("category", ""),
            implementations=implementations,
            authentication=auth,
            rate_limits=data.get("rate_limits", {}),
        )

    def register(self, definition: ToolDefinition) -> None:
        """
        Register a tool definition.

        Args:
            definition: Tool definition to register
        """
        self._definitions[definition.name] = definition

    def has_tool(self, name: str, agent: str | None = None) -> bool:
        """
        Check if a tool is available.

        Args:
            name: Tool name
            agent: Optional agent to check compatibility for

        Returns:
            True if tool is available
        """
        if name not in self._definitions:
            return False

        if agent:
            definition = self._definitions[name]
            return definition.get_best_implementation(agent) is not None

        return True

    def get_tool(self, name: str, agent: str) -> Tool | None:
        """
        Get a tool instance for an agent.

        Args:
            name: Tool name
            agent: Agent name

        Returns:
            Tool instance or None if not available
        """
        # Check cache
        if name in self._tools and agent in self._tools[name]:
            return self._tools[name][agent]

        # Get definition
        definition = self._definitions.get(name)
        if not definition:
            return None

        # Get best implementation
        implementation = definition.get_best_implementation(agent)
        if not implementation:
            return None

        # Create tool instance
        tool = self._create_tool(definition, implementation)

        # Cache
        if name not in self._tools:
            self._tools[name] = {}
        self._tools[name][agent] = tool

        return tool

    def _create_tool(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
    ) -> Tool:
        """Create a tool instance based on implementation type."""
        if implementation.type == ToolType.MCP:
            from aiworkflow.tools.mcp_bridge import MCPTool

            return MCPTool(definition, implementation)
        elif implementation.type == ToolType.OPENAPI:
            from aiworkflow.tools.openapi import OpenAPITool

            return OpenAPITool(definition, implementation)
        else:
            from aiworkflow.tools.custom import CustomTool

            return CustomTool(definition, implementation)

    def list_tools(self) -> list[str]:
        """
        List all registered tool names.

        Returns:
            List of tool names
        """
        return list(self._definitions.keys())

    def list_compatible_tools(self, agent: str) -> list[str]:
        """
        List tools compatible with an agent.

        Args:
            agent: Agent name

        Returns:
            List of compatible tool names
        """
        compatible = []
        for name, definition in self._definitions.items():
            if definition.get_best_implementation(agent) is not None:
                compatible.append(name)
        return compatible

    def get_definition(self, name: str) -> ToolDefinition | None:
        """
        Get a tool definition by name.

        Args:
            name: Tool name

        Returns:
            Tool definition or None
        """
        return self._definitions.get(name)

    def get_all_function_schemas(self, agent: str) -> list[dict[str, Any]]:
        """
        Get function schemas for all compatible tools.

        Args:
            agent: Agent name

        Returns:
            List of function schemas for use with LLM APIs
        """
        schemas = []
        for name in self.list_compatible_tools(agent):
            tool = self.get_tool(name, agent)
            if tool:
                for operation in tool.list_operations():
                    schemas.append(tool.to_function_schema(operation))
        return schemas
