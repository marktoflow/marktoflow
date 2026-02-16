# Critical Bug Report - marktoflow Deep Dive

## Summary
Found **2 critical bugs** and several high-priority issues during code review of the marktoflow main branch.

---

## CRITICAL BUGS

### 1. Code Injection Vulnerability in Template Engine (CVSS 9.8)

**File:** `packages/core/src/template-engine.ts`, lines 136-143

**Severity:** CRITICAL - Remote Code Execution

**Description:**
The `evaluateExpression()` function uses `new Function()` to evaluate arithmetic expressions, allowing arbitrary JavaScript code execution. An attacker can inject malicious code through workflow definitions.

**Vulnerable Code:**
```typescript
// Lines 136-143 in template-engine.ts
if (!expression.includes('|') && /[+\-*/]/.test(expression)) {
  try {
    // Create a safe evaluation context (COMMENT IS MISLEADING)
    const fn = new Function(...Object.keys(context), `return ${expression}`);
    return fn(...Object.values(context));
  } catch {
    // Fall through to Nunjucks if JavaScript evaluation fails
  }
}
```

**Attack Vector:**
A user can craft a workflow that executes arbitrary code:
```yaml
steps:
  - id: exploit
    action: some.action
    inputs:
      value: "{{ (x => { require('fs').writeFileSync('/tmp/pwned', 'hacked'); return 1 + 1 })() + 1 }}"
```

**Impact:**
- Full system compromise
- Data exfiltration
- Denial of service
- Lateral movement within infrastructure

**Root Cause:**
Using `new Function()` with user-controlled input is inherently unsafe. JavaScript's Function constructor cannot be sandboxed in user-controlled code.

**Fix:**
Remove the `new Function()` evaluation entirely. Use Nunjucks' built-in expression evaluation for all cases.

---

### 2. Regex Global State Bug in Parser (CVSS 7.5)

**File:** `packages/core/src/parser.ts`, lines 52 and 238

**Severity:** HIGH - Parsing Failures & Data Loss

**Description:**
The `STEP_CODE_BLOCK_REGEX` has the global flag (`/g`), which maintains state across multiple calls to `parseContent()`. When `exec()` is used in a while loop, the regex's `lastIndex` property persists, causing the parser to skip code blocks on subsequent invocations.

**Vulnerable Code:**
```typescript
// Line 52: Defined with global flag
const STEP_CODE_BLOCK_REGEX = /```ya?ml\n([\s\S]*?)```/g;

// Line 238: Used in while loop - regex state persists
while ((match = STEP_CODE_BLOCK_REGEX.exec(markdown)) !== null) {
```

**Scenario:**
```javascript
// First call - works fine (finds steps 1, 2, 3)
parseContent(workflow1);  // STEP_CODE_BLOCK_REGEX.lastIndex = 0 after loop ends

// Second call - BUG: skips initial steps because lastIndex is not reset
parseContent(workflow2);  // Missing step 1 and 2!
```

**Impact:**
- Workflow steps are silently skipped
- Inconsistent behavior in servers/REPL environments  
- Data loss (steps not parsed)
- Difficult to debug (works in isolation, fails in production)

**Root Cause:**
Using regex with global flag in a loop requires manual `lastIndex` management or recreating the regex each iteration.

**Fix:**
Remove the `g` flag and use `string.match()` or `string.matchAll()` instead of exec loop.

---

## HIGH-PRIORITY ISSUES

### 3. Type Casting Without Validation

**Files:** 
- `packages/core/src/parser.ts`, lines 177-181
- `packages/core/src/parser.ts`, lines 218-220

**Description:**
Steps array is cast to `Array<Record<string, unknown>>` without checking if it's actually an array.

```typescript
// Line 178 - assumes frontmatter.steps is an array
steps = parseStepsFromFrontmatter(
  frontmatter.steps as Array<Record<string, unknown>>,
  warnings
);
```

**Impact:**
Runtime crash if `frontmatter.steps` is not an array (string, object, null, etc.)

**Fix:**
Add validation: `if (!Array.isArray(frontmatter.steps))`

---

### 4. Missing Error Handling in Environment Variable Resolution

**File:** `packages/core/src/parser.ts`, lines 343-346

**Description:**
Environment variable resolution silently replaces undefined variables with empty strings.

```typescript
const envValue = process.env[varName];
if (envValue === undefined) {
  console.warn(`[marktoflow] Environment variable \${${varName}} is not set`);
}
return envValue || ''; // <- Returns '' if undefined
```

**Impact:**
- Silent failures (invalid credentials, wrong URLs)
- Hard to debug missing configuration
- Security: credentials might silently default to empty strings

**Fix:**
Consider throwing an error or returning a sentinel value.

---

## MEDIUM-PRIORITY ISSUES

### 5. Missing Input Validation in Secret Manager

**File:** `packages/core/src/secret-providers/secret-manager.ts`, lines 79-95

**Description:**
`parseReference()` doesn't validate the provider exists in the configured providers before calling them.

**Impact:**
- Potential for provider enumeration attacks
- Unclear error messages

---

## RECOMMENDATIONS

1. **Immediate (Critical):**
   - Remove `new Function()` evaluation in template engine
   - Fix regex global state bug in parser
   - Add tests for multiple calls to parseContent()

2. **Short-term (High):**
   - Add input validation for array types
   - Improve error handling in env var resolution
   - Add security tests for template injection

3. **Long-term:**
   - Consider using a safer expression evaluator (e.g., mathjs for arithmetic only)
   - Add comprehensive input validation layer
   - Regular security audits for code execution paths

---

## Test Coverage Gaps

- No tests for calling `parseContent()` multiple times (would catch regex bug)
- No security tests for template injection
- No tests for invalid input types in parser

