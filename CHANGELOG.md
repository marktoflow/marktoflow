# Changelog

All notable changes to marktoflow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Non-scoped wrapper package (`marktoflow`) for easier installation (#56)
  - Enables `npm install -g marktoflow` instead of `npm install -g @marktoflow/cli`
  - Wrapper package delegates to `@marktoflow/cli` for all functionality

### Changed
- Moved CLI bin from `@marktoflow/cli` to `marktoflow` package to resolve "File exists" conflicts
- Updated all documentation to use `npm install -g marktoflow` command
- Updated publish pipeline to include wrapper package

### Fixed
- CLI now reads version from package.json dynamically
- Zod overrides to suppress claude-agent-sdk peer dependency warnings
- Discord, Trello, Mailchimp, and Shopify integrations now fail fast on missing required IDs instead of issuing malformed API calls

## [2.0.4] - 2026-02-15

### Security
- Fixed CVE-2026-2391 (GHSA-w7fw-mjwx-w883): Updated qs dependency to >=6.14.2 to fix arrayLimit bypass DoS vulnerability
  - All transitive dependencies now use patched qs@6.15.0

### Fixed
- Workflow parser now handles CRLF/CR line endings correctly
- GUI workflow importer supports all line ending formats
- `parallel.spawn` majority/any wait strategy index tracking fixed
- `parallel.map` preserves `{{ item }}` and `{{ itemIndex }}` templates correctly
- WorkflowService frontmatter regex allows trailing whitespace

### Changed
- Converted 3 parallel-agent examples to executable YAML frontmatter format
- All 46 example workflows validated and loadable via GUI
- Comprehensive SEO refresh across all package READMEs
- Added 170+ npm keywords across packages for discoverability
- Root README: Enhanced Security & Privacy section, AI platform comparison table

### Technical
- All 1,805 tests passing (1,646 unit, 150 integration, 9 smoke)
- All 46 example workflows validated

## [2.0.3] - 2026-02-09

### Added
- Auto-detect available AI agents in `marktoflow agent list`, `agent info`, and `agent init` based on runtime availability
  - Runtime detection via CLI availability, environment variables, and server pings
  - No longer relies on static capabilities.yaml file
- OpenAI provider support in GUI with configurable base URL and API key (for VLLM, OpenRouter, etc.)
- OpenCode provider support in GUI with port configuration (default 4096)
- Coverage infrastructure with thresholds to prevent regressions:
  - core: 50% lines/statements, 65% functions, 70% branches
  - integrations: 60% lines/statements, 50% functions, 50% branches
  - gui: 25% lines/statements, 80% functions, 65% branches
- Environment variable support for engine config defaults:
  - `MARKTOFLOW_TIMEOUT`, `MARKTOFLOW_MAX_RETRIES`
  - `MARKTOFLOW_RETRY_BASE_DELAY`, `MARKTOFLOW_RETRY_MAX_DELAY`
- SUPPORTED-INTEGRATIONS.md documentation with categorized tables of all 38 services, 6 AI adapters, and built-in tools

### Changed
- Updated AI provider models to 2026 versions:
  - Claude: claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5
  - OpenAI: gpt-4.5, gpt-4.1, gpt-4.1-mini, gpt-4o, o3
  - Codex: gpt-5.2-codex, gpt-5.1-codex-max, gpt-5.2, gpt-5.1-codex-mini
  - Copilot: Official GitHub Copilot naming with spaces (e.g., "Claude Opus 4.6", "GPT-5.2-Codex", "Gemini 3 Pro")
- Renamed "Claude Code" to "Claude Agent" for clarity in GUI
- Updated favicon to use marktoflow logo instead of vite.svg
- Consolidated AI agent control section in README
- Improved GitHub Copilot provider:
  - Fixed SDK initialization to properly call `client.start()`
  - Added availability detection to check if Copilot SDK is installed
  - Updated auth command from `copilot auth login` to `copilot login`
  - Added 1-second stabilization wait after start() for reliable connections

### Fixed
- Form data validation against field schema in GUI routes
- GitHub Copilot activation flow - "Connect & Activate" button now works correctly
- Security vulnerabilities:
  - Updated axios from 1.13.2 to 1.13.5 (fixes DoS via __proto__ vulnerability)
  - Updated langsmith from 0.3.87 to 0.5.0 (fixes SSRF via tracing header injection)
  - Added pnpm overrides to enforce secure dependency versions

### Removed
- Removed gemini-cli from known agents list (no provider implementation)
- Removed Claude API provider from GUI (redundant with Claude Agent)
- Cleaned up legacy Python artifacts and added .ruff_cache/ to .gitignore

### Technical
- Enhanced CI workflow with coverage flags and artifact uploads (14-day retention)
- Added visual status indicators in GUI with color coding:
  - 🟢 Ready (green) - Connected and active
  - 🔵 Available (blue) - SDK installed, ready to connect
  - 🟡 Needs Config (yellow) - Configuration required
  - 🔴 Unavailable (red) - SDK not installed
- All 736 GUI tests passing

## [2.0.2] - 2026-02-03

### Security
- Fixed 11 security vulnerabilities:
  - Replaced xlsx (0.18.5) with exceljs (4.4.0) to fix prototype pollution and ReDoS
  - Added pnpm overrides to force secure versions:
    - qs >= 6.13.0 (fixes prototype pollution and DoS)
    - xml2js >= 0.6.2 (fixes prototype pollution)
    - @isaacs/brace-expansion >= 5.0.1 (fixes uncontrolled resource consumption)
    - fast-xml-parser >= 5.3.4 (fixes RangeError DoS)
    - esbuild >= 0.24.2 (fixes development server vulnerability)
- Result: 0 security vulnerabilities remaining

### Added
- GitHub Package Registry support for npm packages
- Agent-task-executor example showcasing AI agent control from Slack/Telegram
  - Enables conversation-based task execution with pass/fail reporting
  - Example commands: `codex do: <task>`, `claude check: <url>`

### Changed
- Updated package logo
- Updated documentation to showcase messaging app integration with AI agents
- Updated @modelcontextprotocol/sdk from 1.25.3 to 1.26.0
- Updated hono from 4.11.5 to 4.11.9

### Fixed
- Updated file-operations.ts to use exceljs instead of xlsx for Excel file processing
- Fixed metapackage bin field

### Technical
- All tests passing, 0 security vulnerabilities

## [2.0.1] - 2026-01-28

**First stable release** - Exited alpha status

### Fixed
- HTTP action resolution: Spread action methods directly on SDK return object for HTTP integration
- GUI installation: Moved react/react-dom from peerDependencies to devDependencies so `npm install -g @marktoflow/marktoflow` correctly installs all deps
- Validated all 46 example workflows against parser
- Fixed broken examples:
  - opencode-config frontmatter
  - approval-workflow variable name
  - oauth-refresh-demo doc blocks
  - code-review YAML quoting

### Changed
- Bumped all packages from v2.0.0-alpha.16 to v2.0.1 (stable release)
- Added vitest test that validates all example workflows

### Technical
- All example workflows now parser-validated
- Stable API commitment begins with 2.0.1

## [2.0.0-alpha.16] - 2026-01-24

### Added
- **Complete TypeScript rewrite** from Python for better npm ecosystem integration
- **Native MCP support** - Direct import of Model Context Protocol servers, no subprocess spawning
- **Visual workflow designer (GUI)** - Drag-and-drop interface with AI assistance
  - React Flow-based canvas with custom nodes and edges
  - Step editor with tabs (Properties, Inputs, Output, Error Handling, Conditions, YAML)
  - AI prompt interface for workflow modifications with Claude/Copilot/OpenCode
  - Real-time execution view with WebSocket updates
  - Settings panel with file-based persistence
  - Dark/light mode support
  - 8-phase enterprise GUI upgrade with 40+ components, 5 stores, 4 route modules
  - 736 GUI tests

- **39 service integrations** via official SDKs:
  - Messaging: Slack, Discord
  - Project Management: Jira, Linear, GitHub
  - Email: Gmail, Outlook
  - Docs & Knowledge: Notion, Confluence
  - Data: Airtable
  - HTTP/GraphQL clients
  - 8 new enterprise integrations with contract testing

- **AI agent support**:
  - GitHub Copilot integration (use existing subscription)
  - Claude Code CLI integration
  - OpenCode support
  - Ollama for local LLMs
  - Anthropic SDK direct integration

- **Multi-agent workflows** - Run parallel AI agents with routing, consensus, and coordination
  - Parallel execution support (3x faster code reviews, batch processing)
  - Agent routing strategies (round-robin, least-loaded, consensus)

- **Trigger system**:
  - Cron-based scheduling (node-cron)
  - Webhook receivers with signature verification (Slack, GitHub, Microsoft Graph)
  - File system watchers (chokidar)
  - Gmail Pub/Sub push notifications
  - Slack Socket Mode for real-time events
  - Microsoft Graph subscriptions

- **Advanced features**:
  - RBAC and permissions system
  - Approval workflows
  - Audit logging
  - Cost tracking and budget limits with alerts
  - Plugin system with lifecycle hooks
  - Workflow templates with variable substitution
  - Tool bundling (bundle build/validate/load)
  - OpenAPI tool loader with schema validation
  - Custom tool adapters and local tool discovery
  - Environment-based config + CLI config defaults

### Changed
- **Package organization**: Now uses npm workspace with `@marktoflow` scope
  - `@marktoflow/core` - Parser, engine, state management
  - `@marktoflow/integrations` - Service integrations and AI adapters
  - `@marktoflow/cli` - Command-line interface
  - `@marktoflow/gui` - Web-based workflow designer
  - `@marktoflow/marktoflow` - Meta-package (installs everything)

- **Workflow format**: YAML frontmatter + markdown (breaking change from Python v1.x)
- **Architecture**: Direct SDK references in YAML instead of Python adapter pattern
- **State management**: SQLite-based (better-sqlite3)
- **Tool integration**: Just import SDKs, no subprocess spawning

### Removed
- Python package no longer maintained (v1.x end-of-life)
- Legacy `@scottgl` packages deprecated in favor of `@marktoflow` organization
- Agent adapters (replaced with direct SDK calls)
- MCP bridge (replaced with native MCP support)
- Subprocess spawning for tools (replaced with direct imports)

### Technical
- Monorepo structure with pnpm workspaces and Turbo
- TypeScript with full type safety
- 181 test suite (expanding to match Python's 615+)
  - 125 core tests (+36 new) - 119 passing
  - 48 integration tests
  - 8 CLI tests
  - 13 workflow integration tests
  - 6 end-to-end tests
  - 8 concurrent execution tests
  - 9 multi-agent workflow tests
- Express-based webhook server
- React Flow-based visual editor
- WebSocket support for real-time updates
- Contract testing for service integrations

### Migration from v1.x

For users migrating from Python v1.x:

- Workflow YAML format is mostly compatible
- Configuration format has changed (see docs)
- Some workflow syntax updates required for SDK references
- No agent adapters - use SDKs directly
- MCP servers are npm packages, not subprocess bridges

See migration guide in documentation for detailed steps.

## [1.0-python-final] - Legacy Python Version

The original Python implementation is no longer maintained. All future development happens in the TypeScript rewrite (v2.x).

---

## Version Summary

- **2.0.4** (Latest) - Security fixes, parser improvements, parallel execution fixes, SEO refresh
- **2.0.3** - AI provider updates, auto-detection, coverage infrastructure, security fixes
- **2.0.2** - Security fixes (11 vulnerabilities), exceljs migration, GitHub Package Registry
- **2.0.1** - First stable release, HTTP action fix, GUI install fix, example validation
- **2.0.0-alpha.16** - TypeScript rewrite, MCP support, GUI, 39 integrations, multi-agent
- **1.0-python-final** - Legacy Python version (deprecated)

For detailed changes and downloads, see [GitHub Releases](https://github.com/marktoflow/marktoflow/releases).
