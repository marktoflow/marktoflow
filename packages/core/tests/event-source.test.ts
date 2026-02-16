import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import {
  EventSourceManager,
  WebSocketEventSource,
  CronEventSource,
  RssEventSource,
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
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("WebSocket server failed to bind a port");
    }
    port = address.port;
  });

  afterEach(async () => {
    server.clients.forEach((client) => client.terminate());
    await new Promise<void>((resolve) => server.close(() => resolve()));
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

  it("creates rss source", () => {
    const source = createEventSource({ kind: "rss", id: "rss", options: { url: "https://example.com/feed.xml" } });
    expect(source).toBeInstanceOf(RssEventSource);
  });

  it("throws on unknown kind", () => {
    expect(() =>
      createEventSource({ kind: "unknown" as any, id: "x", options: {} }),
    ).toThrow("Unknown event source kind");
  });
});

describe("RssEventSource", () => {
  const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Article 1</title>
      <link>https://example.com/1</link>
      <description>First article</description>
      <guid>guid-1</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article 2</title>
      <link>https://example.com/2</link>
      <description>Second article</description>
      <guid>guid-2</guid>
      <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

  const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry 1</title>
    <link href="https://example.com/atom/1" />
    <id>atom-1</id>
    <updated>2024-01-01T00:00:00Z</updated>
    <summary>First atom entry</summary>
    <author><name>Author One</name></author>
  </entry>
</feed>`;

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchResponse(body: string) {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(body),
    });
  }

  it("connects and reports status as connected", async () => {
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "test-rss",
      options: { url: "https://example.com/feed.xml", interval: "1h" },
    });

    await source.connect();
    expect(source.status).toBe("connected");
    await source.stop();
  });

  it("seeds seenIds on first poll without emitting events", async () => {
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "seed-test",
      options: { url: "https://example.com/feed.xml", interval: "1h", immediate: true },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    // Wait briefly for the immediate poll to complete
    await new Promise((r) => setTimeout(r, 50));
    await source.stop();

    expect(events).toHaveLength(0);
  });

  it("emits new_item events for new items on subsequent polls", async () => {
    // First poll: seed with 2 items
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "poll-test",
      options: { url: "https://example.com/feed.xml", interval: "100ms", immediate: true },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    await new Promise((r) => setTimeout(r, 50));

    // Second poll: add a new item
    const feedWithNew = RSS_FEED.replace("</channel>", `<item>
      <title>Article 3</title>
      <link>https://example.com/3</link>
      <description>Third article</description>
      <guid>guid-3</guid>
      <pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate>
    </item>
    </channel>`);
    mockFetchResponse(feedWithNew);

    await new Promise((r) => setTimeout(r, 150));
    await source.stop();

    expect(events.length).toBeGreaterThanOrEqual(1);
    const newItemEvent = events.find((e) => e.data.guid === "guid-3");
    expect(newItemEvent).toBeDefined();
    expect(newItemEvent!.type).toBe("new_item");
    expect(newItemEvent!.data.title).toBe("Article 3");
    expect(newItemEvent!.data.feedUrl).toBe("https://example.com/feed.xml");
  });

  it("respects filter option", async () => {
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "filter-test",
      options: { url: "https://example.com/feed.xml", interval: "1h", immediate: true },
      filter: ["not_new_item"], // won't match "new_item"
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();

    // Add new items for second poll
    const feedWithNew = RSS_FEED.replace("</channel>", `<item>
      <title>Filtered Item</title>
      <link>https://example.com/filtered</link>
      <guid>guid-filtered</guid>
    </item>
    </channel>`);
    mockFetchResponse(feedWithNew);

    // Trigger a manual poll by waiting
    await new Promise((r) => setTimeout(r, 50));
    await source.stop();

    // No events should pass through the filter
    expect(events).toHaveLength(0);
  });

  it("respects maxItems option", async () => {
    // First poll: seed
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "max-test",
      options: { url: "https://example.com/feed.xml", interval: "100ms", immediate: true, maxItems: 1 },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    await new Promise((r) => setTimeout(r, 50));

    // Second poll: add 3 new items
    const feedWithMany = RSS_FEED.replace("</channel>", `<item>
      <title>New A</title><link>https://example.com/a</link><guid>guid-a</guid>
    </item>
    <item>
      <title>New B</title><link>https://example.com/b</link><guid>guid-b</guid>
    </item>
    <item>
      <title>New C</title><link>https://example.com/c</link><guid>guid-c</guid>
    </item>
    </channel>`);
    mockFetchResponse(feedWithMany);

    await new Promise((r) => setTimeout(r, 150));
    await source.stop();

    // Only 1 item per poll due to maxItems
    expect(events.length).toBe(1);
  });

  it("handles fetch errors gracefully", async () => {
    // First poll succeeds
    mockFetchResponse(RSS_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "error-test",
      options: { url: "https://example.com/feed.xml", interval: "100ms", immediate: true },
    });

    const errors: unknown[] = [];
    source.on("error", (e: unknown) => errors.push(e));

    await source.connect();
    await new Promise((r) => setTimeout(r, 50));

    // Second poll fails
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });

    await new Promise((r) => setTimeout(r, 150));

    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(source.status).toBe("connected"); // Still connected despite error
    await source.stop();
  });

  it("parses Atom feeds correctly", async () => {
    // First poll: seed with atom feed
    mockFetchResponse(ATOM_FEED);
    const source = new RssEventSource({
      kind: "rss",
      id: "atom-test",
      options: { url: "https://example.com/atom.xml", interval: "100ms", immediate: true },
    });

    const events: EventSourceEvent[] = [];
    source.on("event", (e: EventSourceEvent) => events.push(e));

    await source.connect();
    await new Promise((r) => setTimeout(r, 50));

    // Second poll: add new atom entry
    const atomWithNew = ATOM_FEED.replace("</feed>", `<entry>
    <title>Atom Entry 2</title>
    <link href="https://example.com/atom/2" />
    <id>atom-2</id>
    <updated>2024-01-02T00:00:00Z</updated>
    <summary>Second atom entry</summary>
  </entry>
</feed>`);
    mockFetchResponse(atomWithNew);

    await new Promise((r) => setTimeout(r, 150));
    await source.stop();

    expect(events.length).toBeGreaterThanOrEqual(1);
    const atomEvent = events.find((e) => e.data.guid === "atom-2");
    expect(atomEvent).toBeDefined();
    expect(atomEvent!.data.title).toBe("Atom Entry 2");
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
