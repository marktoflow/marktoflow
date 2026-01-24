# CLAUDE.md - Claude Code Context

This file provides context for Claude Code when working on this project.

---

## Project Summary

**marktoflow** is a universal automation framework that enables markdown-based workflows with standardized tool integrations.

**Current Status:** Transitioning from Python v1.0 to TypeScript v2.0

---

## v2.0 TypeScript Rewrite (Current Focus)

We are rewriting the framework in TypeScript for:
- Native MCP server support (npm packages)
- Direct SDK integration (Slack, Jira, GitHub, etc.)
- Simpler tool registration (just import)
- Better developer experience

### Key Design Goals

1. **Direct SDK References in Workflows**
```yaml
tools:
  slack:
    sdk: "@slack/web-api"
  anthropic:
    sdk: "@anthropic-ai/sdk"

steps:
  - action: slack.chat.postMessage
    inputs:
      channel: "#general"
      text: "Hello!"
```

2. **Native MCP Support**
```typescript
// Direct import, no subprocess spawning
import { SlackServer } from '@modelcontextprotocol/server-slack';
```

3. **Simple CLI**
```bash
npx marktoflow init
npx marktoflow connect slack  # OAuth flow
npx marktoflow run workflow.md
```

### New Project Structure

```
packages/
  core/           # Parser, engine, state
  cli/            # CLI commands
  integrations/   # Slack, Jira, Gmail, etc.
```

---

## Quick Reference

### Key Files
- `TODO.md` - v2.0 TypeScript roadmap
- `PROGRESS.md` - Development history
- `FRAMEWORK_ANALYSIS.md` - Analysis and recommendations

### Architecture Documents
- Python v1.0 code is in `src/marktoflow/` (archived)
- TypeScript v2.0 will be in `packages/` (to be created)

---

## Common Tasks

### Starting TypeScript Development
```bash
# Initialize monorepo
pnpm init
pnpm add -D typescript @types/node vitest

# Create packages
mkdir -p packages/{core,cli,integrations}/src
```

### Key Dependencies for v2.0
```json
{
  "@anthropic-ai/sdk": "^0.x",
  "@slack/web-api": "^7.x",
  "@octokit/rest": "^21.x",
  "jira.js": "^4.x",
  "better-sqlite3": "^11.x",
  "commander": "^12.x"
}
```

---

## Conventions

- Use TypeScript strict mode
- Use pnpm for package management
- Use Vitest for testing
- Keep modules focused and small
- Prefer composition over inheritance
