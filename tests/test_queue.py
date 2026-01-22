"""
Tests for message queue integration.
"""

import pytest
from datetime import datetime

from aiworkflow.core.queue import (
    QueueMessage,
    QueueConfig,
    MessagePriority,
    MessageStatus,
    InMemoryQueue,
    WorkflowQueueManager,
)


class TestQueueMessage:
    """Tests for QueueMessage dataclass."""

    def test_default_values(self):
        """Test default message values."""
        msg = QueueMessage()
        assert msg.id is not None
        assert msg.workflow_id == ""
        assert msg.payload == {}
        assert msg.priority == MessagePriority.NORMAL
        assert msg.status == MessageStatus.PENDING
        assert msg.attempts == 0
        assert msg.max_attempts == 3

    def test_custom_values(self):
        """Test message with custom values."""
        msg = QueueMessage(
            id="test-123",
            workflow_id="my-workflow",
            payload={"key": "value"},
            priority=MessagePriority.HIGH,
            max_attempts=5,
        )
        assert msg.id == "test-123"
        assert msg.workflow_id == "my-workflow"
        assert msg.payload == {"key": "value"}
        assert msg.priority == MessagePriority.HIGH
        assert msg.max_attempts == 5

    def test_to_dict(self):
        """Test serialization to dictionary."""
        msg = QueueMessage(
            id="test-123",
            workflow_id="my-workflow",
            priority=MessagePriority.HIGH,
        )
        data = msg.to_dict()
        assert data["id"] == "test-123"
        assert data["workflow_id"] == "my-workflow"
        assert data["priority"] == MessagePriority.HIGH.value
        assert data["status"] == MessageStatus.PENDING.value

    def test_from_dict(self):
        """Test deserialization from dictionary."""
        data = {
            "id": "test-123",
            "workflow_id": "my-workflow",
            "priority": 2,
            "status": "processing",
            "created_at": "2026-01-22T10:00:00",
            "attempts": 1,
        }
        msg = QueueMessage.from_dict(data)
        assert msg.id == "test-123"
        assert msg.workflow_id == "my-workflow"
        assert msg.priority == MessagePriority.HIGH
        assert msg.status == MessageStatus.PROCESSING
        assert msg.attempts == 1

    def test_to_json(self):
        """Test JSON serialization."""
        msg = QueueMessage(id="test-123", workflow_id="my-workflow")
        json_str = msg.to_json()
        assert "test-123" in json_str
        assert "my-workflow" in json_str

    def test_from_json(self):
        """Test JSON deserialization."""
        msg = QueueMessage(id="test-123", workflow_id="my-workflow")
        json_str = msg.to_json()
        restored = QueueMessage.from_json(json_str)
        assert restored.id == msg.id
        assert restored.workflow_id == msg.workflow_id


class TestQueueConfig:
    """Tests for QueueConfig dataclass."""

    def test_default_config(self):
        """Test default configuration values."""
        config = QueueConfig()
        assert config.name == "aiworkflow"
        assert config.max_size == 0
        assert config.message_ttl == 86400
        assert config.retry_delay == 5.0
        assert config.visibility_timeout == 300

    def test_custom_config(self):
        """Test custom configuration."""
        config = QueueConfig(
            name="custom-queue",
            max_size=100,
            message_ttl=3600,
            dead_letter_queue="dlq",
        )
        assert config.name == "custom-queue"
        assert config.max_size == 100
        assert config.message_ttl == 3600
        assert config.dead_letter_queue == "dlq"


class TestMessagePriority:
    """Tests for MessagePriority enum."""

    def test_priority_values(self):
        """Test priority enum values."""
        assert MessagePriority.LOW.value == 0
        assert MessagePriority.NORMAL.value == 1
        assert MessagePriority.HIGH.value == 2
        assert MessagePriority.CRITICAL.value == 3

    def test_priority_comparison(self):
        """Test priority ordering."""
        assert MessagePriority.CRITICAL.value > MessagePriority.HIGH.value
        assert MessagePriority.HIGH.value > MessagePriority.NORMAL.value
        assert MessagePriority.NORMAL.value > MessagePriority.LOW.value


class TestMessageStatus:
    """Tests for MessageStatus enum."""

    def test_status_values(self):
        """Test status enum values."""
        assert MessageStatus.PENDING.value == "pending"
        assert MessageStatus.PROCESSING.value == "processing"
        assert MessageStatus.COMPLETED.value == "completed"
        assert MessageStatus.FAILED.value == "failed"
        assert MessageStatus.DEAD_LETTER.value == "dead_letter"


