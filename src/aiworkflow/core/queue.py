"""
Message Queue Integration for aiworkflow framework.

Supports Redis and RabbitMQ for distributed workflow execution.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    pass

# Try to import redis, provide graceful fallback
try:
    import redis
    from redis import asyncio as aioredis

    REDIS_AVAILABLE = True
except ImportError:
    redis = None  # type: ignore
    aioredis = None  # type: ignore
    REDIS_AVAILABLE = False

# Try to import pika (RabbitMQ), provide graceful fallback
try:
    import pika
    from pika.adapters.asyncio_connection import AsyncioConnection

    RABBITMQ_AVAILABLE = True
except ImportError:
    pika = None  # type: ignore
    AsyncioConnection = None  # type: ignore
    RABBITMQ_AVAILABLE = False


class MessagePriority(Enum):
    """Priority levels for messages."""

    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


class MessageStatus(Enum):
    """Status of a message in the queue."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


@dataclass
class QueueMessage:
    """
    Represents a message in the queue.

    Attributes:
        id: Unique message identifier
        workflow_id: Workflow to execute
        payload: Message payload data
        priority: Message priority level
        status: Current message status
        created_at: When the message was created
        processed_at: When the message was processed
        attempts: Number of processing attempts
        max_attempts: Maximum retry attempts
        error: Error message if failed
        metadata: Additional metadata
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str = ""
    payload: dict[str, Any] = field(default_factory=dict)
    priority: MessagePriority = MessagePriority.NORMAL
    status: MessageStatus = MessageStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    processed_at: datetime | None = None
    attempts: int = 0
    max_attempts: int = 3
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "payload": self.payload,
            "priority": self.priority.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "error": self.error,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "QueueMessage":
        """Create from dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            workflow_id=data.get("workflow_id", ""),
            payload=data.get("payload", {}),
            priority=MessagePriority(data.get("priority", 1)),
            status=MessageStatus(data.get("status", "pending")),
            created_at=datetime.fromisoformat(data["created_at"])
            if data.get("created_at")
            else datetime.now(),
            processed_at=datetime.fromisoformat(data["processed_at"])
            if data.get("processed_at")
            else None,
            attempts=data.get("attempts", 0),
            max_attempts=data.get("max_attempts", 3),
            error=data.get("error"),
            metadata=data.get("metadata", {}),
        )

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> "QueueMessage":
        """Deserialize from JSON string."""
        return cls.from_dict(json.loads(json_str))


@dataclass
class QueueConfig:
    """
    Configuration for a message queue.

    Attributes:
        name: Queue name
        max_size: Maximum queue size (0 = unlimited)
        message_ttl: Message time-to-live in seconds
        dead_letter_queue: Name of dead letter queue
        retry_delay: Delay between retries in seconds
        visibility_timeout: How long a message is hidden during processing
    """

    name: str = "aiworkflow"
    max_size: int = 0
    message_ttl: int = 86400  # 24 hours
    dead_letter_queue: str | None = None
    retry_delay: float = 5.0
    visibility_timeout: int = 300  # 5 minutes


# Callback types
MessageHandler = Callable[[QueueMessage], Any]
AsyncMessageHandler = Callable[[QueueMessage], Any]


