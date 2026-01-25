/**
 * GitHub Copilot AI agent provider
 * Uses the @github/copilot-sdk for AI capabilities
 */

import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

// Dynamic import types for Copilot SDK
interface CopilotClient {
  createSession: (options: {
    model?: string;
    streaming?: boolean;
    systemMessage?: { content: string };
  }) => Promise<CopilotSession>;
  ping: () => Promise<{ message: string; timestamp: number }>;
  stop: () => Promise<Error[]>;
}

interface CopilotSession {
  sendAndWait: (options: { prompt: string }) => Promise<{ data: { content: string } } | null>;
  send: (options: { prompt: string }) => Promise<void>;
  on: (callback: (event: SessionEvent) => void) => void;
  destroy: () => Promise<void>;
}

interface SessionEvent {
  type: string;
  data: {
    deltaContent?: string;
    content?: string;
    message?: string;
  };
}

export class CopilotProvider implements AgentProvider {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: true,
    systemPrompts: true,
    models: [
      'gpt-4.1',
      'gpt-4o',
      'gpt-4-turbo',
      'claude-3.5-sonnet',
    ],
  };

  private client: CopilotClient | null = null;
  private model: string = 'gpt-4.1';
  private ready: boolean = false;
  private error: string | undefined;
  private cliPath?: string;
  private cliUrl?: string;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Try to import the Copilot SDK (dynamic import to avoid bundling issues)
      // Use variable to prevent static analysis
      const sdkName = '@github/copilot-sdk';
      const sdkModule = await import(sdkName).catch(() => null);
      if (!sdkModule) {
        this.ready = false;
        this.error = 'GitHub Copilot SDK not installed. Run: npm install @github/copilot-sdk';
        return;
      }
      const { CopilotClient } = sdkModule;

      this.cliPath = config.options?.cliPath as string;
      this.cliUrl = config.baseUrl || (config.options?.cliUrl as string);

      const clientConfig: {
        cliPath?: string;
        cliUrl?: string;
        autoStart?: boolean;
        logLevel?: string;
      } = {
        autoStart: true,
        logLevel: 'error',
      };

      if (this.cliUrl) {
        clientConfig.cliUrl = this.cliUrl;
      } else {
        clientConfig.cliPath = this.cliPath || 'copilot';
      }

      this.client = new CopilotClient(clientConfig);

      if (config.model) {
        this.model = config.model;
      }

      // Test connectivity
      try {
        await this.client.ping();
        this.ready = true;
        this.error = undefined;
      } catch (pingError) {
        this.ready = false;
        this.error = 'Cannot connect to GitHub Copilot CLI. Ensure you are authenticated with `copilot auth`.';
      }
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing Copilot';
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
    if (!this.client || !this.ready) {
      return {
        explanation: 'GitHub Copilot provider not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      // Build context-aware prompts
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);

      const session = await this.client.createSession({
        model: this.model,
        systemMessage: { content: systemPrompt },
      });

      try {
        const response = await session.sendAndWait({ prompt: userPrompt });
        const responseText = response?.data.content || '';
        return this.parseAIResponse(responseText, workflow);
      } finally {
        await session.destroy();
      }
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
    if (!this.client || !this.ready) {
      return this.processPrompt(prompt, workflow, context);
    }

    const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
    let fullResponse = '';

    try {
      const session = await this.client.createSession({
        model: this.model,
        streaming: true,
        systemMessage: { content: systemPrompt },
      });

      return new Promise((resolve, reject) => {
        session.on((event: SessionEvent) => {
          if (event.type === 'assistant.message_delta') {
            const chunk = event.data.deltaContent || '';
            fullResponse += chunk;
            onChunk(chunk);
          } else if (event.type === 'assistant.message') {
            fullResponse = event.data.content || fullResponse;
          } else if (event.type === 'session.idle') {
            session
              .destroy()
              .then(() => resolve(this.parseAIResponse(fullResponse, workflow)))
              .catch(reject);
          } else if (event.type === 'session.error') {
            reject(new Error(event.data.message || 'Session error'));
          }
        });

        session.send({ prompt: userPrompt }).catch(reject);
      });
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  async cancel(): Promise<void> {
    if (this.client) {
      await this.client.stop();
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

export function createCopilotProvider(config?: AgentConfig): CopilotProvider {
  const provider = new CopilotProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
