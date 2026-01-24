/**
 * Message Queue Integration for marktoflow v2.0
 *
 * Supports Redis and RabbitMQ for distributed workflow execution.
 */

import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import * as amqp from 'amqplib';
import { randomUUID } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
}

export interface QueueMessage {
  id: string;
  workflowId: string;
  payload: Record<string, unknown>;
  priority: MessagePriority;
  status: MessageStatus;
  createdAt: Date;
  processedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface QueueConfig {
  name: string;
  maxSize?: number;
  messageTtl?: number; // seconds
  deadLetterQueue?: string;
  retryDelay?: number; // seconds
  visibilityTimeout?: number; // seconds
}

export type MessageHandler = (message: QueueMessage) => Promise<void>;

// ============================================================================
// Abstract Message Queue
// ============================================================================

export abstract class MessageQueue extends EventEmitter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract publish(message: QueueMessage, queueName?: string): Promise<string>;
  abstract consume(handler: MessageHandler, queueName?: string, batchSize?: number): Promise<void>;
  abstract acknowledge(messageId: string): Promise<void>;
  abstract reject(messageId: string, requeue?: boolean): Promise<void>;
  abstract getQueueLength(queueName?: string): Promise<number>;
  abstract purge(queueName?: string): Promise<number>;
  abstract stop(): Promise<void>;
}

// ============================================================================
// InMemory Queue
// ============================================================================

export class InMemoryQueue extends MessageQueue {
  private queues: Map<string, QueueMessage[]> = new Map();
  private processing: Map<string, QueueMessage> = new Map();
  private deadLetter: Map<string, QueueMessage[]> = new Map();
  private running = false;
  private config: QueueConfig;

  constructor(config: QueueConfig = { name: 'marktoflow' }) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> { this.running = false; }

  private getQueue(name?: string): QueueMessage[] {
    const queueName = name || this.config.name;
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    return this.queues.get(queueName)!;
  }

  async publish(message: QueueMessage, queueName?: string): Promise<string> {
    const queue = this.getQueue(queueName);
    
    // Simple priority insertion
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (message.priority > queue[i].priority) {
        queue.splice(i, 0, message);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(message);
    }
    
    return message.id;
  }

  async consume(handler: MessageHandler, queueName?: string, batchSize = 1): Promise<void> {
    this.running = true;
    const queue = this.getQueue(queueName);

    while (this.running) {
      if (queue.length === 0) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      const batch = queue.splice(0, batchSize);
      
      for (const message of batch) {
        message.attempts++;
        message.status = MessageStatus.PROCESSING;
        this.processing.set(message.id, message);

        try {
          await handler(message);
          await this.acknowledge(message.id);
        } catch (error) {
          message.error = String(error);
          await this.reject(message.id, message.attempts < message.maxAttempts);
        }
      }
    }
  }

  async acknowledge(messageId: string): Promise<void> {
    const message = this.processing.get(messageId);
    if (message) {
      message.status = MessageStatus.COMPLETED;
      message.processedAt = new Date();
      this.processing.delete(messageId);
    }
  }

  async reject(messageId: string, requeue = true): Promise<void> {
    const message = this.processing.get(messageId);
    if (!message) return;

    this.processing.delete(messageId);

    if (requeue) {
      message.status = MessageStatus.PENDING;
      await this.publish(message); // Re-insert with priority
    } else if (this.config.deadLetterQueue) {
      message.status = MessageStatus.DEAD_LETTER;
      if (!this.deadLetter.has(this.config.deadLetterQueue)) {
        this.deadLetter.set(this.config.deadLetterQueue, []);
      }
      this.deadLetter.get(this.config.deadLetterQueue)!.push(message);
    } else {
      message.status = MessageStatus.FAILED;
    }
  }

  async getQueueLength(queueName?: string): Promise<number> {
    return this.getQueue(queueName).length;
  }

  async purge(queueName?: string): Promise<number> {
    const queue = this.getQueue(queueName);
    const length = queue.length;
    queue.length = 0;
    return length;
  }

  async stop(): Promise<void> {
    this.running = false;
  }
}

// ============================================================================
// Redis Queue
// ============================================================================

export class RedisQueue extends MessageQueue {
  private client: Redis | null = null;
  private config: QueueConfig;
  private running = false;
  private redisUrl: string;

  constructor(redisUrl: string, config: QueueConfig = { name: 'marktoflow' }) {
    super();
    this.redisUrl = redisUrl;
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = new Redis(this.redisUrl);
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  private queueKey(name?: string): string {
    return `marktoflow:queue:${name || this.config.name}`;
  }

  private processingKey(name?: string): string {
    return `marktoflow:processing:${name || this.config.name}`;
  }

  async publish(message: QueueMessage, queueName?: string): Promise<string> {
    if (!this.client) throw new Error("Redis not connected");
    
    const key = this.queueKey(queueName);
    await this.client.zadd(key, -message.priority, JSON.stringify(message));
    return message.id;
  }

  async consume(handler: MessageHandler, queueName?: string, batchSize = 1): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    this.running = true;
    const key = this.queueKey(queueName);
    const procKey = this.processingKey(queueName);

    while (this.running) {
      const results = await this.client.zpopmin(key, batchSize);
      
      if (results.length === 0) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      for (let i = 0; i < results.length; i += 2) {
        const msgJson = results[i];
        const message: QueueMessage = JSON.parse(msgJson);
        
        message.attempts++;
        message.status = MessageStatus.PROCESSING;
        
        await this.client.hset(procKey, message.id, JSON.stringify(message));

        try {
          await handler(message);
          await this.acknowledge(message.id);
        } catch (error) {
          message.error = String(error);
          await this.reject(message.id, message.attempts < message.maxAttempts);
        }
      }
    }
  }

