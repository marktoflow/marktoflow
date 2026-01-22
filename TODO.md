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
- [ ] Cost tracking
  - [ ] Token usage monitoring
  - [ ] API cost estimation

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
- [ ] Integration tests with real APIs
- [ ] Cross-agent compatibility tests
- [ ] End-to-end workflow tests
- [ ] Performance benchmarks

**Total: 227 tests passing**

---

## Phase 3: Enterprise

### Security
- [ ] RBAC implementation
  - [ ] User/role management
  - [ ] Permission scopes
- [ ] Approval workflows
  - [ ] Human-in-the-loop gates
  - [ ] Slack/email approval requests
- [ ] Audit logging
  - [ ] All actions logged
  - [ ] Compliance reporting
- [ ] Credential encryption (age/GPG)
  - [ ] Age encryption integration
  - [ ] Key management

### Optimization
- [ ] Automatic agent selection
  - [ ] Cost/quality routing rules
  - [ ] Capability-based selection
- [ ] Cost-based routing
  - [ ] Budget limits per workflow
  - [ ] Dynamic agent switching
- [ ] Performance tuning
  - [ ] Parallel step execution
  - [ ] Caching strategies
- [ ] Load balancing
  - [ ] Multi-instance support
  - [ ] Work distribution

### Ecosystem
- [ ] Plugin system
  - [ ] Plugin discovery
  - [ ] Hook points for extensions
- [ ] Workflow template library
  - [ ] Common workflow patterns
  - [ ] Importable templates
- [ ] Community tool marketplace
  - [ ] Tool packaging format
  - [ ] Registry integration

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

## Quick Wins (Next Up)

These are small improvements that can be done quickly:

1. [ ] Add `--verbose` flag to CLI commands
2. [ ] Add `aiworkflow workflow create` scaffolding command
3. [ ] Add JSON output option for CLI commands
4. [ ] Improve error messages with suggestions
5. [ ] Add `aiworkflow doctor` for environment checking

---

## Notes

- Phase 1 complete - core framework is functional
- Phase 2 focuses on production readiness
- Testing is critical before Phase 3
- Consider user feedback for prioritization
