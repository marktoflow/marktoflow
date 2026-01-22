"""
Script Tool implementation for executable script tools.

Allows workflows to use bash scripts, Python scripts, or any executable as tools.
Scripts receive inputs as CLI arguments (--key=value) and return output on stdout.
"""

from __future__ import annotations

import asyncio
import json
import os
import shlex
import stat
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from aiworkflow.tools.registry import Tool, ToolDefinition, ToolImplementation, ToolType


@dataclass
class ScriptOperation:
    """Represents an operation provided by a script."""

    name: str
    script_path: Path
    description: str = ""
    parameters: dict[str, Any] = field(default_factory=dict)
    timeout: int = 300  # 5 minutes default
    working_dir: Path | None = None
    env: dict[str, str] = field(default_factory=dict)

    def to_schema(self) -> dict[str, Any]:
        """Convert to JSON Schema format."""
        return {
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self.parameters,
                "required": [k for k, v in self.parameters.items() if v.get("required", False)],
            },
        }


@dataclass
class ScriptToolConfig:
    """Configuration for a script tool from tools.yaml manifest."""

    name: str
    script: str  # Relative path to script
    description: str = ""
    operations: dict[str, dict[str, Any]] = field(default_factory=dict)
    timeout: int = 300
    env: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ScriptToolConfig":
        """Create from dictionary."""
        return cls(
            name=data["name"],
            script=data["script"],
            description=data.get("description", ""),
            operations=data.get("operations", {}),
            timeout=data.get("timeout", 300),
            env=data.get("env", {}),
        )


class ScriptTool(Tool):
    """
    Tool that executes scripts (bash, Python, or any executable).

    Scripts receive inputs as CLI arguments:
        ./script.sh --key1=value1 --key2=value2

    Scripts return output on stdout:
        - If output is valid JSON, it's parsed
        - Otherwise, returned as plain text

    For multi-operation scripts, the operation name is passed as the first argument:
        ./script.sh operation_name --key1=value1
    """

    def __init__(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
        tools_dir: Path | None = None,
    ) -> None:
        """
        Initialize the script tool.

        Args:
            definition: Tool definition from registry
            implementation: Specific implementation to use
            tools_dir: Base directory for script discovery
        """
        super().__init__(definition, implementation)
        self._tools_dir = tools_dir
        self._operations: dict[str, ScriptOperation] = {}
        self._script_path: Path | None = None
        self._multi_operation = False  # Does script handle multiple operations?

    async def initialize(self) -> None:
        """Initialize the script tool by discovering operations."""
        if self._initialized:
            return

        # Determine script path
        script_path = self.implementation.adapter_path
        if script_path:
            self._script_path = Path(script_path)
            if self._tools_dir and not self._script_path.is_absolute():
                self._script_path = self._tools_dir / self._script_path

        if self._script_path and self._script_path.exists():
            # Single script - operations come from manifest or are inferred
            await self._load_script_operations()
        else:
            raise FileNotFoundError(f"Script not found: {self._script_path}")

        self._initialized = True

    async def _load_script_operations(self) -> None:
        """Load operations for the script."""
        # Check if script has a companion .yaml file with operation definitions
        yaml_path = self._script_path.with_suffix(".yaml")
        if yaml_path.exists():
            await self._load_operations_from_yaml(yaml_path)
        else:
            # Default: single operation with the tool name
            self._operations["run"] = ScriptOperation(
                name="run",
                script_path=self._script_path,
                description=self.definition.description or f"Execute {self._script_path.name}",
            )

    async def _load_operations_from_yaml(self, yaml_path: Path) -> None:
        """Load operations from companion YAML file."""
        content = yaml_path.read_text(encoding="utf-8")
        data = yaml.safe_load(content) or {}

        operations = data.get("operations", {})
        if operations:
            self._multi_operation = True
            for op_name, op_data in operations.items():
                self._operations[op_name] = ScriptOperation(
                    name=op_name,
                    script_path=self._script_path,
                    description=op_data.get("description", ""),
                    parameters=op_data.get("parameters", {}),
                    timeout=op_data.get("timeout", 300),
                )
        else:
            # Single operation with metadata from YAML
            self._operations["run"] = ScriptOperation(
                name="run",
                script_path=self._script_path,
                description=data.get("description", ""),
                parameters=data.get("parameters", {}),
                timeout=data.get("timeout", 300),
            )

    async def execute(
        self,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """
        Execute a script operation.

        Args:
            operation: Operation name
            params: Operation parameters

        Returns:
            Script output (JSON parsed if valid, otherwise string)
        """
        if not self._initialized:
            await self.initialize()

        if operation not in self._operations:
            raise ValueError(
                f"Unknown operation: {operation}. Available: {list(self._operations.keys())}"
            )

        op = self._operations[operation]

        # Build command
        cmd = [str(op.script_path)]

        # For multi-operation scripts, pass operation name first
        if self._multi_operation:
            cmd.append(operation)

        # Add parameters as --key=value arguments
        for key, value in params.items():
            if value is None:
                continue
            elif isinstance(value, bool):
                if value:
                    cmd.append(f"--{key}")
            elif isinstance(value, (list, dict)):
                # Complex values as JSON
                cmd.append(f"--{key}={json.dumps(value)}")
            else:
                cmd.append(f"--{key}={value}")

        # Prepare environment
        env = os.environ.copy()
        env.update(op.env)
        # Add workflow context as env vars
        env["AIWORKFLOW_TOOL"] = self.name
        env["AIWORKFLOW_OPERATION"] = operation

        # Execute script
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=op.working_dir,
                env=env,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=op.timeout,
            )

            stdout_str = stdout.decode("utf-8").strip()
            stderr_str = stderr.decode("utf-8").strip()

            if process.returncode != 0:
                raise RuntimeError(
                    f"Script failed with exit code {process.returncode}: {stderr_str or stdout_str}"
                )

            # Try to parse output as JSON
            if stdout_str:
                try:
                    return json.loads(stdout_str)
                except json.JSONDecodeError:
                    return stdout_str

            return {"success": True, "stderr": stderr_str} if stderr_str else {"success": True}

        except asyncio.TimeoutError:
            raise TimeoutError(f"Script timed out after {op.timeout} seconds")

    def list_operations(self) -> list[str]:
        """List available operations."""
        return list(self._operations.keys())

    def get_operation_schema(self, operation: str) -> dict[str, Any]:
        """Get the schema for an operation."""
        if operation not in self._operations:
            raise ValueError(f"Unknown operation: {operation}")
        return self._operations[operation].to_schema()


