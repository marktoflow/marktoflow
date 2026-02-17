/**
 * Event sources for event-driven workflows.
 *
 * Provides persistent connections to external services (Discord, Slack, WebSocket, etc.)
 * that emit events to trigger workflow steps or restart workflows.
 *
 * Event sources:
 * - websocket: Connect to any WebSocket endpoint
 * - discord: Listen for Discord events via bot gateway
 * - slack: Listen for Slack events via Socket Mode
 * - cron: Emit events on a schedule (wraps the existing scheduler)
 * - http-stream: SSE (Server-Sent Events) listener
 * - rss: Poll RSS/Atom feeds for new items
 */

import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { CronExpressionParser } from "cron-parser";
import { parseDuration } from "./utils/duration.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventSourceEvent {
  /** Source identifier (e.g., "discord", "slack", "websocket") */
  source: string;
  /** Event type (e.g., "message", "reaction", "connected", "disconnected") */
  type: string;
  /** Event payload (source-specific) */
  data: Record<string, unknown>;
  /** ISO timestamp */
  timestamp: string;
  /** Raw event data (for debugging) */
  raw?: unknown;
}

export interface EventSourceConfig {
  /** Source type */
  kind: "websocket" | "discord" | "slack" | "cron" | "http-stream" | "rss";
  /** Unique id for this source */
  id: string;
  /** Source-specific configuration */
  options: Record<string, unknown>;
  /** Optional filter: only emit events matching these types */
  filter?: string[];
  /** Reconnect on disconnect (default: true) */
  reconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Max reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
}

export type EventSourceStatus = "disconnected" | "connecting" | "connected" | "error" | "stopped";

export interface EventSourceStats {
  id: string;
  kind: string;
  status: EventSourceStatus;
  eventsReceived: number;
  lastEventAt?: string | undefined;
  connectedAt?: string | undefined;
  reconnectAttempts: number;
}

// ── Abstract Base ────────────────────────────────────────────────────────────

export abstract class BaseEventSource extends EventEmitter {
  readonly id: string;
  readonly kind: string;
  protected config: EventSourceConfig;
  protected _status: EventSourceStatus = "disconnected";
  protected _eventsReceived = 0;
  protected _lastEventAt: string | undefined;
  protected _connectedAt: string | undefined;
  protected _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(config: EventSourceConfig) {
    super();
    this.id = config.id;
    this.kind = config.kind;
    this.config = config;
  }

  get status(): EventSourceStatus {
    return this._status;
  }

