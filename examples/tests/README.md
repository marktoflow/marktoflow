# Test & Demo Workflows

This directory contains workflow examples that demonstrate specific features, test functionality, or showcase individual SDK integrations. These are primarily for learning and testing purposes.

## Agent SDK Demos

### Claude Agent SDK (`claude-agent-sdk/`)
Demonstrates the full Claude Agent SDK with agentic capabilities, specialized subagents, and built-in tools.

### Claude Code (`claude-code-config/`)
Shows how to use Claude Code for code analysis, generation, and documentation.

### Codex (`codex-config/`)
Demonstrates OpenAI Codex SDK integration for automated code review.

### OpenCode (`opencode-config/`)
Shows OpenCode AI integration for code analysis tasks.

## Feature Tests

### Control Flow (`control-flow/`)
Demonstrates various control flow constructs:
- `data-pipeline.md` - For-each loops and data transformation
- `error-handling.md` - Try/catch/finally error handling
- `incident-router.md` - Switch/case routing
- `parallel-fetch.md` - Parallel execution
- `polling-loop.md` - While loops

### Sub-Workflows (`sub-workflows/`)
Demonstrates calling workflows from other workflows:
- `user-onboarding.md` - Parent workflow example

## Simple Test Files

### `copilot-simple-test.md`
Basic test for GitHub Copilot integration.

### `rest-api-demo.md`
Demonstrates HTTP/REST API integration patterns.

## Purpose

These examples are designed to:
- **Test** specific features and integrations
- **Demonstrate** how to use particular SDKs
- **Showcase** control flow patterns
- **Provide** simple templates for learning

For production-ready workflow examples, see the parent `/examples` directory.

## Usage

Run any test workflow:
```bash
marktoflow run examples/tests/control-flow/data-pipeline.md
marktoflow run examples/tests/claude-code-config/workflow.md --agent claude-code
```

Validate syntax:
```bash
marktoflow run --dry-run examples/tests/rest-api-demo.md
```
