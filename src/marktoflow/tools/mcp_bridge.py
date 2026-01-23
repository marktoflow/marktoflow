"""
MCP Bridge for marktoflow framework.

Enables agents without native MCP support to use MCP tools by providing
a bridge layer that translates between MCP protocol and standard function calls.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from marktoflow.tools.registry import (
    Tool,
    ToolDefinition,
    ToolImplementation,
    ToolType,
)


@dataclass
class MCPToolSchema:
    """Schema for an MCP tool."""

    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)


@dataclass
class MCPCallResult:
    """Result from an MCP tool call."""

    is_error: bool
    content: Any
    metadata: dict[str, Any] = field(default_factory=dict)


class MCPToolAdapter:
    """
    Adapter for a single MCP tool.

    Converts between MCP tool format and standard function call format.
    """

    def __init__(
        self,
        mcp_tool: MCPToolSchema,
        server_name: str,
    ) -> None:
        """
        Initialize the MCP tool adapter.

        Args:
            mcp_tool: MCP tool schema
            server_name: Name of the MCP server
        """
        self.mcp_tool = mcp_tool
        self.server_name = server_name
        self._schema = self._parse_schema(mcp_tool.input_schema)

    def _parse_schema(self, input_schema: dict[str, Any]) -> dict[str, Any]:
        """Parse and normalize the MCP input schema."""
        if not input_schema:
            return {"type": "object", "properties": {}}
        return input_schema

    def convert_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Convert standard params to MCP format.

        Args:
            params: Standard function parameters

        Returns:
            MCP-formatted arguments
        """
        return {"arguments": params}

    def convert_result(self, mcp_result: MCPCallResult) -> dict[str, Any]:
        """
        Convert MCP result to standard format.

        Args:
            mcp_result: Result from MCP tool call

        Returns:
            Standardized result dict
        """
        return {
            "success": not mcp_result.is_error,
            "data": mcp_result.content,
            "metadata": {
                "tool": self.mcp_tool.name,
                "server": self.server_name,
                **mcp_result.metadata,
            },
        }

    def to_function_schema(self) -> dict[str, Any]:
        """
        Convert MCP tool schema to OpenAI function format.

        Returns:
            Function schema for LLM APIs
        """
        return {
            "name": self.mcp_tool.name,
            "description": self.mcp_tool.description,
            "parameters": self._schema,
        }

    @property
    def name(self) -> str:
        """Get the tool name."""
        return self.mcp_tool.name

    @property
    def description(self) -> str:
        """Get the tool description."""
        return self.mcp_tool.description


class MCPBridge:
    """
    Bridge layer between MCP servers and non-native agents.

    Allows agents that don't have native MCP support (like Aider)
    to still use MCP tools through a translation layer.
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        """
        Initialize the MCP bridge.

        Args:
            config: MCP server configurations
        """
        self.config = config or {}
        self._servers: dict[str, Any] = {}  # Server connections
        self._tools: dict[str, MCPToolAdapter] = {}  # Tool adapters
        self._initialized = False

    async def initialize(self) -> None:
        """
        Initialize connections to MCP servers.

        This discovers and connects to configured MCP servers,
        then registers all their tools.
        """
        for server_name, server_config in self.config.items():
            await self._connect_server(server_name, server_config)

        self._initialized = True

    async def _connect_server(
        self,
        name: str,
        config: dict[str, Any],
    ) -> None:
        """
        Connect to an MCP server.

        Args:
            name: Server name
            config: Server configuration
        """
        # In a full implementation, this would:
        # 1. Start the MCP server process (if needed)
        # 2. Establish stdio/SSE connection
        # 3. Complete the initialization handshake
        # 4. Discover available tools

        # For now, we simulate the connection
        server = MCPServerStub(name, config)
        self._servers[name] = server

        # Register tools from this server
        for tool in server.list_tools():
            adapter = MCPToolAdapter(tool, name)
            self._tools[tool.name] = adapter

    def register_tools(self, server_name: str, tools: list[MCPToolSchema]) -> None:
        """
        Manually register tools from an MCP server.

        Args:
            server_name: Name of the MCP server
            tools: List of tool schemas
        """
        for tool in tools:
            adapter = MCPToolAdapter(tool, server_name)
            self._tools[tool.name] = adapter

    def get_tool(self, name: str) -> MCPToolAdapter | None:
        """
        Get an MCP tool adapter by name.

        Args:
            name: Tool name

        Returns:
            Tool adapter or None
        """
        return self._tools.get(name)

    async def call_tool(
        self,
        tool_name: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Call an MCP tool and return standardized result.

        Args:
            tool_name: Name of the tool
            params: Tool parameters

        Returns:
            Standardized result dict

        Raises:
            ValueError: If tool not found
        """
        adapter = self._tools.get(tool_name)
        if not adapter:
            raise ValueError(f"MCP tool not found: {tool_name}")

        # Get the server
        server = self._servers.get(adapter.server_name)
        if not server:
            raise ValueError(f"MCP server not found: {adapter.server_name}")

        # Convert params to MCP format
        mcp_params = adapter.convert_params(params)

        # Call the MCP server
        mcp_result = await server.call_tool(tool_name, mcp_params)

        # Convert result to standard format
        return adapter.convert_result(mcp_result)

    def list_tools(self) -> list[str]:
        """
        List all available MCP tools.

        Returns:
            List of tool names
        """
        return list(self._tools.keys())

    def get_all_function_schemas(self) -> list[dict[str, Any]]:
        """
        Get function schemas for all MCP tools.

        Returns:
            List of function schemas
        """
        return [adapter.to_function_schema() for adapter in self._tools.values()]

    async def shutdown(self) -> None:
        """Disconnect from all MCP servers."""
        for server in self._servers.values():
            await server.shutdown()
        self._servers.clear()
        self._tools.clear()
        self._initialized = False

    async def cleanup(self) -> None:
        """Compatibility alias for shutdown."""
        await self.shutdown()