  get stats(): EventSourceStats {
    return {
      id: this.id,
      kind: this.kind,
      status: this._status,
      eventsReceived: this._eventsReceived,
      lastEventAt: this._lastEventAt,
      connectedAt: this._connectedAt,
      reconnectAttempts: this._reconnectAttempts,
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  /** Emit an event through the source */
  protected emitEvent(type: string, data: Record<string, unknown>, raw?: unknown): void {
    if (this.config.filter && !this.config.filter.includes(type)) {
      return; // filtered out
    }
    this._eventsReceived++;
    this._lastEventAt = new Date().toISOString();
    const event: EventSourceEvent = {
      source: this.id,
      type,
      data,
      timestamp: this._lastEventAt,
      raw,
    };
    this.emit("event", event);
  }

  /** Handle disconnection with optional reconnect */
  protected handleDisconnect(reason?: string): void {
    // Don't reconnect if explicitly stopped
    if (this._status === "stopped") {
      return;
    }

    this._status = "disconnected";
    this._connectedAt = undefined;
    this.emit("disconnected", { source: this.id, reason });

    if (this.config.reconnect !== false) {
      const maxAttempts = this.config.maxReconnectAttempts ?? Infinity;
      if (this._reconnectAttempts < maxAttempts) {
        const delay = this.config.reconnectDelay ?? 5000;
        this._reconnectTimer = setTimeout(() => {
          // Re-check status in case stop() was called during the delay
          if (this._status === "stopped") return;
          this._reconnectAttempts++;
          this.connect().catch((err) => {
            this.emit("error", err);
          });
        }, delay);
      }
    }
  }

  /** Stop the source (no reconnect) */
  async stop(): Promise<void> {
    this._status = "stopped";
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
    await this.disconnect();
  }
}

// ── WebSocket Source ──────────────────────────────────────────────────────────

export class WebSocketEventSource extends BaseEventSource {
  private ws: WebSocket | undefined;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "websocket" });
  }

  async connect(): Promise<void> {
    const url = this.config.options.url as string;
    if (!url) throw new Error("WebSocket event source requires 'url' option");

    this._status = "connecting";
    this.emit("connecting", { source: this.id });

    return new Promise((resolve, reject) => {
      const headers = (this.config.options.headers as Record<string, string>) ?? {};
      this.ws = new WebSocket(url, { headers });

      this.ws.on("open", () => {
        this._status = "connected";
        this._connectedAt = new Date().toISOString();
        this._reconnectAttempts = 0;
        this.emit("connected", { source: this.id });
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        const raw = data.toString();
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = { message: raw };
        }
        const type = (parsed.type as string) ?? (parsed.event as string) ?? "message";
        this.emitEvent(type, parsed, raw);
      });

      this.ws.on("close", (code, reason) => {
        this.handleDisconnect(`code=${code} reason=${reason.toString()}`);
      });

      this.ws.on("error", (err) => {
        if (this._status === "connecting") {
          reject(err);
        }
        this._status = "error";
        this.emit("error", err);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = undefined;
    }
  }

  /** Send a message through the WebSocket */
  send(data: string | Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket source '${this.id}' is not connected`);
    }
    const payload = typeof data === "string" ? data : JSON.stringify(data);
    this.ws.send(payload);
  }
}

// ── Discord Source ───────────────────────────────────────────────────────────

/**
 * Discord event source via the Discord Gateway (WebSocket).
 * Uses the Discord Bot Gateway API directly — no external library needed.
 *
 * Required options:
 * - token: Discord bot token
 * - intents: Gateway intents bitmask (e.g., 513 for GUILDS + GUILD_MESSAGES)
 *
 * Optional:
 * - filter: Array of event types to listen for (e.g., ["MESSAGE_CREATE"])
 */
export class DiscordEventSource extends BaseEventSource {
  private ws: WebSocket | undefined;
  private heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  private lastSequence: number | null = null;
  private sessionId: string | undefined;
  private resumeGatewayUrl: string | undefined;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "discord" });
  }

  async connect(): Promise<void> {
    const token = this.config.options.token as string;
    if (!token) throw new Error("Discord event source requires 'token' option");

    const intents = (this.config.options.intents as number) ?? 513; // GUILDS + GUILD_MESSAGES
    const gatewayUrl = this.resumeGatewayUrl ?? "wss://gateway.discord.gg/?v=10&encoding=json";

    this._status = "connecting";
    this.emit("connecting", { source: this.id });

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(gatewayUrl);

      this.ws.on("open", () => {
        // Wait for HELLO before identifying
      });

      this.ws.on("message", (raw: WebSocket.Data) => {
        const payload = JSON.parse(raw.toString());
        const { op, d, s, t } = payload;

        if (s !== null) this.lastSequence = s;

        switch (op) {
          case 10: // HELLO
            this.startHeartbeat(d.heartbeat_interval);
            if (this.sessionId && this.resumeGatewayUrl) {
              // Resume
              this.ws!.send(JSON.stringify({
                op: 6,
                d: { token, session_id: this.sessionId, seq: this.lastSequence },
              }));
            } else {
              // Identify
              this.ws!.send(JSON.stringify({
                op: 2,
                d: {
                  token,
                  intents,
                  properties: { os: "linux", browser: "marktoflow", device: "marktoflow" },
                },
              }));
            }
            break;

          case 11: // HEARTBEAT_ACK
            break;

          case 0: // DISPATCH
            if (t === "READY") {
              this.sessionId = d.session_id;
              this.resumeGatewayUrl = d.resume_gateway_url;
              this._status = "connected";
              this._connectedAt = new Date().toISOString();
              this._reconnectAttempts = 0;
              this.emit("connected", { source: this.id, user: d.user });
              resolve();
            }
            // Emit all dispatch events
            this.emitEvent(t, d, payload);
            break;

          case 7: // RECONNECT
            this.ws!.close();
            this.handleDisconnect("server requested reconnect");
            break;

          case 9: // INVALID SESSION
            this.sessionId = undefined;
            this.resumeGatewayUrl = undefined;
            this.ws!.close();
            this.handleDisconnect("invalid session");
            break;
        }
      });

      this.ws.on("close", (code) => {
        this.stopHeartbeat();
        if (this._status === "connecting") {
          reject(new Error(`Discord gateway closed during connect: ${code}`));
        } else {
          this.handleDisconnect(`code=${code}`);
        }
      });

      this.ws.on("error", (err) => {
        if (this._status === "connecting") {
          reject(err);
        }
        this.emit("error", err);
      });
    });
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "disconnect");
      }
      this.ws = undefined;
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    // Send first heartbeat immediately
    this.ws?.send(JSON.stringify({ op: 1, d: this.lastSequence }));
    this.heartbeatInterval = setInterval(() => {
      this.ws?.send(JSON.stringify({ op: 1, d: this.lastSequence }));
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
}

// ── Slack Socket Mode Source ─────────────────────────────────────────────────

/**
 * Slack event source via Socket Mode (WebSocket).
 *
 * Required options:
 * - appToken: Slack app-level token (xapp-...)
 *
 * Optional:
 * - filter: Array of event types (e.g., ["message", "reaction_added"])
 */
export class SlackEventSource extends BaseEventSource {
  private ws: WebSocket | undefined;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "slack" });
  }

  async connect(): Promise<void> {
    const appToken = this.config.options.appToken as string;
    if (!appToken) throw new Error("Slack event source requires 'appToken' option");

    this._status = "connecting";
    this.emit("connecting", { source: this.id });

    // Get WebSocket URL from Slack
    const res = await fetch("https://slack.com/api/apps.connections.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const body = await res.json() as { ok: boolean; url?: string; error?: string };
    if (!body.ok || !body.url) {
      throw new Error(`Slack connections.open failed: ${body.error ?? "unknown"}`);
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(body.url!);

      this.ws.on("open", () => {
        this._status = "connected";
        this._connectedAt = new Date().toISOString();
        this._reconnectAttempts = 0;
        this.emit("connected", { source: this.id });
        resolve();
      });

      this.ws.on("message", (raw: WebSocket.Data) => {
        const payload = JSON.parse(raw.toString());

        // Acknowledge envelope
        if (payload.envelope_id) {
          this.ws!.send(JSON.stringify({ envelope_id: payload.envelope_id }));
        }

        if (payload.type === "events_api") {
          const event = payload.payload?.event;
          if (event) {
            this.emitEvent(event.type, event, payload);
          }
        } else if (payload.type === "interactive") {
          this.emitEvent("interactive", payload.payload ?? {}, payload);
        } else if (payload.type === "slash_commands") {
          this.emitEvent("slash_command", payload.payload ?? {}, payload);
        } else if (payload.type === "disconnect") {
          this.handleDisconnect("slack requested disconnect");
        }
      });

      this.ws.on("close", () => {
        if (this._status === "connecting") {
          reject(new Error("Slack WebSocket closed during connect"));
        } else {
          this.handleDisconnect("connection closed");
        }
      });

      this.ws.on("error", (err) => {
        if (this._status === "connecting") reject(err);
        this.emit("error", err);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = undefined;
    }
  }
}

// ── Cron Event Source ────────────────────────────────────────────────────────

/**
 * Cron event source — emits events on a schedule.
 *
 * Options:
 * - schedule: Duration string (e.g., "30m", "1h", "5s") for fixed-interval,
 *             or cron expression (e.g., "0 * * * *") for cron-based scheduling
 * - payload: Optional static payload to include with each event
 * - immediate: Emit first event immediately on connect (default: false)
 */
export class CronEventSource extends BaseEventSource {
  private timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | undefined;
  private intervalMs: number | null;
  private cronExpression: string | null;
  private stopped = false;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "cron" });
    const schedule = config.options.schedule as string;
    if (!schedule) throw new Error("Cron event source requires 'schedule' option");

    // Detect if schedule is a cron expression (5 space-separated fields) or duration
    const isCron = /^[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+\s+[\d*,/-]+$/.test(schedule.trim());
    if (isCron) {
      this.cronExpression = schedule;
      this.intervalMs = null;
    } else {
      this.cronExpression = null;
      this.intervalMs = parseDuration(schedule);
    }
  }

  async connect(): Promise<void> {
    this._status = "connected";
    this._connectedAt = new Date().toISOString();
    this.stopped = false;
    this.emit("connected", { source: this.id });

    // Emit first event immediately if configured
    if (this.config.options.immediate) {
      this.tick();
    }

    if (this.intervalMs !== null) {
      // Fixed interval mode
      this.timer = setInterval(() => this.tick(), this.intervalMs);
    } else if (this.cronExpression) {
      // Cron expression mode: schedule next tick
      this.scheduleNextCronTick();
    }
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNextCronTick(): void {
    if (this.stopped || !this.cronExpression) return;

    try {
      const expr = CronExpressionParser.parse(this.cronExpression, {
        currentDate: new Date(),
      });
      const nextDate = expr.next().toDate();
      const delayMs = nextDate.getTime() - Date.now();

      this.timer = setTimeout(() => {
        if (this.stopped) return;
        this.tick();
        this.scheduleNextCronTick();
      }, Math.max(0, delayMs));
    } catch (err) {
      this.emit("error", new Error(`Invalid cron expression "${this.cronExpression}": ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  private tick(): void {
    const payload = (this.config.options.payload as Record<string, unknown>) ?? {};
    this.emitEvent("tick", { ...payload, scheduledAt: new Date().toISOString() });
  }
}

// ── SSE (Server-Sent Events) Source ──────────────────────────────────────────

/**
 * HTTP Server-Sent Events listener.
 *
 * Options:
 * - url: SSE endpoint URL
 * - headers: Optional headers
 */
export class SSEEventSource extends BaseEventSource {
  private controller: AbortController | undefined;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "http-stream" });
  }

  async connect(): Promise<void> {
    const url = this.config.options.url as string;
    if (!url) throw new Error("SSE event source requires 'url' option");

    this._status = "connecting";
    this.controller = new AbortController();
    const headers = (this.config.options.headers as Record<string, string>) ?? {};

    const res = await fetch(url, {
      headers: { Accept: "text/event-stream", ...headers },
      signal: this.controller.signal,
    });

    if (!res.ok) {
      throw new Error(`SSE connect failed: ${res.status} ${res.statusText}`);
    }

    this._status = "connected";
    this._connectedAt = new Date().toISOString();
    this._reconnectAttempts = 0;
    this.emit("connected", { source: this.id });

    // Parse SSE stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error("SSE response has no body");

    const decoder = new TextDecoder();
    let buffer = "";
    // Track event fields across buffer boundaries
    let eventType = "message";
    let eventData = "";

    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              eventData += (eventData ? "\n" : "") + line.slice(5).trim();
            } else if (line.startsWith(":")) {
              // SSE comment line — ignore (used for keep-alive)
            } else if (line === "" || line === "\r") {
              // Empty line = end of event dispatch
              if (eventData) {
                let parsed: Record<string, unknown>;
                try {
                  parsed = JSON.parse(eventData);
                } catch {
                  parsed = { data: eventData };
                }
                this.emitEvent(eventType, parsed, eventData);
              }
              // Reset for next event
              eventType = "message";
              eventData = "";
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          this.emit("error", err);
        }
      }
      this.handleDisconnect("stream ended");
    };

    // Start reading in background — connect() resolves once the HTTP
    // connection is established (status 200), stream processing continues
    // asynchronously.
    void readLoop();
  }

  async disconnect(): Promise<void> {
    this.controller?.abort();
    this.controller = undefined;
  }
}

