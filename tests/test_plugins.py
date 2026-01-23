"""Tests for plugin system."""

from __future__ import annotations

import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import pytest

from marktoflow.core.plugins import (
    HookContext,
    HookRegistry,
    HookResult,
    HookType,
    LoggingPlugin,
    MetricsPlugin,
    Plugin,
    PluginInfo,
    PluginManager,
    PluginMetadata,
    PluginState,
    create_plugin_manager,
)


# =============================================================================
# Test Fixtures
# =============================================================================


class SimplePlugin(Plugin):
    """Simple test plugin."""

    def __init__(self, name: str = "simple", version: str = "1.0.0"):
        self._name = name
        self._version = version
        self.load_called = False
        self.enable_called = False
        self.disable_called = False
        self.unload_called = False
        self.config: dict[str, Any] = {}

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name=self._name,
            version=self._version,
            description="A simple test plugin",
            author="test",
            tags=["test"],
        )

    def on_load(self) -> None:
        self.load_called = True

    def on_enable(self) -> None:
        self.enable_called = True

    def on_disable(self) -> None:
        self.disable_called = True

    def on_unload(self) -> None:
        self.unload_called = True

    def configure(self, config: dict[str, Any]) -> None:
        self.config = config


class HookPlugin(Plugin):
    """Plugin with hook callbacks for testing."""

    def __init__(self):
        self.hook_calls: list[tuple[HookType, HookContext]] = []

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="hook_test",
            version="1.0.0",
            description="Hook testing plugin",
        )

    def get_hooks(self) -> dict[HookType, list]:
        return {
            HookType.WORKFLOW_BEFORE_START: [self._on_workflow_start],
            HookType.WORKFLOW_AFTER_END: [self._on_workflow_end],
            HookType.STEP_BEFORE_EXECUTE: [self._on_step_before],
            HookType.STEP_AFTER_EXECUTE: [self._on_step_after],
        }

    def _on_workflow_start(self, context: HookContext) -> HookResult:
        self.hook_calls.append((HookType.WORKFLOW_BEFORE_START, context))
        return HookResult(success=True)

    def _on_workflow_end(self, context: HookContext) -> HookResult:
        self.hook_calls.append((HookType.WORKFLOW_AFTER_END, context))
        return HookResult(success=True)

    def _on_step_before(self, context: HookContext) -> HookResult:
        self.hook_calls.append((HookType.STEP_BEFORE_EXECUTE, context))
        return HookResult(success=True)

    def _on_step_after(self, context: HookContext) -> HookResult:
        self.hook_calls.append((HookType.STEP_AFTER_EXECUTE, context))
        return HookResult(success=True)


class ToolPlugin(Plugin):
    """Plugin that provides tools."""

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="tool_provider",
            version="1.0.0",
            description="Provides custom tools",
        )

    def get_tools(self) -> list[Any]:
        return [
            {"name": "tool1", "description": "First tool"},
            {"name": "tool2", "description": "Second tool"},
        ]

    def get_templates(self) -> list[dict[str, Any]]:
        return [
            {"id": "template1", "name": "Template 1"},
        ]


class StopPropagationPlugin(Plugin):
    """Plugin that stops hook propagation."""

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(name="stopper", version="1.0.0")

    def get_hooks(self) -> dict[HookType, list]:
        return {
            HookType.WORKFLOW_BEFORE_START: [self._stop_hook],
        }

    def _stop_hook(self, context: HookContext) -> HookResult:
        return HookResult(success=True, stop_propagation=True)


class ErrorPlugin(Plugin):
    """Plugin that raises errors."""

    @property
    def metadata(self) -> PluginMetadata:
        return PluginMetadata(name="error_plugin", version="1.0.0")

    def get_hooks(self) -> dict[HookType, list]:
        return {
            HookType.WORKFLOW_BEFORE_START: [self._error_hook],
        }

    def _error_hook(self, context: HookContext) -> HookResult:
        raise ValueError("Intentional error")


# =============================================================================
# PluginMetadata Tests
# =============================================================================


