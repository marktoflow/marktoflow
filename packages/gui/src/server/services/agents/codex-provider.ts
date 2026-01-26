/**
 * OpenAI Codex AI agent provider
 * Uses the @openai/codex-sdk for AI capabilities
 */

import { parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

// Dynamic import types for Codex SDK
interface CodexSDK {
  Codex: new (options?: CodexOptions) => CodexInstance;
}

interface CodexOptions {
  codexPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  env?: Record<string, string>;
}

interface ThreadOptions {
  model?: string;
  sandboxMode?: 'read-only' | 'workspace-write' | 'danger-full-access';
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  modelReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  networkAccessEnabled?: boolean;
  webSearchMode?: 'disabled' | 'cached' | 'live';
  approvalPolicy?: 'never' | 'on-request' | 'on-failure' | 'untrusted';
  additionalDirectories?: string[];
}

interface ThreadItem {
  id: string;
  type: string;
  text?: string;
  command?: string;
  aggregated_output?: string;
  status?: string;
  changes?: unknown[];
}

interface Usage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

interface TurnResult {
  items: ThreadItem[];
  finalResponse: string;
  usage: Usage | null;
}

interface ThreadEvent {
  type: string;
  thread_id?: string;
  item?: ThreadItem;
  usage?: Usage;
  message?: string;
  error?: { message: string };
}

interface StreamedTurnResult {
  events: AsyncGenerator<ThreadEvent>;
}

interface Thread {
  id: string | null;
  run(input: string, options?: unknown): Promise<TurnResult>;
  runStreamed(input: string, options?: unknown): Promise<StreamedTurnResult>;
}

interface CodexInstance {
  startThread(options?: ThreadOptions): Thread;
  resumeThread(id: string, options?: ThreadOptions): Thread;
}

export class CodexProvider implements AgentProvider {
  readonly id = 'codex';
  readonly name = 'OpenAI Codex';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: true,
    systemPrompts: true,
    models: [
      'codex-1',
      'o3',
      'o3-mini',
      'o4-mini',
      'gpt-4.1',
    ],
  };

  private codex: CodexInstance | null = null;
  private model: string = 'codex-1';
  private ready: boolean = false;
  private error: string | undefined;
  private workingDirectory: string = process.cwd();
  private lastThreadId: string | null = null;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Try to import the Codex SDK (dynamic import with webpackIgnore to avoid bundling issues)
      const sdkModule = (await import(
        /* webpackIgnore: true */ '@openai/codex-sdk'
      ).catch(() => null)) as CodexSDK | null;

      if (!sdkModule || !sdkModule.Codex) {
        this.ready = false;
        this.error = 'OpenAI Codex SDK not installed. Run: npm install @openai/codex-sdk';
        return;
      }

      const { Codex } = sdkModule;

      const codexOptions: CodexOptions = {};

      // API key from config or environment
      if (config.apiKey) {
        codexOptions.apiKey = config.apiKey;
      } else if (process.env.OPENAI_API_KEY) {
        codexOptions.apiKey = process.env.OPENAI_API_KEY;
      }

      // Base URL
      if (config.baseUrl) {
        codexOptions.baseUrl = config.baseUrl;
      }

      // Codex path override
      if (config.options?.codexPath) {
        codexOptions.codexPathOverride = config.options.codexPath as string;
      }

      // Environment variables
      if (config.options?.env) {
        codexOptions.env = config.options.env as Record<string, string>;
      }

      this.codex = new Codex(codexOptions);

      if (config.model) {
        this.model = config.model;
      }

      // Working directory
      if (config.options?.workingDirectory) {
        this.workingDirectory = config.options.workingDirectory as string;
      } else if (config.options?.cwd) {
        this.workingDirectory = config.options.cwd as string;
      }

      // Test connectivity by starting a simple thread
      try {
        const thread = this.codex.startThread({
          skipGitRepoCheck: true,
          sandboxMode: 'read-only',
          workingDirectory: this.workingDirectory,
        });
        // Just verify it can be created
        if (thread) {
          this.ready = true;
          this.error = undefined;
        }
      } catch (testError) {
        this.ready = false;
        this.error = `Cannot initialize Codex: ${testError instanceof Error ? testError.message : 'Unknown error'}`;
      }
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing Codex';
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { ready: boolean; model?: string; error?: string } {
    return {
      ready: this.ready,
      model: this.model,
      error: this.error,
    };
  }

  async processPrompt(
    prompt: string,
    workflow: Workflow,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.codex || !this.ready) {
      return {
        explanation: 'OpenAI Codex provider not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      // Build context-aware prompts
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      // Combine system and user prompts for Codex
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

      const thread = this.codex.startThread({
        model: this.model,
        skipGitRepoCheck: true,
        sandboxMode: 'read-only', // Safe for workflow modifications
        workingDirectory: this.workingDirectory,
        modelReasoningEffort: 'medium',
      });

      const result = await thread.run(fullPrompt);
      this.lastThreadId = thread.id;

      // Extract the response text
      const responseText = result.finalResponse ||
        result.items.find((item) => item.type === 'agent_message')?.text || '';

      return this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    return generateSuggestions(workflow, selectedStepId);
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.codex || !this.ready) {
      return this.processPrompt(prompt, workflow, context);
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
    let fullResponse = '';

    try {
      const thread = this.codex.startThread({
        model: this.model,
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        workingDirectory: this.workingDirectory,
        modelReasoningEffort: 'medium',
      });

      const streamResult = await thread.runStreamed(fullPrompt);

      for await (const event of streamResult.events) {
        if (event.type === 'thread.started') {
          this.lastThreadId = event.thread_id || null;
        } else if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
          const text = event.item.text || '';
          fullResponse = text;
          onChunk(text);
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Stream error');
        } else if (event.type === 'turn.failed') {
          throw new Error(event.error?.message || 'Turn failed');
        }
      }

      return this.parseAIResponse(fullResponse, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async cancel(): Promise<void> {
    // Codex SDK doesn't have explicit cancellation, but we can reset state
    this.lastThreadId = null;
  }

  /**
   * Get the last thread ID for resumption
   */
  getLastThreadId(): string | null {
    return this.lastThreadId;
  }

  /**
   * Resume a previous thread
   */
  async resumePrompt(
    threadId: string,
    prompt: string,
    workflow: Workflow,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.codex || !this.ready) {
      return {
        explanation: 'OpenAI Codex provider not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

      const thread = this.codex.resumeThread(threadId, {
        model: this.model,
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        workingDirectory: this.workingDirectory,
      });

      const result = await thread.run(fullPrompt);
      this.lastThreadId = thread.id;

      const responseText = result.finalResponse ||
        result.items.find((item) => item.type === 'agent_message')?.text || '';

      return this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private parseAIResponse(responseText: string, originalWorkflow: Workflow): PromptResult {
    const yamlMatch = responseText.match(/```yaml\n([\s\S]*?)\n```/);
    let modifiedWorkflow: Workflow | undefined;
    let explanation = responseText;

    if (yamlMatch) {
      try {
        const parsedYaml = yamlParse(yamlMatch[1]);
        if (parsedYaml && (parsedYaml.steps || parsedYaml.metadata)) {
          modifiedWorkflow = parsedYaml as Workflow;
          const explanationMatch = responseText.match(/^([\s\S]*?)```yaml/);
          if (explanationMatch) {
            explanation = explanationMatch[1].trim();
          }
        }
      } catch {
        // Failed to parse YAML
      }
    }

    let diff: string | undefined;
    if (modifiedWorkflow) {
      diff = this.generateDiff(originalWorkflow, modifiedWorkflow);
    }

    return { explanation, workflow: modifiedWorkflow, diff };
  }

  private generateDiff(original: Workflow, modified: Workflow): string {
    const originalStepIds = new Set(original.steps?.map((s) => s.id) || []);
    const modifiedStepIds = new Set(modified.steps?.map((s) => s.id) || []);

    const added = modified.steps?.filter((s) => !originalStepIds.has(s.id)) || [];
    const removed = original.steps?.filter((s) => !modifiedStepIds.has(s.id)) || [];

    let diff = '';
    if (added.length > 0) {
      diff += `+ Added ${added.length} step(s): ${added.map((s) => s.name || s.id).join(', ')}\n`;
    }
    if (removed.length > 0) {
      diff += `- Removed ${removed.length} step(s): ${removed.map((s) => s.name || s.id).join(', ')}\n`;
    }

    return diff || 'No structural changes detected';
  }
}

export function createCodexProvider(config?: AgentConfig): CodexProvider {
  const provider = new CodexProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
