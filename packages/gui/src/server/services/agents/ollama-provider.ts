/**
 * Ollama AI agent provider
 * Uses local Ollama instance for AI capabilities
 */

import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';

const SYSTEM_PROMPT = `You are an expert workflow automation assistant. Help users modify their workflows.

When modifying workflows:
- Each step has: id, name, action, inputs, output_variable
- Actions use format: service.method (e.g., slack.chat.postMessage)
- Template variables use: {{ variable_name }} syntax

Respond with:
1. A brief explanation of changes
2. The complete modified workflow in YAML format between \`\`\`yaml and \`\`\``;

export class OllamaProvider implements AgentProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: false,
    codeExecution: false,
    systemPrompts: true,
    models: [
      'llama3.2',
      'llama3.1',
      'codellama',
      'mistral',
      'mixtral',
      'phi3',
      'gemma2',
    ],
  };

  private baseUrl: string = 'http://localhost:11434';
  private model: string = 'llama3.2';
  private ready: boolean = false;
  private error: string | undefined;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      if (config.baseUrl) {
        this.baseUrl = config.baseUrl;
      }
      if (config.model) {
        this.model = config.model;
      }

      // Check if Ollama is available
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.ready = true;
        this.error = undefined;
      } else {
        this.ready = false;
        this.error = 'Ollama server returned an error';
      }
    } catch (err) {
      this.ready = false;
      this.error = `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?`;
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
    if (!this.ready) {
      return {
        explanation: 'Ollama is not available. Please ensure Ollama is running.',
        error: this.error,
      };
    }

    try {
      const workflowYaml = yamlStringify(workflow, { indent: 2, lineWidth: 0 });

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${SYSTEM_PROMPT}\n\nCurrent workflow:\n\`\`\`yaml\n${workflowYaml}\n\`\`\`\n\nUser request: ${prompt}`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAIResponse(data.response, workflow);
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
        'Create a simple workflow',
        'Add an HTTP request',
      ];
    }

    suggestions.push(
      'Add error handling',
      'Add a notification step',
      'Simplify the workflow'
    );

    if (selectedStepId) {
      const step = workflow.steps.find((s) => s.id === selectedStepId);
      if (step) {
        suggestions.push(
          `Improve "${step.name || step.id}"`,
          `Add validation to "${step.name || step.id}"`
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
    if (!this.ready) {
      return this.processPrompt(prompt, workflow);
    }

    const workflowYaml = yamlStringify(workflow, { indent: 2, lineWidth: 0 });
    let fullResponse = '';

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${SYSTEM_PROMPT}\n\nCurrent workflow:\n\`\`\`yaml\n${workflowYaml}\n\`\`\`\n\nUser request: ${prompt}`,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              onChunk(data.response);
            }
          } catch {
            // Skip invalid JSON
          }
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
      diff += `+ Added ${added.length} step(s)\n`;
    }
    if (removed.length > 0) {
      diff += `- Removed ${removed.length} step(s)\n`;
    }

    return diff || 'No structural changes';
  }
}

export function createOllamaProvider(config?: AgentConfig): OllamaProvider {
  const provider = new OllamaProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