class TestPluginMetadata:
    """Tests for PluginMetadata."""

    def test_create_metadata(self):
        """Test creating plugin metadata."""
        metadata = PluginMetadata(
            name="test-plugin",
            version="1.0.0",
            description="A test plugin",
            author="Test Author",
            homepage="https://example.com",
            license="MIT",
            requires=["other-plugin"],
            python_requires=">=3.11",
            tags=["test", "example"],
        )

        assert metadata.name == "test-plugin"
        assert metadata.version == "1.0.0"
        assert metadata.description == "A test plugin"
        assert metadata.author == "Test Author"
        assert metadata.homepage == "https://example.com"
        assert metadata.license == "MIT"
        assert metadata.requires == ["other-plugin"]
        assert metadata.python_requires == ">=3.11"
        assert metadata.tags == ["test", "example"]

    def test_metadata_defaults(self):
        """Test metadata default values."""
        metadata = PluginMetadata(name="minimal", version="0.1.0")

        assert metadata.description == ""
        assert metadata.author == ""
        assert metadata.homepage == ""
        assert metadata.license == ""
        assert metadata.requires == []
        assert metadata.python_requires == ">=3.11"
        assert metadata.tags == []

    def test_metadata_to_dict(self):
        """Test serializing metadata to dictionary."""
        metadata = PluginMetadata(
            name="test",
            version="1.0.0",
            description="Test",
            author="Author",
        )

        data = metadata.to_dict()

        assert data["name"] == "test"
        assert data["version"] == "1.0.0"
        assert data["description"] == "Test"
        assert data["author"] == "Author"

    def test_metadata_from_dict(self):
        """Test deserializing metadata from dictionary."""
        data = {
            "name": "restored",
            "version": "2.0.0",
            "description": "Restored plugin",
            "tags": ["restored"],
        }

        metadata = PluginMetadata.from_dict(data)

        assert metadata.name == "restored"
        assert metadata.version == "2.0.0"
        assert metadata.description == "Restored plugin"
        assert metadata.tags == ["restored"]

    def test_metadata_roundtrip(self):
        """Test serialization roundtrip."""
        original = PluginMetadata(
            name="roundtrip",
            version="1.0.0",
            description="Test roundtrip",
            author="Tester",
            requires=["dep1", "dep2"],
        )

        restored = PluginMetadata.from_dict(original.to_dict())

        assert restored.name == original.name
        assert restored.version == original.version
        assert restored.description == original.description
        assert restored.author == original.author
        assert restored.requires == original.requires


# =============================================================================
# HookContext Tests
# =============================================================================


class TestHookContext:
    """Tests for HookContext."""

    def test_create_context(self):
        """Test creating hook context."""
        context = HookContext(
            hook_type=HookType.WORKFLOW_BEFORE_START,
            workflow_id="wf-123",
            step_index=0,
            step_name="step1",
            data={"key": "value"},
        )

        assert context.hook_type == HookType.WORKFLOW_BEFORE_START
        assert context.workflow_id == "wf-123"
        assert context.step_index == 0
        assert context.step_name == "step1"
        assert context.data == {"key": "value"}
        assert isinstance(context.timestamp, datetime)

    def test_context_get_set(self):
        """Test context get/set methods."""
        context = HookContext(hook_type=HookType.STEP_BEFORE_EXECUTE)

        context.set("foo", "bar")
        assert context.get("foo") == "bar"
        assert context.get("missing") is None
        assert context.get("missing", "default") == "default"

    def test_context_defaults(self):
        """Test context default values."""
        context = HookContext(hook_type=HookType.CUSTOM)

        assert context.workflow_id is None
        assert context.step_index is None
        assert context.step_name is None
        assert context.agent_name is None
        assert context.tool_name is None
        assert context.data == {}


# =============================================================================
# HookResult Tests
# =============================================================================


