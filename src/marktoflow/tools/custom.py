"""
Custom Tool implementation for marktoflow framework.

Enables using custom Python adapters for tool integration.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from marktoflow.tools.registry import (
    Tool,
    ToolDefinition,
    ToolImplementation,
)


class CustomTool(Tool):
    """
    Tool implementation using custom Python adapters.

    Loads and executes custom adapter code for tool operations.
    """

    def __init__(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
    ) -> None:
        """
        Initialize the custom tool.

        Args:
            definition: Tool definition
            implementation: Custom implementation details
        """
        super().__init__(definition, implementation)
        self._adapter: Any = None
        self._operations: dict[str, Any] = {}

    async def initialize(self) -> None:
        """Load the custom adapter module."""
        adapter_path = self.implementation.adapter_path

        if adapter_path:
            path = Path(adapter_path)
            if path.exists():
                self._adapter = self._load_adapter(path)
                self._discover_operations()

        self._initialized = True

    def _load_adapter(self, path: Path) -> Any:
        """
        Load a custom adapter from a Python file.

        Args:
            path: Path to the adapter.py file

        Returns:
            Loaded adapter module or class instance
        """
        spec = importlib.util.spec_from_file_location("adapter", path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load adapter from {path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Look for an Adapter class
        if hasattr(module, "Adapter"):
            return module.Adapter()

        # Or return the module itself
        return module

    def _discover_operations(self) -> None:
        """Discover available operations from the adapter."""
        if self._adapter is None:
            return

        # Look for methods that start with "op_" or are decorated
        for name in dir(self._adapter):
            if name.startswith("op_"):
                method = getattr(self._adapter, name)
                if callable(method):
                    op_name = name[3:]  # Remove "op_" prefix
                    self._operations[op_name] = {
                        "method": method,
                        "description": method.__doc__ or "",
                    }
            elif name.startswith("_") or name.startswith("__"):
                continue
            else:
                method = getattr(self._adapter, name)
                if callable(method) and hasattr(method, "_is_operation"):
                    self._operations[name] = {
                        "method": method,
                        "description": method.__doc__ or "",
                    }

        # Also check for an "operations" attribute
        if hasattr(self._adapter, "operations"):
            ops = self._adapter.operations
            if isinstance(ops, dict):
                for name, method in ops.items():
                    self._operations[name] = {
                        "method": method,
                        "description": method.__doc__ or "",
                    }

    async def execute(
        self,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """
        Execute a custom operation.

        Args:
            operation: Operation name
            params: Operation parameters

        Returns:
            Operation result
        """
        if operation not in self._operations:
            raise ValueError(f"Unknown operation: {operation}")

        method = self._operations[operation]["method"]

        # Check if method is async
        import asyncio

        if asyncio.iscoroutinefunction(method):
            return await method(**params)
        else:
            return method(**params)

    def list_operations(self) -> list[str]:
        """List available operations."""
        return list(self._operations.keys())

    def get_operation_schema(self, operation: str) -> dict[str, Any]:
        """Get schema for an operation."""
        if operation not in self._operations:
            return {}

        op = self._operations[operation]
        method = op["method"]

        # Try to extract schema from type hints
        import inspect

        sig = inspect.signature(method)

        properties = {}
        required = []

        for name, param in sig.parameters.items():
            if name == "self":
                continue

            param_type = "string"
            if param.annotation != inspect.Parameter.empty:
                type_map = {
                    str: "string",
                    int: "integer",
                    float: "number",
                    bool: "boolean",
                    list: "array",
                    dict: "object",
                }
                param_type = type_map.get(param.annotation, "string")

            properties[name] = {"type": param_type}

            if param.default == inspect.Parameter.empty:
                required.append(name)

        return {
            "description": op.get("description", ""),
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }


def operation(func: Any) -> Any:
    """
    Decorator to mark a method as a tool operation.

    Usage:
        class MyAdapter:
            @operation
            def my_operation(self, param1: str) -> dict:
                return {"result": param1}
    """
    func._is_operation = True
    return func