// ── RSS Event Source ─────────────────────────────────────────────────────────

/**
 * RSS/Atom feed event source — polls a feed and emits events for new items.
 *
 * Options:
 * - url: Feed URL (required)
 * - interval: Polling interval as duration string (default: "5m")
 * - immediate: Poll immediately on connect (default: false)
 * - headers: Custom HTTP headers for feed requests
 * - maxItems: Max new items to emit per poll (default: unlimited)
 */
export class RssEventSource extends BaseEventSource {
  private timer: ReturnType<typeof setInterval> | undefined;
  private intervalMs: number;
  private seenIds: Set<string> = new Set();
  private firstPoll = true;
  private static readonly MAX_SEEN_IDS = 10_000;

  constructor(config: EventSourceConfig) {
    super({ ...config, kind: "rss" });
    const interval = (config.options.interval as string) ?? "5m";
    this.intervalMs = parseDuration(interval);
  }

  async connect(): Promise<void> {
    const url = this.config.options.url as string;
    if (!url) throw new Error("RSS event source requires 'url' option");

    this._status = "connected";
    this._connectedAt = new Date().toISOString();
    this.emit("connected", { source: this.id });

    if (this.config.options.immediate) {
      await this.poll();
    }

    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        this.emit("error", err);
      });
    }, this.intervalMs);
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async poll(): Promise<void> {
    const url = this.config.options.url as string;
    const headers = (this.config.options.headers as Record<string, string>) ?? {};
    const maxItems = this.config.options.maxItems as number | undefined;

    let xml: string;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", ...headers },
      });
      if (!res.ok) {
        throw new Error(`RSS fetch failed: ${res.status} ${res.statusText}`);
      }
      xml = await res.text();
    } catch (err) {
      this.emit("error", err);
      return;
    }

    const items = parseRssItems(xml);
    const newItems: RssItem[] = [];

    for (const item of items) {
      const id = item.guid || item.link || item.title;
      if (!id) continue;
      if (!this.seenIds.has(id)) {
        this.seenIds.add(id);
        if (!this.firstPoll) {
          newItems.push(item);
        }
      }
    }

    this.firstPoll = false;

    // Evict oldest entries if seenIds grows too large
    if (this.seenIds.size > RssEventSource.MAX_SEEN_IDS) {
      const entries = Array.from(this.seenIds);
      const toRemove = entries.length - RssEventSource.MAX_SEEN_IDS;
      for (let i = 0; i < toRemove; i++) {
        this.seenIds.delete(entries[i]);
      }
    }

    const toEmit = maxItems ? newItems.slice(0, maxItems) : newItems;
    for (const item of toEmit) {
      this.emitEvent("new_item", {
        title: item.title,
        link: item.link,
        description: item.description,
        pubDate: item.pubDate,
        guid: item.guid,
        author: item.author,
        categories: item.categories,
        feedUrl: url,
      });
    }
  }
}