class TestHookResult:
    """Tests for HookResult."""

    def test_default_result(self):
        """Test default hook result."""
        result = HookResult()

        assert result.success is True
        assert result.modified_data is None
        assert result.stop_propagation is False
        assert result.error is None

    def test_failure_result(self):
        """Test failure hook result."""
        result = HookResult(success=False, error="Something went wrong")

        assert result.success is False
        assert result.error == "Something went wrong"

    def test_stop_propagation(self):
        """Test stop propagation flag."""
        result = HookResult(stop_propagation=True)

        assert result.stop_propagation is True

    def test_modified_data(self):
        """Test modified data in result."""
        result = HookResult(modified_data={"new_key": "new_value"})

        assert result.modified_data == {"new_key": "new_value"}


# =============================================================================
# HookRegistry Tests
# =============================================================================


class TestHookRegistry:
    """Tests for HookRegistry."""

    def test_register_hook(self):
        """Test registering a hook callback."""
        registry = HookRegistry()

        def callback(ctx: HookContext) -> HookResult:
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "test_plugin")

        assert registry.count(HookType.WORKFLOW_BEFORE_START) == 1
        assert registry.count() == 1

    def test_register_multiple_hooks(self):
        """Test registering multiple hooks."""
        registry = HookRegistry()

        def callback1(ctx: HookContext) -> HookResult:
            return HookResult()

        def callback2(ctx: HookContext) -> HookResult:
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback1, "plugin1")
        registry.register(HookType.WORKFLOW_BEFORE_START, callback2, "plugin2")
        registry.register(HookType.STEP_BEFORE_EXECUTE, callback1, "plugin1")

        assert registry.count(HookType.WORKFLOW_BEFORE_START) == 2
        assert registry.count(HookType.STEP_BEFORE_EXECUTE) == 1
        assert registry.count() == 3

    def test_hook_priority(self):
        """Test hook priority ordering."""
        registry = HookRegistry()
        call_order = []

        def callback1(ctx: HookContext) -> HookResult:
            call_order.append("low")
            return HookResult()

        def callback2(ctx: HookContext) -> HookResult:
            call_order.append("high")
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback1, "low", priority=200)
        registry.register(HookType.WORKFLOW_BEFORE_START, callback2, "high", priority=50)

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        registry.invoke(context)

        assert call_order == ["high", "low"]

    def test_unregister_hooks(self):
        """Test unregistering hooks for a plugin."""
        registry = HookRegistry()

        def callback(ctx: HookContext) -> HookResult:
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "plugin1")
        registry.register(HookType.WORKFLOW_AFTER_END, callback, "plugin1")
        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "plugin2")

        count = registry.unregister("plugin1")

        assert count == 2
        assert registry.count(HookType.WORKFLOW_BEFORE_START) == 1
        assert registry.count(HookType.WORKFLOW_AFTER_END) == 0

    def test_invoke_hooks(self):
        """Test invoking hook callbacks."""
        registry = HookRegistry()
        results_collected = []

        def callback(ctx: HookContext) -> HookResult:
            results_collected.append(ctx.workflow_id)
            return HookResult(success=True)

        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "test")

        context = HookContext(
            hook_type=HookType.WORKFLOW_BEFORE_START,
            workflow_id="wf-test",
        )
        results = registry.invoke(context)

        assert len(results) == 1
        assert results[0].success is True
        assert results_collected == ["wf-test"]

    def test_invoke_with_none_return(self):
        """Test invoking callback that returns None."""
        registry = HookRegistry()

        def callback(ctx: HookContext) -> None:
            pass  # Returns None

        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "test")

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        results = registry.invoke(context)

        assert len(results) == 1
        assert results[0].success is True  # Default HookResult

    def test_invoke_stops_on_propagation(self):
        """Test that stop_propagation stops further callbacks."""
        registry = HookRegistry()
        call_order = []

        def callback1(ctx: HookContext) -> HookResult:
            call_order.append("first")
            return HookResult(stop_propagation=True)

        def callback2(ctx: HookContext) -> HookResult:
            call_order.append("second")
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback1, "p1", priority=10)
        registry.register(HookType.WORKFLOW_BEFORE_START, callback2, "p2", priority=20)

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        results = registry.invoke(context)

        assert call_order == ["first"]  # Second callback not called
        assert len(results) == 1

    def test_invoke_handles_exception(self):
        """Test that exceptions in callbacks are caught."""
        registry = HookRegistry()

        def bad_callback(ctx: HookContext) -> HookResult:
            raise ValueError("Oops")

        registry.register(HookType.WORKFLOW_BEFORE_START, bad_callback, "bad")

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        results = registry.invoke(context)

        assert len(results) == 1
        assert results[0].success is False
        assert results[0].error is not None
        assert "Oops" in results[0].error

    def test_get_hooks(self):
        """Test getting hooks for a type."""
        registry = HookRegistry()

        def callback(ctx: HookContext) -> HookResult:
            return HookResult()

        registry.register(HookType.WORKFLOW_BEFORE_START, callback, "test_plugin")

        hooks = registry.get_hooks(HookType.WORKFLOW_BEFORE_START)

        assert len(hooks) == 1
        assert hooks[0][0] == "test_plugin"
        assert hooks[0][1] == callback


