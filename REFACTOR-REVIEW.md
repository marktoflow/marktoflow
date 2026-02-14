# Marktoflow Codebase Review & Refactoring Opportunities

**Date:** 2026-02-14
**Reviewer:** Artisan (Personal Coding Task Agent)
**Scope:** `packages/core/src/`, `packages/cli/src/`, `packages/integrations/src/`

---

## Overview

The marktoflow codebase is well-structured as a monorepo with clear package boundaries (`core`, `cli`, `integrations`, `gui`). The core package handles parsing, execution, and state management. The main concern is that several files have grown large and taken on too many responsibilities, particularly `engine.ts`.

### File Size Summary (core/src)

| File | Lines | Concern |
|------|-------|---------|
| `engine.ts` | 2,739 | 🔴 God object — needs splitting |
| `credentials.ts` | 1,055 | Acceptable — complex domain |
| `built-in-operations.ts` | 993 | 🟡 Could be split by category |
| `nunjucks-filters.ts` | 722 | 🟢 Could be split by category |
| `parser.ts` | 675 | Acceptable |
| `costs.ts` | 601 | Acceptable |
| `routing.ts` | 562 | Acceptable |
| `models.ts` | 559 | Acceptable |

---

## 🔴 Critical

### 1. `engine.ts` is a 2,739-line God Object

`WorkflowEngine` has ~40 methods handling unrelated concerns:

- Step dispatching and routing
- Retry logic + circuit breaking
- Failover logic
- Template resolution (`resolveTemplates`, `resolveVariablePath`)
- Condition evaluation (custom parser)
- Sub-workflow execution (including sub-agent orchestration)
- Every control flow type (if, switch, for-each, while, map, filter, reduce, parallel, try, wait, merge)
- Prompt loading and caching
- State management coordination
- Workflow result building

**Suggested refactor — extract into focused modules:**

```
packages/core/src/
├── engine.ts                    # Thin orchestrator (~400-500 lines)
├── engine/
│   ├── control-flow.ts          # if, switch, for-each, while, map, filter, reduce, parallel, try, merge
│   ├── retry.ts                 # RetryPolicy, CircuitBreaker, executeStepWithRetry
│   ├── failover.ts              # executeStepWithFailover (rename existing failover.ts → failover-config.ts)
│   ├── conditions.ts            # evaluateConditions, evaluateCondition, resolveConditionValue, parseValue
│   ├── subworkflow.ts           # executeSubWorkflow, executeSubWorkflowWithAgent, buildSubagentPrompt
│   └── wait-step.ts             # executeWaitStep (~130 lines, complex with 3 modes)
```

**Estimated line savings from engine.ts:**

| New Module | Methods | Est. Lines |
|---|---|---|
| `engine/control-flow.ts` | 10 execute*Step methods | ~1,000 |
| `engine/retry.ts` | RetryPolicy, CircuitBreaker, executeStepWithRetry | ~350 |
| `engine/conditions.ts` | evaluateConditions, evaluateCondition, resolveConditionValue, parseValue | ~120 |
| `engine/subworkflow.ts` | executeSubWorkflow, executeSubWorkflowWithAgent, build*Prompt, parse* | ~250 |
| `engine/wait-step.ts` | executeWaitStep | ~130 |
| **Total extracted** | | **~1,850** |

The main `engine.ts` would become a thin orchestrator (~400-500 lines) that imports and delegates to these modules. The `WorkflowEngine` class would keep:
- Constructor and config
- `execute()` and `resumeExecution()` (top-level workflow execution)
- `executeStep()` (dispatcher that calls into extracted modules)
- `executeFile()` (file loading convenience)
- `buildWorkflowResult()`
- Context cloning/merging utilities

**Benefits:**
- Each module is independently testable
- Easier to understand — each file has one clear responsibility
- Reduces merge conflicts when multiple features touch the engine
- New step types can be added without modifying the core engine

---

## 🟡 Medium Priority

### 2. `resolveTemplates` is defined in the wrong file

