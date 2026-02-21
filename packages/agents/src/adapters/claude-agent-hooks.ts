/**
 * Claude Agent SDK Hooks for marktoflow
 *
 * Provides pre-built hook configurations for common use cases:
 * - Audit logging
 * - Cost tracking
 * - Approval workflows
 * - File change monitoring
 * - Security enforcement
 */

import {
  HookCallback,
  HookInput,
  HookResult,
  HookEvent,
  ToolPermissionHandler,
  ToolPermissionResult,
} from './claude-agent-types.js';

// ============================================================================
// Audit Logging Hooks
// ============================================================================

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  event: HookEvent;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: string;
  sessionId?: string;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logger interface
 */
export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
  flush(): Promise<void>;
}

/**
 * Console audit logger (default)
 */
export class ConsoleAuditLogger implements AuditLogger {
  private prefix: string;

  constructor(prefix = '[Agent Audit]') {
    this.prefix = prefix;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    const timestamp = entry.timestamp.toISOString();
    const toolInfo = entry.toolName ? ` tool=${entry.toolName}` : '';
    const errorInfo = entry.error ? ` error=${entry.error}` : '';

    console.log(`${this.prefix} ${timestamp} ${entry.event}${toolInfo}${errorInfo}`);

    if (entry.toolInput) {
      console.log(`${this.prefix}   input:`, JSON.stringify(entry.toolInput, null, 2));
    }
  }

  async flush(): Promise<void> {
    // Console logger doesn't need flushing
  }
}

/**
 * File audit logger
 */
export class FileAuditLogger implements AuditLogger {
  private filePath: string;
  private buffer: AuditLogEntry[] = [];
  private bufferSize: number;

  constructor(filePath: string, bufferSize = 10) {
    this.filePath = filePath;
    this.bufferSize = bufferSize;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const { appendFile } = await import('node:fs/promises');
    const lines = this.buffer.map((e) => JSON.stringify(e)).join('\n') + '\n';

    await appendFile(this.filePath, lines);
    this.buffer = [];
  }
}

/**
 * Create audit logging hooks
 */
export function createAuditHooks(logger: AuditLogger = new ConsoleAuditLogger()): Partial<
  Record<HookEvent, HookCallback[]>
> {
  const createLogHook = (event: HookEvent) => ({
    hooks: [
      async (input: HookInput): Promise<HookResult> => {
        await logger.log({
          timestamp: new Date(),
          event,
          toolName: input.tool_name,
          toolInput: input.tool_input,
          toolResponse: input.tool_response,
          sessionId: input.session_id,
          error: input.error,
        });
        return { continue: true };
      },
    ],
  });

  return {
    PreToolUse: [createLogHook('PreToolUse')],
    PostToolUse: [createLogHook('PostToolUse')],
    PostToolUseFailure: [createLogHook('PostToolUseFailure')],
    SessionStart: [createLogHook('SessionStart')],
    SessionEnd: [createLogHook('SessionEnd')],
  };
}

// ============================================================================
// Cost Tracking Hooks
// ============================================================================

/**
 * Cost tracker for monitoring spending
 */
export interface CostTracker {
  /** Current total cost in USD */
  totalCostUsd: number;
  /** Cost per model */
  costByModel: Record<string, number>;
  /** Tool execution counts */
  toolCounts: Record<string, number>;
  /** Start time */
  startTime: Date;
  /** Number of API calls */
  apiCalls: number;
}

/**
 * Cost tracking callback
 */
export type CostCallback = (tracker: CostTracker) => void | Promise<void>;

/**
 * Create a cost tracker
 */
export function createCostTracker(): CostTracker {
  return {
    totalCostUsd: 0,
    costByModel: {},
    toolCounts: {},
    startTime: new Date(),
    apiCalls: 0,
  };
}

/**
 * Create cost tracking hooks
 */