# =============================================================================
# Plugin Base Class Tests
# =============================================================================


class TestPluginBase:
    """Tests for Plugin base class."""

    def test_simple_plugin_lifecycle(self):
        """Test plugin lifecycle methods are called."""
        plugin = SimplePlugin()

        assert not plugin.load_called
        plugin.on_load()
        assert plugin.load_called

        assert not plugin.enable_called
        plugin.on_enable()
        assert plugin.enable_called

        assert not plugin.disable_called
        plugin.on_disable()
        assert plugin.disable_called

        assert not plugin.unload_called
        plugin.on_unload()
        assert plugin.unload_called

    def test_plugin_metadata(self):
        """Test plugin metadata access."""
        plugin = SimplePlugin(name="my-plugin", version="2.0.0")

        assert plugin.metadata.name == "my-plugin"
        assert plugin.metadata.version == "2.0.0"

    def test_plugin_configure(self):
        """Test plugin configuration."""
        plugin = SimplePlugin()
        plugin.configure({"setting1": "value1", "setting2": 42})

        assert plugin.config["setting1"] == "value1"
        assert plugin.config["setting2"] == 42

    def test_plugin_default_hooks(self):
        """Test default empty hooks."""
        plugin = SimplePlugin()
        assert plugin.get_hooks() == {}

    def test_plugin_default_tools(self):
        """Test default empty tools."""
        plugin = SimplePlugin()
        assert plugin.get_tools() == []

    def test_plugin_default_templates(self):
        """Test default empty templates."""
        plugin = SimplePlugin()
        assert plugin.get_templates() == []

    def test_plugin_default_config_schema(self):
        """Test default config schema is None."""
        plugin = SimplePlugin()
        assert plugin.get_config_schema() is None


# =============================================================================
# PluginInfo Tests
# =============================================================================


class TestPluginInfo:
    """Tests for PluginInfo."""

    def test_create_plugin_info(self):
        """Test creating plugin info."""
        plugin = SimplePlugin()
        info = PluginInfo(plugin=plugin, source="manual")

        assert info.plugin == plugin
        assert info.source == "manual"
        assert info.path is None
        assert info.state == PluginState.LOADED
        assert info.error is None
        assert isinstance(info.loaded_at, datetime)
        assert info.enabled_at is None
        assert info.config == {}

    def test_plugin_info_with_path(self):
        """Test plugin info with path."""
        plugin = SimplePlugin()
        path = Path("/some/path/plugin.py")
        info = PluginInfo(plugin=plugin, source="directory", path=path)

        assert info.path == path

    def test_plugin_info_metadata_access(self):
        """Test accessing metadata through info."""
        plugin = SimplePlugin(name="test-name")
        info = PluginInfo(plugin=plugin, source="manual")

        assert info.metadata.name == "test-name"
        assert info.name == "test-name"

    def test_plugin_info_to_dict(self):
        """Test serializing plugin info."""
        plugin = SimplePlugin(name="serialized")
        info = PluginInfo(plugin=plugin, source="entrypoint")
        info.config = {"key": "value"}

        data = info.to_dict()

        assert data["name"] == "serialized"
        assert data["source"] == "entrypoint"
        assert data["state"] == "loaded"
        assert data["config"] == {"key": "value"}
        assert "metadata" in data


# =============================================================================
# PluginManager Tests
# =============================================================================


