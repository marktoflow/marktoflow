import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ConsoleAuditLogger,
  FileAuditLogger,
  createAuditHooks,
  createCostTracker,
  createCostTrackingHooks,
  createApprovalHooks,
  createFileMonitoringHooks,
  createSecurityPermissionHandler,
  PresetHooks,
  mergeHooks,
  AuditLogEntry,
  AuditLogger,
  CostTracker,
  FileChange,
  SecurityPolicy,
} from '../src/adapters/claude-agent-hooks.js';
import { HookEvent, HookInput } from '../src/adapters/claude-agent-types.js';

describe('Claude Agent Hooks', () => {
  describe('AuditLoggers', () => {
    describe('ConsoleAuditLogger', () => {
      it('should create logger with default prefix', () => {
        const logger = new ConsoleAuditLogger();
        expect(logger).toBeInstanceOf(ConsoleAuditLogger);
      });

      it('should create logger with custom prefix', () => {
        const logger = new ConsoleAuditLogger('[Custom]');
        expect(logger).toBeInstanceOf(ConsoleAuditLogger);
      });

      it('should log entries to console', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const logger = new ConsoleAuditLogger('[Test]');
        await logger.log({
          timestamp: new Date('2024-01-01'),
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/test.ts' },
        });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('should flush without error', async () => {
        const logger = new ConsoleAuditLogger();
        await expect(logger.flush()).resolves.not.toThrow();
      });
    });

    describe('FileAuditLogger', () => {
      it('should create logger with file path', () => {
        const logger = new FileAuditLogger('./audit.log');
        expect(logger).toBeInstanceOf(FileAuditLogger);
      });

      it('should create logger with custom buffer size', () => {
        const logger = new FileAuditLogger('./audit.log', 5);
        expect(logger).toBeInstanceOf(FileAuditLogger);
      });

      it('should buffer entries before flushing', async () => {
        const logger = new FileAuditLogger('./audit.log', 10);

        // Log an entry (won't flush yet due to buffer)
        await logger.log({
          timestamp: new Date(),
          event: 'PreToolUse',
          toolName: 'Read',
        });

        // Logger should still be valid
        expect(logger).toBeInstanceOf(FileAuditLogger);
      });
    });
  });

  describe('createAuditHooks', () => {
    it('should create hooks for all audit events', () => {
      const hooks = createAuditHooks();

      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();
      expect(hooks.PostToolUseFailure).toBeDefined();
      expect(hooks.SessionStart).toBeDefined();
      expect(hooks.SessionEnd).toBeDefined();
    });

    it('should create hooks with custom logger', () => {
      const customLogger: AuditLogger = {
        log: vi.fn(),
        flush: vi.fn(),
      };

      const hooks = createAuditHooks(customLogger);

      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PreToolUse![0].hooks).toHaveLength(1);
    });

    it('should call logger on hook execution', async () => {
      const customLogger: AuditLogger = {
        log: vi.fn(),
        flush: vi.fn(),
      };

      const hooks = createAuditHooks(customLogger);
      const hookFn = hooks.PreToolUse![0].hooks[0];

      const input: HookInput = {
        tool_name: 'Read',
        tool_input: { file_path: '/test.ts' },
        session_id: 'sess_123',
      };

      const result = await hookFn(input);

      expect(customLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'PreToolUse',
          toolName: 'Read',
          toolInput: { file_path: '/test.ts' },
          sessionId: 'sess_123',
        })
      );
      expect(result.continue).toBe(true);
    });
  });

  describe('Cost Tracking', () => {
    describe('createCostTracker', () => {
      it('should create tracker with initial values', () => {
        const tracker = createCostTracker();

        expect(tracker.totalCostUsd).toBe(0);
        expect(tracker.costByModel).toEqual({});
        expect(tracker.toolCounts).toEqual({});
        expect(tracker.apiCalls).toBe(0);
        expect(tracker.startTime).toBeInstanceOf(Date);
      });
    });

    describe('createCostTrackingHooks', () => {
      it('should create PreToolUse and PostToolUse hooks', () => {
        const tracker = createCostTracker();
        const hooks = createCostTrackingHooks(tracker);

        expect(hooks.PreToolUse).toBeDefined();
        expect(hooks.PostToolUse).toBeDefined();
      });

      it('should increment tool counts on PreToolUse', async () => {
        const tracker = createCostTracker();
        const hooks = createCostTrackingHooks(tracker);
        const hookFn = hooks.PreToolUse![0].hooks[0];

        await hookFn({ tool_name: 'Read' });
        await hookFn({ tool_name: 'Read' });
        await hookFn({ tool_name: 'Grep' });

        expect(tracker.toolCounts['Read']).toBe(2);
        expect(tracker.toolCounts['Grep']).toBe(1);
      });

      it('should increment API calls on PostToolUse', async () => {
        const tracker = createCostTracker();
        const hooks = createCostTrackingHooks(tracker);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({});
        await hookFn({});

        expect(tracker.apiCalls).toBe(2);
      });

      it('should call onToolUse callback', async () => {
        const tracker = createCostTracker();
        const onToolUse = vi.fn();
        const hooks = createCostTrackingHooks(tracker, { onToolUse });
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({});

        expect(onToolUse).toHaveBeenCalledWith(tracker);
      });

      it('should call onBudgetWarning when threshold exceeded', async () => {
        const tracker = createCostTracker();
        tracker.totalCostUsd = 1.5; // Set cost above default threshold

        const onBudgetWarning = vi.fn();
        const hooks = createCostTrackingHooks(tracker, {
          onBudgetWarning,
          budgetWarningThreshold: 1.0,
        });
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({});

        expect(onBudgetWarning).toHaveBeenCalledWith(tracker);
      });

      it('should not call onBudgetWarning below threshold', async () => {
        const tracker = createCostTracker();
        tracker.totalCostUsd = 0.5; // Below threshold

        const onBudgetWarning = vi.fn();
        const hooks = createCostTrackingHooks(tracker, {
          onBudgetWarning,
          budgetWarningThreshold: 1.0,
        });
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({});

        expect(onBudgetWarning).not.toHaveBeenCalled();
      });
    });
  });

  describe('Approval Workflows', () => {
    describe('createApprovalHooks', () => {
      it('should create PreToolUse hooks', () => {
        const handler = vi.fn().mockResolvedValue(true);
        const hooks = createApprovalHooks(handler);

        expect(hooks.PreToolUse).toBeDefined();
        expect(hooks.PreToolUse![0].matcher).toBe('Bash|Write|Edit');
      });

      it('should allow approved tools', async () => {
        const handler = vi.fn().mockResolvedValue(true);
        const hooks = createApprovalHooks(handler);
        const hookFn = hooks.PreToolUse![0].hooks[0];

        const result = await hookFn({
          tool_name: 'Bash',
          tool_input: { command: 'ls' },
        });

        expect(handler).toHaveBeenCalledWith({
          toolName: 'Bash',
          toolInput: { command: 'ls' },
        });
        expect(result.continue).toBe(true);
      });

      it('should deny unapproved tools', async () => {
        const handler = vi.fn().mockResolvedValue(false);
        const hooks = createApprovalHooks(handler);
        const hookFn = hooks.PreToolUse![0].hooks[0];

        const result = await hookFn({
          tool_name: 'Bash',
          tool_input: { command: 'rm -rf /' },
        });

        expect(result.continue).toBe(false);
        expect(result.message).toContain('not approved');
      });

      it('should skip approval for non-matching tools', async () => {
        const handler = vi.fn().mockResolvedValue(true);
        const hooks = createApprovalHooks(handler);
        const hookFn = hooks.PreToolUse![0].hooks[0];

        const result = await hookFn({
          tool_name: 'Read',
          tool_input: { file_path: '/test.ts' },
        });

        expect(handler).not.toHaveBeenCalled();
        expect(result.continue).toBe(true);
      });

      it('should use custom tool list', async () => {
        const handler = vi.fn().mockResolvedValue(true);
        const hooks = createApprovalHooks(handler, ['Bash', 'WebFetch']);

        expect(hooks.PreToolUse![0].matcher).toBe('Bash|WebFetch');
      });
    });
  });

  describe('File Monitoring', () => {
    describe('createFileMonitoringHooks', () => {
      it('should create PostToolUse hooks', () => {
        const callback = vi.fn();
        const hooks = createFileMonitoringHooks(callback);

        expect(hooks.PostToolUse).toBeDefined();
        expect(hooks.PostToolUse![0].matcher).toBe('Read|Write|Edit');
      });

      it('should call callback for file operations', async () => {
        const callback = vi.fn();
        const hooks = createFileMonitoringHooks(callback);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({
          tool_name: 'Write',
          tool_input: { file_path: '/new-file.ts' },
        });

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'write',
            filePath: '/new-file.ts',
          })
        );
      });

      it('should record read operations', async () => {
        const callback = vi.fn();
        const hooks = createFileMonitoringHooks(callback);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({
          tool_name: 'Read',
          tool_input: { file_path: '/existing.ts' },
        });

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'read',
          })
        );
      });

      it('should record edit operations', async () => {
        const callback = vi.fn();
        const hooks = createFileMonitoringHooks(callback);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({
          tool_name: 'Edit',
          tool_input: { file_path: '/modified.ts' },
        });

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'edit',
          })
        );
      });

      it('should skip non-file operations', async () => {
        const callback = vi.fn();
        const hooks = createFileMonitoringHooks(callback);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({
          tool_name: 'Bash',
          tool_input: { command: 'ls' },
        });

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });

  describe('Security Enforcement', () => {
    describe('createSecurityPermissionHandler', () => {
      it('should allow operations by default', async () => {
        const handler = createSecurityPermissionHandler({});
        const result = await handler('Read', { file_path: '/test.ts' });

        expect(result.behavior).toBe('allow');
      });

      it('should block operations matching blocked paths', async () => {
        const handler = createSecurityPermissionHandler({
          blockedPaths: ['*.env', '/secrets/*'],
        });

        const result = await handler('Read', { file_path: '.env' });
        expect(result.behavior).toBe('deny');
        expect(result.message).toContain('blocked by security policy');
      });

      it('should allow paths not in blocked list', async () => {
        const handler = createSecurityPermissionHandler({
          blockedPaths: ['*.env'],
        });

        const result = await handler('Read', { file_path: '/src/utils.ts' });
        expect(result.behavior).toBe('allow');
      });

      it('should enforce allowed directories', async () => {
        const handler = createSecurityPermissionHandler({
          allowedDirectories: ['/workspace', '/tmp'],
        });

        const allowed = await handler('Read', { file_path: '/workspace/code.ts' });
        expect(allowed.behavior).toBe('allow');

        const denied = await handler('Read', { file_path: '/etc/passwd' });
        expect(denied.behavior).toBe('deny');
        expect(denied.message).toContain('outside allowed directories');
      });

      it('should block dangerous commands', async () => {
        const handler = createSecurityPermissionHandler({
          blockedCommands: ['rm -rf', 'sudo', 'chmod'],
        });

        const result = await handler('Bash', { command: 'sudo rm -rf /' });
        expect(result.behavior).toBe('deny');
      });

      it('should allow safe commands', async () => {
        const handler = createSecurityPermissionHandler({
          blockedCommands: ['rm -rf', 'sudo'],
        });

        const result = await handler('Bash', { command: 'ls -la' });
        expect(result.behavior).toBe('allow');
      });

      it('should block network when configured', async () => {
        const handler = createSecurityPermissionHandler({
          blockNetwork: true,
        });

        const webSearch = await handler('WebSearch', { query: 'test' });
        expect(webSearch.behavior).toBe('deny');

        const webFetch = await handler('WebFetch', { url: 'http://example.com' });
        expect(webFetch.behavior).toBe('deny');
      });

      it('should allow network when not blocked', async () => {
        const handler = createSecurityPermissionHandler({
          blockNetwork: false,
        });

        const result = await handler('WebSearch', { query: 'test' });
        expect(result.behavior).toBe('allow');
      });
    });
  });

  describe('PresetHooks', () => {
    describe('development', () => {
      it('should create development hooks with audit logging', () => {
        const hooks = PresetHooks.development();

        expect(hooks.PreToolUse).toBeDefined();
        expect(hooks.PostToolUse).toBeDefined();
        expect(hooks.SessionStart).toBeDefined();
        expect(hooks.SessionEnd).toBeDefined();
      });

      it('should accept custom logger', () => {
        const customLogger: AuditLogger = {
          log: vi.fn(),
          flush: vi.fn(),
        };

        const hooks = PresetHooks.development(customLogger);
        expect(hooks.PreToolUse).toBeDefined();
      });
    });

    describe('production', () => {
      it('should create production hooks with approval workflow', () => {
        const approvalHandler = vi.fn().mockResolvedValue(true);
        const hooks = PresetHooks.production(approvalHandler);

        expect(hooks.PreToolUse).toBeDefined();
        expect(hooks.PostToolUse).toBeDefined();
        // Should have multiple hooks merged
        expect(hooks.PreToolUse!.length).toBeGreaterThan(0);
      });
    });

    describe('cicd', () => {
      it('should create CI/CD hooks with cost tracking', () => {
        const tracker = createCostTracker();
        const hooks = PresetHooks.cicd(tracker, 5.0);

        expect(hooks.PreToolUse).toBeDefined();
        expect(hooks.PostToolUse).toBeDefined();
      });

      it('should warn at 80% of budget', async () => {
        const tracker = createCostTracker();
        tracker.totalCostUsd = 4.5; // 90% of 5.0 budget

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hooks = PresetHooks.cicd(tracker, 5.0);
        const hookFn = hooks.PostToolUse![0].hooks[0];

        await hookFn({});

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('secure', () => {
      it('should create secure hooks with file monitoring', () => {
        const callback = vi.fn();
        const result = PresetHooks.secure({}, callback);

        expect(result.hooks).toBeDefined();
        expect(result.hooks.PostToolUse).toBeDefined();
      });

      it('should create security permission handler', () => {
        const policy: SecurityPolicy = {
          blockedPaths: ['*.env'],
          blockedCommands: ['rm -rf'],
        };

        const result = PresetHooks.secure(policy);

        expect(result.canUseTool).toBeDefined();
        expect(typeof result.canUseTool).toBe('function');
      });
    });
  });

  describe('mergeHooks', () => {
    it('should merge multiple hook configurations', () => {
      const hooks1 = { PreToolUse: [{ hooks: [vi.fn()] }] };
      const hooks2 = { PostToolUse: [{ hooks: [vi.fn()] }] };

      const merged = mergeHooks(hooks1, hooks2);

      expect(merged.PreToolUse).toBeDefined();
      expect(merged.PostToolUse).toBeDefined();
    });

    it('should combine hooks for same event', () => {
      const hook1 = vi.fn();
      const hook2 = vi.fn();

      const hooks1 = { PreToolUse: [{ hooks: [hook1] }] };
      const hooks2 = { PreToolUse: [{ hooks: [hook2] }] };

      const merged = mergeHooks(hooks1, hooks2);

      expect(merged.PreToolUse).toHaveLength(2);
    });

    it('should handle empty configurations', () => {
      const hooks1 = { PreToolUse: [{ hooks: [vi.fn()] }] };
      const hooks2 = {};

      const merged = mergeHooks(hooks1, hooks2);

      expect(merged.PreToolUse).toBeDefined();
      expect(merged.PreToolUse).toHaveLength(1);
    });
  });
});