class MCPServerStub:
    """
    Stub implementation of an MCP server connection.

    In production, this would be replaced with actual MCP protocol
    communication using the mcp Python library.
    """

    def __init__(self, name: str, config: dict[str, Any]) -> None:
        """
        Initialize the server stub.

        Args:
            name: Server name
            config: Server configuration
        """
        self.name = name
        self.config = config
        self._tools: list[MCPToolSchema] = []

    def list_tools(self) -> list[MCPToolSchema]:
        """
        List tools provided by this server.

        Returns:
            List of tool schemas
        """
        # In production, this would query the MCP server
        return self._tools

    async def call_tool(
        self,
        tool_name: str,
        params: dict[str, Any],
    ) -> MCPCallResult:
        """
        Call a tool on this server.

        Args:
            tool_name: Tool name
            params: Tool parameters (in MCP format)

        Returns:
            MCP call result
        """
        # In production, this would send the request to the MCP server
        return MCPCallResult(
            is_error=False,
            content={"message": f"Tool {tool_name} called (stub)"},
        )

    async def shutdown(self) -> None:
        """Shutdown the server connection."""
        pass


class MCPTool(Tool):
    """
    Tool implementation that uses MCP bridge.

    This wraps an MCP server tool for use through the tool registry.
    """

    def __init__(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
    ) -> None:
        """
        Initialize the MCP tool.

        Args:
            definition: Tool definition
            implementation: MCP implementation details
        """
        super().__init__(definition, implementation)
        self._bridge: MCPBridge | None = None
        self._operations: list[str] = []
        self._schemas: dict[str, dict[str, Any]] = {}

    async def initialize(self) -> None:
        """Initialize connection to MCP server."""
        # Load MCP server config
        config = {}
        if self.implementation.config_path:
            import yaml
            from pathlib import Path

            config_path = Path(self.implementation.config_path)
            if config_path.exists():
                config = yaml.safe_load(config_path.read_text())

        # Create bridge for this tool's MCP server
        self._bridge = MCPBridge({self.name: config})
        await self._bridge.initialize()

        # Get available operations
        self._operations = self._bridge.list_tools()

        # Get schemas
        for schema in self._bridge.get_all_function_schemas():
            op_name = schema["name"].split(".")[-1] if "." in schema["name"] else schema["name"]
            self._schemas[op_name] = schema

        self._initialized = True

    async def execute(
        self,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """
        Execute an MCP tool operation.

        Args:
            operation: Operation name
            params: Operation parameters

        Returns:
            Operation result
        """
        if not self._bridge:
            await self.initialize()

        # Map operation to MCP tool name
        tool_name = operation
        if operation in self._schemas:
            tool_name = self._schemas[operation].get("name", operation)

        if self._bridge is None:
            raise RuntimeError("MCP bridge not initialized")

        bridge = self._bridge  # Type narrowing
        result = await bridge.call_tool(tool_name, params)

        if not result.get("success", False):
            raise RuntimeError(f"MCP tool call failed: {result.get('data')}")

        return result.get("data")

    def list_operations(self) -> list[str]:
        """List available operations."""
        return list(self._schemas.keys())

    def get_operation_schema(self, operation: str) -> dict[str, Any]:
        """Get schema for an operation."""
        return self._schemas.get(
            operation,
            {
                "description": f"Operation: {operation}",
                "parameters": {"type": "object", "properties": {}},
            },
        )

    async def shutdown(self) -> None:
        """Shutdown MCP connection."""
        if self._bridge:
            await self._bridge.shutdown()
        await super().shutdown()
