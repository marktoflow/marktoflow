"""
Workflow Bundle - Self-contained workflow directories.

A workflow bundle is a directory containing:
- workflow.md (or any .md file) - The workflow definition
- tools/ - Directory containing script tools
- tools.yaml (optional) - Tool metadata and configuration
- config.yaml (optional) - Workflow-specific configuration

Usage:
    bundle = WorkflowBundle("/path/to/my-workflow")
    workflow = bundle.load_workflow()
    tools = bundle.load_tools()

    # Or run directly
    result = await bundle.execute(inputs={"key": "value"})
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from marktoflow.core.models import Workflow
from marktoflow.core.parser import WorkflowParser
from marktoflow.tools.registry import (
    ToolRegistry,
    ToolDefinition,
    ToolImplementation,
    ToolType,
    Tool,
)
from marktoflow.tools.script import ScriptTool, ScriptToolLoader


@dataclass
class BundleConfig:
    """Configuration for a workflow bundle."""

    # Agent settings
    agent: str = "opencode"
    fallback_agent: str | None = None

    # Execution settings
    timeout: int = 300
    max_retries: int = 3

    # Tool settings
    tools_dir: str = "tools"
    inherit_global_tools: bool = True

    # Environment variables to pass to scripts
    env: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BundleConfig":
        """Create from dictionary."""
        return cls(
            agent=data.get("agent", "opencode"),
            fallback_agent=data.get("fallback_agent"),
            timeout=data.get("timeout", 300),
            max_retries=data.get("max_retries", 3),
            tools_dir=data.get("tools_dir", "tools"),
            inherit_global_tools=data.get("inherit_global_tools", True),
            env=data.get("env", {}),
        )

    @classmethod
    def from_yaml(cls, path: Path) -> "BundleConfig":
        """Load from YAML file."""
        if not path.exists():
            return cls()
        content = path.read_text(encoding="utf-8")
        data = yaml.safe_load(content) or {}
        return cls.from_dict(data)


class BundleToolRegistry(ToolRegistry):
    """
    Tool registry for a workflow bundle.

    Extends the standard registry with bundle-local script tools.
    """

    def __init__(
        self,
        bundle_dir: Path,
        tools_dir: str = "tools",
        inherit_global: bool = True,
        global_registry_path: Path | None = None,
    ) -> None:
        """
        Initialize the bundle tool registry.

        Args:
            bundle_dir: Bundle directory path
            tools_dir: Subdirectory name for tools (default: "tools")
            inherit_global: Whether to inherit tools from global registry
            global_registry_path: Path to global registry.yaml
        """
        # Initialize parent with global registry if inheriting
        super().__init__(global_registry_path if inherit_global else None)

        self._bundle_dir = Path(bundle_dir)
        self._tools_dir = self._bundle_dir / tools_dir
        self._script_tools: dict[str, ScriptTool] = {}

        # Load bundle-local script tools
        self._load_script_tools()

    def _load_script_tools(self) -> None:
        """Load script tools from the bundle's tools directory."""
        if not self._tools_dir.exists():
            return

        loader = ScriptToolLoader(self._tools_dir)
        self._script_tools = loader.load_tools()

        # Register script tools in the main registry
        for name, tool in self._script_tools.items():
            self._definitions[name] = tool.definition
            # Pre-cache the tool (no agent-specific selection needed for scripts)
            if name not in self._tools:
                self._tools[name] = {}
            self._tools[name]["_script"] = tool

    def get_tool(self, name: str, agent: str = "opencode") -> Tool | None:
        """
        Get a tool by name.

        Script tools take priority over inherited global tools.

        Args:
            name: Tool name
            agent: Agent requesting the tool

        Returns:
            Tool instance or None
        """
        # Check script tools first
        if name in self._script_tools:
            return self._script_tools[name]

        # Fall back to parent implementation (global tools)
        return super().get_tool(name, agent)

    def list_tools(self) -> list[str]:
        """List all available tools (bundle + global)."""
        tools = set(super().list_tools())
        tools.update(self._script_tools.keys())
        return sorted(tools)

    def list_script_tools(self) -> list[str]:
        """List only bundle-local script tools."""
        return list(self._script_tools.keys())


