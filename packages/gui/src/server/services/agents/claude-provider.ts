/**
 * Claude/Anthropic AI agent provider
 * Uses the Anthropic SDK for AI capabilities
 */

import Anthropic from '@anthropic-ai/sdk';
import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';

const SYSTEM_PROMPT = `You are an expert workflow automation assistant for Marktoflow, a markdown-based workflow automation framework.

Your role is to help users modify their workflows based on natural language requests. You should:

1. Understand the current workflow structure (YAML frontmatter with steps, inputs, tools)
2. Make precise modifications based on user requests
3. Explain what changes you made and why

When modifying workflows, follow these conventions:
- Each step has: id, name (optional), action (service.method), inputs, output_variable
- Actions use format: service.method (e.g., slack.chat.postMessage, github.pulls.get)
- Template variables use: {{ variable_name }} syntax
- Error handling can specify: action (stop/continue/retry), max_retries
- Conditions use JavaScript-like expressions

Available services: slack, github, jira, gmail, outlook, linear, notion, discord, airtable, confluence, http, claude, opencode, ollama

Respond with:
1. A brief explanation of the changes
2. The complete modified workflow in valid YAML format

Be concise and precise. Only make the requested changes.`;

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

  async processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult> {
    if (!this.client) {
      return {
        explanation: 'Claude provider not initialized. Running in demo mode.',
        workflow: this.simulateResponse(prompt, workflow),
      };
    }

    try {
      const workflowYaml = yamlStringify(workflow, { indent: 2, lineWidth: 0 });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Current workflow:\n\`\`\`yaml\n${workflowYaml}\n\`\`\`\n\nUser request: ${prompt}`,
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
    const suggestions: string[] = [];

    if (!workflow || !workflow.steps) {
      return [
        'Add your first step',
        'Import a template workflow',
        'Connect to a service',
      ];
    }

    suggestions.push(
      'Add error handling to all steps',
      'Add a notification step at the end',
      'Convert steps to a sub-workflow'
    );

    if (selectedStepId) {
      const step = workflow.steps.find((s) => s.id === selectedStepId);
      if (step) {
        if (!step.errorHandling) {
          suggestions.push(`Add retry logic to "${step.name || step.id}"`);
        }
        suggestions.push(
          `Add a condition to "${step.name || step.id}"`,
          `Duplicate "${step.name || step.id}"`
        );
      }
    }

    return suggestions.slice(0, 5);
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void
  ): Promise<PromptResult> {
    if (!this.client) {
      return this.processPrompt(prompt, workflow);
    }

    const workflowYaml = yamlStringify(workflow, { indent: 2, lineWidth: 0 });
    let fullResponse = '';

    try {
      const stream = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: [
          {
            role: 'user',
            content: `Current workflow:\n\`\`\`yaml\n${workflowYaml}\n\`\`\`\n\nUser request: ${prompt}`,
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