class TestInMemoryQueue:
    """Tests for InMemoryQueue implementation."""

    def test_connect_disconnect(self):
        """Test connection lifecycle."""
        queue = InMemoryQueue()
        queue.connect()  # Should be no-op
        queue.disconnect()  # Should be no-op

    def test_publish_message(self):
        """Test publishing a message."""
        queue = InMemoryQueue()
        msg = QueueMessage(workflow_id="test-workflow")
        msg_id = queue.publish(msg)
        assert msg_id == msg.id
        assert queue.get_queue_length() == 1

    def test_publish_multiple_messages(self):
        """Test publishing multiple messages."""
        queue = InMemoryQueue()
        for i in range(5):
            queue.publish(QueueMessage(workflow_id=f"workflow-{i}"))
        assert queue.get_queue_length() == 5

    def test_priority_ordering(self):
        """Test messages are ordered by priority."""
        queue = InMemoryQueue()
        queue.publish(QueueMessage(workflow_id="low", priority=MessagePriority.LOW))
        queue.publish(QueueMessage(workflow_id="critical", priority=MessagePriority.CRITICAL))
        queue.publish(QueueMessage(workflow_id="normal", priority=MessagePriority.NORMAL))
        queue.publish(QueueMessage(workflow_id="high", priority=MessagePriority.HIGH))

        messages = queue.peek(count=4)
        assert messages[0].workflow_id == "critical"
        assert messages[1].workflow_id == "high"
        assert messages[2].workflow_id == "normal"
        assert messages[3].workflow_id == "low"

    def test_max_size_enforcement(self):
        """Test queue max size is enforced."""
        config = QueueConfig(max_size=3)
        queue = InMemoryQueue(config=config)

        for i in range(3):
            queue.publish(QueueMessage(workflow_id=f"workflow-{i}"))

        with pytest.raises(RuntimeError, match="Queue is full"):
            queue.publish(QueueMessage(workflow_id="overflow"))

    def test_purge(self):
        """Test purging the queue."""
        queue = InMemoryQueue()
        for i in range(5):
            queue.publish(QueueMessage(workflow_id=f"workflow-{i}"))

        count = queue.purge()
        assert count == 5
        assert queue.get_queue_length() == 0

    def test_peek(self):
        """Test peeking at messages."""
        queue = InMemoryQueue()
        queue.publish(QueueMessage(workflow_id="workflow-1"))
        queue.publish(QueueMessage(workflow_id="workflow-2"))

        messages = queue.peek(count=1)
        assert len(messages) == 1
        assert queue.get_queue_length() == 2  # Not removed

    def test_acknowledge(self):
        """Test message acknowledgment."""
        queue = InMemoryQueue()
        msg = QueueMessage(workflow_id="test")
        queue.publish(msg)

        # Simulate processing
        queue._processing[msg.id] = msg
        queue.acknowledge(msg.id)
        assert msg.id not in queue._processing

    def test_reject_with_requeue(self):
        """Test message rejection with requeue."""
        queue = InMemoryQueue()
        msg = QueueMessage(workflow_id="test")
        queue.publish(msg)

        # Simulate processing
        peeked = queue.peek()[0]
        queue._queues[queue.config.name].clear()
        queue._processing[peeked.id] = peeked

        queue.reject(peeked.id, requeue=True)
        assert queue.get_queue_length() == 1

    def test_dead_letter_queue(self):
        """Test dead letter queue handling."""
        config = QueueConfig(dead_letter_queue="dlq")
        queue = InMemoryQueue(config=config)
        msg = QueueMessage(workflow_id="test", max_attempts=1, attempts=1)
        queue._processing[msg.id] = msg

        queue.reject(msg.id, requeue=False)

        dlq_messages = queue.get_dead_letter_messages()
        assert len(dlq_messages) == 1
        assert dlq_messages[0].status == MessageStatus.DEAD_LETTER