class ScriptToolLoader:
    """
    Discovers and loads script tools from a directory.

    Scans a tools/ directory and creates ScriptTool instances for each executable.
    Optionally loads metadata from tools.yaml manifest.
    """

    def __init__(self, tools_dir: Path) -> None:
        """
        Initialize the script tool loader.

        Args:
            tools_dir: Directory containing script tools
        """
        self.tools_dir = Path(tools_dir)
        self._manifest: dict[str, ScriptToolConfig] = {}

    def load_manifest(self) -> dict[str, ScriptToolConfig]:
        """Load tools.yaml manifest if present."""
        manifest_path = self.tools_dir / "tools.yaml"
        if not manifest_path.exists():
            return {}

        content = manifest_path.read_text(encoding="utf-8")
        data = yaml.safe_load(content) or {}

        for tool_data in data.get("tools", []):
            config = ScriptToolConfig.from_dict(tool_data)
            self._manifest[config.name] = config

        return self._manifest

    def discover_scripts(self) -> dict[str, Path]:
        """
        Discover executable scripts in the tools directory.

        Returns:
            Dict mapping tool name to script path
        """
        scripts: dict[str, Path] = {}

        if not self.tools_dir.exists():
            return scripts

        for path in self.tools_dir.iterdir():
            # Skip directories, hidden files, and manifest
            if (
                path.is_dir()
                or path.name.startswith(".")
                or path.name in ("tools.yaml", "README.md")
            ):
                continue

            # Skip companion YAML files (they're metadata, not tools)
            if path.suffix == ".yaml":
                continue

            # Check if file is executable
            if self._is_executable(path):
                # Tool name is filename without extension
                tool_name = path.stem
                scripts[tool_name] = path

        return scripts

    def _is_executable(self, path: Path) -> bool:
        """Check if a file is executable."""
        if not path.is_file():
            return False

        # Check file permissions
        mode = path.stat().st_mode
        if mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH):
            return True

        # On Windows or if permissions aren't set, check for known extensions
        executable_extensions = {".sh", ".bash", ".py", ".rb", ".pl", ".js", ".ts"}
        return path.suffix.lower() in executable_extensions

    def load_tools(self) -> dict[str, ScriptTool]:
        """
        Load all script tools from the directory.

        Returns:
            Dict mapping tool name to ScriptTool instance
        """
        tools: dict[str, ScriptTool] = {}

        # Load manifest for metadata
        self.load_manifest()

        # Discover scripts
        scripts = self.discover_scripts()

        for tool_name, script_path in scripts.items():
            # Get metadata from manifest if available
            manifest_config = self._manifest.get(tool_name)

            # Create tool definition
            definition = ToolDefinition(
                name=tool_name,
                description=manifest_config.description
                if manifest_config
                else f"Script tool: {tool_name}",
                category="script",
                implementations=[
                    ToolImplementation(
                        type=ToolType.CUSTOM,
                        priority=1,
                        adapter_path=str(script_path),
                    )
                ],
            )

            # Create implementation
            implementation = definition.implementations[0]

            # Create tool
            tool = ScriptTool(definition, implementation, tools_dir=self.tools_dir)
            tools[tool_name] = tool

        return tools

    def get_tool(self, name: str) -> ScriptTool | None:
        """
        Get a specific script tool by name.

        Args:
            name: Tool name

        Returns:
            ScriptTool instance or None
        """
        tools = self.load_tools()
        return tools.get(name)


def create_script_tool(
    name: str,
    script_path: str | Path,
    description: str = "",
    operations: dict[str, dict[str, Any]] | None = None,
) -> ScriptTool:
    """
    Create a script tool from a script path.

    Convenience function for programmatic tool creation.

    Args:
        name: Tool name
        script_path: Path to the script
        description: Tool description
        operations: Optional operation definitions

    Returns:
        ScriptTool instance
    """
    script_path = Path(script_path)

    definition = ToolDefinition(
        name=name,
        description=description or f"Script tool: {name}",
        category="script",
        implementations=[
            ToolImplementation(
                type=ToolType.CUSTOM,
                priority=1,
                adapter_path=str(script_path),
            )
        ],
    )

    implementation = definition.implementations[0]
    tool = ScriptTool(definition, implementation, tools_dir=script_path.parent)

    return tool