`resolveTemplates()` and `resolveVariablePath()` are defined in `engine.ts` but they are **template concerns**, not engine concerns. They are imported by:
- `built-in-operations.ts`
- `parallel.ts`
- Other modules that need template resolution

This creates an awkward dependency where utility modules reach into the engine for template functionality.

**Fix:** Move `resolveTemplates()` and `resolveVariablePath()` (plus the helper `getNestedValue()`) to `template-engine.ts`, which already exists and handles Nunjucks rendering.

**Current:**
```
built-in-operations.ts → imports resolveTemplates from engine.ts
parallel.ts            → imports resolveTemplates from engine.ts
```

**Proposed:**
```
built-in-operations.ts → imports resolveTemplates from template-engine.ts
parallel.ts            → imports resolveTemplates from template-engine.ts
engine.ts              → imports resolveTemplates from template-engine.ts
```

---

### 3. Duplicated duration parsing

Two nearly identical functions exist:

- `engine.ts` → `parseDuration()` (lines 83-98): Parses `"2h"`, `"30m"`, `"5s"`, `"100ms"` into milliseconds
- `parallel.ts` → `parseTimeout()`: Same logic, different name

**Fix:** Extract to a shared `utils/duration.ts`:

```typescript
// packages/core/src/utils/duration.ts
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (!match) {
    const asNum = Number(duration);
    if (!isNaN(asNum)) return asNum;
    throw new Error(`Invalid duration: "${duration}"`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 1);
}
```

---

### 4. `template-engine.ts` vs `templates.ts` — confusing naming

- `template-engine.ts` — Nunjucks rendering engine (resolves `{{ }}` expressions)
- `templates.ts` — Workflow template library (project scaffolding, `marktoflow new`)

These do completely different things but have nearly identical names. This is confusing when navigating the codebase.

**Fix:** Rename `templates.ts` → `workflow-templates.ts` or `template-library.ts`.

---

### 5. `built-in-operations.ts` at ~1,000 lines

This file is a monolith of unrelated operations: `core.set`, `core.transform`, `core.extract`, `core.format`, `core.merge`, `core.validate`, `core.log`, `core.error`, `core.uuid`, `core.hash`, `core.encode`, `core.decode`, `core.aggregate`, `core.jsonpath`, all `workflow.*` operations, plus the dispatcher.

**Fix:** Split into focused modules:

```
packages/core/src/
├── built-in-operations.ts           # Dispatcher/registry only (~100 lines)
├── operations/
│   ├── core-operations.ts           # core.set, core.extract, core.format, core.uuid, core.hash, etc.
│   ├── workflow-operations.ts       # workflow.set_outputs, workflow.log, workflow.sleep, workflow.fail, etc.
│   └── transform-operations.ts      # core.transform, core.aggregate, core.jsonpath
```

---

### 6. Condition evaluation is hand-rolled and fragile

The `evaluateCondition()` method (engine.ts:1565-1610) does naive string splitting on operators:

```typescript
// Current implementation
for (const op of operators) {
  if (condition.includes(op)) {
    operator = op;
    parts = condition.split(op).map((s) => s.trim());
    break;
  }
}
```

**Problems:**
- Splits on the **first operator found** in a fixed order — `>=` must be checked before `>`, but what about expressions containing `==` inside strings?
- Uses `==` (loose equality) instead of `===`
- Can't handle compound expressions: `items.length > 0 && status == 'active'`
- Can't handle parentheses or logical operators (AND/OR/NOT)
- Can't handle negation: `!isComplete`
- Breaks if a variable name contains operator characters

Since Nunjucks is already available and handles all of this natively, conditions could be evaluated as Nunjucks expressions:

**Fix:**
```typescript
private evaluateCondition(condition: string, context: ExecutionContext): boolean {
  const result = resolveTemplates(`{{ ${condition} }}`, context);
  return Boolean(result);
}
```

This gives you **for free:**
- Logical operators: `and`, `or`, `not`
- Parentheses: `(a > 1) and (b < 5)`
- Filter support: `items | length > 0`
- String comparisons: `status == 'active'`
- All Nunjucks comparison operators
- Consistent behavior with template expressions elsewhere

