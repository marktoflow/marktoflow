import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  EventSourceManager,
  WebSocketEventSource,
  CronEventSource,
  createEventSource,
  type EventSourceEvent,
  type EventSourceConfig,
} from "../src/event-source.js";

describe("EventSourceManager", () => {
  let manager: EventSourceManager;

  beforeEach(() => {
    manager = new EventSourceManager();
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  it("starts empty with no sources", () => {
    expect(manager.stats()).toEqual([]);
  });

  it("rejects duplicate source ids", async () => {
    // Use cron source (doesn't need a real connection)
    await manager.add({ kind: "cron", id: "test", options: { schedule: "1h" } });
    await expect(
      manager.add({ kind: "cron", id: "test", options: { schedule: "1h" } }),
    ).rejects.toThrow("already exists");
  });

  it("removes a source", async () => {
    await manager.add({ kind: "cron", id: "test", options: { schedule: "1h" } });
    expect(manager.stats()).toHaveLength(1);
    await manager.remove("test");
    expect(manager.stats()).toHaveLength(0);
  });

  it("stops all sources", async () => {
    await manager.add({ kind: "cron", id: "a", options: { schedule: "1h" } });
    await manager.add({ kind: "cron", id: "b", options: { schedule: "2h" } });
    expect(manager.stats()).toHaveLength(2);
    await manager.stopAll();
    expect(manager.stats()).toHaveLength(0);
  });
});

describe("CronEventSource", () => {
  it("emits tick events on schedule", async () => {
    const source = new CronEventSource({
      kind: "cron",
      id: "test-cron",
      options: { schedule: "100ms", immediate: true },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    expect(source.status).toBe("connected");

    // Wait for at least 2 ticks
    await new Promise((r) => setTimeout(r, 250));
    await source.stop();

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].type).toBe("tick");
    expect(events[0].source).toBe("test-cron");
    expect(events[0].data.scheduledAt).toBeDefined();
  });

  it("respects filter", async () => {
    const source = new CronEventSource({
      kind: "cron",
      id: "filtered",
      options: { schedule: "100ms", immediate: true },
      filter: ["not-tick"], // won't match "tick"
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    await new Promise((r) => setTimeout(r, 250));
    await source.stop();

    expect(events).toHaveLength(0);
  });
});

describe("WebSocketEventSource", () => {
  let server: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    server = new WebSocketServer({ port: 0 });
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    server.close();
  });

  it("connects to a WebSocket server and receives messages", async () => {
    const source = new WebSocketEventSource({
      kind: "websocket",
      id: "test-ws",
      options: { url: `ws://localhost:${port}` },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    expect(source.status).toBe("connected");

    // Server sends a message
    server.clients.forEach((client) => {
      client.send(JSON.stringify({ type: "greeting", text: "hello" }));
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("greeting");
    expect(events[0].data.text).toBe("hello");

    await source.stop();
  });

  it("can send messages through the WebSocket", async () => {
    const received: string[] = [];
    server.on("connection", (ws) => {
      ws.on("message", (data) => received.push(data.toString()));
    });

    const source = new WebSocketEventSource({
      kind: "websocket",
      id: "send-test",
      options: { url: `ws://localhost:${port}` },
    });

    await source.connect();
    source.send({ action: "ping" });
    await new Promise((r) => setTimeout(r, 100));

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0])).toEqual({ action: "ping" });

    await source.stop();
  });

  it("handles non-JSON messages", async () => {
    const source = new WebSocketEventSource({
      kind: "websocket",
      id: "text-ws",
      options: { url: `ws://localhost:${port}` },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();

    server.clients.forEach((client) => {
      client.send("plain text message");
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("message");
    expect(events[0].data.message).toBe("plain text message");

    await source.stop();
  });
});

describe("createEventSource factory", () => {
  it("creates websocket source", () => {
    const source = createEventSource({ kind: "websocket", id: "ws", options: { url: "ws://localhost" } });
    expect(source).toBeInstanceOf(WebSocketEventSource);
  });

  it("creates cron source", () => {
    const source = createEventSource({ kind: "cron", id: "cron", options: { schedule: "1h" } });
    expect(source).toBeInstanceOf(CronEventSource);
  });

  it("throws on unknown kind", () => {
    expect(() =>
      createEventSource({ kind: "unknown" as any, id: "x", options: {} }),
    ).toThrow("Unknown event source kind");
  });
});

describe("EventSourceManager.waitForEvent", () => {
  let manager: EventSourceManager;

  beforeEach(() => {
    manager = new EventSourceManager();
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  it("resolves when a matching event arrives", async () => {
    await manager.add({ kind: "cron", id: "waiter", options: { schedule: "100ms", immediate: true } });

    const event = await manager.waitForEvent({ timeout: 2000 });
    expect(event.source).toBe("waiter");
    expect(event.type).toBe("tick");
  });

  it("filters by source", async () => {
    await manager.add({ kind: "cron", id: "a", options: { schedule: "50ms", immediate: true } });
    await manager.add({ kind: "cron", id: "b", options: { schedule: "150ms" } });

    const event = await manager.waitForEvent({ source: "b", timeout: 2000 });
    expect(event.source).toBe("b");
  });

  it("times out when no event arrives", async () => {
    await manager.add({ kind: "cron", id: "slow", options: { schedule: "10s" } });

    await expect(
      manager.waitForEvent({ timeout: 100 }),
    ).rejects.toThrow("Timed out");
  });
});