class TestPluginManager:
    """Tests for PluginManager."""

    def test_create_manager(self):
        """Test creating plugin manager."""
        manager = PluginManager()

        assert manager.list_plugins() == []
        assert manager.list_enabled() == []

    def test_register_plugin(self):
        """Test manually registering a plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="registered")

        info = manager.register(plugin)

        assert info.name == "registered"
        assert info.state == PluginState.LOADED
        assert plugin.load_called is True
        assert len(manager.list_plugins()) == 1

    def test_enable_plugin(self):
        """Test enabling a plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="to-enable")
        manager.register(plugin)

        result = manager.enable("to-enable")

        assert result is True
        info = manager.get("to-enable")
        assert info is not None
        assert info.state == PluginState.ENABLED
        assert plugin.enable_called is True
        assert len(manager.list_enabled()) == 1

    def test_enable_already_enabled(self):
        """Test enabling an already enabled plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="already")
        manager.register(plugin)
        manager.enable("already")

        result = manager.enable("already")

        assert result is True  # Idempotent

    def test_enable_nonexistent(self):
        """Test enabling nonexistent plugin."""
        manager = PluginManager()

        result = manager.enable("nonexistent")

        assert result is False

    def test_disable_plugin(self):
        """Test disabling a plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="to-disable")
        manager.register(plugin)
        manager.enable("to-disable")

        result = manager.disable("to-disable")

        assert result is True
        info = manager.get("to-disable")
        assert info is not None
        assert info.state == PluginState.DISABLED
        assert plugin.disable_called is True

    def test_disable_not_enabled(self):
        """Test disabling a not-enabled plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="not-enabled")
        manager.register(plugin)

        result = manager.disable("not-enabled")

        assert result is True  # Idempotent

    def test_unload_plugin(self):
        """Test unloading a plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="to-unload")
        manager.register(plugin)
        manager.enable("to-unload")

        result = manager.unload("to-unload")

        assert result is True
        assert plugin.disable_called is True
        assert plugin.unload_called is True
        assert manager.get("to-unload") is None

    def test_unload_nonexistent(self):
        """Test unloading nonexistent plugin."""
        manager = PluginManager()

        result = manager.unload("nonexistent")

        assert result is False

    def test_configure_plugin(self):
        """Test configuring a plugin."""
        manager = PluginManager()
        plugin = SimplePlugin(name="configurable")
        manager.register(plugin)

        result = manager.configure("configurable", {"option": "value"})

        assert result is True
        assert plugin.config == {"option": "value"}
        info = manager.get("configurable")
        assert info is not None
        assert info.config == {"option": "value"}

    def test_configure_nonexistent(self):
        """Test configuring nonexistent plugin."""
        manager = PluginManager()

        result = manager.configure("nonexistent", {})

        assert result is False

    def test_hook_registration_on_enable(self):
        """Test that hooks are registered when plugin is enabled."""
        manager = PluginManager()
        plugin = HookPlugin()
        manager.register(plugin)

        # Hooks not registered yet
        assert manager.hooks.count(HookType.WORKFLOW_BEFORE_START) == 0

        manager.enable("hook_test")

        # Hooks now registered
        assert manager.hooks.count(HookType.WORKFLOW_BEFORE_START) == 1
        assert manager.hooks.count(HookType.WORKFLOW_AFTER_END) == 1

    def test_hook_unregistration_on_disable(self):
        """Test that hooks are unregistered when plugin is disabled."""
        manager = PluginManager()
        plugin = HookPlugin()
        manager.register(plugin)
        manager.enable("hook_test")

        assert manager.hooks.count() > 0

        manager.disable("hook_test")

        assert manager.hooks.count(HookType.WORKFLOW_BEFORE_START) == 0

    def test_invoke_hook(self):
        """Test invoking hooks through manager."""
        manager = PluginManager()
        plugin = HookPlugin()
        manager.register(plugin)
        manager.enable("hook_test")

        context = HookContext(
            hook_type=HookType.WORKFLOW_BEFORE_START,
            workflow_id="wf-123",
        )
        results = manager.invoke_hook(context)

        assert len(results) == 1
        assert results[0].success is True
        assert len(plugin.hook_calls) == 1
        assert plugin.hook_calls[0][0] == HookType.WORKFLOW_BEFORE_START

    def test_get_all_tools(self):
        """Test getting tools from all enabled plugins."""
        manager = PluginManager()
        plugin = ToolPlugin()
        manager.register(plugin)
        manager.enable("tool_provider")

        tools = manager.get_all_tools()

        assert len(tools) == 2
        assert tools[0]["name"] == "tool1"

    def test_get_all_templates(self):
        """Test getting templates from all enabled plugins."""
        manager = PluginManager()
        plugin = ToolPlugin()
        manager.register(plugin)
        manager.enable("tool_provider")

        templates = manager.get_all_templates()

        assert len(templates) == 1
        assert templates[0]["id"] == "template1"

    def test_multiple_plugins(self):
        """Test managing multiple plugins."""
        manager = PluginManager()

        plugin1 = SimplePlugin(name="plugin1")
        plugin2 = SimplePlugin(name="plugin2")
        plugin3 = SimplePlugin(name="plugin3")

        manager.register(plugin1)
        manager.register(plugin2)
        manager.register(plugin3)

        manager.enable("plugin1")
        manager.enable("plugin3")

        assert len(manager.list_plugins()) == 3
        assert len(manager.list_enabled()) == 2

        enabled_names = [p.name for p in manager.list_enabled()]
        assert "plugin1" in enabled_names
        assert "plugin3" in enabled_names
        assert "plugin2" not in enabled_names


