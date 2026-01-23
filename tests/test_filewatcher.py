"""
Tests for the file watcher module.
"""

import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from marktoflow.core.filewatcher import (
    FileEvent,
    FileEventType,
    WatchConfig,
    WatchHandle,
    WATCHDOG_AVAILABLE,
)


class TestFileEventType:
    """Tests for FileEventType enum."""

    def test_event_type_values(self):
        """Test event type values."""
        assert FileEventType.CREATED.value == "created"
        assert FileEventType.MODIFIED.value == "modified"
        assert FileEventType.DELETED.value == "deleted"
        assert FileEventType.MOVED.value == "moved"


class TestFileEvent:
    """Tests for FileEvent class."""

    def test_create_event(self):
        """Test creating a file event."""
        event = FileEvent(
            event_type=FileEventType.CREATED,
            path=Path("/tmp/test.py"),
            is_directory=False,
        )

        assert event.event_type == FileEventType.CREATED
        assert event.path == Path("/tmp/test.py")
        assert event.is_directory is False
        assert isinstance(event.timestamp, datetime)

    def test_event_with_all_fields(self):
        """Test creating event with all fields."""
        now = datetime.now()
        event = FileEvent(
            event_type=FileEventType.MOVED,
            path=Path("/tmp/new.py"),
            is_directory=False,
            timestamp=now,
            src_path=Path("/tmp/old.py"),
            dest_path=Path("/tmp/new.py"),
        )

        assert event.event_type == FileEventType.MOVED
        assert event.src_path == Path("/tmp/old.py")
        assert event.dest_path == Path("/tmp/new.py")
        assert event.timestamp == now

    def test_matches_pattern_glob(self):
        """Test glob pattern matching."""
        event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/project/src/main.py"),
            is_directory=False,
        )

        assert event.matches_pattern("*.py") is True
        assert event.matches_pattern("*.js") is False
        assert event.matches_pattern("**/main.py") is True

    def test_matches_pattern_directory(self):
        """Test pattern matching with directories."""
        event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/project/src/utils/helper.py"),
            is_directory=False,
        )

        assert event.matches_pattern("**/utils/*.py") is True
        assert event.matches_pattern("*/src/*") is True  # fnmatch matches this

    def test_matches_regex(self):
        """Test regex pattern matching."""
        event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/project/src/test_main.py"),
            is_directory=False,
        )

        assert event.matches_regex(r"test_.*\.py$") is True
        assert event.matches_regex(r"^/project/src/") is True
        assert event.matches_regex(r"\.js$") is False

    def test_to_dict(self):
        """Test converting event to dictionary."""
        now = datetime.now()
        event = FileEvent(
            event_type=FileEventType.CREATED,
            path=Path("/tmp/test.py"),
            is_directory=False,
            timestamp=now,
        )

        result = event.to_dict()

        assert result["event_type"] == "created"
        assert result["path"] == "/tmp/test.py"
        assert result["is_directory"] is False
        assert result["timestamp"] == now.isoformat()


class TestWatchConfig:
    """Tests for WatchConfig class."""

    def test_default_config(self):
        """Test default watch configuration."""
        config = WatchConfig(path=Path("/tmp"))

        assert config.path == Path("/tmp")
        assert config.patterns == ["*"]
        assert config.ignore_patterns == []
        assert config.recursive is True
        assert FileEventType.CREATED in config.events
        assert FileEventType.MODIFIED in config.events
        assert config.debounce_seconds == 1.0
        assert config.workflow_id is None

    def test_custom_config(self):
        """Test custom watch configuration."""
        config = WatchConfig(
            path=Path("/project/src"),
            patterns=["*.py", "*.yaml"],
            ignore_patterns=["__pycache__/*", "*.pyc"],
            recursive=False,
            events=[FileEventType.MODIFIED],
            debounce_seconds=2.0,
            workflow_id="my-workflow",
            workflow_inputs={"key": "value"},
        )

        assert config.path == Path("/project/src")
        assert "*.py" in config.patterns
        assert "*.yaml" in config.patterns
        assert "__pycache__/*" in config.ignore_patterns
        assert config.recursive is False
        assert config.events == [FileEventType.MODIFIED]
        assert config.workflow_id == "my-workflow"

    def test_matches_event_type(self):
        """Test matching event by type."""
        config = WatchConfig(
            path=Path("/tmp"),
            events=[FileEventType.CREATED],
        )

        created_event = FileEvent(
            event_type=FileEventType.CREATED,
            path=Path("/tmp/test.py"),
            is_directory=False,
        )
        modified_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/test.py"),
            is_directory=False,
        )

        assert config.matches(created_event) is True
        assert config.matches(modified_event) is False

    def test_matches_pattern_include(self):
        """Test matching by include patterns."""
        config = WatchConfig(
            path=Path("/tmp"),
            patterns=["*.py", "*.yaml"],
            events=[FileEventType.MODIFIED],
        )

        py_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/main.py"),
            is_directory=False,
        )
        yaml_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/config.yaml"),
            is_directory=False,
        )
        js_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/app.js"),
            is_directory=False,
        )

        assert config.matches(py_event) is True
        assert config.matches(yaml_event) is True
        assert config.matches(js_event) is False

    def test_matches_pattern_ignore(self):
        """Test matching with ignore patterns."""
        config = WatchConfig(
            path=Path("/tmp"),
            patterns=["*.py"],
            ignore_patterns=["**/test_*.py", "**/__pycache__/*"],
            events=[FileEventType.MODIFIED],
        )

        main_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/main.py"),
            is_directory=False,
        )
        test_event = FileEvent(
            event_type=FileEventType.MODIFIED,
            path=Path("/tmp/test_main.py"),
            is_directory=False,
        )

        assert config.matches(main_event) is True
        assert config.matches(test_event) is False


