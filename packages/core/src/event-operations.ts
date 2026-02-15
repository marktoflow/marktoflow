/**
 * Event-driven workflow operations.
 *
 * Built-in operations for connecting to event sources, waiting for events,
 * and running daemon/long-lived workflows.
 *
 * Operations:
 * - event.connect: Connect to an event source (WebSocket, Discord, Slack, etc.)
 * - event.wait: Wait for the next matching event from connected sources
 * - event.disconnect: Disconnect an event source
 * - event.send: Send a message through a connected event source
 * - event.status: Get status of connected event sources
 */

import {
  EventSourceManager,
  type EventSourceConfig,
  type EventSourceEvent,
} from "./event-source.js";

// Singleton manager — shared across all steps in a workflow run
let _manager: EventSourceManager | undefined;

export function getEventSourceManager(): EventSourceManager {
  if (!_manager) {
    _manager = new EventSourceManager();
  }
  return _manager;
}

/** Reset the manager (for testing or workflow cleanup) */
export async function resetEventSourceManager(): Promise<void> {
  if (_manager) {
    await _manager.stopAll();
    _manager.removeAllListeners();
    _manager = undefined;
  }
}

// ── Operations ───────────────────────────────────────────────────────────────

export interface EventConnectInputs {
  /** Event source kind */
  kind: "websocket" | "discord" | "slack" | "cron" | "http-stream";
  /** Unique id for this connection */
  id: string;
  /** Source-specific options (url, token, etc.) */
  options?: Record<string, unknown>;
  /** Only emit events matching these types */
  filter?: string[];
  /** Auto-reconnect (default: true) */
  reconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
}

export async function executeEventConnect(inputs: EventConnectInputs): Promise<Record<string, unknown>> {
  const manager = getEventSourceManager();
  const config: EventSourceConfig = {
    kind: inputs.kind,
    id: inputs.id,
    options: inputs.options ?? {},
    ...(inputs.filter ? { filter: inputs.filter } : {}),
    ...(inputs.reconnect !== undefined ? { reconnect: inputs.reconnect } : {}),
    ...(inputs.reconnectDelay !== undefined ? { reconnectDelay: inputs.reconnectDelay } : {}),
  };

  const source = await manager.add(config);
  return {
    id: source.id,
    kind: source.kind,
    status: source.status,
    connectedAt: source.stats.connectedAt,
  };
}

export interface EventWaitInputs {
  /** Source id to wait on (omit for any source) */
  source?: string;
  /** Event type to wait for (omit for any type) */
  type?: string;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Nunjucks expression to filter events (evaluated against event.data) */
  filter?: string;
}

export async function executeEventWait(inputs: EventWaitInputs): Promise<EventSourceEvent> {
  const manager = getEventSourceManager();

  const event = await manager.waitForEvent({
    ...(inputs.source ? { source: inputs.source } : {}),
    ...(inputs.type ? { type: inputs.type } : {}),
    ...(inputs.timeout ? { timeout: inputs.timeout } : {}),
  });

  return event;
}

export interface EventDisconnectInputs {
  /** Source id to disconnect */
  id: string;
}

export async function executeEventDisconnect(inputs: EventDisconnectInputs): Promise<Record<string, unknown>> {
  const manager = getEventSourceManager();
  await manager.remove(inputs.id);
  return { disconnected: inputs.id };
}

export interface EventSendInputs {
  /** Source id to send through */
  id: string;
  /** Data to send (string or object) */
  data: string | Record<string, unknown>;
}

export async function executeEventSend(inputs: EventSendInputs): Promise<Record<string, unknown>> {
  const manager = getEventSourceManager();
  const source = manager.get(inputs.id);
  if (!source) {
    throw new Error(`Event source '${inputs.id}' not found`);
  }
  if ("send" in source && typeof (source as any).send === "function") {
    (source as any).send(inputs.data);
    return { sent: true, source: inputs.id };
  }
  throw new Error(`Event source '${inputs.id}' does not support sending`);
}

export async function executeEventStatus(): Promise<Record<string, unknown>> {
  const manager = getEventSourceManager();
  return { sources: manager.stats() };
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function isEventOperation(action: string): boolean {
  return action.startsWith("event.");
}

export async function executeEventOperation(
  action: string,
  inputs: Record<string, unknown>,
): Promise<unknown> {
  switch (action) {
    case "event.connect":
      return executeEventConnect(inputs as unknown as EventConnectInputs);
    case "event.wait":
      return executeEventWait(inputs as unknown as EventWaitInputs);
    case "event.disconnect":
      return executeEventDisconnect(inputs as unknown as EventDisconnectInputs);
    case "event.send":
      return executeEventSend(inputs as unknown as EventSendInputs);
    case "event.status":
      return executeEventStatus();
    default:
      throw new Error(`Unknown event operation: ${action}`);
  }
}