# =============================================================================
# LoggingPlugin Tests
# =============================================================================


class TestLoggingPlugin:
    """Tests for LoggingPlugin."""

    def test_logging_plugin_metadata(self):
        """Test logging plugin metadata."""
        plugin = LoggingPlugin()

        assert plugin.metadata.name == "logging"
        assert plugin.metadata.version == "1.0.0"
        assert "logging" in plugin.metadata.tags

    def test_logging_plugin_hooks(self):
        """Test logging plugin provides hooks."""
        plugin = LoggingPlugin()

        hooks = plugin.get_hooks()

        assert HookType.WORKFLOW_BEFORE_START in hooks
        assert HookType.WORKFLOW_AFTER_END in hooks
        assert HookType.STEP_AFTER_EXECUTE in hooks

    def test_logging_plugin_configure(self):
        """Test configuring logging plugin."""
        plugin = LoggingPlugin()

        with tempfile.NamedTemporaryFile(suffix=".log", delete=False) as f:
            log_path = f.name

        plugin.configure({"log_file": log_path})

        # Invoke a hook to trigger logging
        context = HookContext(
            hook_type=HookType.WORKFLOW_BEFORE_START,
            workflow_id="test-wf",
        )
        hooks = plugin.get_hooks()
        hooks[HookType.WORKFLOW_BEFORE_START][0](context)

        # Check log file was written
        with open(log_path) as f:
            content = f.read()
            assert "test-wf" in content

        Path(log_path).unlink()


# =============================================================================
# MetricsPlugin Tests
# =============================================================================


