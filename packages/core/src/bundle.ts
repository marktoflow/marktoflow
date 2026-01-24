/**
 * Workflow bundle support for marktoflow.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, extname, basename } from 'node:path';
import { parse } from 'yaml';
import { parseFile } from './parser.js';
import { Workflow, ToolConfig } from './models.js';
import { ScriptTool } from './script-tool.js';
import { ToolRegistry } from './tool-registry.js';
import { Tool, ToolDefinition, ToolImplementation, ToolType } from './tool-base.js';

export interface BundleConfig {
  agent: string;
  fallbackAgent?: string | undefined;
  timeout: number;
  maxRetries: number;
  toolsDir: string;
  inheritGlobalTools: boolean;
  env: Record<string, string>;
}

export function loadBundleConfig(path: string): BundleConfig {
  if (!existsSync(path)) {
    return {
      agent: 'opencode',
      timeout: 300,
      maxRetries: 3,
      toolsDir: 'tools',
      inheritGlobalTools: true,
      env: {},
    };
  }
  const content = readFileSync(path, 'utf8');
  const data = (parse(content) as Record<string, any>) ?? {};
  return {
    agent: data.agent ?? 'opencode',
    fallbackAgent: data.fallback_agent ?? undefined,
    timeout: data.timeout ?? 300,
    maxRetries: data.max_retries ?? 3,
    toolsDir: data.tools_dir ?? 'tools',
    inheritGlobalTools: data.inherit_global_tools ?? true,
    env: data.env ?? {},
  };
}

class ScriptToolWrapper extends Tool {
  private scriptTool: ScriptTool;
  private operations: string[] = [];

  constructor(definition: ToolDefinition, implementation: ToolImplementation, toolsDir: string) {
    super(definition, implementation);
    this.scriptTool = new ScriptTool(implementation.adapterPath ?? '', toolsDir);
    this.operations = this.loadOperations(implementation.adapterPath ?? '', toolsDir);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  private loadOperations(scriptPath: string, toolsDir: string): string[] {
    const fullPath = resolve(toolsDir, scriptPath);
    const yamlPath = fullPath.replace(/\.[^/.]+$/, '') + '.yaml';
    if (existsSync(yamlPath)) {
      const content = readFileSync(yamlPath, 'utf8');
      const data = parse(content) as Record<string, any>;
      const ops = data?.operations ? Object.keys(data.operations) : [];
      return ops.length > 0 ? ops : ['run'];
    }
    return ['run'];
  }

  async execute(operation: string, params: Record<string, unknown>): Promise<unknown> {
    return this.scriptTool.execute(operation, params as Record<string, any>);
  }

  listOperations(): string[] {
    return this.operations;
  }

  getOperationSchema(_operation: string): Record<string, unknown> {
    return { description: '', parameters: { type: 'object', properties: {}, required: [] } };
  }
}

export class BundleToolRegistry extends ToolRegistry {
  private scriptTools = new Map<string, Tool>();
  private bundleDir: string;
  private toolsDir: string;

  constructor(bundleDir: string, toolsDir: string = 'tools', inheritGlobal: boolean = true, globalRegistryPath?: string) {
    super(inheritGlobal ? globalRegistryPath : undefined);
    this.bundleDir = resolve(bundleDir);
    this.toolsDir = resolve(this.bundleDir, toolsDir);
    this.loadScriptTools();
  }

  private loadScriptTools(): void {
    if (!existsSync(this.toolsDir)) return;
    const entries = readdirSync(this.toolsDir);
    for (const entry of entries) {
      const ext = extname(entry);
      if (ext === '.yaml' || ext === '.yml') continue;
      const toolName = basename(entry, ext);
      const implementation: ToolImplementation = {
        type: ToolType.CUSTOM,
        priority: 0,
        adapterPath: join(this.toolsDir, entry),
      };
      const definition: ToolDefinition = {
        name: toolName,
        description: `Script tool ${toolName}`,
        implementations: [implementation],
      };
      const tool = new ScriptToolWrapper(definition, implementation, this.toolsDir);
      this.scriptTools.set(toolName, tool);
      this.register(definition);
    }
  }

  getTool(name: string, agent: string): Tool | null {
    if (this.scriptTools.has(name)) {
      return this.scriptTools.get(name) ?? null;
    }
    return super.getTool(name, agent);
  }

  listTools(): string[] {
    const tools = new Set(super.listTools());
    for (const name of this.scriptTools.keys()) tools.add(name);
    return Array.from(tools).sort();
  }

  listScriptTools(): string[] {
    return Array.from(this.scriptTools.keys());
  }

  getScriptToolPaths(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, tool] of this.scriptTools.entries()) {
      result[name] = tool.implementation.adapterPath ?? '';
    }
    return result;
  }
}

export class WorkflowBundle {
  public readonly path: string;
  private configCache?: BundleConfig;
  private workflowCache?: Workflow;
  private toolRegistryCache?: BundleToolRegistry;

  constructor(path: string, private globalRegistryPath?: string) {
    const resolved = resolve(path);
    if (!existsSync(resolved)) throw new Error(`Bundle directory not found: ${resolved}`);
    this.path = resolved;
  }

  get name(): string {
    return basename(this.path);
  }

  get config(): BundleConfig {
    if (!this.configCache) {
      this.configCache = loadBundleConfig(join(this.path, 'config.yaml'));
    }
    return this.configCache;
  }

  get workflowFile(): string | null {
    const candidates = ['workflow.md', 'main.md'];
    for (const candidate of candidates) {
      const full = join(this.path, candidate);
      if (existsSync(full)) return full;
    }
    const entries = readdirSync(this.path).filter((name) => name.endsWith('.md') && name !== 'README.md');
    if (entries.length === 1) return join(this.path, entries[0]);
    return null;
  }

  async loadWorkflow(): Promise<Workflow> {
    if (this.workflowCache) return this.workflowCache;
    const wfPath = this.workflowFile;
    if (!wfPath) throw new Error('No workflow markdown found in bundle');
    const { workflow } = await parseFile(wfPath);
    this.workflowCache = workflow;
    return workflow;
  }

  loadTools(): BundleToolRegistry {
    if (this.toolRegistryCache) return this.toolRegistryCache;
    this.toolRegistryCache = new BundleToolRegistry(
      this.path,
      this.config.toolsDir,
      this.config.inheritGlobalTools,
      this.globalRegistryPath
    );
    return this.toolRegistryCache;
  }

  buildToolConfigs(): Record<string, ToolConfig> {
    const registry = this.loadTools();
    const scriptToolPaths = registry.getScriptToolPaths();
    const configs: Record<string, ToolConfig> = {};

    for (const [toolName, scriptPath] of Object.entries(scriptToolPaths)) {
      if (!scriptPath) continue;
      configs[toolName] = {
        sdk: 'script',
        options: {
          path: scriptPath,
          toolsDir: join(this.path, this.config.toolsDir),
        },
      };
    }

    return configs;
  }

  async loadWorkflowWithBundleTools(): Promise<Workflow> {
    const workflow = await this.loadWorkflow();
    const bundleTools = this.buildToolConfigs();

    return {
      ...workflow,
      tools: {
        ...(workflow.tools ?? {}),
        ...bundleTools,
      },
    };
  }
}
