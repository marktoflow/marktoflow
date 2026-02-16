# marktoflow Architectural Review

## Executive Summary

Comprehensive architectural analysis reveals several design issues that impact maintainability, extensibility, and code quality. While the codebase is well-structured overall, there are specific patterns that need improvement.

**Key Findings:**
- ⚠️ **Hard-coded factories** - Event sources, SDKs, and operations use hard-coded switch statements
- ⚠️ **Tight coupling** - SDKRegistry depends on concrete classes, not interfaces
- ⚠️ **Inconsistent error handling** - Multiple patterns for error conversion throughout codebase
- ⚠️ **Large files with too many responsibilities** - credentials.ts (1055 lines), engine.ts (1079 lines)
- ✅ **Good separation of concerns** - Engine, parser, state management are well-separated
- ✅ **Type safety** - Good use of TypeScript and Zod validation

---

## 1. Hard-Coded Factory Pattern Issues

### Problem: Event Source Factory (HIGH)

**File:** `packages/core/src/event-source.ts` (lines 850-866)

**Current Implementation:**
```typescript
export function createEventSource(config: EventSourceConfig): BaseEventSource {
  switch (config.kind) {
    case "websocket":
      return new WebSocketEventSource(config);
    case "discord":
      return new DiscordEventSource(config);
    case "slack":
      return new SlackEventSource(config);
    case "cron":
      return new CronEventSource(config);
    case "http-stream":
      return new SSEEventSource(config);
    case "rss":
      return new RssEventSource(config);
    default:
      throw new Error(`Unknown event source kind: ${config.kind}`);
  }
}
```

**Issues:**
1. **Not extensible** - Adding a new event source requires modifying this function
2. **Violates Open/Closed Principle** - Open for extension, closed for modification
3. **Tight coupling** - Requires importing all event source implementations
4. **Hard to test** - Can't easily mock or inject different event sources

**Impact:**
- Users can't add custom event sources without modifying core code
- Plugins can't register new event sources
- Hard to unit test (need to test all variants)

**Recommendation:**
Use a registry pattern:
```typescript
class EventSourceRegistry {
  private factories: Map<string, (config: EventSourceConfig) => BaseEventSource> = new Map();
  
  register(kind: string, factory: (config: EventSourceConfig) => BaseEventSource) {
    this.factories.set(kind, factory);
  }
  
  create(config: EventSourceConfig): BaseEventSource {
    const factory = this.factories.get(config.kind);
    if (!factory) throw new Error(`Unknown event source: ${config.kind}`);
    return factory(config);
  }
}
```

---

### Problem: SDK Initializer Registry (HIGH)

**File:** `packages/core/src/sdk-registry.ts` (lines 81-180)

**Current Implementation:**
```typescript
export const defaultInitializers: Record<string, SDKInitializer> = {
  '@slack/web-api': { /* hardcoded */ },
  '@octokit/rest': { /* hardcoded */ },
  '@anthropic-ai/sdk': { /* hardcoded */ },
  openai: { /* hardcoded */ },
  'jira.js': { /* hardcoded */ },
  // ... more hardcoded initializers
};
```

**Issues:**
1. **Not extensible** - Each new SDK needs code modification
2. **All SDKs must be defined upfront** - No dynamic registration
3. **Hard-coded error handling** - Each SDK has similar pattern but repeated
4. **Not easily testable** - Can't swap implementations

**Impact:**
- Adding a new SDK requires PR and release
- Can't support private/custom SDKs without modification
- Increased maintenance burden

**Recommendation:**
```typescript
interface SDKInitializerRegistry {
  register(packageName: string, initializer: SDKInitializer): void;
  get(packageName: string): SDKInitializer | undefined;
}
```

---

### Problem: Operation Factory (MEDIUM)

**File:** `packages/core/src/built-in-operations.ts`

**Issue:** Similar hard-coded switch statement for operation selection

---

## 2. Inconsistent Error Handling (MEDIUM)

### Problem: Multiple Error Conversion Patterns

**Files:** 
- `packages/core/src/engine.ts` - Multiple inconsistent patterns
- `packages/core/src/engine/control-flow.ts` - Multiple patterns
- Throughout the codebase