class TestMetricsPlugin:
    """Tests for MetricsPlugin."""

    def test_metrics_plugin_metadata(self):
        """Test metrics plugin metadata."""
        plugin = MetricsPlugin()

        assert plugin.metadata.name == "metrics"
        assert plugin.metadata.version == "1.0.0"
        assert "metrics" in plugin.metadata.tags

    def test_metrics_plugin_hooks(self):
        """Test metrics plugin provides hooks."""
        plugin = MetricsPlugin()

        hooks = plugin.get_hooks()

        assert HookType.WORKFLOW_AFTER_END in hooks
        assert HookType.STEP_AFTER_EXECUTE in hooks

    def test_metrics_collection(self):
        """Test metrics are collected."""
        plugin = MetricsPlugin()

        # Simulate workflow executions
        hooks = plugin.get_hooks()

        # Workflow end
        wf_context = HookContext(
            hook_type=HookType.WORKFLOW_AFTER_END,
            workflow_id="wf-1",
        )
        hooks[HookType.WORKFLOW_AFTER_END][0](wf_context)
        hooks[HookType.WORKFLOW_AFTER_END][0](wf_context)

        # Step completions
        step_context = HookContext(
            hook_type=HookType.STEP_AFTER_EXECUTE,
            step_name="step1",
            data={"duration_ms": 100},
        )
        hooks[HookType.STEP_AFTER_EXECUTE][0](step_context)

        step_context2 = HookContext(
            hook_type=HookType.STEP_AFTER_EXECUTE,
            step_name="step1",
            data={"duration_ms": 200},
        )
        hooks[HookType.STEP_AFTER_EXECUTE][0](step_context2)

        stats = plugin.get_stats()

        assert stats["workflow_counts"]["wf-1"] == 2
        assert stats["step_stats"]["step1"]["count"] == 2
        assert stats["step_stats"]["step1"]["avg_ms"] == 150
        assert stats["step_stats"]["step1"]["min_ms"] == 100
        assert stats["step_stats"]["step1"]["max_ms"] == 200


# =============================================================================
# Plugin Discovery Tests
# =============================================================================


class TestPluginDiscovery:
    """Tests for plugin discovery."""

    def test_discover_from_empty_directory(self):
        """Test discovering from empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            discovered = manager.discover()

            assert discovered == []

    def test_discover_from_directory_with_plugin_file(self):
        """Test discovering plugin from .py file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            plugin_file = Path(tmpdir) / "my_plugin.py"
            plugin_file.write_text("""
from marktoflow.core.plugins import Plugin, PluginMetadata

class MyPlugin(Plugin):
    @property
    def metadata(self):
        return PluginMetadata(name="my_plugin", version="1.0.0")
""")

            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            discovered = manager.discover()

            assert "my_plugin" in discovered

    def test_discover_from_directory_with_plugin_package(self):
        """Test discovering plugin from package directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            plugin_dir = Path(tmpdir) / "package_plugin"
            plugin_dir.mkdir()
            plugin_file = plugin_dir / "plugin.py"
            plugin_file.write_text("""
from marktoflow.core.plugins import Plugin, PluginMetadata

class PackagePlugin(Plugin):
    @property
    def metadata(self):
        return PluginMetadata(name="package_plugin", version="1.0.0")
""")

            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            discovered = manager.discover()

            assert "package_plugin" in discovered

    def test_load_from_file(self):
        """Test loading plugin from file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            plugin_file = Path(tmpdir) / "loadable.py"
            plugin_file.write_text("""
from marktoflow.core.plugins import Plugin, PluginMetadata

class LoadablePlugin(Plugin):
    @property
    def metadata(self):
        return PluginMetadata(name="loadable", version="1.0.0")
""")

            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            info = manager.load("loadable")

            assert info is not None
            assert info.name == "loadable"
            assert info.state == PluginState.LOADED
            assert info.source == "directory"


# =============================================================================
# create_plugin_manager Tests
# =============================================================================


class TestCreatePluginManager:
    """Tests for create_plugin_manager helper."""

    def test_create_without_project_root(self):
        """Test creating manager without project root."""
        manager = create_plugin_manager()

        assert isinstance(manager, PluginManager)

    def test_create_with_project_root(self):
        """Test creating manager with project root."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)

            manager = create_plugin_manager(project_root=project_root)

            assert isinstance(manager, PluginManager)

    def test_create_with_plugins_directory(self):
        """Test creating manager finds .marktoflow/plugins."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            plugins_dir = project_root / ".marktoflow" / "plugins"
            plugins_dir.mkdir(parents=True)

            # Create a test plugin
            plugin_file = plugins_dir / "test_plugin.py"
            plugin_file.write_text("""
from marktoflow.core.plugins import Plugin, PluginMetadata

class TestPlugin(Plugin):
    @property
    def metadata(self):
        return PluginMetadata(name="test_plugin", version="1.0.0")
""")

            manager = create_plugin_manager(project_root=project_root)
            discovered = manager.discover()

            assert "test_plugin" in discovered


# =============================================================================
# Edge Cases and Error Handling
# =============================================================================