// ── RSS XML Parsing Helpers ──────────────────────────────────────────────────

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author: string;
  categories: string[];
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function extractAtomLink(xml: string): string {
  const m = xml.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/i);
  return m ? m[1] : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, "gi");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const val = (m[1] ?? m[2] ?? "").trim();
    if (val) results.push(val);
  }
  return results;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Detect RSS 2.0 vs Atom
  const isAtom = /<feed[\s>]/i.test(xml);

  if (isAtom) {
    // Atom: split on <entry>
    const entries = xml.split(/<entry[\s>]/i).slice(1);
    for (const entry of entries) {
      const block = entry.split(/<\/entry>/i)[0];
      items.push({
        title: extractTag(block, "title"),
        link: extractAtomLink(block) || extractTag(block, "link"),
        description: extractTag(block, "summary") || extractTag(block, "content"),
        pubDate: extractTag(block, "updated") || extractTag(block, "published"),
        guid: extractTag(block, "id"),
        author: extractTag(block, "name") || extractTag(block, "author"),
        categories: extractAllTags(block, "category"),
      });
    }
  } else {
    // RSS 2.0: split on <item>
    const rawItems = xml.split(/<item[\s>]/i).slice(1);
    for (const raw of rawItems) {
      const block = raw.split(/<\/item>/i)[0];
      items.push({
        title: extractTag(block, "title"),
        link: extractTag(block, "link"),
        description: extractTag(block, "description"),
        pubDate: extractTag(block, "pubDate"),
        guid: extractTag(block, "guid"),
        author: extractTag(block, "author") || extractTag(block, "dc:creator"),
        categories: extractAllTags(block, "category"),
      });
    }
  }

  return items;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createEventSource(config: EventSourceConfig): BaseEventSource {
  switch (config.kind) {
    case "websocket":
      return new WebSocketEventSource(config);
    case "discord":
      return new DiscordEventSource(config);
    case "slack":
      return new SlackEventSource(config);
    case "cron":
      return new CronEventSource(config);
    case "http-stream":
      return new SSEEventSource(config);
    case "rss":
      return new RssEventSource(config);
    default:
      throw new Error(`Unknown event source kind: ${config.kind}`);
  }
}

