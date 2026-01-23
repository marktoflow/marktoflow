"""
File System Event Triggers for marktoflow framework.

Uses watchdog to monitor file system changes and trigger workflows.
"""

from __future__ import annotations

import asyncio
import fnmatch
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    pass

# Try to import watchdog, provide graceful fallback
try:
    from watchdog.observers import Observer
    from watchdog.events import (
        FileSystemEventHandler,
        FileSystemEvent,
        FileCreatedEvent,
        FileModifiedEvent,
        FileDeletedEvent,
        FileMovedEvent,
        DirCreatedEvent,
        DirModifiedEvent,
        DirDeletedEvent,
        DirMovedEvent,
    )

    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    Observer = None  # type: ignore
    FileSystemEventHandler = object  # type: ignore
    FileSystemEvent = None  # type: ignore


class FileEventType(Enum):
    """Types of file system events."""

    CREATED = "created"
    MODIFIED = "modified"
    DELETED = "deleted"
    MOVED = "moved"


@dataclass
class FileEvent:
    """
    Represents a file system event.

    Attributes:
        event_type: Type of event (created, modified, deleted, moved)
        path: Path to the affected file/directory
        is_directory: Whether the event is for a directory
        timestamp: When the event occurred
        src_path: Source path (same as path for most events)
        dest_path: Destination path (only for moved events)
    """

    event_type: FileEventType
    path: Path
    is_directory: bool
    timestamp: datetime = field(default_factory=datetime.now)
    src_path: Path | None = None
    dest_path: Path | None = None

    def matches_pattern(self, pattern: str) -> bool:
        """
        Check if the file path matches a glob pattern.

        Args:
            pattern: Glob pattern (e.g., "*.py", "src/**/*.ts")

        Returns:
            True if path matches pattern
        """
        return fnmatch.fnmatch(str(self.path), pattern)

    def matches_regex(self, regex: str) -> bool:
        """
        Check if the file path matches a regex pattern.

        Args:
            regex: Regular expression pattern

        Returns:
            True if path matches regex
        """
        return bool(re.search(regex, str(self.path)))

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "event_type": self.event_type.value,
            "path": str(self.path),
            "is_directory": self.is_directory,
            "timestamp": self.timestamp.isoformat(),
            "src_path": str(self.src_path) if self.src_path else None,
            "dest_path": str(self.dest_path) if self.dest_path else None,
        }


@dataclass
class WatchConfig:
    """
    Configuration for a file watch.

    Attributes:
        path: Directory to watch
        patterns: Glob patterns to match (e.g., ["*.py", "*.yaml"])
        ignore_patterns: Patterns to ignore
        recursive: Watch subdirectories
        events: Event types to watch for
        debounce_seconds: Minimum time between events for same file
        workflow_id: Workflow to trigger on match
        workflow_inputs: Additional inputs to pass to workflow
    """

    path: Path
    patterns: list[str] = field(default_factory=lambda: ["*"])
    ignore_patterns: list[str] = field(default_factory=list)
    recursive: bool = True
    events: list[FileEventType] = field(
        default_factory=lambda: [FileEventType.CREATED, FileEventType.MODIFIED]
    )
    debounce_seconds: float = 1.0
    workflow_id: str | None = None
    workflow_inputs: dict[str, Any] = field(default_factory=dict)

    def matches(self, event: FileEvent) -> bool:
        """Check if an event matches this watch configuration."""
        # Check event type
        if event.event_type not in self.events:
            return False

        path_str = str(event.path)

        # Check ignore patterns first
        for pattern in self.ignore_patterns:
            if fnmatch.fnmatch(path_str, pattern):
                return False

        # Check include patterns
        for pattern in self.patterns:
            if fnmatch.fnmatch(path_str, pattern):
                return True
            # Also check just the filename
            if fnmatch.fnmatch(event.path.name, pattern):
                return True

        return False


# Event handler callback type
FileEventHandler = Callable[[FileEvent, WatchConfig], None]
AsyncFileEventHandler = Callable[[FileEvent, WatchConfig], Any]


