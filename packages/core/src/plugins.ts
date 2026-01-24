/**
 * Plugin system for marktoflow.
 *
 * Provides hook registry and plugin lifecycle management.
 */

export enum PluginState {
  DISCOVERED = 'discovered',
  LOADED = 'loaded',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
}

export enum HookType {
  WORKFLOW_BEFORE_START = 'workflow_before_start',
  WORKFLOW_AFTER_START = 'workflow_after_start',
  WORKFLOW_BEFORE_END = 'workflow_before_end',
  WORKFLOW_AFTER_END = 'workflow_after_end',
  WORKFLOW_ON_ERROR = 'workflow_on_error',
  STEP_BEFORE_EXECUTE = 'step_before_execute',
  STEP_AFTER_EXECUTE = 'step_after_execute',
  STEP_ON_RETRY = 'step_on_retry',
  STEP_ON_SKIP = 'step_on_skip',
  STEP_ON_ERROR = 'step_on_error',
  AGENT_BEFORE_SELECT = 'agent_before_select',
  AGENT_AFTER_SELECT = 'agent_after_select',
  AGENT_ON_FAILOVER = 'agent_on_failover',
  TOOL_BEFORE_CALL = 'tool_before_call',
  TOOL_AFTER_CALL = 'tool_after_call',
  TOOL_ON_ERROR = 'tool_on_error',
  CUSTOM = 'custom',
}

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string | undefined;
  author?: string | undefined;
  homepage?: string | undefined;
  license?: string | undefined;
  requires?: string[];
  tags?: string[];
}

export interface HookContext {
  hookType: HookType;
  workflowId?: string | undefined;
  stepIndex?: number | undefined;
  stepName?: string | undefined;
  agentName?: string | undefined;
  toolName?: string | undefined;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface HookResult {
  success: boolean;
  modifiedData?: Record<string, unknown> | undefined;
  stopPropagation?: boolean | undefined;
  error?: string | undefined;
}

export type HookCallback = (context: HookContext) => HookResult | void | Promise<HookResult | void>;

export interface Plugin {
  metadata: PluginMetadata;
  onLoad?(): void;
  onEnable?(): void;
  onDisable?(): void;
  onUnload?(): void;
  getHooks?(): Record<string, HookCallback[]>;
  getTools?(): unknown[];
  getTemplates?(): unknown[];
  getConfigSchema?(): Record<string, unknown> | null;
  configure?(config: Record<string, unknown>): void;
}

export interface PluginInfo {
  plugin: Plugin;
  source: string;
  state: PluginState;
  loadedAt: Date;
  error?: string | undefined;
}

export class HookRegistry {
  private hooks = new Map<HookType, HookCallback[]>();

  register(hook: HookType, callback: HookCallback): void {
    if (!this.hooks.has(hook)) {
      this.hooks.set(hook, []);
    }
    this.hooks.get(hook)!.push(callback);
  }

  unregister(hook: HookType, callback: HookCallback): void {
    const list = this.hooks.get(hook);
    if (!list) return;
    this.hooks.set(
      hook,
      list.filter((cb) => cb !== callback)
    );
  }

  async run(hook: HookType, context: HookContext): Promise<HookResult[]> {
    const callbacks = this.hooks.get(hook) ?? [];
    const results: HookResult[] = [];

    for (const cb of callbacks) {
      try {
        const result = await cb(context);
        if (result) {
          results.push(result);
          if (result.stopPropagation) break;
        }
      } catch (error) {
        results.push({ success: false, error: String(error) });
      }
    }

    return results;
  }
}

export class PluginManager {
  private plugins = new Map<string, PluginInfo>();
  private hookRegistry = new HookRegistry();

  register(plugin: Plugin, source: string = 'manual'): PluginInfo {
    const info: PluginInfo = {
      plugin,
      source,
      state: PluginState.DISCOVERED,
      loadedAt: new Date(),
    };
    this.plugins.set(plugin.metadata.name, info);
    return info;
  }

  enable(name: string): boolean {
    const info = this.plugins.get(name);
    if (!info) return false;
    try {
      if (info.state === PluginState.DISCOVERED) {
        info.plugin.onLoad?.();
        info.state = PluginState.LOADED;
      }
      info.plugin.onEnable?.();
      info.state = PluginState.ENABLED;

      const hooks = info.plugin.getHooks?.() ?? {};
      for (const [hookName, callbacks] of Object.entries(hooks)) {
        const hookType = hookName as HookType;
        for (const cb of callbacks) {
          this.hookRegistry.register(hookType, cb);
        }
      }
      return true;
    } catch (error) {
      info.state = PluginState.ERROR;
      info.error = String(error);
      return false;
    }
  }

  disable(name: string): boolean {
    const info = this.plugins.get(name);
    if (!info) return false;
    try {
      info.plugin.onDisable?.();
      info.state = PluginState.DISABLED;
      return true;
    } catch (error) {
      info.state = PluginState.ERROR;
      info.error = String(error);
      return false;
    }
  }

  unload(name: string): boolean {
    const info = this.plugins.get(name);
    if (!info) return false;
    try {
      info.plugin.onUnload?.();
      this.plugins.delete(name);
      return true;
    } catch (error) {
      info.state = PluginState.ERROR;
      info.error = String(error);
      return false;
    }
  }

  list(): PluginInfo[] {
    return Array.from(this.plugins.values());
  }

  get(name: string): PluginInfo | undefined {
    return this.plugins.get(name);
  }

  hooks(): HookRegistry {
    return this.hookRegistry;
  }
}

export class LoggingPlugin implements Plugin {
  metadata: PluginMetadata = {
    name: 'logging',
    version: '1.0.0',
    description: 'Logs hook events',
  };

  getHooks(): Record<string, HookCallback[]> {
    return {
      [HookType.WORKFLOW_BEFORE_START]: [
        (ctx) => {
          console.log(`[workflow:start] ${ctx.workflowId ?? ''}`.trim());
        },
      ],
    };
  }
}

export class MetricsPlugin implements Plugin {
  metadata: PluginMetadata = {
    name: 'metrics',
    version: '1.0.0',
    description: 'Collects basic metrics for hooks',
  };

  private counts: Record<string, number> = {};

  getHooks(): Record<string, HookCallback[]> {
    return {
      [HookType.STEP_AFTER_EXECUTE]: [
        () => {
          this.counts.stepAfterExecute = (this.counts.stepAfterExecute ?? 0) + 1;
        },
      ],
    };
  }

  getMetrics(): Record<string, number> {
    return { ...this.counts };
  }
}