**Current Implementations (All Different):**

```typescript
// Pattern 1: Message extraction
const errorMsg = error instanceof Error ? error.message : String(error);

// Pattern 2: Error creation
const lastError = error instanceof Error ? error : new Error(String(error));

// Pattern 3: Direct string conversion
String(error)

// Pattern 4: Using utility
errorToString(result.error)
```

**Issues:**
1. **Inconsistent** - Different patterns in different files
2. **Error-prone** - Easy to miss edge cases (null, undefined, objects)
3. **Duplication** - Same logic repeated ~50+ times
4. **Not type-safe** - `unknown` errors can slip through

**Impact:**
- Harder to debug (error format varies)
- Potential data loss (some conversions lose information)
- Maintenance burden (fix in multiple places)

**Recommendation:**

Create a consistent error handling utility:

```typescript
// packages/core/src/utils/error-conversion.ts
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }
  return String(error);
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(toErrorMessage(error));
}

export function toErrorDetails(error: unknown): { message: string; stack?: string } {
  const err = toError(error);
  return {
    message: err.message,
    stack: err.stack,
  };
}

// Usage throughout codebase:
const message = toErrorMessage(error);
const err = toError(error);
```

---

## 3. God Objects & Large Files (MEDIUM)

### Problem: Oversized Classes/Files

**Files Exceeding 1000 Lines:**
1. `engine.ts` - 1079 lines
   - Handles: execution flow, retry, failover, state management, daemon mode, resumption
   - Has ~15 methods and complex state

2. `credentials.ts` - 1055 lines
   - Handles: 4 encryption backends, 2 credential stores, key management
   - Has 4 classes/interfaces with multiple implementations

3. `control-flow.ts` - 1030 lines
   - Handles: 12 different control flow step types
   - Each with complex logic

4. `event-source.ts` - 921 lines
   - Handles: 6 different event source implementations
   - Base class + all implementations in one file

**Issues:**
1. **Cognitive overload** - Too many concepts in one file
2. **Reusability** - Hard to reuse just one piece
3. **Testing** - Must test everything together
4. **Maintenance** - Harder to find and fix bugs

**Recommendation:**

**For engine.ts** - Break into focused modules:
```
engine/
  ├── executor.ts (main execute logic)
  ├── daemon.ts (daemon mode)
  ├── resumption.ts (resume execution)
  ├── retry.ts (existing)
  ├── failover.ts (existing)
  └── prompt-loading.ts (prompt resolution)
```

**For credentials.ts** - Organize by concern:
```
credentials/
  ├── types.ts (interfaces and types)
  ├── encryptors/ (each encryptor in its own file)
  │   ├── fernet.ts
  │   ├── aes256gcm.ts
  │   ├── age.ts
  │   └── gpg.ts
  ├── stores/ (each store in its own file)
  │   ├── in-memory.ts
  │   └── sqlite.ts
  ├── manager.ts (CredentialManager)
  └── key-manager.ts (KeyManager)
```

**For event-source.ts** - Separate implementations:
```
event-sources/
  ├── base.ts (BaseEventSource)
  ├── websocket.ts (WebSocketEventSource)
  ├── discord.ts (DiscordEventSource)
  ├── slack.ts (SlackEventSource)
  ├── cron.ts (CronEventSource)
  ├── sse.ts (SSEEventSource)
  ├── rss.ts (RssEventSource)
  ├── manager.ts (EventSourceManager)
  └── factory.ts (createEventSource)
```

---

## 4. Tight Coupling Issues (MEDIUM)

### Problem: SDKRegistry Depends on Concrete Classes

**File:** `packages/core/src/sdk-registry.ts`

**Current Implementation:**
```typescript
constructor(
  loader: SDKLoader = defaultSDKLoader,
  initializers: Record<string, SDKInitializer> = defaultInitializers,
  mcpLoader?: McpLoader,  // <-- Concrete class dependency
  secretManager?: SecretManager  // <-- Concrete class dependency
) {
  this.mcpLoader = mcpLoader || new McpLoader();  // <-- Creates instance
  if (secretManager) {
    this.secretManager = secretManager;
  }
}
```

