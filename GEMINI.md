# GEMINI.md - Automation Framework Port Status

This file tracks the progress and state of the TypeScript v2.0 port for the Gemini CLI agent.

---

## Current Status: Porting Phase

**Last Updated:** 2026-01-23

### Core Progress
- [x] Monorepo setup (pnpm + turbo)
- [x] Core package foundation (Parser, Engine, Models, State, Logging, Scheduler, Webhook)
- [x] 56 passing tests in `packages/core`
- [x] CLI package (init, run, workflow, connect, doctor, version)
- [x] Integrations package initialization

### Parity Progress (Python v1.0 -> TS v2.0)
- [x] Slack Integration (@slack/web-api)
- [x] GitHub Integration (@octokit/rest)
- [x] Jira Integration (jira.js)
- [x] Ollama Integration (ollama)
- [x] Claude Code CLI Integration (Subprocess wrapper)
- [x] OpenCode CLI/Server Integration (Manual fetch + @opencode-ai/sdk)
- [x] Script Tool (Executable script runner)
- [x] File Watcher Trigger
- [ ] Queue Integration (Redis/RabbitMQ)

---

## Next Steps

1.  **OpenCode SDK Integration**: Refactor `opencode.ts` to use `@opencode-ai/sdk` for server communication.
2.  **Script Tool Implementation**: Port `ScriptTool` from Python to `packages/core` or `packages/integrations`.
3.  **File Watcher Trigger**: Port `filewatcher.py` to TypeScript (likely using `chokidar`).
4.  **Feature Parity Audit**: Review Python modules for missing small features.
5.  **Documentation**: Update README and examples for v2.0 usage.

---

## Technical Notes

- **SDK Registry**: Dynamically loads integrations. Supports both traditional SDKs and Native MCP modules.
- **Native MCP**: Supports in-memory communication with MCP servers exported as NPM packages.
- **CLI Mode**: Agents like Claude Code and OpenCode still support CLI fallback via subprocesses for ease of local development.

---

## References
- `AGENTS.md` - Agent development guidelines
- `TODO.md` - Detailed roadmap
- `PROGRESS.md` - Overall project history
