import { describe, it, expect } from "vitest";
import { parseContent } from "../src/parser.js";
import fs from "fs";
import path from "path";

const examplesDir = path.resolve(__dirname, "../../../examples/event-driven");

describe("event-driven example workflows", () => {
  const files = fs.readdirSync(examplesDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    it(`parses ${file} without errors`, () => {
      const content = fs.readFileSync(path.join(examplesDir, file), "utf8");
      const result = parseContent(content);
      const wf = result.workflow;

      expect(wf.metadata.name).toBeTruthy();
      expect(wf.steps.length).toBeGreaterThan(0);

      // All event-driven examples should have mode: daemon
      expect(wf.mode).toBe("daemon");

      // All should have sources defined
      expect(wf.sources).toBeDefined();
      expect(wf.sources!.length).toBeGreaterThan(0);

      // Each source should have kind and id
      for (const source of wf.sources!) {
        expect(source.kind).toBeTruthy();
        expect(source.id).toBeTruthy();
      }

      // Log for visibility
      console.log(
        `  ${file}: ${wf.steps.length} steps, mode=${wf.mode}, sources=${wf.sources!.length} (${wf.sources!.map((s) => s.kind).join(", ")})`,
      );
    });
  }

  it("discord-bot.md has event.connect and event.wait steps", () => {
    const content = fs.readFileSync(path.join(examplesDir, "discord-bot.md"), "utf8");
    const { workflow } = parseContent(content);
    const actions = workflow.steps.map((s: any) => s.action).filter(Boolean);
    expect(actions).toContain("event.connect");
    expect(actions).toContain("event.wait");
  });

  it("websocket-monitor.md connects to a WebSocket", () => {
    const content = fs.readFileSync(path.join(examplesDir, "websocket-monitor.md"), "utf8");
    const { workflow } = parseContent(content);
    expect(workflow.sources![0].kind).toBe("websocket");
    const actions = workflow.steps.map((s: any) => s.action).filter(Boolean);
    expect(actions).toContain("event.connect");
    expect(actions).toContain("event.wait");
  });

  it("cron-healthcheck.md uses cron source", () => {
    const content = fs.readFileSync(path.join(examplesDir, "cron-healthcheck.md"), "utf8");
    const { workflow } = parseContent(content);
    expect(workflow.sources![0].kind).toBe("cron");
  });
});
