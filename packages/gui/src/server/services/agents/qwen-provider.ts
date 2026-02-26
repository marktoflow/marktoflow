/**
 * Qwen Code AI agent provider
 * Uses the shared integrations adapter (@marktoflow/integrations)
 */

import { parse as yamlParse } from 'yaml';
import { QwenCodeClient, isQwenSdkAvailable } from '@marktoflow/integrations';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

export class QwenProvider implements AgentProvider {
  readonly id = 'qwen-code';
  readonly name = 'Qwen Code (SDK)';
  capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: true,
    systemPrompts: true,
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  };

  private client: QwenCodeClient | null = null;
  private ready: boolean = false;
  private available: boolean = false;
  private error: string | undefined;

  constructor() {
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    this.available = await isQwenSdkAvailable();
  }

  async initialize(config: AgentConfig): Promise<void> {
    try {
      this.client = new QwenCodeClient({
        model: config.model,
        cwd: (config.options?.cwd as string) || process.cwd(),
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });

      this.ready = true;
      this.error = undefined;
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing Qwen provider';
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { ready: boolean; available?: boolean; model?: string; error?: string } {
    const status = this.client?.getStatus();
    return {
      ready: this.ready,
      available: this.available,
      model: status?.model,
      error: this.error,
    };
  }

  async processPrompt(
    prompt: string,
    workflow: Workflow,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.client || !this.ready) {
      return {
        explanation: 'Qwen provider not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`;

    try {
      const responseText = await this.client.send({ prompt: fullPrompt });
      return this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.client || !this.ready) {
      return this.processPrompt(prompt, workflow, context);
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`;

    try {
      const responseText = await this.client.stream({
        prompt: fullPrompt,
        onChunk,
      });
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

  async cancel(): Promise<void> {
    if (this.client) {
      await this.client.cancel();
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
        // ignore YAML parse failures
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

export function createQwenProvider(config?: AgentConfig): QwenProvider {
  const provider = new QwenProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
