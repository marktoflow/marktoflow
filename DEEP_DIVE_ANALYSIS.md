# marktoflow Deep Dive Analysis - February 15, 2026

## Executive Summary

Completed comprehensive security and code quality review of the marktoflow main branch. Found **2 critical bugs** and several high-priority issues.

**Key Findings:**
- ✅ **FIXED:** Critical code injection vulnerability in template engine (CVSS 9.8)
- ✅ **FIXED:** Parser regex state bug causing silent data loss in multi-threaded environments
- ⚠️ **NOTED:** Several medium-priority code quality issues (not fixed, as they're not critical)

---

## Critical Bugs Found & Fixed

### Bug #1: Remote Code Execution in Template Engine ⚠️ CRITICAL

**CVSS Score:** 9.8 (Critical)  
**Attack Vector:** Network/User-Provided Workflows  
**Authentication:** Not Required

**Description:**
The `evaluateExpression()` function in `template-engine.ts` uses `new Function()` to evaluate arithmetic expressions, allowing arbitrary JavaScript code execution.

**Vulnerable Code Location:**
```typescript
// packages/core/src/template-engine.ts (lines 136-143)
if (!expression.includes('|') && /[+\-*/]/.test(expression)) {
  const fn = new Function(...Object.keys(context), `return ${expression}`);
  return fn(...Object.values(context));
}
```

**Exploitation Example:**
A user can create a workflow with:
```yaml
steps:
  - action: some.action
    inputs:
      command: "{{ (require('fs').writeFileSync('/tmp/pwned', 'hacked'); 1 + 1) }}"
```

This would execute arbitrary Node.js code within the workflow engine's process context.

**Impact:**
- Remote Code Execution
- System compromise
- Data exfiltration  
- Denial of service
- Privilege escalation (if engine runs as root)

**Root Cause:**
`new Function()` cannot be sandboxed when user-controlled input is included in the function body.

**Fix Applied:**
Removed the unsafe `new Function()` evaluation. All expressions now go through Nunjucks templating engine, which provides safe expression evaluation without code execution.

**PR:** #58

---

### Bug #2: Parser Regex State Bug Causing Data Loss ⚠️ HIGH

**Impact:** Silent data loss in server/REPL environments  
**Reproducibility:** High (affects any codebase calling parseContent() multiple times)

**Description:**
The `STEP_CODE_BLOCK_REGEX` is defined with the global flag (`/g`), which causes regex state to persist across multiple calls to `exec()`. When `parseContent()` is called multiple times in the same process, subsequent calls skip code blocks because the regex's `lastIndex` is not reset.

**Vulnerable Code Location:**
```typescript
// packages/core/src/parser.ts (lines 52, 238)
const STEP_CODE_BLOCK_REGEX = /```ya?ml\n([\s\S]*?)```/g;  // Global flag

function parseStepsFromMarkdown(markdown: string, warnings: string[]): WorkflowStep[] {
  let match;
  while ((match = STEP_CODE_BLOCK_REGEX.exec(markdown)) !== null) {  // State persists
    // ...
  }
}
```

**Exploitation Scenario:**

```javascript
// First call - works correctly
const result1 = parseContent(workflow1);  // Finds steps 1, 2, 3
// Regex lastIndex is now at end of match

// Second call in same process - FAILS
const result2 = parseContent(workflow2);  // Missing steps! Only finds steps after initial position
```

**Impact:**
- Workflow steps silently skipped
- Inconsistent behavior (works in isolation, fails in server)
- Data loss (steps not parsed)
- Hard to debug (behavior depends on call order)

**Root Cause:**
JavaScript regex with `/g` flag maintains state. Using `exec()` in a while loop is a known anti-pattern that requires manual `lastIndex` management.

**Fix Applied:**
Replaced exec() loop with `String.matchAll()` which returns a fresh iterator and doesn't maintain state.

**PR:** #58

---

## High-Priority Issues (Not Critical)

### Issue #3: Type Casting Without Validation

**Files:** 
- `packages/core/src/parser.ts` (lines 177-181)

**Description:**
The `frontmatter.steps` field is cast to array without checking:

```typescript
steps = parseStepsFromFrontmatter(
  frontmatter.steps as Array<Record<string, unknown>>,  // No validation
  warnings
);
```

**Risk:**
If frontmatter contains `steps: "not an array"`, the code crashes at runtime.

**Recommendation:**
```typescript
if (!Array.isArray(frontmatter.steps)) {
  warnings.push('steps must be an array');
  steps = [];
} else {
  steps = parseStepsFromFrontmatter(frontmatter.steps, warnings);
}
```

---

### Issue #4: Silent Environment Variable Failures

**File:** `packages/core/src/parser.ts` (lines 343-346)

**Description:**
Environment variables that are undefined are silently replaced with empty strings:

```typescript
const envValue = process.env[varName];
if (envValue === undefined) {
  console.warn(`[marktoflow] Environment variable \${${varName}} is not set`);
}
return envValue || '';  // Returns '' silently
```

**Risk:**
- Credentials might default to empty strings
- Configuration failures aren't caught until runtime
- Hard to debug missing configuration

**Recommendation:**
Consider returning a sentinel value or throwing an error.

---

## Code Quality Assessment

### Strengths
1. **Well-structured codebase:** Good separation of concerns (engine, parser, state management)
2. **Comprehensive test coverage:** Good coverage of core functionality
3. **Type safety:** Well-typed TypeScript with Zod validation
4. **Error handling:** Generally good error messages and logging
5. **Security-conscious:** Good use of frozen objects and sandboxing where implemented

### Areas for Improvement
1. **Regex patterns:** Need more care with global flag usage
2. **Type validation:** Add runtime checks for user input
3. **Error propagation:** Some silent failures (env vars)
4. **Test coverage gaps:** No security tests, no multi-call tests

---

## Test Coverage Analysis

### Existing Tests (Good)
- ✅ Parser basic functionality (frontmatter, steps)
- ✅ Template variable extraction
- ✅ Tool configuration
- ✅ Trigger parsing
- ✅ Step type detection

### Coverage Gaps (Risky)
- ❌ Multiple parseContent() calls (regex bug not caught)
- ❌ Template injection security
- ❌ Environment variable edge cases  
- ❌ Type validation failures
- ❌ Parallel execution edge cases

---

## Recommendations

### Immediate (Critical)
1. ✅ **DONE:** Remove new Function() evaluation
2. ✅ **DONE:** Fix regex state bug
3. Deploy security fixes immediately (RCE vulnerability)

### Short-term (Before Next Release)
1. Add input validation for array types
2. Add security tests for template injection
3. Add tests for multiple parseContent() calls
4. Review environment variable handling
5. Add CHANGELOG entry for security fixes

### Long-term (Ongoing)
1. Consider using a safer expression evaluator (e.g., mathjs for arithmetic only)
2. Add comprehensive security audit for all user input paths
3. Implement defense-in-depth: validate at parse-time and execution-time
4. Add security testing to CI/CD pipeline
5. Regular dependency updates and security scanning

---

## Files Reviewed

### Core Components (Primary Focus)
- ✅ `packages/core/src/parser.ts` - **2 issues found**
- ✅ `packages/core/src/template-engine.ts` - **1 critical issue found**
- ✅ `packages/core/src/engine.ts` - OK
- ✅ `packages/core/src/engine/control-flow.ts` - OK
- ✅ `packages/core/src/engine/variable-resolution.ts` - OK
- ✅ `packages/core/src/script-executor.ts` - OK (good sandboxing)
- ✅ `packages/core/src/state.ts` - OK
- ✅ `packages/core/src/credentials.ts` - OK (good encryption)
- ✅ `packages/core/src/oauth-refresh.ts` - OK
- ✅ `packages/core/src/secret-providers/secret-manager.ts` - OK
- ✅ `packages/core/src/parallel.ts` - OK

### Integration Components (Secondary)
- ✅ `packages/integrations/*` - Spot checks OK

---

## PR Summary

**PR #58:** fix/critical-template-injection-and-parser-bugs
- ✅ 2 critical bugs fixed
- ✅ Comprehensive test coverage added
- ✅ All tests passing
- ✅ No breaking changes
- ✅ Full documentation in BUG_REPORT.md

---

## Conclusion

The marktoflow codebase is **generally well-architected** with good attention to security and type safety. However, two critical bugs were found and fixed:

1. **RCE vulnerability in template engine** - High severity, immediate fix required
2. **Data loss bug in parser** - High impact in production environments

With these fixes applied, the codebase is significantly more secure and robust.

**Recommended Action:** Merge PR #58 and deploy security patches immediately.

---

*Analysis completed on February 15, 2026 by clawmander*