**Risk:** This changes evaluation semantics slightly (Nunjucks `==` vs JavaScript `==`). Would need test verification.

---

## 🟢 Low Priority

### 7. `getNestedValue()` duplicates `getField()`

Both are in `engine.ts`:
- `getNestedValue()` (lines 362-417): Handles dot notation AND array indexing (`items[0].name`)
- `getField()` (lines 119-128): Only handles dot notation, no array indexing

**Fix:** Remove `getField()`, use `getNestedValue()` everywhere. The only caller of `getField()` is the `filter` and `sort` built-in operations.

---

### 8. `nunjucks-filters.ts` at 722 lines

This file registers all custom Nunjucks filters in one giant function. While functional, it's hard to navigate.

**Fix:** Organize by category:

```
packages/core/src/
├── nunjucks-filters.ts              # Main registry, calls registerXxxFilters()
├── filters/
│   ├── string-filters.ts            # upper, lower, trim, split, replace, etc.
│   ├── array-filters.ts             # first, last, sort_by, group_by, unique, etc.
│   ├── date-filters.ts              # date, now, relative_time, etc.
│   ├── json-filters.ts              # json, from_json, to_yaml, etc.
│   └── regex-filters.ts             # match, test, replace_regex, etc.
```

---

### 9. Inconsistent error handling patterns

Error handling in `engine.ts` is inconsistent:

```typescript
// Pattern 1: Wrap in Error
lastError = error instanceof Error ? error : new Error(String(error));

// Pattern 2: Pass error message string to createStepResult
createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
  error instanceof Error ? error.message : String(error));

// Pattern 3: Pass raw error object
createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0, lastError);

// Pattern 4: Pass string literal
createStepResult(step.id, StepStatus.FAILED, null, startedAt, 0,
  'Step is neither an action nor a workflow');
```

The `StepResult.error` field is typed as `unknown`, which allows this inconsistency.

**Fix:**
1. Type `StepResult.error` as `Error | string | undefined`
2. Standardize on always passing `Error` objects (or at minimum, always strings)
3. Create a helper: `function toError(e: unknown): Error`

---

### 10. `index.ts` barrel exports everything

The core `index.ts` (524 lines) exports virtually everything from every module. This means:
- Consumers can't tree-shake effectively
- The public API surface is unclear
- Internal implementation details are exposed

