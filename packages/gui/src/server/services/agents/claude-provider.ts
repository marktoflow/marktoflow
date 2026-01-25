/**
 * Claude/Anthropic AI agent provider
 * Uses the Anthropic SDK for AI capabilities
 */

import Anthropic from '@anthropic-ai/sdk';
import { parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude';
  readonly name = 'Claude (Anthropic)';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: false,
    systemPrompts: true,
    maxContextLength: 200000,
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
  };

  private client: Anthropic | null = null;
  private model: string = 'claude-sonnet-4-20250514';
  private ready: boolean = false;
  private error: string | undefined;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        this.ready = false;
        this.error = 'No API key configured';
        return;
      }

      this.client = new Anthropic({
        apiKey,
        baseURL: config.baseUrl,
        timeout: config.timeout,
      });

      if (config.model) {
        this.model = config.model;
      }

      this.ready = true;
      this.error = undefined;
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error';
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
    if (!this.client) {
      return {
        explanation: 'Claude provider not initialized. Running in demo mode.',
        workflow: this.simulateResponse(prompt, workflow),
      };
    }

    try {
      // Build context-aware prompts
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const responseText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    // Use the prompt engineering module for context-aware suggestions
    return generateSuggestions(workflow, selectedStepId);
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.client) {
      return this.processPrompt(prompt, workflow, context);
    }

    // Build context-aware prompts
    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    let fullResponse = '';

    try {
      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        stream: true,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          fullResponse += text;
          onChunk(text);
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

  private simulateResponse(prompt: string, workflow: Workflow): Workflow {
    const promptLower = prompt.toLowerCase();
    const modifiedWorkflow = { ...workflow, steps: [...(workflow.steps || [])] };

    if (promptLower.includes('add') && promptLower.includes('slack')) {
      modifiedWorkflow.steps.push({
        id: `slack-${Date.now()}`,
        name: 'Send Slack Notification',
        action: 'slack.chat.postMessage',
        inputs: { channel: '#general', text: 'Workflow completed!' },
        outputVariable: 'slack_result',
      });
    } else if (promptLower.includes('add') && promptLower.includes('error')) {
      modifiedWorkflow.steps = modifiedWorkflow.steps.map((step) => ({
        ...step,
        errorHandling: { action: 'retry' as const, maxRetries: 3 },
      }));
    }

    return modifiedWorkflow;
  }
}

export function createClaudeProvider(config?: AgentConfig): ClaudeProvider {
  const provider = new ClaudeProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
