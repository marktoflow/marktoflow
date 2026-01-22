# TODO - Unified AI Workflow Automation Framework

This file tracks pending tasks for the project. Completed items are moved to PROGRESS.md.

---

## Phase 1: Foundation - COMPLETE

All Phase 1 items have been implemented. See PROGRESS.md for details.

---

## Phase 2: Production Ready (Current)

### Automation
- [x] Scheduling system (cron-based)
  - [x] Cron expression parsing (CronParser class)
  - [x] Scheduler with job management
  - [x] CLI commands (schedule list/start/run/info)
- [x] Webhook receivers
  - [x] HTTP server for webhook endpoints (WebhookReceiver)
  - [x] Webhook signature verification (GitHub-style and generic HMAC-SHA256)
  - [x] Event routing to workflows
  - [x] CLI commands (webhook list/start/test)
  - [x] AsyncWebhookReceiver for async variant
- [x] File system event triggers
  - [x] Watchdog integration (FileWatcher, AsyncFileWatcher)
  - [x] File pattern matching (WatchConfig with glob patterns)
  - [x] Debouncing and event filtering
  - [x] Workflow trigger from file events
- [x] Message queue integration
  - [x] Redis queue support (RedisQueue, AsyncRedisQueue)
  - [x] RabbitMQ support (RabbitMQQueue)
  - [x] In-memory queue for testing (InMemoryQueue)
  - [x] WorkflowQueueManager for high-level operations
  - [x] CLI commands (queue status/publish/worker/purge)

### Reliability
- [x] Error recovery and retry logic
  - [x] Exponential backoff (RetryPolicy class)
  - [x] Circuit breaker pattern (CircuitBreaker class with CLOSED/OPEN/HALF_OPEN states)
  - [x] Integrated into WorkflowEngine
- [x] State persistence (workflow checkpoints)
  - [x] SQLite state store (StateStore class)
  - [x] Execution records and step checkpoints
  - [x] Resume from checkpoint support
- [x] Rollback capabilities
  - [x] Step undo registry (RollbackRegistry, RollbackAction)
  - [x] Transaction-like semantics (TransactionContext with savepoints)
  - [x] Pre-built compensation handlers (FileCompensationHandler, GitCompensationHandler)
- [x] Agent failover
  - [x] Automatic fallback to secondary agent (FailoverConfig, _execute_step_with_failover)
  - [x] Health checking (check_agent_health, AgentHealth)
  - [x] Per-agent circuit breakers
  - [x] Failover event tracking (FailoverEvent, FailoverReason)

### Monitoring
- [x] Metrics collection
  - [x] Prometheus metrics endpoint (MetricsServer with /metrics and /health)
  - [x] Step timing, success rates (WorkflowMetrics, MetricsCollector)
- [x] Execution logging (markdown format)
  - [x] ExecutionLog and LogEntry classes
  - [x] ExecutionLogger for managing logs
  - [x] Markdown log file generation
- [ ] Agent comparison dashboards
  - [ ] Performance metrics by agent
  - [ ] Cost per workflow
- [x] Cost tracking
  - [x] Token usage monitoring (TokenUsage, CostRecord, CostTracker)
  - [x] API cost estimation (ModelPricing, PricingRegistry, WorkflowCostEstimator)
  - [x] Cost limits and alerts (CostLimit, CostAlert, CostAlertHandler)
  - [x] Persistent storage (CostStore, PersistentCostTracker)

### Testing
- [x] Unit tests for scheduler module (18 tests)
- [x] Unit tests for state persistence module (18 tests)
- [x] Unit tests for execution logging module (18 tests)
- [x] Unit tests for engine enhancements (31 tests - RetryPolicy, CircuitBreaker, Failover)
- [x] Unit tests for webhook receiver (14 tests)
- [x] Unit tests for file watcher (23 tests)
- [x] Unit tests for metrics collection (23 tests)
- [x] Unit tests for message queue (30 tests)
- [x] Unit tests for rollback capabilities (34 tests)
- [x] Unit tests for cost tracking (37 tests)
- [ ] Integration tests with real APIs
- [ ] Cross-agent compatibility tests
- [ ] End-to-end workflow tests
- [ ] Performance benchmarks

**Total: 615 tests (600+ passing, ~12 skipped async/age)**

---

## Phase 3: Enterprise - In Progress

### Security
- [x] RBAC implementation
  - [x] Permission enum (14 permissions)
  - [x] Role class with inheritance
  - [x] User class with role assignment
  - [x] RBACManager for permission checking
  - [x] Predefined roles (viewer, executor, developer, approver, admin)
  - [x] PermissionDeniedError and require_permission decorator
- [x] Approval workflows
  - [x] ApprovalStatus enum (pending, approved, rejected, expired, cancelled)
  - [x] ApprovalRequest dataclass
  - [x] ApprovalManager for creating/approving/rejecting requests
  - [x] ApprovalHandler interface for notifications
  - [x] Required approvers and min_approvals support