class TestWorkflowQueueManager:
    """Tests for WorkflowQueueManager."""

    def test_enqueue_workflow(self):
        """Test enqueueing a workflow."""
        queue = InMemoryQueue()
        manager = WorkflowQueueManager(queue)

        msg_id = manager.enqueue_workflow(
            "my-workflow",
            inputs={"param": "value"},
            priority=MessagePriority.HIGH,
        )

        assert msg_id is not None
        assert manager.get_pending_count() == 1

        messages = queue.peek()
        assert messages[0].workflow_id == "my-workflow"
        assert messages[0].payload == {"param": "value"}
        assert messages[0].priority == MessagePriority.HIGH

    def test_enqueue_multiple_workflows(self):
        """Test enqueueing multiple workflows."""
        queue = InMemoryQueue()
        manager = WorkflowQueueManager(queue)

        for i in range(3):
            manager.enqueue_workflow(f"workflow-{i}")

        assert manager.get_pending_count() == 3

    def test_enqueue_with_metadata(self):
        """Test enqueueing with metadata."""
        queue = InMemoryQueue()
        manager = WorkflowQueueManager(queue)

        manager.enqueue_workflow(
            "my-workflow",
            metadata={"source": "api", "user": "test"},
        )

        messages = queue.peek()
        assert messages[0].metadata["source"] == "api"
        assert messages[0].metadata["user"] == "test"

    def test_start_worker_requires_callback(self):
        """Test worker requires callback."""
        queue = InMemoryQueue()
        manager = WorkflowQueueManager(queue)

        with pytest.raises(RuntimeError, match="No workflow callback"):
            manager.start_worker()

    def test_stop_worker(self):
        """Test stopping the worker."""
        queue = InMemoryQueue()

        def callback(wf_id, inputs):
            return {"result": "ok"}

        manager = WorkflowQueueManager(queue, workflow_callback=callback)
        manager.stop_worker()  # Should not raise


class TestQueueIntegration:
    """Integration tests for queue functionality."""

    def test_full_message_lifecycle(self):
        """Test complete message lifecycle."""
        queue = InMemoryQueue()
        results = []

        def handler(msg):
            results.append(msg.workflow_id)

        # Publish messages
        queue.publish(QueueMessage(workflow_id="workflow-1"))
        queue.publish(QueueMessage(workflow_id="workflow-2"))

        # Process manually (consume is blocking)
        messages = queue.peek(count=2)
        for msg in messages:
            msg.status = MessageStatus.PROCESSING
            handler(msg)
            queue.acknowledge(msg.id)

        assert len(results) == 2
        assert "workflow-1" in results
        assert "workflow-2" in results

    def test_retry_on_failure(self):
        """Test retry behavior on failure."""
        queue = InMemoryQueue()
        msg = QueueMessage(workflow_id="test", max_attempts=3)
        queue.publish(msg)

        # Simulate failures
        for _ in range(2):
            peeked = queue.peek()[0]
            peeked.attempts += 1
            queue._queues[queue.config.name].pop(0)
            queue._processing[peeked.id] = peeked
            queue.reject(peeked.id, requeue=True)

        assert queue.get_queue_length() == 1
        final = queue.peek()[0]
        assert final.attempts == 2

    def test_priority_queue_behavior(self):
        """Test priority queue processes high priority first."""
        queue = InMemoryQueue()
        processed = []

        # Add in reverse priority order
        queue.publish(QueueMessage(workflow_id="low", priority=MessagePriority.LOW))
        queue.publish(QueueMessage(workflow_id="normal", priority=MessagePriority.NORMAL))
        queue.publish(QueueMessage(workflow_id="high", priority=MessagePriority.HIGH))

        # Process all
        while queue.get_queue_length() > 0:
            msg = queue._queues[queue.config.name].pop(0)
            processed.append(msg.workflow_id)

        assert processed == ["high", "normal", "low"]

    def test_workflow_manager_with_callback(self):
        """Test workflow manager processes with callback."""
        queue = InMemoryQueue()
        executed = []

        def execute_workflow(workflow_id, inputs):
            executed.append((workflow_id, inputs))
            return {"status": "success"}

        manager = WorkflowQueueManager(queue, workflow_callback=execute_workflow)

        # Enqueue workflows
        manager.enqueue_workflow("workflow-1", inputs={"a": 1})
        manager.enqueue_workflow("workflow-2", inputs={"b": 2})

        # Manually process (consume is blocking)
        while manager.get_pending_count() > 0:
            msg = queue._queues[queue.config.name].pop(0)
            execute_workflow(msg.workflow_id, msg.payload)

        assert len(executed) == 2
        assert executed[0] == ("workflow-1", {"a": 1})
        assert executed[1] == ("workflow-2", {"b": 2})
