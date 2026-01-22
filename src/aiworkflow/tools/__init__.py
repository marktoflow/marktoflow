"""
Tool integration for aiworkflow framework.
"""

from aiworkflow.tools.registry import Tool, ToolRegistry
from aiworkflow.tools.mcp_bridge import MCPBridge, MCPToolAdapter
from aiworkflow.tools.script import (
    ScriptTool,
    ScriptToolLoader,
    ScriptOperation,
    ScriptToolConfig,
    create_script_tool,
)
from aiworkflow.tools.bundle import (
    WorkflowBundle,
    BundleConfig,
    BundleToolRegistry,
    load_bundle,
    is_bundle,
)

__all__ = [
    # Registry
    "Tool",
    "ToolRegistry",
    # MCP Bridge
    "MCPBridge",
    "MCPToolAdapter",
    # Script Tools
    "ScriptTool",
    "ScriptToolLoader",
    "ScriptOperation",
    "ScriptToolConfig",
    "create_script_tool",
    # Bundles
    "WorkflowBundle",
    "BundleConfig",
    "BundleToolRegistry",
    "load_bundle",
    "is_bundle",
]