- [x] Audit logging
  - [x] AuditEventType enum (20+ event types)
  - [x] AuditEvent dataclass
  - [x] InMemoryAuditStore for testing
  - [x] SQLiteAuditStore for persistent storage
  - [x] AuditLogger high-level interface
- [x] Credential encryption (age/GPG)
  - [x] Age encryption integration
  - [x] GPG encryption integration
  - [x] Fernet built-in encryption
  - [x] Key management

### Optimization
- [x] Automatic agent selection
  - [x] Cost/quality routing rules
  - [x] Capability-based selection
- [x] Cost-based routing
  - [x] Budget limits per workflow
  - [x] Dynamic agent switching
- [ ] Performance tuning
  - [ ] Parallel step execution
  - [ ] Caching strategies
- [ ] Load balancing
  - [ ] Multi-instance support
  - [ ] Work distribution

### Ecosystem
- [x] Plugin system
  - [x] Plugin discovery (from directories and entry points)
  - [x] Hook points for extensions (20+ hook types)
  - [x] Plugin lifecycle management (load, enable, disable, unload)
  - [x] PluginManager for managing plugins
  - [x] HookRegistry for hook callbacks
  - [x] Example plugins (LoggingPlugin, MetricsPlugin)
- [x] Workflow template library
  - [x] TemplateVariable for customizable parameters
  - [x] TemplateMetadata with categories and requirements
  - [x] WorkflowTemplate with render and instantiate
  - [x] TemplateRegistry for discovery and management
  - [x] 7 built-in templates (PR review, deployment, testing, etc.)
  - [x] CLI commands (template list/show/use/search/categories)
- [ ] Community tool marketplace
  - [ ] Tool package format and metadata (ToolPackage, PackageMetadata)
  - [ ] Tool package builder and validator (PackageBuilder, PackageValidator)
  - [ ] Marketplace registry (MarketplaceRegistry with local/remote sources)
  - [ ] Tool installation and management (PackageInstaller, InstalledPackage)
  - [ ] Version management and dependency resolution
  - [ ] Package signing and verification
  - [ ] CLI commands (marketplace search/install/uninstall/update/publish)
  - [ ] Comprehensive tests for marketplace module

---

## Backlog

### Future Agent Support
- [ ] Aider adapter (full support)
- [ ] Cursor adapter
- [ ] Codex adapter
- [ ] Gemini CLI adapter
- [ ] GitHub Copilot Workspace adapter

### Advanced Features
- [ ] Parallel workflow execution
- [ ] Workflow composition (sub-workflows)
- [ ] A/B testing workflows across agents
- [ ] Natural language workflow creation
- [ ] Visual workflow editor (web UI)
- [ ] Workflow versioning and rollback

---

## Self-Contained Bundles - COMPLETE

- [x] ScriptTool for executing bash/Python scripts as tools
  - Inputs passed as `--key=value` CLI arguments
  - Outputs parsed as JSON or plain text
  - Multi-operation support
- [x] WorkflowBundle for self-contained workflow directories
  - Auto-detect workflow.md, main.md, or single .md file
  - Load script tools from tools/ directory
  - Bundle configuration via config.yaml
  - Bundle tool metadata via tools.yaml
- [x] CLI bundle commands
  - `aiworkflow bundle info <path>` - Show bundle information
  - `aiworkflow bundle validate <path>` - Validate bundle structure
  - `aiworkflow bundle run <path>` - Run a bundle workflow
  - `aiworkflow bundle list [path]` - List bundles in a directory
  - Auto-detect bundles in `aiworkflow run`
- [x] Example bundles (5 refactored from flat files)
  - code-review, daily-standup, dependency-update
  - incident-response, sprint-planning
- [x] Comprehensive tests (53 new tests)

**Total: 615 tests (600+ passing, ~12 skipped async/age)**

---

## Quick Wins - COMPLETE

All quick wins have been implemented:

- [x] Add `--verbose` flag to CLI commands
  - Global `-v/--verbose` option for all commands
  - `log_verbose()` helper for debug output
- [x] Add `aiworkflow workflow create` scaffolding command
  - Templates: basic, multi-step, with-tools
  - `--bundle` flag to create bundle directory
  - `--template` and `--output` options
- [x] Add JSON output option for CLI commands
  - Global `--json` option for all commands
  - `output_json()` and `output_result()` helpers
  - Updated: run, workflow list, workflow show, version
- [x] Improve error messages with suggestions
  - Added helpful tips after error messages
  - Suggestions for next commands to try
- [x] Add `aiworkflow doctor` for environment checking
  - Python version check
  - Project initialization check
  - Optional dependencies check
  - Git availability check
  - Workflows and tools summary

---

## Notes

- Phase 1 complete - core framework is functional
- Phase 2 focuses on production readiness
- Testing is critical before Phase 3
- Consider user feedback for prioritization
