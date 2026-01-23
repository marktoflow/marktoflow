"""Plugin system for marktoflow framework.

This module provides a flexible plugin architecture that allows:
- Plugin discovery from directories and entry points
- Hook points for extending workflow execution
- Plugin lifecycle management (load, enable, disable, unload)
- Plugin configuration and state management
"""

from __future__ import annotations

import importlib
import importlib.metadata
import importlib.util
import inspect
import json
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, TypeVar

T = TypeVar("T")


class PluginState(str, Enum):
    """Plugin lifecycle states."""

    DISCOVERED = "discovered"  # Found but not loaded
    LOADED = "loaded"  # Loaded but not enabled
    ENABLED = "enabled"  # Active and running
    DISABLED = "disabled"  # Loaded but not active
    ERROR = "error"  # Failed to load or enable


class HookType(str, Enum):
    """Types of hooks available in the workflow engine."""

    # Workflow lifecycle hooks
    WORKFLOW_BEFORE_START = "workflow_before_start"
    WORKFLOW_AFTER_START = "workflow_after_start"
    WORKFLOW_BEFORE_END = "workflow_before_end"
    WORKFLOW_AFTER_END = "workflow_after_end"
    WORKFLOW_ON_ERROR = "workflow_on_error"

    # Step lifecycle hooks
    STEP_BEFORE_EXECUTE = "step_before_execute"
    STEP_AFTER_EXECUTE = "step_after_execute"
    STEP_ON_RETRY = "step_on_retry"
    STEP_ON_SKIP = "step_on_skip"
    STEP_ON_ERROR = "step_on_error"

    # Agent hooks
    AGENT_BEFORE_SELECT = "agent_before_select"
    AGENT_AFTER_SELECT = "agent_after_select"
    AGENT_ON_FAILOVER = "agent_on_failover"

    # Tool hooks
    TOOL_BEFORE_CALL = "tool_before_call"
    TOOL_AFTER_CALL = "tool_after_call"
    TOOL_ON_ERROR = "tool_on_error"

    # Custom hook for user-defined events
    CUSTOM = "custom"


@dataclass
class PluginMetadata:
    """Metadata about a plugin."""

    name: str
    version: str
    description: str = ""
    author: str = ""
    homepage: str = ""
    license: str = ""
    requires: list[str] = field(default_factory=list)  # Other plugins required
    python_requires: str = ">=3.11"
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "homepage": self.homepage,
            "license": self.license,
            "requires": self.requires,
            "python_requires": self.python_requires,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PluginMetadata:
        """Deserialize from dictionary."""
        return cls(
            name=data["name"],
            version=data["version"],
            description=data.get("description", ""),
            author=data.get("author", ""),
            homepage=data.get("homepage", ""),
            license=data.get("license", ""),
            requires=data.get("requires", []),
            python_requires=data.get("python_requires", ">=3.11"),
            tags=data.get("tags", []),
        )