**Issues:**
1. **Hard to test** - Can't easily mock McpLoader or SecretManager
2. **Not truly injectable** - Optional dependencies create confusion
3. **Default behavior hidden** - Creating McpLoader() is buried in constructor

**Recommendation:**
```typescript
interface McpLoaderLike {
  load(path: string): Promise<unknown>;
}

interface SecretManagerLike {
  getSecret(reference: string): Promise<Secret>;
}

constructor(
  config: {
    loader: SDKLoader;
    initializers: Record<string, SDKInitializer>;
    mcpLoader: McpLoaderLike;
    secretManager?: SecretManagerLike;
  }
) {
  this.loader = config.loader;
  this.initializers = new Map(Object.entries(config.initializers));
  this.mcpLoader = config.mcpLoader;
  this.secretManager = config.secretManager;
}
```

---

## 5. Missing Abstractions (MEDIUM)

### Problem: No Plugin/Hook System for Extensibility

**Issue:** There's no standard way to:
- Add custom event sources
- Add custom operation types
- Add custom step types
- Hook into execution lifecycle (beyond events)

**Recommendation:** 
Implement a proper plugin architecture (note: plugins.ts exists but is not widely used):

```typescript
interface WorkflowPlugin {
  name: string;
  version: string;
  
  // Lifecycle hooks
  beforeExecute?(workflow: Workflow, context: ExecutionContext): Promise<void>;
  afterExecute?(result: WorkflowResult): Promise<void>;
  
  // Extension hooks
  registerEventSources?(registry: EventSourceRegistry): void;
  registerOperations?(registry: OperationRegistry): void;
  registerTools?(registry: ToolRegistry): void;
}
```

---

## 6. State Management Issues (LOW)

### Problem: Global Singleton Pattern for EventSourceManager

**File:** `packages/core/src/event-operations.ts`

**Issue:**
```typescript
let globalEventSourceManager: EventSourceManager;

export function getEventSourceManager(): EventSourceManager {
  if (!globalEventSourceManager) {
    globalEventSourceManager = new EventSourceManager();
  }
  return globalEventSourceManager;
}
```

**Problems:**
1. **Global state** - Can cause issues in tests and concurrent environments
2. **Not injectable** - Hard to provide different instances for different contexts
3. **Hidden dependency** - Calling code doesn't show it depends on this

**Recommendation:**
Pass EventSourceManager through dependency injection rather than global lookup.

---

## 7. Naming & API Design Issues (MEDIUM)

### Problem: Inconsistent Naming Conventions

**Examples:**
- `renderTemplate()` vs `evaluateCondition()`
- `executeStep()` vs `executeIfStep()`
- `WorkflowEngine.execute()` vs `executeIfStep()`
- `parseFile()` vs `parseContent()`
- Some operations use `execute*` prefix, others don't

**Impact:**
- API is less predictable
- Harder to discover functions via IDE autocomplete
- Mental overhead for users

**Recommendation:**
Establish and document naming conventions:
- All "execute" functions for step execution
- All "parse" functions for parsing
- All "create" functions for construction
- Consistent verb-object pattern

---

### Problem: Large Parameter Objects Without Documentation

**Examples:**

`packages/core/src/engine.ts` - EngineConfig has many optional fields:
```typescript
export interface EngineConfig {
  defaultTimeout?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
  retryMaxDelay?: number;
  defaultAgent?: string;
  defaultModel?: string;
  failoverConfig?: FailoverConfig;
  healthTracker?: AgentHealthTracker;
  rollbackRegistry?: RollbackRegistry;
}
```

**Issues:**
1. **Unclear defaults** - Where are defaults defined?
2. **Inconsistent patterns** - Some optional with defaults, some without
3. **Hard to discover** - Many parameters scattered

**Recommendation:**
```typescript
// Define defaults in one place
const DEFAULT_ENGINE_CONFIG = {
  defaultTimeout: 60000,
  maxRetries: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
} as const;

// Use defaults factory
function createDefaultEngineConfig(): EngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG };
}
```

---

## 8. Performance/Scalability Issues (LOW)

### Problem: No Connection Pooling for SQLite

**Files:**
- `packages/core/src/state.ts`
- `packages/core/src/credentials.ts`