  async acknowledge(messageId: string): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    const procKey = this.processingKey();
    await this.client.hdel(procKey, messageId);
  }

  async reject(messageId: string, requeue = true): Promise<void> {
    if (!this.client) throw new Error("Redis not connected");
    const procKey = this.processingKey();
    const msgJson = await this.client.hget(procKey, messageId);
    
    if (msgJson) {
      await this.client.hdel(procKey, messageId);
      const message: QueueMessage = JSON.parse(msgJson);
      
      if (requeue) {
        message.status = MessageStatus.PENDING;
        await new Promise(r => setTimeout(r, (this.config.retryDelay || 5) * 1000));
        await this.publish(message);
      } else if (this.config.deadLetterQueue) {
        message.status = MessageStatus.DEAD_LETTER;
        await this.publish(message, this.config.deadLetterQueue);
      }
    }
  }

  async getQueueLength(queueName?: string): Promise<number> {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.zcard(this.queueKey(queueName));
  }

  async purge(queueName?: string): Promise<number> {
    if (!this.client) throw new Error("Redis not connected");
    const key = this.queueKey(queueName);
    const count = await this.client.zcard(key);
    await this.client.del(key);
    return count;
  }

  async stop(): Promise<void> {
    this.running = false;
  }
}

// ============================================================================
// RabbitMQ Queue
// ============================================================================

export class RabbitMQQueue extends MessageQueue {
  private connection: any = null;
  private channel: any = null;
  private config: QueueConfig;
  private amqpUrl: string;
  private consumerTag: string | null = null;

  constructor(amqpUrl: string, config: QueueConfig = { name: 'marktoflow' }) {
    super();
    this.amqpUrl = amqpUrl;
    this.config = config;
  }

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.amqpUrl);
    this.channel = await this.connection.createChannel();
    
    const args: any = {};
    if (this.config.messageTtl) args['x-message-ttl'] = this.config.messageTtl * 1000;
    if (this.config.maxSize) args['x-max-length'] = this.config.maxSize;
    if (this.config.deadLetterQueue) {
      args['x-dead-letter-exchange'] = '';
      args['x-dead-letter-routing-key'] = this.config.deadLetterQueue;
      
      await this.channel.assertQueue(this.config.deadLetterQueue, { durable: true });
    }

    await this.channel.assertQueue(this.config.name, {
      durable: true,
      arguments: args
    });
  }

  async disconnect(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.channel = null;
    this.connection = null;
  }

  async publish(message: QueueMessage, queueName?: string): Promise<string> {
    if (!this.channel) throw new Error("RabbitMQ not connected");
    const queue = queueName || this.config.name;
    
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      priority: message.priority,
      messageId: message.id,
      timestamp: message.createdAt.getTime(),
    });
    
    return message.id;
  }

  async consume(handler: MessageHandler, queueName?: string, batchSize = 1): Promise<void> {
    if (!this.channel) throw new Error("RabbitMQ not connected");
    const queue = queueName || this.config.name;
    
    await this.channel.prefetch(batchSize);
    
    const { consumerTag } = await this.channel.consume(queue, async (msg: any) => {
      if (!msg) return;
      
      const message: QueueMessage = JSON.parse(msg.content.toString());
      message.attempts++;
      
      try {
        await handler(message);
        this.channel?.ack(msg);
      } catch (error) {
        message.error = String(error);
        if (message.attempts < message.maxAttempts) {
          this.channel?.nack(msg, false, true);
        } else {
          this.channel?.nack(msg, false, false); 
        }
      }
    });
    
    this.consumerTag = consumerTag;
  }

  async acknowledge(_messageId: string): Promise<void> {
    // Handled in consume
  }

  async reject(_messageId: string, _requeue = true): Promise<void> {
    // Handled in consume
  }

  async getQueueLength(queueName?: string): Promise<number> {
    if (!this.channel) throw new Error("RabbitMQ not connected");
    const q = await this.channel.assertQueue(queueName || this.config.name, { durable: true });
    return q.messageCount;
  }

  async purge(queueName?: string): Promise<number> {
    if (!this.channel) throw new Error("RabbitMQ not connected");
    const q = await this.channel.purgeQueue(queueName || this.config.name);
    return q.messageCount;
  }

  async stop(): Promise<void> {
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.consumerTag = null;
    }
  }
}

// ============================================================================
// Workflow Queue Manager
// ============================================================================

export class WorkflowQueueManager {
  private queue: MessageQueue;
  private workflowCallback?: ((workflowId: string, inputs: Record<string, unknown>) => Promise<any>) | undefined;

  constructor(queue: MessageQueue, workflowCallback?: ((workflowId: string, inputs: Record<string, unknown>) => Promise<any>) | undefined) {
    this.queue = queue;
    this.workflowCallback = workflowCallback;
  }

  async enqueueWorkflow(
    workflowId: string,
    inputs: Record<string, unknown> = {},
    priority: MessagePriority = MessagePriority.NORMAL,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const message: QueueMessage = {
      id: randomUUID(),
      workflowId,
      payload: inputs,
      priority,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      metadata,
    };
    return this.queue.publish(message);
  }

  async startWorker(numWorkers = 1): Promise<void> {
    if (!this.workflowCallback) {
      throw new Error("No workflow callback configured");
    }

    const handler: MessageHandler = async (message) => {
      if (this.workflowCallback) {
        await this.workflowCallback(message.workflowId, message.payload);
      }
    };

    await this.queue.consume(handler, undefined, numWorkers);
  }

  async stopWorker(): Promise<void> {
    await this.queue.stop();
  }
}