class WorkflowBundle:
    """
    A self-contained workflow directory.

    Structure:
        my-workflow/
        ├── workflow.md         # Main workflow (or *.md)
        ├── tools/              # Script tools
        │   ├── build.sh
        │   ├── deploy.py
        │   └── ...
        ├── tools.yaml          # Optional: tool metadata
        └── config.yaml         # Optional: bundle config
    """

    def __init__(
        self,
        path: str | Path,
        global_registry_path: Path | None = None,
    ) -> None:
        """
        Initialize a workflow bundle.

        Args:
            path: Path to the bundle directory
            global_registry_path: Optional path to global tool registry
        """
        self.path = Path(path).expanduser().absolute()

        if not self.path.exists():
            raise FileNotFoundError(f"Bundle directory not found: {self.path}")

        if not self.path.is_dir():
            raise ValueError(f"Bundle path must be a directory: {self.path}")

        self._global_registry_path = global_registry_path
        self._config: BundleConfig | None = None
        self._workflow: Workflow | None = None
        self._tool_registry: BundleToolRegistry | None = None

    @property
    def name(self) -> str:
        """Get the bundle name (directory name)."""
        return self.path.name

    @property
    def config(self) -> BundleConfig:
        """Get the bundle configuration."""
        if self._config is None:
            config_path = self.path / "config.yaml"
            self._config = BundleConfig.from_yaml(config_path)
        return self._config

    @property
    def tools_dir(self) -> Path:
        """Get the tools directory path."""
        return self.path / self.config.tools_dir

    @property
    def workflow_file(self) -> Path | None:
        """
        Find the workflow file in the bundle.

        Looks for:
        1. workflow.md
        2. Any single .md file
        3. main.md
        """
        # Check for workflow.md
        workflow_path = self.path / "workflow.md"
        if workflow_path.exists():
            return workflow_path

        # Check for main.md
        main_path = self.path / "main.md"
        if main_path.exists():
            return main_path

        # Find any .md file (excluding README.md)
        md_files = [
            f
            for f in self.path.glob("*.md")
            if f.name.lower() not in ("readme.md", "changelog.md", "license.md")
        ]

        if len(md_files) == 1:
            return md_files[0]
        elif len(md_files) > 1:
            # Prefer workflow.md or main.md patterns
            for pattern in ["workflow", "main", "index"]:
                for f in md_files:
                    if pattern in f.stem.lower():
                        return f
            # Just take the first one
            return md_files[0]

        return None

    def load_workflow(self) -> Workflow:
        """
        Load and parse the workflow from the bundle.

        Returns:
            Parsed Workflow object
        """
        if self._workflow is not None:
            return self._workflow

        workflow_path = self.workflow_file
        if workflow_path is None:
            raise FileNotFoundError(f"No workflow file found in bundle: {self.path}")

        parser = WorkflowParser()
        self._workflow = parser.parse_file(workflow_path)
        self._workflow.source_path = str(workflow_path)

        return self._workflow

    def load_tools(self) -> BundleToolRegistry:
        """
        Load the tool registry for this bundle.

        Returns:
            BundleToolRegistry with script tools and optionally global tools
        """
        if self._tool_registry is not None:
            return self._tool_registry

        self._tool_registry = BundleToolRegistry(
            bundle_dir=self.path,
            tools_dir=self.config.tools_dir,
            inherit_global=self.config.inherit_global_tools,
            global_registry_path=self._global_registry_path,
        )

        return self._tool_registry

    def validate(self) -> list[str]:
        """
        Validate the bundle.

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Check workflow exists and is valid
        workflow_path = self.workflow_file
        if workflow_path is None:
            errors.append("No workflow file found (expected workflow.md or *.md)")
        else:
            try:
                workflow = self.load_workflow()
                parser = WorkflowParser()
                workflow_errors = parser.validate(workflow)
                errors.extend(workflow_errors)
            except Exception as e:
                errors.append(f"Failed to parse workflow: {e}")

        # Check tools directory
        if self.tools_dir.exists():
            # Check that scripts are executable
            for script in self.tools_dir.iterdir():
                if script.is_file() and not script.name.startswith("."):
                    if script.suffix not in (".yaml", ".md", ".txt"):
                        # Should be executable
                        if not os.access(script, os.X_OK):
                            # Check for shebang
                            try:
                                with open(script, "rb") as f:
                                    first_bytes = f.read(2)
                                    if first_bytes != b"#!":
                                        errors.append(
                                            f"Script not executable and no shebang: {script.name}"
                                        )
                            except Exception:
                                pass

        return errors

    async def execute(
        self,
        inputs: dict[str, Any] | None = None,
        agent: str | None = None,
    ) -> Any:
        """
        Execute the workflow in this bundle.

        Args:
            inputs: Workflow input parameters
            agent: Agent to use (overrides config)

        Returns:
            Workflow result
        """
        from marktoflow.core.engine import WorkflowEngine

        workflow = self.load_workflow()
        tool_registry = self.load_tools()

        # Create engine with bundle configuration
        engine_config = {
            "agent": {
                "primary": agent or self.config.agent,
                "fallback": self.config.fallback_agent,
            },
            "timeout": self.config.timeout,
            "max_retries": self.config.max_retries,
        }

        engine = WorkflowEngine(config=engine_config)

        # Set environment variables from config
        original_env = {}
        for key, value in self.config.env.items():
            original_env[key] = os.environ.get(key)
            os.environ[key] = value

        try:
            result = await engine.execute(
                workflow,
                inputs=inputs or {},
                tool_registry=tool_registry,
            )
            return result
        finally:
            # Restore environment
            for key, value in original_env.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def get_info(self) -> dict[str, Any]:
        """
        Get information about the bundle.

        Returns:
            Dictionary with bundle information
        """
        workflow = None
        workflow_error = None
        try:
            workflow = self.load_workflow()
        except Exception as e:
            workflow_error = str(e)

        tools = self.load_tools()

        return {
            "name": self.name,
            "path": str(self.path),
            "workflow_file": str(self.workflow_file) if self.workflow_file else None,
            "workflow": {
                "id": workflow.metadata.id if workflow else None,
                "name": workflow.metadata.name if workflow else None,
                "version": workflow.metadata.version if workflow else None,
                "steps": len(workflow.steps) if workflow else 0,
                "error": workflow_error,
            },
            "tools": {
                "script_tools": tools.list_script_tools(),
                "all_tools": tools.list_tools(),
                "tools_dir": str(self.tools_dir),
                "tools_dir_exists": self.tools_dir.exists(),
            },
            "config": {
                "agent": self.config.agent,
                "fallback_agent": self.config.fallback_agent,
                "timeout": self.config.timeout,
                "inherit_global_tools": self.config.inherit_global_tools,
            },
        }

    def __repr__(self) -> str:
        return f"WorkflowBundle({self.path})"


def load_bundle(path: str | Path) -> WorkflowBundle:
    """
    Load a workflow bundle from a directory.

    Convenience function for loading bundles.

    Args:
        path: Path to bundle directory

    Returns:
        WorkflowBundle instance
    """
    return WorkflowBundle(path)


def is_bundle(path: str | Path) -> bool:
    """
    Check if a path is a valid workflow bundle.

    Args:
        path: Path to check

    Returns:
        True if path is a valid bundle directory
    """
    path = Path(path)

    if not path.is_dir():
        return False

    # Must have at least one .md file (workflow)
    md_files = list(path.glob("*.md"))
    if not md_files:
        return False

    # Should have either tools/ directory or a workflow with steps
    tools_dir = path / "tools"
    if tools_dir.exists():
        return True

    # Check if any .md file looks like a workflow (has YAML frontmatter)
    for md_file in md_files:
        try:
            content = md_file.read_text(encoding="utf-8")
            if content.startswith("---"):
                return True
        except Exception:
            pass

    return False