**Fix:** Consider grouping exports or using sub-path exports in `package.json`:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./engine": "./dist/engine.js",
    "./parser": "./dist/parser.js",
    "./models": "./dist/models.js"
  }
}
```

---

## Recommended Approach

### Phase 1: Quick Wins (Low risk, high clarity)
1. Extract `parseDuration` to shared utils
2. Rename `templates.ts` → `workflow-templates.ts`
3. Remove duplicate `getField()`
4. Standardize error handling helper

### Phase 2: Engine Decomposition (High impact)
1. Extract control flow methods to `engine/control-flow.ts`
2. Extract retry/circuit breaker to `engine/retry.ts`
3. Extract condition evaluation to `engine/conditions.ts`
4. Extract sub-workflow execution to `engine/subworkflow.ts`
5. Move `resolveTemplates` to `template-engine.ts`

### Phase 3: Operation Splitting (Medium impact)
1. Split `built-in-operations.ts` into operation modules
2. Split `nunjucks-filters.ts` into filter modules

### Phase 4: Condition Evaluation Upgrade
1. Replace custom condition parser with Nunjucks evaluation
2. Verify all existing tests pass
3. Add tests for compound conditions

---

## Notes

- The monorepo structure (`core`, `cli`, `integrations`, `gui`) is clean and well-organized
- Zod schema validation in `models.ts` is a good pattern
- The `base-client.ts` in integrations provides good HTTP abstraction
- The reliability/schema layer in integrations is well-designed
- Test coverage appears solid across the codebase
- The parser handles markdown-to-workflow conversion well

This review focuses on structural improvements. The code is functional and well-tested — these changes are about maintainability and readability as the project grows.

---

## Licensing: Free for Personal Use, Paid for Commercial

**Current license:** Apache 2.0 — fully permissive, anyone (including corporations) can use it for free with no obligation to pay or contribute back.

### Goal

- ✅ Free for individuals, hobbyists, students, nonprofits
- ✅ Free for personal/internal use
- 💰 Paid for commercial/corporate production use
- ✅ Source code remains visible (not proprietary/closed)

### Option 1: Business Source License (BSL 1.1) ⭐ Recommended

**Used by:** HashiCorp (Terraform, Vault), CockroachDB, Sentry, MariaDB, Couchbase

**How it works:**
- Source code is publicly available
- Free for non-production use (development, testing, personal projects)
- **Commercial production use requires a paid license**
- After a set time period (typically 2-4 years), the code automatically converts to a true open source license (Apache 2.0 or MIT)
- You define an "Additional Use Grant" that specifies what's allowed for free

**Example Additional Use Grant for marktoflow:**
> You may use the Licensed Work for any purpose other than operating a commercial product or service that uses the Licensed Work as a workflow automation engine for more than 5 users. For individual, educational, nonprofit, and evaluation use, no commercial license is required.

**Pros:**
- Battle-tested by major companies (HashiCorp, CockroachDB)
- Clear terms — corporations understand BSL
- Auto-converts to Apache 2.0 after change date (builds trust)
- You control the "Additional Use Grant" (can be generous for individuals)
- Prevents cloud vendors from reselling your work

**Cons:**
- Not technically "open source" (OSI doesn't approve it) — it's "source available"
- Some developers/companies avoid BSL on principle
- May reduce community contributions from corporate contributors

**Revenue model:** Sell commercial licenses directly, or through a self-serve portal.

---

### Option 2: Functional Source License (FSL) ⭐ Strong Alternative

**Used by:** Sentry, Codecov, GitButler, Liquibase

**How it works:**
- A simplified, more opinionated version of BSL
- Created by Sentry specifically for this use case
- **Non-compete clause**: You can't use it to build a competing product/service
- All other use (including commercial) is permitted
- Automatically converts to Apache 2.0 or MIT after **exactly 2 years**
- Simpler and clearer than BSL

**Pros:**
- Simpler than BSL — easier for users to understand
- More permissive — only blocks competitors, not all commercial use
- Guaranteed 2-year conversion to true open source
- Growing adoption and community support
- Backed by fair.io / Fair Source movement

**Cons:**
- Only blocks competitors — a corporation using marktoflow internally for their own workflows would NOT need to pay (unlike BSL)
- Newer license, less legal precedent
- "Competing" can be subjective

**Best for:** If you mainly want to prevent someone from cloning marktoflow and selling it as a service, but are okay with corporations using it internally for free.

---

### Option 3: Dual Licensing (AGPL + Commercial)

**Used by:** MySQL/Oracle, Qt, MongoDB (originally), Neo4j, Grafana

**How it works:**
- Release under AGPL v3 (strong copyleft)
- AGPL requires anyone who modifies and deploys the software (even as a service) to release their source code
- Corporations that don't want to open-source their modifications buy a commercial license
- Individual/personal use under AGPL is completely free

**Pros:**
- True open source (AGPL is OSI-approved)
- Proven model (MySQL built a billion-dollar business on this)
- Strong legal teeth — AGPL's network clause catches SaaS usage
- Community contributions flow back under AGPL
- Corporations have strong incentive to buy commercial license

**Cons:**
- AGPL scares many corporations — some have blanket policies against it
- You need a CLA (Contributor License Agreement) to dual-license contributions
- More complex to administer
- Some companies will just avoid your project entirely

---

### Option 4: PolyForm Noncommercial + Commercial License

**Used by:** Various smaller projects

**How it works:**
- PolyForm Noncommercial 1.0.0 for the public release
- Explicitly allows: personal use, academic use, nonprofit use
- Explicitly prohibits: any commercial use without a separate license
- Sell commercial licenses separately

**Pros:**
- Crystal clear — "noncommercial" is well understood
- Very simple license text (written by lawyers, plain English)
- No time-based conversion (you keep control forever)

**Cons:**
- Not open source (won't be on OSI list)
- "Noncommercial" can be ambiguous (is a developer at a company using it for a side project commercial?)
- May significantly reduce adoption
- No community goodwill from eventual open source conversion

---

### Option 5: Open Core Model

**Used by:** GitLab, Elastic, Redis, Sidekiq

**How it works:**
- Keep the core under Apache 2.0 (truly open source)
- Build premium features that are only in a paid "Enterprise" or "Pro" edition
- Enterprise features licensed under BSL, proprietary, or separate terms

**Pros:**
- Core remains truly open source — maximum adoption and goodwill
- Premium features justify the price
- Community contributes to the open core
- Easiest model for adoption

**Cons:**
- You need to identify which features are "enterprise" vs "community"
- Constant tension about what goes in which tier
- Competitors can still build on your open core
- Requires more engineering effort (maintaining two editions)

**Possible marktoflow split:**
- **Community (Apache 2.0):** Core engine, parser, CLI, basic integrations
- **Enterprise (BSL/paid):** GUI, advanced integrations (Salesforce, SAP), SSO, audit logging, parallel execution at scale, priority support

---

### Comparison Matrix

| | BSL 1.1 | FSL | AGPL + Commercial | PolyForm NC | Open Core |
|---|---|---|---|---|---|
| **Personal use free** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Corp must pay** | ✅ Production use | ⚠️ Only competitors | ✅ If they modify/deploy | ✅ Any commercial | ⚠️ Only for premium features |
| **Source visible** | ✅ | ✅ | ✅ | ✅ | ✅ Core, ⚠️ Enterprise |
| **OSI "open source"** | ❌ | ❌ | ✅ | ❌ | ✅ Core |
| **Converts to open source** | ✅ (2-4 years) | ✅ (2 years) | N/A (already is) | ❌ | N/A |
| **Blocks cloud resellers** | ✅ | ✅ | ✅ | ✅ | ⚠️ Only enterprise features |
| **Community contributions** | Medium | Medium | High (but need CLA) | Low | High (to core) |
| **Legal clarity** | High | High | High | Medium | Medium |
| **Adoption friction** | Low-Medium | Low | Medium-High | High | Low |
| **Revenue potential** | High | Medium | High | Medium | High |
| **Precedent** | HashiCorp, CockroachDB | Sentry, GitButler | MySQL, MongoDB | Smaller projects | GitLab, Redis |

---

### Recommendation

**For marktoflow, I'd recommend BSL 1.1** because:

1. **Clear corporate payment trigger** — any company using it in production needs a license
2. **Generous personal use** — you define exactly what's free via the Additional Use Grant
3. **Trust signal** — auto-converts to Apache 2.0 after 3-4 years
4. **Proven model** — HashiCorp and CockroachDB validated this at scale
5. **Aligns with your goal** — corporations pay, individuals don't

**Suggested Additional Use Grant:**
> You may use the Licensed Work for any non-production purpose, including development, testing, personal projects, and educational use. You may also use the Licensed Work in production for personal, non-commercial purposes. Production use by a commercial entity with more than one (1) user requires a commercial license from [your entity].

**Change Date:** 4 years from each release (e.g., v2.0 released 2026 → becomes Apache 2.0 in 2030)

**Change License:** Apache License 2.0

### Migration Steps

1. Draft the BSL 1.1 license with your Additional Use Grant
2. Update `LICENSE` file
3. Update `package.json` license field to `"BSL-1.1"`
4. Add a `NOTICE` file explaining the licensing
5. Update README with licensing section
6. Set up a page/form for commercial license purchases
7. Consider grandfathering existing users who adopted under Apache 2.0
8. Apply to new releases only (can't retroactively change existing releases)

### Important Note

**You cannot retroactively change the license on already-published versions.** Anyone who downloaded marktoflow under Apache 2.0 can continue using that version forever under Apache 2.0 terms. The license change only applies to new releases going forward. This is normal and expected — HashiCorp, Elastic, and others all did the same.