class TestWatchHandle:
    """Tests for WatchHandle class."""

    def test_create_handle(self):
        """Test creating a watch handle."""
        config = WatchConfig(path=Path("/tmp"))
        handle = WatchHandle(watch_id="watch-1", config=config)

        assert handle.watch_id == "watch-1"
        assert handle.config == config
        assert handle.handler is None

    def test_handle_repr(self):
        """Test watch handle representation."""
        config = WatchConfig(path=Path("/tmp/project"))
        handle = WatchHandle(watch_id="my-watch", config=config)

        repr_str = repr(handle)

        assert "my-watch" in repr_str
        assert "/tmp/project" in repr_str


@pytest.mark.skipif(not WATCHDOG_AVAILABLE, reason="watchdog not installed")
class TestFileWatcher:
    """Tests for FileWatcher class (requires watchdog)."""

    def test_create_watcher(self):
        """Test creating a file watcher."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        assert watcher.is_running() is False
        assert watcher.list_watches() == []

    def test_add_watch(self):
        """Test adding a watch."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            handle = watcher.add_watch(config, callback)

            assert handle.watch_id.startswith("watch-")
            assert handle.config == config
            assert len(watcher.list_watches()) == 1

    def test_add_watch_custom_id(self):
        """Test adding watch with custom ID."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            handle = watcher.add_watch(config, callback, watch_id="my-custom-watch")

            assert handle.watch_id == "my-custom-watch"

    def test_remove_watch(self):
        """Test removing a watch."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            handle = watcher.add_watch(config, callback)
            result = watcher.remove_watch(handle.watch_id)

            assert result is True
            assert len(watcher.list_watches()) == 0

    def test_remove_nonexistent_watch(self):
        """Test removing a watch that doesn't exist."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()
        result = watcher.remove_watch("nonexistent")

        assert result is False

    def test_get_watch(self):
        """Test getting a watch by ID."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            handle = watcher.add_watch(config, callback, watch_id="test-watch")
            retrieved = watcher.get_watch("test-watch")

            assert retrieved is not None
            assert retrieved.watch_id == "test-watch"

    def test_start_stop_watcher(self):
        """Test starting and stopping the watcher."""
        from marktoflow.core.filewatcher import FileWatcher

        watcher = FileWatcher()

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            watcher.add_watch(config, callback)

            watcher.start()
            assert watcher.is_running() is True

            watcher.stop()
            assert watcher.is_running() is False

    def test_context_manager(self):
        """Test using watcher as context manager."""
        from marktoflow.core.filewatcher import FileWatcher

        with tempfile.TemporaryDirectory() as tmpdir:
            config = WatchConfig(path=Path(tmpdir))

            def callback(event, config):
                pass

            watcher = FileWatcher()
            watcher.add_watch(config, callback)

            with watcher:
                assert watcher.is_running() is True

            assert watcher.is_running() is False


class TestWatchdogNotAvailable:
    """Tests for when watchdog is not installed."""

    def test_watchdog_available_flag(self):
        """Test WATCHDOG_AVAILABLE flag is set."""
        # This just tests the flag exists - actual value depends on installation
        assert isinstance(WATCHDOG_AVAILABLE, bool)
