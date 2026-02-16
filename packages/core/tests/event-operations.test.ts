import { describe, it, expect, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import {
  executeEventConnect,
  executeEventWait,
  executeEventDisconnect,
  executeEventStatus,
  executeEventSend,
  isEventOperation,
  resetEventSourceManager,
} from "../src/event-operations.js";

afterEach(async () => {
  await resetEventSourceManager();
});

describe("isEventOperation", () => {
  it("recognizes event operations", () => {
    expect(isEventOperation("event.connect")).toBe(true);
    expect(isEventOperation("event.wait")).toBe(true);
    expect(isEventOperation("event.disconnect")).toBe(true);
    expect(isEventOperation("event.send")).toBe(true);
    expect(isEventOperation("event.status")).toBe(true);
  });

  it("rejects non-event operations", () => {
    expect(isEventOperation("core.set")).toBe(false);
    expect(isEventOperation("file.read")).toBe(false);
  });
});

describe("event.connect + event.status", () => {
  it("connects a cron source and reports status", async () => {
    const result = await executeEventConnect({
      kind: "cron",
      id: "test-cron",
      options: { schedule: "1h" },
    });

    expect(result.id).toBe("test-cron");
    expect(result.status).toBe("connected");

    const status = await executeEventStatus();
    const sources = status.sources as any[];
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe("test-cron");
    expect(sources[0].status).toBe("connected");
  });
});

describe("event.wait", () => {
  it("waits for cron tick event", async () => {
    await executeEventConnect({
      kind: "cron",
      id: "fast-cron",
      options: { schedule: "50ms", immediate: true },
    });

    const event = await executeEventWait({ timeout: 2000 });
    expect(event.source).toBe("fast-cron");
    expect(event.type).toBe("tick");
  });
});

describe("event.disconnect", () => {
  it("disconnects a source", async () => {
    await executeEventConnect({
      kind: "cron",
      id: "remove-me",
      options: { schedule: "1h" },
    });

    const result = await executeEventDisconnect({ id: "remove-me" });
    expect(result.disconnected).toBe("remove-me");

    const status = await executeEventStatus();
    expect((status.sources as any[]).length).toBe(0);
  });
});

describe("event.connect with WebSocket", () => {
  let server: WebSocketServer;
  let port: number;

  afterEach(() => {
    server?.close();
  });

  it("connects to WebSocket and waits for event", async () => {
    server = new WebSocketServer({ port: 0 });
    port = (server.address() as { port: number }).port;

    await executeEventConnect({
      kind: "websocket",
      id: "ws-test",
      options: { url: `ws://localhost:${port}` },
    });

    // Server sends event after short delay
    setTimeout(() => {
      server.clients.forEach((client) => {
        client.send(JSON.stringify({ type: "update", value: 42 }));
      });
    }, 50);

    const event = await executeEventWait({ source: "ws-test", timeout: 2000 });
    expect(event.type).toBe("update");
    expect(event.data.value).toBe(42);
  });
});
