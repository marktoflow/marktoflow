# marktoflow Integration Tests

This directory contains comprehensive integration tests that verify SDKs are correctly configured and work with YAML workflows.

## Test Coverage

**Total Tests:** 568 (up from 516)
**Test Files:** 40

## New Test Suites

### 1. SDK-YAML Integration Tests (`sdk-yaml-integration.test.ts`)

**Purpose:** End-to-end testing of SDK integration through YAML workflows

**Coverage:**
- Slack integration (2 tests)
- GitHub integration (1 test)
- PostgreSQL integration (1 test)
- Jira integration (1 test)
- Google Sheets integration (1 test)
- Error handling (3 tests)
- Complex multi-tool workflows (1 test)
- Input type validation (1 test)

**What's Tested:**
- YAML parsing and workflow structure validation
- Tool configuration validation (auth, SDK references)
- Step structure validation (action paths, inputs, output variables)
- SDK initialization from YAML config
- Action invocation through workflow steps

**Total:** 11 tests

### 2. Action Executor Tests (`action-executor.test.ts`)

**Purpose:** Verify the full path from action string to SDK method invocation

**Coverage:**
- Single-level actions (db.query) - 1 test
- Two-level nested actions (slack.chat.postMessage, github.repos.get, etc.) - 4 tests
- Three-level nested actions (jira.issueSearch.searchForIssuesUsingJql, sheets.spreadsheets.values.get, etc.) - 3 tests
- Context binding verification - 1 test
- Error handling (invalid format, unregistered SDK, non-existent methods) - 4 tests
- Input handling (empty inputs, complex types) - 2 tests

**What's Tested:**
- Correct method resolution through nested object paths
- Method invocation with proper `this` context
- Parameter passing and type preservation
- Error messages for common issues

**Total:** 15 tests

### 3. Enhanced Slack Tests (`slack-enhanced.test.ts`)

**Purpose:** Comprehensive Slack SDK integration validation

**Coverage:**
- SDK initialization (2 tests)
- Action mapping for common methods (4 tests)
- Method invocation with mocked responses (2 tests)
- SDK registry integration (2 tests)

**Methods Tested:**
- `chat.postMessage`
- `users.info`
- `conversations.history`
- `conversations.create`

**Total:** 10 tests

### 4. Enhanced GitHub Tests (`github-enhanced.test.ts`)

**Purpose:** Comprehensive GitHub/Octokit SDK integration validation

**Coverage:**
- SDK initialization (2 tests)
- Action mapping for common methods (9 tests)
- Method invocation with mocked responses (3 tests)
- SDK registry integration (2 tests)

**Methods Tested:**
- `repos.get`
- `pulls.list`
- `pulls.get`
- `pulls.listFiles`
- `pulls.createReview`
- `repos.getContent`
- `issues.create`
- `git.createRef`
- `search.issuesAndPullRequests`

**Total:** 16 tests

## What These Tests Verify

### 1. SDK Configuration is Valid

Tests ensure that:
- SDKs are correctly identified by package name
- Authentication configurations match SDK requirements
- Required fields are validated (e.g., `auth.token` for Slack)
- Optional fields are handled correctly

### 2. YAML Workflows Parse Correctly

Tests verify that:
- Workflow metadata is extracted properly
- Tools are registered with correct configuration
- Steps are parsed with correct structure
- Input/output variables are captured
- Complex nested structures work (Jira, Google Sheets)

### 3. Actions Map to SDK Methods

Tests confirm that:
- Action strings like `slack.chat.postMessage` resolve to actual SDK methods
- Deep nesting works (e.g., `sheets.spreadsheets.values.get`)
- Method context (`this`) is preserved correctly
- All documented actions are available

### 4. Method Invocation Works Correctly

Tests validate that:
- Parameters are passed to methods correctly
- Return values are captured
- Complex input types are preserved (objects, arrays, nested structures)
- Empty inputs are handled

### 5. Error Handling is Robust

Tests check that:
- Invalid action formats are rejected with clear errors
- Unregistered SDKs are reported
- Missing methods are caught
- Non-function properties are identified

## Running Tests

```bash
# Run all integration tests
pnpm test --filter=@marktoflow/integrations

# Run specific test suite
pnpm test --filter=@marktoflow/integrations -- sdk-yaml-integration.test.ts
pnpm test --filter=@marktoflow/integrations -- action-executor.test.ts
pnpm test --filter=@marktoflow/integrations -- slack-enhanced.test.ts
pnpm test --filter=@marktoflow/integrations -- github-enhanced.test.ts

# Run with coverage
pnpm test --filter=@marktoflow/integrations --coverage
```

## Test Patterns

### YAML Workflow Test Pattern

```typescript
const yaml = `
---
workflow:
  id: test-workflow
  name: Test

tools:
  service:
    sdk: 'package-name'
    auth:
      token: 'test-token'
---

# Workflow

## Step 1

\`\`\`yaml
action: service.method
inputs:
  param: value
output_variable: result
\`\`\`
`;

const { workflow } = parseContent(yaml.trim());

// Validate structure
expect(workflow.metadata.id).toBe('test-workflow');
expect(workflow.tools?.service.sdk).toBe('package-name');
expect(workflow.steps[0].action).toBe('service.method');
```

### Action Executor Test Pattern

```typescript
const mockClient = {
  method: vi.fn().mockResolvedValue({ success: true })
};

vi.spyOn(registry, 'load').mockResolvedValue(mockClient);

const step = {
  action: 'service.method',
  inputs: { param: 'value' }
};

const result = await executor(step, {}, registry);

expect(mockClient.method).toHaveBeenCalledWith({ param: 'value' });
expect(result).toEqual({ success: true });
```

### SDK Initialization Test Pattern

```typescript
const config = {
  sdk: 'package-name',
  auth: { token: 'test-token' }
};

const client = await Initializer.initialize({}, config);

expect(client).toBeInstanceOf(ExpectedClass);
expect(typeof client.method.submethod).toBe('function');
```

## Coverage Goals

- ✅ All major integrations have initialization tests
- ✅ Common actions are verified to exist
- ✅ YAML parsing works for all tool types
- ✅ Error handling covers common failure cases
- ✅ Input/output handling is validated
- ⏳ Future: Add tests for OAuth flows
- ⏳ Future: Add tests for rate limiting
- ⏳ Future: Add tests for retry behavior

## Contributing

When adding new integrations:

1. Add initialization tests (auth validation)
2. Add action mapping tests (verify methods exist)
3. Add method invocation tests (mocked responses)
4. Add YAML workflow test (end-to-end)
5. Document the integration in this README

Ensure all tests use mocked responses - never call real external APIs in tests.