class _WatchdogHandler(FileSystemEventHandler if WATCHDOG_AVAILABLE else object):
    """Internal watchdog event handler."""

    def __init__(
        self,
        config: WatchConfig,
        callback: FileEventHandler,
        async_callback: AsyncFileEventHandler | None = None,
        loop: asyncio.AbstractEventLoop | None = None,
    ) -> None:
        if WATCHDOG_AVAILABLE:
            super().__init__()
        self.config = config
        self.callback = callback
        self.async_callback = async_callback
        self.loop = loop
        self._last_events: dict[str, datetime] = {}

    def _should_debounce(self, path: str) -> bool:
        """Check if event should be debounced."""
        now = datetime.now()
        if path in self._last_events:
            elapsed = (now - self._last_events[path]).total_seconds()
            if elapsed < self.config.debounce_seconds:
                return True
        self._last_events[path] = now
        return False

    def _handle_event(self, event: FileSystemEvent, event_type: FileEventType) -> None:
        """Process a file system event."""
        if not WATCHDOG_AVAILABLE:
            return

        path = Path(event.src_path)

        # Skip debounced events
        if self._should_debounce(str(path)):
            return

        file_event = FileEvent(
            event_type=event_type,
            path=path,
            is_directory=event.is_directory,
            timestamp=datetime.now(),
            src_path=path,
        )

        # Handle moved events
        if hasattr(event, "dest_path") and event.dest_path:
            file_event.dest_path = Path(event.dest_path)

        # Check if event matches config
        if not self.config.matches(file_event):
            return

        # Call callback
        if self.async_callback and self.loop:
            asyncio.run_coroutine_threadsafe(
                self.async_callback(file_event, self.config),
                self.loop,
            )
        else:
            self.callback(file_event, self.config)

    def on_created(self, event: FileSystemEvent) -> None:
        """Handle file/directory creation."""
        self._handle_event(event, FileEventType.CREATED)

    def on_modified(self, event: FileSystemEvent) -> None:
        """Handle file/directory modification."""
        self._handle_event(event, FileEventType.MODIFIED)

    def on_deleted(self, event: FileSystemEvent) -> None:
        """Handle file/directory deletion."""
        self._handle_event(event, FileEventType.DELETED)

    def on_moved(self, event: FileSystemEvent) -> None:
        """Handle file/directory move."""
        self._handle_event(event, FileEventType.MOVED)


@dataclass
class WatchHandle:
    """Handle for a registered watch."""

    watch_id: str
    config: WatchConfig
    handler: _WatchdogHandler | None = None
    _observer_watch: Any = None  # The watch object returned by observer.schedule

    def __repr__(self) -> str:
        return f"WatchHandle(id={self.watch_id!r}, path={self.config.path!r})"


class FileWatcher:
    """
    Watches file system for changes and triggers callbacks.

    Example:
        ```python
        watcher = FileWatcher()

        config = WatchConfig(
            path=Path("./src"),
            patterns=["*.py"],
            events=[FileEventType.MODIFIED],
        )

        def on_change(event, config):
            print(f"File changed: {event.path}")

        watcher.add_watch(config, on_change)
        watcher.start()
        ```
    """

    def __init__(self) -> None:
        """Initialize the file watcher."""
        if not WATCHDOG_AVAILABLE:
            raise ImportError(
                "watchdog is required for file system triggers. "
                "Install with: pip install marktoflow[triggers]"
            )

        self._observer: Observer = Observer()
        self._watches: dict[str, WatchHandle] = {}
        self._watch_counter = 0
        self._running = False
        self._lock = threading.Lock()

    def add_watch(
        self,
        config: WatchConfig,
        callback: FileEventHandler,
        watch_id: str | None = None,
    ) -> WatchHandle:
        """
        Add a file watch.

        Args:
            config: Watch configuration
            callback: Function to call on matching events
            watch_id: Optional custom ID for the watch

        Returns:
            WatchHandle for managing the watch
        """
        with self._lock:
            if watch_id is None:
                self._watch_counter += 1
                watch_id = f"watch-{self._watch_counter}"

            handler = _WatchdogHandler(config, callback)

            # Schedule with observer
            observer_watch = self._observer.schedule(
                handler,
                str(config.path),
                recursive=config.recursive,
            )

            handle = WatchHandle(watch_id=watch_id, config=config, handler=handler)
            handle._observer_watch = observer_watch

            self._watches[watch_id] = handle
            return handle

    def remove_watch(self, watch_id: str) -> bool:
        """
        Remove a watch.

        Args:
            watch_id: ID of watch to remove

        Returns:
            True if watch was removed
        """
        with self._lock:
            if watch_id not in self._watches:
                return False

            handle = self._watches.pop(watch_id)
            if handle._observer_watch:
                self._observer.unschedule(handle._observer_watch)
            return True

    def get_watch(self, watch_id: str) -> WatchHandle | None:
        """Get a watch by ID."""
        return self._watches.get(watch_id)

    def list_watches(self) -> list[WatchHandle]:
        """List all registered watches."""
        return list(self._watches.values())

    def start(self, blocking: bool = False) -> None:
        """
        Start watching for file changes.

        Args:
            blocking: If True, block until stop() is called
        """
        if self._running:
            return

        self._observer.start()
        self._running = True

        if blocking:
            try:
                while self._running:
                    self._observer.join(timeout=1.0)
            except KeyboardInterrupt:
                self.stop()

    def stop(self) -> None:
        """Stop watching for file changes."""
        if not self._running:
            return

        self._running = False
        self._observer.stop()
        self._observer.join(timeout=5.0)

    def is_running(self) -> bool:
        """Check if watcher is running."""
        return self._running

    def __enter__(self) -> "FileWatcher":
        self.start()
        return self

    def __exit__(self, *args: Any) -> None:
        self.stop()