**Issue:**
Each StateStore and SQLiteCredentialStore creates its own Database instance:

```typescript
export class StateStore {
  private db: Database.Database;

  constructor(dbPath: string = '.marktoflow/state/workflow-state.db') {
    this.db = new Database(dbPath);  // <-- New instance per store
  }
}
```

**Problems:**
1. **Multiple instances** - Each StateStore creates its own DB connection
2. **Resource inefficiency** - Multiple file handles to same DB file
3. **Potential contention** - WAL mode may have issues with multiple connections

**Impact:** At scale with many workflows, could hit file descriptor limits

**Recommendation:**
```typescript
class DatabaseConnectionPool {
  private instances: Map<string, Database> = new Map();
  
  get(dbPath: string): Database {
    if (!this.instances.has(dbPath)) {
      this.instances.set(dbPath, new Database(dbPath));
    }
    return this.instances.get(dbPath)!;
  }
  
  close(dbPath?: string): void {
    if (dbPath) {
      this.instances.get(dbPath)?.close();
      this.instances.delete(dbPath);
    } else {
      for (const db of this.instances.values()) {
        db.close();
      }
      this.instances.clear();
    }
  }
}
```

---

### Problem: No Caching for Parsed Workflows

**File:** `packages/core/src/engine.ts`

**Issue:** parseFile() is called every time resumeExecution() is called:
```typescript
async resumeExecution(...) {
  const { workflow } = await parseFile(execution.workflowPath);  // <-- No caching
  // ...
}
```

**Impact:** For frequently resumed workflows, repeated parsing overhead

**Recommendation:**
```typescript
private workflowCache = new Map<string, { workflow: Workflow; timestamp: number }>();

async getCachedWorkflow(path: string, maxAge = 60000) {
  const cached = this.workflowCache.get(path);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < maxAge) {
    return cached.workflow;
  }
  
  const { workflow } = await parseFile(path);
  this.workflowCache.set(path, { workflow, timestamp: now });
  return workflow;
}
```

---

## 9. Test Coverage Gaps (MEDIUM)

### Missing Tests for:
1. ❌ Plugin system integration
2. ❌ Custom event sources
3. ❌ SDK registry extension
4. ❌ Error handling edge cases
5. ❌ Concurrent execution scenarios
6. ❌ Large workflow execution (memory/performance)
7. ❌ Database connection limits
8. ❌ Workflow cache invalidation

---

## Summary of Recommendations

### Immediate (High Priority)
1. ✅ **DONE** Fix code injection bug
2. ✅ **DONE** Fix parser regex bug
3. Create consistent error handling utility
4. Document naming conventions

### Short-term (Before 2.1 Release)
1. Implement EventSourceRegistry for extensibility
2. Implement SDKInitializerRegistry
3. Break down god objects (engine.ts, credentials.ts)
4. Remove global state from event operations

### Long-term (Future Releases)
1. Formal plugin architecture
2. Database connection pooling
3. Workflow parsing cache
4. Performance benchmarking
5. Architecture documentation

---

## Impact Assessment

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Hard-coded factories | HIGH | No extensibility | MEDIUM |
| Error handling inconsistency | MEDIUM | Debugging complexity | SMALL |
| God objects (1000+ LOC files) | MEDIUM | Maintainability | LARGE |
| Tight coupling (concrete deps) | MEDIUM | Testing difficulty | MEDIUM |
| Global state (EventSourceManager) | MEDIUM | Concurrency issues | SMALL |
| Missing plugin system | MEDIUM | No extensibility | LARGE |
| No DB connection pooling | LOW | Scalability at scale | MEDIUM |
| No workflow caching | LOW | Performance | SMALL |

---

## Conclusion

The marktoflow codebase has good overall architecture with clear separation of concerns. However, several design patterns limit extensibility and maintainability:

1. **Hard-coded factories** prevent users from extending functionality
2. **Inconsistent error handling** makes debugging harder
3. **Large files** reduce code clarity
4. **Tight coupling** makes testing difficult

With the architectural improvements outlined above, marktoflow would be more maintainable, extensible, and testable.

---

*Analysis completed on February 15, 2026*
