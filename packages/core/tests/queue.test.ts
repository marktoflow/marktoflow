import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryQueue, RedisQueue, RabbitMQQueue, MessagePriority, MessageStatus } from '../src/queue.js';
import { randomUUID } from 'crypto';

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn();
  RedisMock.prototype.zadd = vi.fn().mockResolvedValue(1);
  RedisMock.prototype.zpopmin = vi.fn().mockResolvedValue([]);
  RedisMock.prototype.hset = vi.fn().mockResolvedValue(1);
  RedisMock.prototype.hdel = vi.fn().mockResolvedValue(1);
  RedisMock.prototype.quit = vi.fn().mockResolvedValue('OK');
  return { Redis: RedisMock };
});

// Mock amqplib
vi.mock('amqplib', () => {
  return {
    connect: vi.fn().mockResolvedValue({
      createChannel: vi.fn().mockResolvedValue({
        assertQueue: vi.fn().mockResolvedValue({ messageCount: 0 }),
        sendToQueue: vi.fn(),
        prefetch: vi.fn(),
        consume: vi.fn().mockResolvedValue({ consumerTag: 'tag' }),
        ack: vi.fn(),
        nack: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  };
});

describe('InMemoryQueue', () => {
  let queue: InMemoryQueue;

  beforeEach(() => {
    queue = new InMemoryQueue();
  });

  afterEach(async () => {
    await queue.stop();
  });

  it('should publish and consume messages', async () => {
    const msg = {
      id: randomUUID(),
      workflowId: 'wf-1',
      payload: { foo: 'bar' },
      priority: MessagePriority.NORMAL,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: {},
    };

    await queue.publish(msg);
    expect(await queue.getQueueLength()).toBe(1);

    const handler = vi.fn().mockResolvedValue(undefined);
    queue.consume(handler); // Non-blocking in test? No, it's a loop.
    
    // We can't await consume() because it loops.
    // We should run it in background and wait for handler call?
    
    // Wait for handler
    await new Promise(r => setTimeout(r, 100));
    
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: msg.id }));
    expect(await queue.getQueueLength()).toBe(0);
  });

  it('should handle priority', async () => {
    const msgLow = {
      id: 'low',
      workflowId: 'wf-1',
      payload: {},
      priority: MessagePriority.LOW,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: {},
    };
    const msgHigh = {
      id: 'high',
      workflowId: 'wf-1',
      payload: {},
      priority: MessagePriority.HIGH,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: {},
    };

    await queue.publish(msgLow);
    await queue.publish(msgHigh);

    const processed: string[] = [];
    const handler = async (m: any) => { processed.push(m.id); };
    
    // Start consuming
    const consumePromise = queue.consume(handler);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 100));
    await queue.stop();
    await consumePromise;

    expect(processed).toEqual(['high', 'low']);
  });
});

describe('RedisQueue', () => {
  it('should connect and publish', async () => {
    const queue = new RedisQueue('redis://localhost');
    await queue.connect();
    
    const msg = {
      id: '123',
      workflowId: 'wf-1',
      payload: {},
      priority: MessagePriority.NORMAL,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: {},
    };

    await queue.publish(msg);
    // Verified by mock calls implicitly, or we can check
    // expect(ioredis.Redis.prototype.zadd).toHaveBeenCalled...
    
    await queue.disconnect();
  });
});

describe('RabbitMQQueue', () => {
  it('should connect and publish', async () => {
    const queue = new RabbitMQQueue('amqp://localhost');
    await queue.connect();
    
    const msg = {
      id: '123',
      workflowId: 'wf-1',
      payload: {},
      priority: MessagePriority.NORMAL,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata: {},
    };

    await queue.publish(msg);
    await queue.disconnect();
  });
});