class AsyncFileWatcher:
    """
    Async version of FileWatcher for use with asyncio.

    Example:
        ```python
        async def main():
            watcher = AsyncFileWatcher()

            config = WatchConfig(
                path=Path("./src"),
                patterns=["*.py"],
            )

            async def on_change(event, config):
                print(f"File changed: {event.path}")

            watcher.add_watch(config, on_change)
            await watcher.start()
        ```
    """

    def __init__(self) -> None:
        """Initialize the async file watcher."""
        if not WATCHDOG_AVAILABLE:
            raise ImportError(
                "watchdog is required for file system triggers. "
                "Install with: pip install marktoflow[triggers]"
            )

        self._observer: Observer = Observer()
        self._watches: dict[str, WatchHandle] = {}
        self._watch_counter = 0
        self._running = False
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._event_queue: asyncio.Queue[tuple[FileEvent, WatchConfig]] = asyncio.Queue()

    def add_watch(
        self,
        config: WatchConfig,
        callback: AsyncFileEventHandler,
        watch_id: str | None = None,
    ) -> WatchHandle:
        """
        Add a file watch with async callback.

        Args:
            config: Watch configuration
            callback: Async function to call on matching events
            watch_id: Optional custom ID for the watch

        Returns:
            WatchHandle for managing the watch
        """
        if watch_id is None:
            self._watch_counter += 1
            watch_id = f"watch-{self._watch_counter}"

        # Create sync callback that queues events
        def sync_callback(event: FileEvent, config: WatchConfig) -> None:
            if self._loop:
                asyncio.run_coroutine_threadsafe(
                    self._event_queue.put((event, config)),
                    self._loop,
                )

        handler = _WatchdogHandler(config, sync_callback)
        handle = WatchHandle(watch_id=watch_id, config=config, handler=handler)

        # Store callback for later use
        handle._async_callback = callback  # type: ignore

        # Schedule with observer
        self._observer.schedule(
            handler,
            str(config.path),
            recursive=config.recursive,
        )

        self._watches[watch_id] = handle
        return handle

    def remove_watch(self, watch_id: str) -> bool:
        """Remove a watch."""
        if watch_id not in self._watches:
            return False

        handle = self._watches.pop(watch_id)
        if handle.handler:
            self._observer.unschedule(handle.handler)
        return True

    def get_watch(self, watch_id: str) -> WatchHandle | None:
        """Get a watch by ID."""
        return self._watches.get(watch_id)

    def list_watches(self) -> list[WatchHandle]:
        """List all registered watches."""
        return list(self._watches.values())

    async def start(self) -> None:
        """Start watching for file changes."""
        if self._running:
            return

        self._loop = asyncio.get_running_loop()
        self._observer.start()
        self._running = True

        # Process events from queue
        while self._running:
            try:
                event, config = await asyncio.wait_for(
                    self._event_queue.get(),
                    timeout=0.5,
                )

                # Find the watch and call its callback
                for handle in self._watches.values():
                    if handle.config == config and hasattr(handle, "_async_callback"):
                        await handle._async_callback(event, config)  # type: ignore

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

    async def stop(self) -> None:
        """Stop watching for file changes."""
        self._running = False
        self._observer.stop()
        self._observer.join(timeout=5.0)

    def is_running(self) -> bool:
        """Check if watcher is running."""
        return self._running

    async def __aenter__(self) -> "AsyncFileWatcher":
        asyncio.create_task(self.start())
        await asyncio.sleep(0.1)  # Give observer time to start
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.stop()


def create_watch_config_from_workflow(
    workflow_path: Path,
    workflow_id: str,
) -> WatchConfig | None:
    """
    Create a WatchConfig from a workflow's trigger configuration.

    Args:
        workflow_path: Path to workflow file
        workflow_id: ID of the workflow

    Returns:
        WatchConfig if workflow has file trigger, None otherwise
    """
    import yaml

    try:
        with open(workflow_path) as f:
            content = f.read()

        # Extract YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 2:
                frontmatter = yaml.safe_load(parts[1])

                triggers = frontmatter.get("triggers", {})
                file_trigger = triggers.get("file", {})

                if not file_trigger:
                    return None

                watch_path = file_trigger.get("path", ".")
                patterns = file_trigger.get("patterns", ["*"])
                ignore = file_trigger.get("ignore", [])
                recursive = file_trigger.get("recursive", True)
                events_str = file_trigger.get("events", ["created", "modified"])

                # Convert event strings to enums
                events = []
                for e in events_str:
                    try:
                        events.append(FileEventType(e))
                    except ValueError:
                        pass

                return WatchConfig(
                    path=Path(watch_path),
                    patterns=patterns if isinstance(patterns, list) else [patterns],
                    ignore_patterns=ignore if isinstance(ignore, list) else [ignore],
                    recursive=recursive,
                    events=events or [FileEventType.CREATED, FileEventType.MODIFIED],
                    workflow_id=workflow_id,
                )

    except Exception:
        pass

    return None