export function createCostTrackingHooks(
  tracker: CostTracker,
  callbacks?: {
    onToolUse?: CostCallback;
    onBudgetWarning?: CostCallback;
    budgetWarningThreshold?: number;
  }
): Partial<Record<HookEvent, HookCallback[]>> {
  const budgetWarningThreshold = callbacks?.budgetWarningThreshold || 1.0; // $1 default warning

  return {
    PreToolUse: [
      {
        hooks: [
          async (input: HookInput): Promise<HookResult> => {
            if (input.tool_name) {
              tracker.toolCounts[input.tool_name] = (tracker.toolCounts[input.tool_name] || 0) + 1;
            }
            return { continue: true };
          },
        ],
      },
    ],
    PostToolUse: [
      {
        hooks: [
          async (_input: HookInput): Promise<HookResult> => {
            tracker.apiCalls++;

            if (callbacks?.onToolUse) {
              await callbacks.onToolUse(tracker);
            }

            // Check budget warning
            if (tracker.totalCostUsd >= budgetWarningThreshold && callbacks?.onBudgetWarning) {
              await callbacks.onBudgetWarning(tracker);
            }

            return { continue: true };
          },
        ],
      },
    ],
  };
}

// ============================================================================
// Approval Workflow Hooks
// ============================================================================

/**
 * Approval request
 */
export interface ApprovalRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
  reason?: string;
}

/**
 * Approval handler
 */
export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

/**
 * Create approval workflow hooks
 */
export function createApprovalHooks(
  approvalHandler: ApprovalHandler,
  toolsRequiringApproval: string[] = ['Bash', 'Write', 'Edit']
): Partial<Record<HookEvent, HookCallback[]>> {
  return {
    PreToolUse: [
      {
        matcher: toolsRequiringApproval.join('|'),
        hooks: [
          async (input: HookInput): Promise<HookResult> => {
            if (!input.tool_name || !toolsRequiringApproval.includes(input.tool_name)) {
              return { continue: true };
            }

            const approved = await approvalHandler({
              toolName: input.tool_name,
              toolInput: input.tool_input || {},
            });

            if (!approved) {
              return {
                continue: false,
                message: `Tool ${input.tool_name} was not approved`,
              };
            }

            return { continue: true };
          },
        ],
      },
    ],
  };
}

// ============================================================================
// File Change Monitoring Hooks
// ============================================================================

/**
 * File change record
 */
export interface FileChange {
  timestamp: Date;
  operation: 'read' | 'write' | 'edit';
  filePath: string;
  toolInput?: Record<string, unknown>;
}

/**
 * File change callback
 */
export type FileChangeCallback = (change: FileChange) => void | Promise<void>;

/**
 * Create file monitoring hooks
 */
export function createFileMonitoringHooks(callback: FileChangeCallback): Partial<
  Record<HookEvent, HookCallback[]>
> {
  const fileTools = ['Read', 'Write', 'Edit'];

  return {
    PostToolUse: [
      {
        matcher: fileTools.join('|'),
        hooks: [
          async (input: HookInput): Promise<HookResult> => {
            if (!input.tool_name || !fileTools.includes(input.tool_name)) {
              return { continue: true };
            }

            const filePath = (input.tool_input?.['file_path'] as string) || 'unknown';
            const operation = input.tool_name.toLowerCase() as 'read' | 'write' | 'edit';

            await callback({
              timestamp: new Date(),
              operation,
              filePath,
              toolInput: input.tool_input,
            });

            return { continue: true };
          },
        ],
      },
    ],
  };
}

// ============================================================================
// Security Enforcement
// ============================================================================

/**
 * Security policy for tool execution
 */
export interface SecurityPolicy {
  /** Blocked file patterns (glob) */
  blockedPaths?: string[];
  /** Blocked commands (regex) */
  blockedCommands?: string[];
  /** Allowed working directories */
  allowedDirectories?: string[];
  /** Maximum file size for writes (bytes) */
  maxFileSize?: number;
  /** Block network access */
  blockNetwork?: boolean;
}

/**
 * Create a security-enforcing permission handler
 */