// ── Event Source Manager ─────────────────────────────────────────────────────

/**
 * Manages multiple event sources and provides a unified event stream.
 */
export class EventSourceManager extends EventEmitter {
  private sources: Map<string, BaseEventSource> = new Map();

  /** Add and connect an event source */
  async add(config: EventSourceConfig): Promise<BaseEventSource> {
    if (this.sources.has(config.id)) {
      throw new Error(`Event source '${config.id}' already exists`);
    }
    const source = createEventSource(config);

    // Forward events
    source.on("event", (event: EventSourceEvent) => {
      this.emit("event", event);
    });
    source.on("connected", (info) => this.emit("source:connected", info));
    source.on("disconnected", (info) => this.emit("source:disconnected", info));
    source.on("error", (err) => this.emit("source:error", { source: config.id, error: err }));

    this.sources.set(config.id, source);
    await source.connect();
    return source;
  }

  /** Remove and disconnect an event source */
  async remove(id: string): Promise<void> {
    const source = this.sources.get(id);
    if (source) {
      await source.stop();
      source.removeAllListeners();
      this.sources.delete(id);
    }
  }

  /** Get a source by id */
  get(id: string): BaseEventSource | undefined {
    return this.sources.get(id);
  }

  /** Get stats for all sources */
  stats(): EventSourceStats[] {
    return Array.from(this.sources.values()).map((s) => s.stats);
  }

  /** Wait for the next event from any source, with optional filter */
  waitForEvent(options?: {
    source?: string;
    type?: string;
    timeout?: number;
    filter?: (event: EventSourceEvent) => boolean;
  }): Promise<EventSourceEvent> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const handler = (event: EventSourceEvent) => {
        if (options?.source && event.source !== options.source) return;
        if (options?.type && event.type !== options.type) return;
        if (options?.filter && !options.filter(event)) return;

        if (timer) clearTimeout(timer);
        this.removeListener("event", handler);
        resolve(event);
      };

      this.on("event", handler);

      if (options?.timeout) {
        timer = setTimeout(() => {
          this.removeListener("event", handler);
          reject(new Error(`Timed out waiting for event after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  }

  /** Stop all sources */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.sources.values()).map((s) => s.stop());
    await Promise.all(promises);
    this.sources.clear();
  }
}

// parseDuration imported from ./utils/duration.js (single source of truth)