class TestErrorHandling:
    """Tests for error handling in plugin system."""

    def test_hook_error_caught(self):
        """Test that errors in hook callbacks are caught."""
        manager = PluginManager()
        plugin = ErrorPlugin()
        manager.register(plugin)
        manager.enable("error_plugin")

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        results = manager.invoke_hook(context)

        assert len(results) == 1
        assert results[0].success is False
        assert results[0].error is not None
        assert "Intentional error" in results[0].error

    def test_stop_propagation_works(self):
        """Test stop propagation prevents subsequent hooks."""
        manager = PluginManager()

        stopper = StopPropagationPlugin()
        hook_plugin = HookPlugin()

        manager.register(stopper)
        manager.register(hook_plugin)

        # Enable stopper first (lower priority)
        manager.enable("stopper")
        manager.enable("hook_test")

        context = HookContext(hook_type=HookType.WORKFLOW_BEFORE_START)
        results = manager.invoke_hook(context)

        # Only stopper's result should be present
        assert len(results) == 1
        assert results[0].stop_propagation is True

    def test_get_nonexistent_plugin(self):
        """Test getting a plugin that doesn't exist."""
        manager = PluginManager()

        info = manager.get("nonexistent")

        assert info is None

    def test_load_invalid_plugin_file(self):
        """Test loading a file that doesn't contain a Plugin class."""
        with tempfile.TemporaryDirectory() as tmpdir:
            invalid_file = Path(tmpdir) / "invalid.py"
            invalid_file.write_text("x = 1  # No Plugin class")

            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            info = manager.load("invalid")

            assert info is None

    def test_load_plugin_with_syntax_error(self):
        """Test loading a plugin file with syntax error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            bad_file = Path(tmpdir) / "bad_syntax.py"
            bad_file.write_text("def broken(:\n  pass")

            manager = PluginManager(plugin_dirs=[Path(tmpdir)])
            info = manager.load("bad_syntax")

            assert info is not None
            assert info.state == PluginState.ERROR
            assert info.error is not None


# =============================================================================
# HookType Enum Tests
# =============================================================================


class TestHookType:
    """Tests for HookType enum."""

    def test_all_hook_types_exist(self):
        """Test all expected hook types exist."""
        expected = [
            "WORKFLOW_BEFORE_START",
            "WORKFLOW_AFTER_START",
            "WORKFLOW_BEFORE_END",
            "WORKFLOW_AFTER_END",
            "WORKFLOW_ON_ERROR",
            "STEP_BEFORE_EXECUTE",
            "STEP_AFTER_EXECUTE",
            "STEP_ON_RETRY",
            "STEP_ON_SKIP",
            "STEP_ON_ERROR",
            "AGENT_BEFORE_SELECT",
            "AGENT_AFTER_SELECT",
            "AGENT_ON_FAILOVER",
            "TOOL_BEFORE_CALL",
            "TOOL_AFTER_CALL",
            "TOOL_ON_ERROR",
            "CUSTOM",
        ]

        for name in expected:
            assert hasattr(HookType, name), f"Missing HookType.{name}"

    def test_hook_type_values(self):
        """Test hook type string values."""
        assert HookType.WORKFLOW_BEFORE_START.value == "workflow_before_start"
        assert HookType.STEP_AFTER_EXECUTE.value == "step_after_execute"
        assert HookType.CUSTOM.value == "custom"


# =============================================================================
# PluginState Enum Tests
# =============================================================================


class TestPluginState:
    """Tests for PluginState enum."""

    def test_all_states_exist(self):
        """Test all expected states exist."""
        expected = ["DISCOVERED", "LOADED", "ENABLED", "DISABLED", "ERROR"]

        for name in expected:
            assert hasattr(PluginState, name), f"Missing PluginState.{name}"

    def test_state_values(self):
        """Test state string values."""
        assert PluginState.DISCOVERED.value == "discovered"
        assert PluginState.LOADED.value == "loaded"
        assert PluginState.ENABLED.value == "enabled"
        assert PluginState.DISABLED.value == "disabled"
        assert PluginState.ERROR.value == "error"