class MessageQueue(ABC):
    """
    Abstract base class for message queue implementations.
    """

    @abstractmethod
    def connect(self) -> None:
        """Connect to the message queue."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Disconnect from the message queue."""
        pass

    @abstractmethod
    def publish(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """
        Publish a message to the queue.

        Args:
            message: Message to publish
            queue_name: Optional queue name override

        Returns:
            Message ID
        """
        pass

    @abstractmethod
    def consume(
        self,
        handler: MessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """
        Start consuming messages from the queue.

        Args:
            handler: Callback for processing messages
            queue_name: Optional queue name override
            batch_size: Number of messages to fetch at once
        """
        pass

    @abstractmethod
    def acknowledge(self, message_id: str) -> None:
        """Acknowledge successful processing of a message."""
        pass

    @abstractmethod
    def reject(self, message_id: str, requeue: bool = True) -> None:
        """Reject a message, optionally requeueing it."""
        pass

    @abstractmethod
    def get_queue_length(self, queue_name: str | None = None) -> int:
        """Get the number of messages in the queue."""
        pass

    @abstractmethod
    def purge(self, queue_name: str | None = None) -> int:
        """Remove all messages from the queue. Returns count of removed messages."""
        pass


class RedisQueue(MessageQueue):
    """
    Redis-based message queue implementation.

    Uses Redis lists for queue operations with sorted sets for priority queues.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: str | None = None,
        config: QueueConfig | None = None,
        url: str | None = None,
    ) -> None:
        """
        Initialize Redis queue.

        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            password: Redis password
            config: Queue configuration
            url: Redis URL (overrides host/port/db/password)
        """
        if not REDIS_AVAILABLE:
            raise ImportError("Redis not available. Install with: pip install redis")

        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.url = url
        self.config = config or QueueConfig()
        self._client: redis.Redis | None = None
        self._processing: dict[str, QueueMessage] = {}

    def connect(self) -> None:
        """Connect to Redis."""
        if self.url:
            self._client = redis.from_url(self.url)
        else:
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
            )
        # Test connection
        self._client.ping()

    def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._client:
            self._client.close()
            self._client = None

    def _queue_key(self, queue_name: str | None = None) -> str:
        """Get the Redis key for a queue."""
        name = queue_name or self.config.name
        return f"aiworkflow:queue:{name}"

    def _priority_key(self, queue_name: str | None = None) -> str:
        """Get the Redis key for a priority queue."""
        name = queue_name or self.config.name
        return f"aiworkflow:priority:{name}"

    def _processing_key(self, queue_name: str | None = None) -> str:
        """Get the Redis key for processing set."""
        name = queue_name or self.config.name
        return f"aiworkflow:processing:{name}"

    def publish(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """Publish a message to the queue."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        # Use sorted set for priority queue
        priority_key = self._priority_key(queue_name)
        score = -message.priority.value  # Negative so higher priority = lower score
        self._client.zadd(priority_key, {message.to_json(): score})

        # Set TTL if configured
        if self.config.message_ttl > 0:
            self._client.expire(priority_key, self.config.message_ttl)

        return message.id

    def consume(
        self,
        handler: MessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """Start consuming messages (blocking)."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        processing_key = self._processing_key(queue_name)

        while True:
            # Get message with highest priority (lowest score)
            result = self._client.zpopmin(priority_key, count=batch_size)

            for item in result:
                json_str, _score = item
                message = QueueMessage.from_json(json_str)
                message.attempts += 1
                message.status = MessageStatus.PROCESSING

                # Track as processing
                self._processing[message.id] = message
                self._client.hset(processing_key, message.id, message.to_json())

                try:
                    handler(message)
                    self.acknowledge(message.id)
                except Exception as e:
                    message.error = str(e)
                    self.reject(message.id, requeue=message.attempts < message.max_attempts)

            if not result:
                # No messages, wait briefly
                import time

                time.sleep(0.1)

    def acknowledge(self, message_id: str) -> None:
        """Acknowledge successful processing."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        processing_key = self._processing_key()
        self._client.hdel(processing_key, message_id)
        self._processing.pop(message_id, None)

    def reject(self, message_id: str, requeue: bool = True) -> None:
        """Reject a message."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        processing_key = self._processing_key()
        message = self._processing.pop(message_id, None)

        if message and requeue:
            # Re-add to queue with delay
            message.status = MessageStatus.PENDING
            import time

            time.sleep(self.config.retry_delay)
            self.publish(message)
        elif message and self.config.dead_letter_queue:
            # Send to dead letter queue
            message.status = MessageStatus.DEAD_LETTER
            self.publish(message, self.config.dead_letter_queue)

        self._client.hdel(processing_key, message_id)

    def get_queue_length(self, queue_name: str | None = None) -> int:
        """Get queue length."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        return self._client.zcard(priority_key)

    def purge(self, queue_name: str | None = None) -> int:
        """Purge all messages from queue."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        count = self._client.zcard(priority_key)
        self._client.delete(priority_key)
        return count

    def peek(self, queue_name: str | None = None, count: int = 10) -> list[QueueMessage]:
        """Peek at messages without removing them."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        result = self._client.zrange(priority_key, 0, count - 1)
        return [QueueMessage.from_json(item) for item in result]


class AsyncRedisQueue(MessageQueue):
    """
    Async Redis-based message queue implementation.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: str | None = None,
        config: QueueConfig | None = None,
        url: str | None = None,
    ) -> None:
        """Initialize async Redis queue."""
        if not REDIS_AVAILABLE:
            raise ImportError("Redis not available. Install with: pip install redis")

        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.url = url
        self.config = config or QueueConfig()
        self._client: aioredis.Redis | None = None
        self._processing: dict[str, QueueMessage] = {}
        self._running = False

    async def connect_async(self) -> None:
        """Connect to Redis asynchronously."""
        if self.url:
            self._client = await aioredis.from_url(self.url)
        else:
            self._client = await aioredis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
            )
        await self._client.ping()

    def connect(self) -> None:
        """Sync connect wrapper."""
        asyncio.get_event_loop().run_until_complete(self.connect_async())

    async def disconnect_async(self) -> None:
        """Disconnect asynchronously."""
        self._running = False
        if self._client:
            await self._client.close()
            self._client = None

    def disconnect(self) -> None:
        """Sync disconnect wrapper."""
        asyncio.get_event_loop().run_until_complete(self.disconnect_async())

    def _priority_key(self, queue_name: str | None = None) -> str:
        """Get the Redis key for a priority queue."""
        name = queue_name or self.config.name
        return f"aiworkflow:priority:{name}"

    def _processing_key(self, queue_name: str | None = None) -> str:
        """Get the Redis key for processing set."""
        name = queue_name or self.config.name
        return f"aiworkflow:processing:{name}"

    async def publish_async(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """Publish a message asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        score = -message.priority.value
        await self._client.zadd(priority_key, {message.to_json(): score})

        if self.config.message_ttl > 0:
            await self._client.expire(priority_key, self.config.message_ttl)

        return message.id

    def publish(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """Sync publish wrapper."""
        return asyncio.get_event_loop().run_until_complete(self.publish_async(message, queue_name))

    async def consume_async(
        self,
        handler: AsyncMessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """Start consuming messages asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        processing_key = self._processing_key(queue_name)
        self._running = True

        while self._running:
            result = await self._client.zpopmin(priority_key, count=batch_size)

            for item in result:
                json_str, _score = item
                message = QueueMessage.from_json(json_str)
                message.attempts += 1
                message.status = MessageStatus.PROCESSING

                self._processing[message.id] = message
                await self._client.hset(processing_key, message.id, message.to_json())

                try:
                    result = handler(message)
                    if asyncio.iscoroutine(result):
                        await result
                    await self.acknowledge_async(message.id)
                except Exception as e:
                    message.error = str(e)
                    await self.reject_async(
                        message.id, requeue=message.attempts < message.max_attempts
                    )

            if not result:
                await asyncio.sleep(0.1)

    def consume(
        self,
        handler: MessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """Sync consume wrapper."""
        asyncio.get_event_loop().run_until_complete(
            self.consume_async(handler, queue_name, batch_size)
        )

    async def acknowledge_async(self, message_id: str) -> None:
        """Acknowledge asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        processing_key = self._processing_key()
        await self._client.hdel(processing_key, message_id)
        self._processing.pop(message_id, None)

    def acknowledge(self, message_id: str) -> None:
        """Sync acknowledge wrapper."""
        asyncio.get_event_loop().run_until_complete(self.acknowledge_async(message_id))

    async def reject_async(self, message_id: str, requeue: bool = True) -> None:
        """Reject asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        processing_key = self._processing_key()
        message = self._processing.pop(message_id, None)

        if message and requeue:
            message.status = MessageStatus.PENDING
            await asyncio.sleep(self.config.retry_delay)
            await self.publish_async(message)
        elif message and self.config.dead_letter_queue:
            message.status = MessageStatus.DEAD_LETTER
            await self.publish_async(message, self.config.dead_letter_queue)

        await self._client.hdel(processing_key, message_id)

    def reject(self, message_id: str, requeue: bool = True) -> None:
        """Sync reject wrapper."""
        asyncio.get_event_loop().run_until_complete(self.reject_async(message_id, requeue))

    async def get_queue_length_async(self, queue_name: str | None = None) -> int:
        """Get queue length asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        return await self._client.zcard(priority_key)

    def get_queue_length(self, queue_name: str | None = None) -> int:
        """Sync get queue length wrapper."""
        return asyncio.get_event_loop().run_until_complete(self.get_queue_length_async(queue_name))

    async def purge_async(self, queue_name: str | None = None) -> int:
        """Purge asynchronously."""
        if not self._client:
            raise RuntimeError("Not connected to Redis")

        priority_key = self._priority_key(queue_name)
        count = await self._client.zcard(priority_key)
        await self._client.delete(priority_key)
        return count

    def purge(self, queue_name: str | None = None) -> int:
        """Sync purge wrapper."""
        return asyncio.get_event_loop().run_until_complete(self.purge_async(queue_name))

    def stop(self) -> None:
        """Stop consuming messages."""
        self._running = False


class RabbitMQQueue(MessageQueue):
    """
    RabbitMQ-based message queue implementation.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 5672,
        username: str = "guest",
        password: str = "guest",
        virtual_host: str = "/",
        config: QueueConfig | None = None,
    ) -> None:
        """
        Initialize RabbitMQ queue.

        Args:
            host: RabbitMQ host
            port: RabbitMQ port
            username: Username for authentication
            password: Password for authentication
            virtual_host: Virtual host to use
            config: Queue configuration
        """
        if not RABBITMQ_AVAILABLE:
            raise ImportError("Pika not available. Install with: pip install pika")

        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.virtual_host = virtual_host
        self.config = config or QueueConfig()
        self._connection: pika.BlockingConnection | None = None
        self._channel: pika.channel.Channel | None = None
        self._consuming = False

    def connect(self) -> None:
        """Connect to RabbitMQ."""
        credentials = pika.PlainCredentials(self.username, self.password)
        parameters = pika.ConnectionParameters(
            host=self.host,
            port=self.port,
            virtual_host=self.virtual_host,
            credentials=credentials,
        )
        self._connection = pika.BlockingConnection(parameters)
        self._channel = self._connection.channel()

        # Declare queue
        args = {}
        if self.config.message_ttl > 0:
            args["x-message-ttl"] = self.config.message_ttl * 1000  # Convert to ms

        if self.config.dead_letter_queue:
            args["x-dead-letter-exchange"] = ""
            args["x-dead-letter-routing-key"] = self.config.dead_letter_queue

        if self.config.max_size > 0:
            args["x-max-length"] = self.config.max_size

        self._channel.queue_declare(
            queue=self.config.name,
            durable=True,
            arguments=args if args else None,
        )

        # Declare dead letter queue if configured
        if self.config.dead_letter_queue:
            self._channel.queue_declare(
                queue=self.config.dead_letter_queue,
                durable=True,
            )

    def disconnect(self) -> None:
        """Disconnect from RabbitMQ."""
        self._consuming = False
        if self._channel:
            self._channel.close()
            self._channel = None
        if self._connection:
            self._connection.close()
            self._connection = None

    def publish(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """Publish a message to the queue."""
        if not self._channel:
            raise RuntimeError("Not connected to RabbitMQ")

        queue = queue_name or self.config.name
        properties = pika.BasicProperties(
            delivery_mode=2,  # Persistent
            priority=message.priority.value,
            message_id=message.id,
            timestamp=int(message.created_at.timestamp()),
            headers=message.metadata,
        )

        self._channel.basic_publish(
            exchange="",
            routing_key=queue,
            body=message.to_json(),
            properties=properties,
        )

        return message.id

    def consume(
        self,
        handler: MessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """Start consuming messages (blocking)."""
        if not self._channel:
            raise RuntimeError("Not connected to RabbitMQ")

        queue = queue_name or self.config.name
        self._channel.basic_qos(prefetch_count=batch_size)

        def callback(ch, method, properties, body):
            message = QueueMessage.from_json(body.decode())
            message.attempts += 1

            try:
                handler(message)
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                message.error = str(e)
                if message.attempts < message.max_attempts:
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                else:
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        self._channel.basic_consume(queue=queue, on_message_callback=callback)
        self._consuming = True
        self._channel.start_consuming()

    def acknowledge(self, message_id: str) -> None:
        """Acknowledge is handled in consume callback."""
        pass

    def reject(self, message_id: str, requeue: bool = True) -> None:
        """Reject is handled in consume callback."""
        pass

    def get_queue_length(self, queue_name: str | None = None) -> int:
        """Get queue length."""
        if not self._channel:
            raise RuntimeError("Not connected to RabbitMQ")

        queue = queue_name or self.config.name
        result = self._channel.queue_declare(queue=queue, passive=True)
        return result.method.message_count

    def purge(self, queue_name: str | None = None) -> int:
        """Purge all messages from queue."""
        if not self._channel:
            raise RuntimeError("Not connected to RabbitMQ")

        queue = queue_name or self.config.name
        result = self._channel.queue_purge(queue=queue)
        return result.method.message_count

    def stop_consuming(self) -> None:
        """Stop the consuming loop."""
        if self._channel:
            self._channel.stop_consuming()
        self._consuming = False


class InMemoryQueue(MessageQueue):
    """
    In-memory message queue for testing and development.

    Not suitable for production use as messages are lost on restart.
    """

    def __init__(self, config: QueueConfig | None = None) -> None:
        """Initialize in-memory queue."""
        self.config = config or QueueConfig()
        self._queues: dict[str, list[QueueMessage]] = {}
        self._processing: dict[str, QueueMessage] = {}
        self._dead_letter: dict[str, list[QueueMessage]] = {}
        self._running = False

    def connect(self) -> None:
        """No-op for in-memory queue."""
        pass

    def disconnect(self) -> None:
        """No-op for in-memory queue."""
        self._running = False

    def _get_queue(self, queue_name: str | None = None) -> list[QueueMessage]:
        """Get or create a queue."""
        name = queue_name or self.config.name
        if name not in self._queues:
            self._queues[name] = []
        return self._queues[name]

    def publish(self, message: QueueMessage, queue_name: str | None = None) -> str:
        """Publish a message to the queue."""
        queue = self._get_queue(queue_name)

        # Check max size
        if self.config.max_size > 0 and len(queue) >= self.config.max_size:
            raise RuntimeError("Queue is full")

        # Insert sorted by priority (higher priority first)
        inserted = False
        for i, existing in enumerate(queue):
            if message.priority.value > existing.priority.value:
                queue.insert(i, message)
                inserted = True
                break

        if not inserted:
            queue.append(message)

        return message.id

    def consume(
        self,
        handler: MessageHandler,
        queue_name: str | None = None,
        batch_size: int = 1,
    ) -> None:
        """Start consuming messages (blocking)."""
        import time

        queue = self._get_queue(queue_name)
        self._running = True

        while self._running:
            messages_to_process = []

            # Get batch of messages
            for _ in range(min(batch_size, len(queue))):
                if queue:
                    message = queue.pop(0)
                    message.attempts += 1
                    message.status = MessageStatus.PROCESSING
                    self._processing[message.id] = message
                    messages_to_process.append(message)

            for message in messages_to_process:
                try:
                    handler(message)
                    self.acknowledge(message.id)
                except Exception as e:
                    message.error = str(e)
                    self.reject(message.id, requeue=message.attempts < message.max_attempts)

            if not messages_to_process:
                time.sleep(0.1)

    def acknowledge(self, message_id: str) -> None:
        """Acknowledge successful processing."""
        message = self._processing.pop(message_id, None)
        if message:
            message.status = MessageStatus.COMPLETED
            message.processed_at = datetime.now()

    def reject(self, message_id: str, requeue: bool = True) -> None:
        """Reject a message."""
        message = self._processing.pop(message_id, None)
        if message:
            if requeue:
                message.status = MessageStatus.PENDING
                self.publish(message)
            elif self.config.dead_letter_queue:
                message.status = MessageStatus.DEAD_LETTER
                if self.config.dead_letter_queue not in self._dead_letter:
                    self._dead_letter[self.config.dead_letter_queue] = []
                self._dead_letter[self.config.dead_letter_queue].append(message)
            else:
                message.status = MessageStatus.FAILED

    def get_queue_length(self, queue_name: str | None = None) -> int:
        """Get queue length."""
        return len(self._get_queue(queue_name))

    def purge(self, queue_name: str | None = None) -> int:
        """Purge all messages from queue."""
        queue = self._get_queue(queue_name)
        count = len(queue)
        queue.clear()
        return count

    def stop(self) -> None:
        """Stop consuming."""
        self._running = False

    def peek(self, queue_name: str | None = None, count: int = 10) -> list[QueueMessage]:
        """Peek at messages without removing them."""
        queue = self._get_queue(queue_name)
        return queue[:count]

    def get_dead_letter_messages(self, queue_name: str | None = None) -> list[QueueMessage]:
        """Get messages from dead letter queue."""
        name = queue_name or self.config.dead_letter_queue
        if name and name in self._dead_letter:
            return self._dead_letter[name]
        return []


class WorkflowQueueManager:
    """
    High-level manager for workflow message queues.

    Provides a simple interface for publishing and consuming workflow execution requests.
    """

    def __init__(
        self,
        queue: MessageQueue,
        workflow_callback: Callable[[str, dict[str, Any]], Any] | None = None,
    ) -> None:
        """
        Initialize the queue manager.

        Args:
            queue: Message queue implementation
            workflow_callback: Callback to execute workflows (workflow_id, inputs) -> result
        """
        self.queue = queue
        self.workflow_callback = workflow_callback
        self._running = False

    def enqueue_workflow(
        self,
        workflow_id: str,
        inputs: dict[str, Any] | None = None,
        priority: MessagePriority = MessagePriority.NORMAL,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Enqueue a workflow for execution.

        Args:
            workflow_id: ID of the workflow to execute
            inputs: Input parameters for the workflow
            priority: Message priority
            metadata: Additional metadata

        Returns:
            Message ID
        """
        message = QueueMessage(
            workflow_id=workflow_id,
            payload=inputs or {},
            priority=priority,
            metadata=metadata or {},
        )
        return self.queue.publish(message)

    def start_worker(self, num_workers: int = 1) -> None:
        """
        Start processing workflows from the queue.

        Args:
            num_workers: Number of concurrent workers (for threading)
        """
        if not self.workflow_callback:
            raise RuntimeError("No workflow callback configured")

        def handler(message: QueueMessage) -> None:
            result = self.workflow_callback(message.workflow_id, message.payload)
            message.metadata["result"] = result

        self._running = True
        self.queue.consume(handler, batch_size=num_workers)

    def stop_worker(self) -> None:
        """Stop processing workflows."""
        self._running = False
        if hasattr(self.queue, "stop"):
            self.queue.stop()
        elif hasattr(self.queue, "stop_consuming"):
            self.queue.stop_consuming()

    def get_pending_count(self) -> int:
        """Get count of pending workflow executions."""
        return self.queue.get_queue_length()