@dataclass
class HookContext:
    """Context passed to hook callbacks."""

    hook_type: HookType
    workflow_id: str | None = None
    step_index: int | None = None
    step_name: str | None = None
    agent_name: str | None = None
    tool_name: str | None = None
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def get(self, key: str, default: Any = None) -> Any:
        """Get data from context."""
        return self.data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set data in context."""
        self.data[key] = value


@dataclass
class HookResult:
    """Result from a hook callback."""

    success: bool = True
    modified_data: dict[str, Any] | None = None
    stop_propagation: bool = False  # Stop calling other hooks
    error: str | None = None


# Type alias for hook callbacks
HookCallback = Callable[[HookContext], HookResult | None]


class Plugin(ABC):
    """Base class for all plugins.

    Plugins extend the marktoflow framework by:
    - Registering hook callbacks
    - Providing custom tools
    - Adding workflow templates
    - Extending CLI commands
    """

    @property
    @abstractmethod
    def metadata(self) -> PluginMetadata:
        """Get plugin metadata."""
        pass

    def on_load(self) -> None:
        """Called when plugin is loaded.

        Override to perform initialization.
        """
        pass

    def on_enable(self) -> None:
        """Called when plugin is enabled.

        Override to activate plugin features.
        """
        pass

    def on_disable(self) -> None:
        """Called when plugin is disabled.

        Override to deactivate plugin features.
        """
        pass

    def on_unload(self) -> None:
        """Called when plugin is unloaded.

        Override to perform cleanup.
        """
        pass

    def get_hooks(self) -> dict[HookType, list[HookCallback]]:
        """Get hook callbacks provided by this plugin.

        Returns:
            Dictionary mapping hook types to callback lists
        """
        return {}

    def get_tools(self) -> list[Any]:
        """Get tools provided by this plugin.

        Returns:
            List of tool definitions
        """
        return []

    def get_templates(self) -> list[dict[str, Any]]:
        """Get workflow templates provided by this plugin.

        Returns:
            List of template definitions
        """
        return []

    def get_config_schema(self) -> dict[str, Any] | None:
        """Get JSON schema for plugin configuration.

        Returns:
            JSON schema dictionary or None
        """
        return None

    def configure(self, config: dict[str, Any]) -> None:
        """Configure the plugin.

        Args:
            config: Configuration dictionary
        """
        pass


class PluginInfo:
    """Runtime information about a loaded plugin."""

    def __init__(
        self,
        plugin: Plugin,
        source: str,  # "directory", "entrypoint", "manual"
        path: Path | None = None,
    ):
        self.plugin = plugin
        self.source = source
        self.path = path
        self.state = PluginState.LOADED
        self.error: str | None = None
        self.loaded_at = datetime.now()
        self.enabled_at: datetime | None = None
        self.config: dict[str, Any] = {}

    @property
    def metadata(self) -> PluginMetadata:
        """Get plugin metadata."""
        return self.plugin.metadata

    @property
    def name(self) -> str:
        """Get plugin name."""
        return self.metadata.name

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "metadata": self.metadata.to_dict(),
            "source": self.source,
            "path": str(self.path) if self.path else None,
            "state": self.state.value,
            "error": self.error,
            "loaded_at": self.loaded_at.isoformat(),
            "enabled_at": self.enabled_at.isoformat() if self.enabled_at else None,
            "config": self.config,
        }


class HookRegistry:
    """Registry for hook callbacks."""

    def __init__(self) -> None:
        self._hooks: dict[HookType, list[tuple[str, HookCallback, int]]] = {}
        for hook_type in HookType:
            self._hooks[hook_type] = []

    def register(
        self,
        hook_type: HookType,
        callback: HookCallback,
        plugin_name: str,
        priority: int = 100,
    ) -> None:
        """Register a hook callback.

        Args:
            hook_type: Type of hook
            callback: Callback function
            plugin_name: Name of plugin registering the hook
            priority: Lower priority runs first (default 100)
        """
        self._hooks[hook_type].append((plugin_name, callback, priority))
        # Sort by priority
        self._hooks[hook_type].sort(key=lambda x: x[2])

    def unregister(self, plugin_name: str) -> int:
        """Unregister all hooks for a plugin.

        Args:
            plugin_name: Name of plugin

        Returns:
            Number of hooks removed
        """
        count = 0
        for hook_type in HookType:
            original_len = len(self._hooks[hook_type])
            self._hooks[hook_type] = [
                (name, cb, priority)
                for name, cb, priority in self._hooks[hook_type]
                if name != plugin_name
            ]
            count += original_len - len(self._hooks[hook_type])
        return count

    def invoke(self, context: HookContext) -> list[HookResult]:
        """Invoke all callbacks for a hook type.

        Args:
            context: Hook context

        Returns:
            List of results from callbacks
        """
        results = []
        for plugin_name, callback, _ in self._hooks[context.hook_type]:
            try:
                result = callback(context)
                if result is None:
                    result = HookResult()
                results.append(result)

                if result.stop_propagation:
                    break
            except Exception as e:
                results.append(HookResult(success=False, error=str(e)))

        return results

    def get_hooks(self, hook_type: HookType) -> list[tuple[str, HookCallback]]:
        """Get all callbacks for a hook type.

        Returns:
            List of (plugin_name, callback) tuples
        """
        return [(name, cb) for name, cb, _ in self._hooks[hook_type]]

    def count(self, hook_type: HookType | None = None) -> int:
        """Count registered hooks.

        Args:
            hook_type: Optional specific hook type

        Returns:
            Number of registered hooks
        """
        if hook_type:
            return len(self._hooks[hook_type])
        return sum(len(hooks) for hooks in self._hooks.values())


class PluginManager:
    """Manages plugin discovery, loading, and lifecycle."""

    def __init__(
        self,
        plugin_dirs: list[Path] | None = None,
        entry_point_group: str = "marktoflow.plugins",
    ):
        """Initialize plugin manager.

        Args:
            plugin_dirs: Directories to search for plugins
            entry_point_group: Entry point group for installed plugins
        """
        self._plugins: dict[str, PluginInfo] = {}
        self._hooks = HookRegistry()
        self._plugin_dirs = plugin_dirs or []
        self._entry_point_group = entry_point_group

    @property
    def hooks(self) -> HookRegistry:
        """Get hook registry."""
        return self._hooks

    def discover(self) -> list[str]:
        """Discover available plugins.

        Returns:
            List of discovered plugin names
        """
        discovered = []

        # Discover from directories
        for plugin_dir in self._plugin_dirs:
            if plugin_dir.exists():
                discovered.extend(self._discover_from_directory(plugin_dir))

        # Discover from entry points
        discovered.extend(self._discover_from_entrypoints())

        return discovered

    def _discover_from_directory(self, plugin_dir: Path) -> list[str]:
        """Discover plugins from a directory."""
        discovered = []

        for item in plugin_dir.iterdir():
            if item.is_dir() and (item / "plugin.py").exists():
                # Plugin as a package
                plugin_name = item.name
                if plugin_name not in self._plugins:
                    discovered.append(plugin_name)

            elif item.suffix == ".py" and item.stem != "__init__":
                # Plugin as a single file
                plugin_name = item.stem
                if plugin_name not in self._plugins:
                    discovered.append(plugin_name)

        return discovered

    def _discover_from_entrypoints(self) -> list[str]:
        """Discover plugins from entry points."""
        discovered = []

        try:
            eps = importlib.metadata.entry_points(group=self._entry_point_group)
            for ep in eps:
                if ep.name not in self._plugins:
                    discovered.append(ep.name)
        except Exception:
            pass

        return discovered

    def load(self, plugin_name: str) -> PluginInfo | None:
        """Load a plugin by name.

        Args:
            plugin_name: Name of plugin to load

        Returns:
            PluginInfo if loaded successfully, None otherwise
        """
        if plugin_name in self._plugins:
            return self._plugins[plugin_name]

        # Try loading from directories
        for plugin_dir in self._plugin_dirs:
            info = self._load_from_directory(plugin_dir, plugin_name)
            if info:
                return info

        # Try loading from entry points
        info = self._load_from_entrypoint(plugin_name)
        if info:
            return info

        return None

    def _load_from_directory(self, plugin_dir: Path, plugin_name: str) -> PluginInfo | None:
        """Load a plugin from a directory."""
        # Try as package
        package_path = plugin_dir / plugin_name / "plugin.py"
        if package_path.exists():
            return self._load_from_file(package_path, plugin_name, "directory")

        # Try as single file
        file_path = plugin_dir / f"{plugin_name}.py"
        if file_path.exists():
            return self._load_from_file(file_path, plugin_name, "directory")

        return None

    def _load_from_file(self, path: Path, plugin_name: str, source: str) -> PluginInfo | None:
        """Load a plugin from a Python file."""
        try:
            spec = importlib.util.spec_from_file_location(f"marktoflow_plugin_{plugin_name}", path)
            if spec is None or spec.loader is None:
                return None

            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)

            # Find Plugin subclass
            plugin_class = self._find_plugin_class(module)
            if plugin_class is None:
                return None

            plugin = plugin_class()
            plugin.on_load()

            info = PluginInfo(plugin=plugin, source=source, path=path)
            self._plugins[plugin_name] = info
            return info

        except Exception as e:
            # Create error info
            info = PluginInfo(
                plugin=None,  # type: ignore
                source=source,
                path=path,
            )
            info.state = PluginState.ERROR
            info.error = str(e)
            return info

    def _load_from_entrypoint(self, plugin_name: str) -> PluginInfo | None:
        """Load a plugin from an entry point."""
        try:
            eps = importlib.metadata.entry_points(group=self._entry_point_group)
            for ep in eps:
                if ep.name == plugin_name:
                    plugin_class = ep.load()
                    plugin = plugin_class()
                    plugin.on_load()

                    info = PluginInfo(plugin=plugin, source="entrypoint")
                    self._plugins[plugin_name] = info
                    return info

        except Exception as e:
            info = PluginInfo(
                plugin=None,  # type: ignore
                source="entrypoint",
            )
            info.state = PluginState.ERROR
            info.error = str(e)
            return info

        return None

    def _find_plugin_class(self, module: Any) -> type[Plugin] | None:
        """Find Plugin subclass in a module."""
        for name, obj in inspect.getmembers(module):
            if inspect.isclass(obj) and issubclass(obj, Plugin) and obj is not Plugin:
                return obj
        return None

    def register(self, plugin: Plugin) -> PluginInfo:
        """Manually register a plugin instance.

        Args:
            plugin: Plugin instance

        Returns:
            PluginInfo for the registered plugin
        """
        plugin.on_load()
        info = PluginInfo(plugin=plugin, source="manual")
        self._plugins[plugin.metadata.name] = info
        return info

    def enable(self, plugin_name: str) -> bool:
        """Enable a loaded plugin.

        Args:
            plugin_name: Name of plugin to enable

        Returns:
            True if enabled successfully
        """
        info = self._plugins.get(plugin_name)
        if not info or info.state == PluginState.ERROR:
            return False

        if info.state == PluginState.ENABLED:
            return True

        try:
            # Register hooks
            hooks = info.plugin.get_hooks()
            for hook_type, callbacks in hooks.items():
                for callback in callbacks:
                    self._hooks.register(hook_type, callback, plugin_name)

            # Call on_enable
            info.plugin.on_enable()

            info.state = PluginState.ENABLED
            info.enabled_at = datetime.now()
            return True

        except Exception as e:
            info.state = PluginState.ERROR
            info.error = str(e)
            return False

    def disable(self, plugin_name: str) -> bool:
        """Disable a plugin.

        Args:
            plugin_name: Name of plugin to disable

        Returns:
            True if disabled successfully
        """
        info = self._plugins.get(plugin_name)
        if not info:
            return False

        if info.state != PluginState.ENABLED:
            return True

        try:
            # Unregister hooks
            self._hooks.unregister(plugin_name)

            # Call on_disable
            info.plugin.on_disable()

            info.state = PluginState.DISABLED
            return True

        except Exception as e:
            info.error = str(e)
            return False

    def unload(self, plugin_name: str) -> bool:
        """Unload a plugin.

        Args:
            plugin_name: Name of plugin to unload

        Returns:
            True if unloaded successfully
        """
        info = self._plugins.get(plugin_name)
        if not info:
            return False

        # Disable first if enabled
        if info.state == PluginState.ENABLED:
            self.disable(plugin_name)

        try:
            if info.plugin:
                info.plugin.on_unload()

            del self._plugins[plugin_name]
            return True

        except Exception:
            return False

    def get(self, plugin_name: str) -> PluginInfo | None:
        """Get plugin info by name."""
        return self._plugins.get(plugin_name)

    def list_plugins(self) -> list[PluginInfo]:
        """List all loaded plugins."""
        return list(self._plugins.values())

    def list_enabled(self) -> list[PluginInfo]:
        """List enabled plugins."""
        return [info for info in self._plugins.values() if info.state == PluginState.ENABLED]

    def configure(self, plugin_name: str, config: dict[str, Any]) -> bool:
        """Configure a plugin.

        Args:
            plugin_name: Name of plugin
            config: Configuration dictionary

        Returns:
            True if configured successfully
        """
        info = self._plugins.get(plugin_name)
        if not info or info.state == PluginState.ERROR:
            return False

        try:
            info.plugin.configure(config)
            info.config = config
            return True
        except Exception:
            return False

    def invoke_hook(self, context: HookContext) -> list[HookResult]:
        """Invoke a hook on all enabled plugins.

        Args:
            context: Hook context

        Returns:
            List of results
        """
        return self._hooks.invoke(context)

    def get_all_tools(self) -> list[Any]:
        """Get tools from all enabled plugins."""
        tools = []
        for info in self.list_enabled():
            tools.extend(info.plugin.get_tools())
        return tools

    def get_all_templates(self) -> list[dict[str, Any]]:
        """Get templates from all enabled plugins."""
        templates = []
        for info in self.list_enabled():
            templates.extend(info.plugin.get_templates())
        return templates


# Example plugin implementations


class LoggingPlugin(Plugin):
    """Example plugin that logs workflow events."""

    def __init__(self) -> None:
        self._log_file: Path | None = None

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="logging",
            version="1.0.0",
            description="Logs workflow execution events",
            author="marktoflow",
            tags=["logging", "monitoring"],
        )

    def get_hooks(self) -> dict[HookType, list[HookCallback]]:
        return {
            HookType.WORKFLOW_BEFORE_START: [self._on_workflow_start],
            HookType.WORKFLOW_AFTER_END: [self._on_workflow_end],
            HookType.STEP_AFTER_EXECUTE: [self._on_step_complete],
        }

    def _on_workflow_start(self, context: HookContext) -> HookResult:
        self._log(f"Workflow started: {context.workflow_id}")
        return HookResult()

    def _on_workflow_end(self, context: HookContext) -> HookResult:
        self._log(f"Workflow ended: {context.workflow_id}")
        return HookResult()

    def _on_step_complete(self, context: HookContext) -> HookResult:
        self._log(f"Step {context.step_index}: {context.step_name} completed")
        return HookResult()

    def _log(self, message: str) -> None:
        timestamp = datetime.now().isoformat()
        line = f"[{timestamp}] {message}\n"
        if self._log_file:
            with open(self._log_file, "a") as f:
                f.write(line)

    def configure(self, config: dict[str, Any]) -> None:
        if "log_file" in config:
            self._log_file = Path(config["log_file"])


class MetricsPlugin(Plugin):
    """Example plugin that collects workflow metrics."""

    def __init__(self) -> None:
        self._step_times: dict[str, list[float]] = {}
        self._workflow_counts: dict[str, int] = {}

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="metrics",
            version="1.0.0",
            description="Collects workflow execution metrics",
            author="marktoflow",
            tags=["metrics", "monitoring"],
        )

    def get_hooks(self) -> dict[HookType, list[HookCallback]]:
        return {
            HookType.WORKFLOW_AFTER_END: [self._on_workflow_end],
            HookType.STEP_AFTER_EXECUTE: [self._on_step_complete],
        }

    def _on_workflow_end(self, context: HookContext) -> HookResult:
        wf_id = context.workflow_id or "unknown"
        self._workflow_counts[wf_id] = self._workflow_counts.get(wf_id, 0) + 1
        return HookResult()

    def _on_step_complete(self, context: HookContext) -> HookResult:
        step_name = context.step_name or "unknown"
        duration = context.get("duration_ms", 0)
        if step_name not in self._step_times:
            self._step_times[step_name] = []
        self._step_times[step_name].append(duration)
        return HookResult()

    def get_stats(self) -> dict[str, Any]:
        """Get collected metrics."""
        step_stats = {}
        for step_name, times in self._step_times.items():
            if times:
                step_stats[step_name] = {
                    "count": len(times),
                    "avg_ms": sum(times) / len(times),
                    "min_ms": min(times),
                    "max_ms": max(times),
                }
        return {
            "workflow_counts": self._workflow_counts,
            "step_stats": step_stats,
        }


def create_plugin_manager(
    project_root: Path | None = None,
) -> PluginManager:
    """Create a plugin manager with default directories.

    Args:
        project_root: Project root directory

    Returns:
        Configured PluginManager
    """
    plugin_dirs = []

    if project_root:
        # .marktoflow/plugins directory
        marktoflow_plugins = project_root / ".marktoflow" / "plugins"
        if marktoflow_plugins.exists():
            plugin_dirs.append(marktoflow_plugins)

    return PluginManager(plugin_dirs=plugin_dirs)
