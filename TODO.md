# TODO - Unified AI Workflow Automation Framework

This file tracks pending tasks for the project. Completed items are moved to PROGRESS.md.

---

## Phase 1: Foundation - COMPLETE

All Phase 1 items have been implemented. See PROGRESS.md for details.

---

## Phase 2: Production Ready (Current)

### Automation
- [ ] Scheduling system (cron-based)
  - [ ] APScheduler integration
  - [ ] Cron expression parsing
  - [ ] Background job execution
- [ ] Webhook receivers
  - [ ] HTTP server for webhook endpoints
  - [ ] Webhook signature verification
  - [ ] Event routing to workflows
- [ ] File system event triggers
  - [ ] Watchdog integration
  - [ ] File pattern matching
- [ ] Message queue integration
  - [ ] Redis queue support
  - [ ] RabbitMQ support (optional)

### Reliability
- [ ] Error recovery and retry logic
  - [ ] Exponential backoff
  - [ ] Circuit breaker pattern
- [ ] State persistence (workflow checkpoints)
  - [ ] SQLite state store
  - [ ] Resume from checkpoint
- [ ] Rollback capabilities
  - [ ] Step undo registry
  - [ ] Transaction-like semantics
- [ ] Agent failover
  - [ ] Automatic fallback to secondary agent
  - [ ] Health checking

### Monitoring
- [ ] Metrics collection
  - [ ] Prometheus metrics endpoint
  - [ ] Step timing, success rates
- [ ] Execution logging (markdown format)
  - [ ] Structured log output
  - [ ] Log aggregation
- [ ] Agent comparison dashboards
  - [ ] Performance metrics by agent
  - [ ] Cost per workflow
- [ ] Cost tracking
  - [ ] Token usage monitoring
  - [ ] API cost estimation

### Testing
- [ ] Integration tests with real APIs
- [ ] Cross-agent compatibility tests
- [ ] End-to-end workflow tests
- [ ] Performance benchmarks

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
