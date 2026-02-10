/**
 * OpenAI Provider for GUI
 * Supports OpenAI API, VLLM, and any OpenAI-compatible endpoint
 */

import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class OpenAIProvider implements AgentProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: false,
    systemPrompts: true,
    models: ['gpt-4.5', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'o3'],
  };

  private apiKey: string = '';
  private baseUrl: string = 'https://api.openai.com/v1';
  private model: string = 'gpt-4.5';
  private ready: boolean = false;
  private error: string | undefined;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Get API key from config or environment
      this.apiKey = (config.apiKey as string) || process.env.OPENAI_API_KEY || '';

      // For VLLM/local endpoints, use dummy key
      if (config.baseUrl && !this.apiKey) {
        this.apiKey = 'dummy-key';
      }

      if (!this.apiKey) {
        this.ready = false;
        this.error = 'OPENAI_API_KEY not set. Set environment variable or provide in config.';
        return;
      }

      // Configure base URL (for VLLM or other OpenAI-compatible endpoints)
      if (config.baseUrl) {
        this.baseUrl = config.baseUrl as string;
      }

      // Configure model
      if (config.model) {
        this.model = config.model;
      }

      // Test the connection
      try {
        await this.testConnection();
        this.ready = true;
        this.error = undefined;
      } catch (err) {
        this.ready = false;
        this.error = err instanceof Error ? err.message : 'Failed to connect to OpenAI API';
      }
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing OpenAI';
    }
  }

  private async testConnection(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API test failed: ${response.statusText}`);
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
    if (!this.ready) {
      return {
        explanation: 'OpenAI provider not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.callOpenAI(messages);
      const responseText = response.choices[0]?.message?.content || '';

      return await this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async callOpenAI(messages: OpenAIMessage[]): Promise<OpenAIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<OpenAIResponse>;
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.ready) {
      return this.processPrompt(prompt, workflow, context);
    }

    try {
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      let fullResponse = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      return await this.parseAIResponse(fullResponse, workflow);
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
    // OpenAI doesn't provide a cancel mechanism via API
    // The request will be aborted by closing the connection
  }

  private async parseAIResponse(responseText: string, originalWorkflow: Workflow): Promise<PromptResult> {
    const yamlMatch = responseText.match(/```yaml\n([\s\S]*?)\n```/);
    let modifiedWorkflow: Workflow | undefined;
    let explanation = responseText;

    if (yamlMatch) {
      try {
        const { parse } = await import('yaml');
        const parsedYaml = parse(yamlMatch[1]);
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

export function createOpenAIProvider(config?: AgentConfig): OpenAIProvider {
  const provider = new OpenAIProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
