/**
 * Claude Code AI agent provider
 * Uses the @anthropic-ai/claude-agent-sdk for AI capabilities
 * Authentication is handled automatically by the SDK (via Claude CLI auth)
 */

import { createRequire } from 'node:module';
import { parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

// Polyfill require for ESM environments (needed by Claude SDK)
if (typeof globalThis.require === 'undefined') {
  (globalThis as unknown as { require: NodeRequire }).require = createRequire(import.meta.url);
}

// Dynamic import types for Claude Agent SDK
interface SDKMessage {
  type: string;
  message?: {
    content: string | Array<{ type: string; text?: string }>;
  };
  result?: string;
  error?: string;
  session_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface AgentQuery extends AsyncGenerator<SDKMessage, void, unknown> {
  interrupt(): Promise<void>;
}

// The SDK exports a query function directly
type QueryFunction = (params: { prompt: string; options?: Record<string, unknown> }) => AgentQuery;

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = 'claude-code';
  readonly name = 'Claude Code (SDK)';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: true,
    systemPrompts: true,
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-20241022'],
  };

  private queryFn: QueryFunction | null = null;
  private model: string = 'claude-sonnet-4-20250514';
  private ready: boolean = false;
  private error: string | undefined;
  private currentQuery: AgentQuery | null = null;
  private maxTurns: number = 50;
  private cwd?: string;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Try to import the Claude Agent SDK (dynamic import with webpackIgnore to avoid bundling issues)
      const sdkModule = await import(/* webpackIgnore: true */ '@anthropic-ai/claude-agent-sdk').catch(
        () => null
      );
      if (!sdkModule || !sdkModule.query) {
        this.ready = false;
        this.error = 'Claude Agent SDK not installed. Run: npm install @anthropic-ai/claude-agent-sdk';
        return;
      }

      this.queryFn = sdkModule.query as QueryFunction;

      if (config.model) {
        this.model = config.model;
      }
      if (config.options?.maxTurns) {
        this.maxTurns = config.options.maxTurns as number;
      }
      if (config.options?.cwd) {
        this.cwd = config.options.cwd as string;
      }

      // Test SDK availability - the SDK handles authentication automatically
      // via the Claude CLI's auth mechanism
      this.ready = true;
      this.error = undefined;
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing Claude Code';
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
    if (!this.queryFn || !this.ready) {
      return {
        explanation: 'Claude Code SDK not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      // Build context-aware prompts
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      // Combine system prompt and user prompt for the SDK
      const fullPrompt = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`;

      const response = await this.runQuery(fullPrompt);
      return this.parseAIResponse(response, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async runQuery(prompt: string): Promise<string> {
    if (!this.queryFn) {
      throw new Error('SDK not initialized');
    }

    const options: Record<string, unknown> = {
      model: this.model,
      maxTurns: this.maxTurns,
      // Restrict tools to read-only for safety in workflow editing context
      allowedTools: ['Read', 'Glob', 'Grep'],
    };

    if (this.cwd) {
      options.cwd = this.cwd;
    }

    this.currentQuery = this.queryFn({
      prompt,
      options,
    });

    let resultText = '';

    try {
      for await (const message of this.currentQuery) {
        if (message.type === 'result') {
          resultText = message.result || '';
          break;
        } else if (message.type === 'assistant' && message.message) {
          // Extract text from assistant messages
          const content = message.message.content;
          if (typeof content === 'string') {
            resultText = content;
          } else if (Array.isArray(content)) {
            resultText = content
              .filter((c) => c.type === 'text' && c.text)
              .map((c) => c.text)
              .join('\n');
          }
        }
      }
    } finally {
      this.currentQuery = null;
    }

    return resultText;
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.queryFn || !this.ready) {
      return this.processPrompt(prompt, workflow, context);
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`;
    let fullResponse = '';

    try {
      const options: Record<string, unknown> = {
        model: this.model,
        maxTurns: this.maxTurns,
        allowedTools: ['Read', 'Glob', 'Grep'],
      };

      if (this.cwd) {
        options.cwd = this.cwd;
      }

      this.currentQuery = this.queryFn({
        prompt: fullPrompt,
        options,
      });

      for await (const message of this.currentQuery) {
        if (message.type === 'assistant' && message.message) {
          const content = message.message.content;
          if (typeof content === 'string') {
            const newContent = content.slice(fullResponse.length);
            if (newContent) {
              fullResponse = content;
              onChunk(newContent);
            }
          } else if (Array.isArray(content)) {
            const text = content
              .filter((c) => c.type === 'text' && c.text)
              .map((c) => c.text)
              .join('\n');
            const newContent = text.slice(fullResponse.length);
            if (newContent) {
              fullResponse = text;
              onChunk(newContent);
            }
          }
        } else if (message.type === 'result') {
          fullResponse = message.result || fullResponse;
          break;
        }
      }

      return this.parseAIResponse(fullResponse, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    } finally {
      this.currentQuery = null;
    }
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    return generateSuggestions(workflow, selectedStepId);
  }

  async cancel(): Promise<void> {
    if (this.currentQuery) {
      await this.currentQuery.interrupt();
      this.currentQuery = null;
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

export function createClaudeCodeProvider(config?: AgentConfig): ClaudeCodeProvider {
  const provider = new ClaudeCodeProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