export function createSecurityPermissionHandler(policy: SecurityPolicy): ToolPermissionHandler {
  return async (toolName: string, input: Record<string, unknown>): Promise<ToolPermissionResult> => {
    // Check file path restrictions
    if (['Read', 'Write', 'Edit'].includes(toolName)) {
      const filePath = input['file_path'] as string;

      if (policy.blockedPaths) {
        for (const pattern of policy.blockedPaths) {
          if (matchesPattern(filePath, pattern)) {
            return {
              behavior: 'deny',
              message: `Access to ${filePath} is blocked by security policy`,
            };
          }
        }
      }

      if (policy.allowedDirectories) {
        const allowed = policy.allowedDirectories.some((dir) => filePath.startsWith(dir));
        if (!allowed) {
          return {
            behavior: 'deny',
            message: `Access to ${filePath} is outside allowed directories`,
          };
        }
      }
    }

    // Check command restrictions
    if (toolName === 'Bash') {
      const command = input['command'] as string;

      if (policy.blockedCommands) {
        for (const pattern of policy.blockedCommands) {
          if (new RegExp(pattern).test(command)) {
            return {
              behavior: 'deny',
              message: `Command blocked by security policy: ${pattern}`,
            };
          }
        }
      }
    }

    // Check network restrictions
    if (policy.blockNetwork && ['WebSearch', 'WebFetch'].includes(toolName)) {
      return {
        behavior: 'deny',
        message: 'Network access is blocked by security policy',
      };
    }

    return { behavior: 'allow' };
  };
}

/**
 * Simple glob pattern matching
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regex = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\//g, '\\/');

  return new RegExp(`^${regex}$`).test(path);
}

// ============================================================================
// Preset Hook Configurations
// ============================================================================

/**
 * Preset hook configurations for common use cases
 */
export const PresetHooks = {
  /**
   * Development mode - permissive with logging
   */
  development: (logger?: AuditLogger) => ({
    ...createAuditHooks(logger || new ConsoleAuditLogger()),
  }),

  /**
   * Production mode - strict with approval and monitoring
   */
  production: (approvalHandler: ApprovalHandler, logger?: AuditLogger) => {
    const hooks: Partial<Record<HookEvent, HookCallback[]>> = {};

    // Merge audit hooks
    const auditHooks = createAuditHooks(logger || new FileAuditLogger('./agent-audit.log'));
    for (const [event, callbacks] of Object.entries(auditHooks)) {
      hooks[event as HookEvent] = callbacks;
    }

    // Merge approval hooks
    const approval = createApprovalHooks(approvalHandler);
    for (const [event, callbacks] of Object.entries(approval)) {
      const existing = hooks[event as HookEvent] || [];
      hooks[event as HookEvent] = [...existing, ...callbacks];
    }

    return hooks;
  },

  /**
   * CI/CD mode - automated with cost tracking
   */
  cicd: (costTracker: CostTracker, maxBudget = 5.0) => {
    const hooks: Partial<Record<HookEvent, HookCallback[]>> = {};

    // Cost tracking
    const costHooks = createCostTrackingHooks(costTracker, {
      budgetWarningThreshold: maxBudget * 0.8,
      onBudgetWarning: async (tracker) => {
        console.warn(
          `[CI/CD] Budget warning: $${tracker.totalCostUsd.toFixed(2)} / $${maxBudget.toFixed(2)}`
        );
      },
    });

    for (const [event, callbacks] of Object.entries(costHooks)) {
      hooks[event as HookEvent] = callbacks;
    }

    return hooks;
  },

  /**
   * Secure mode - strict security with file monitoring
   */
  secure: (policy: SecurityPolicy, fileChangeCallback?: FileChangeCallback) => {
    const hooks: Partial<Record<HookEvent, HookCallback[]>> = {};

    // File monitoring
    if (fileChangeCallback) {
      const fileHooks = createFileMonitoringHooks(fileChangeCallback);
      for (const [event, callbacks] of Object.entries(fileHooks)) {
        hooks[event as HookEvent] = callbacks;
      }
    }

    return {
      hooks,
      canUseTool: createSecurityPermissionHandler(policy),
    };
  },
};

// ============================================================================
// Utility: Merge Multiple Hook Configurations
// ============================================================================

/**
 * Merge multiple hook configurations
 */
export function mergeHooks(
  ...hookConfigs: Array<Partial<Record<HookEvent, HookCallback[]>>>
): Partial<Record<HookEvent, HookCallback[]>> {
  const merged: Partial<Record<HookEvent, HookCallback[]>> = {};

  for (const config of hookConfigs) {
    for (const [event, callbacks] of Object.entries(config)) {
      const existing = merged[event as HookEvent] || [];
      merged[event as HookEvent] = [...existing, ...(callbacks || [])];
    }
  }

  return merged;
}
