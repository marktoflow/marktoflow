/**
 * GitHub Copilot AI agent provider
 * Uses the @github/copilot-sdk for AI capabilities
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

// Polyfill require for ESM environments (needed by Copilot SDK dependencies)
if (typeof globalThis.require === 'undefined') {
  (globalThis as unknown as { require: NodeRequire }).require = createRequire(import.meta.url);
}

// Dynamic import types for Copilot SDK
// Using loose types to handle SDK version differences
interface CopilotClientConfig {
  cliPath?: string;
  cliUrl?: string;
  autoStart?: boolean;
  logLevel?: 'error' | 'info' | 'none' | 'warning' | 'debug' | 'all';
}

interface CopilotSessionOptions {
  model?: string;
  streaming?: boolean;
  systemMessage?: { content: string };
}

interface CopilotSessionResponse {
  data?: {
    content?: string;
    messageId?: string;
  };
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

  // Using 'unknown' to handle SDK version differences
  private client: unknown = null;
  private model: string = 'gpt-4.1';
  private ready: boolean = false;
  private error: string | undefined;
  private cliPath?: string;
  private cliUrl?: string;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Try to import the Copilot SDK (dynamic import with webpackIgnore to avoid bundling issues)
      const sdkModule = await import(/* webpackIgnore: true */ '@github/copilot-sdk').catch(
        () => null
      );
      if (!sdkModule || !sdkModule.CopilotClient) {
        this.ready = false;
        this.error = 'GitHub Copilot SDK not installed. Run: npm install @github/copilot-sdk';
        return;
      }
      const { CopilotClient } = sdkModule;

      this.cliPath = config.options?.cliPath as string;
      this.cliUrl = config.baseUrl || (config.options?.cliUrl as string);

      const clientConfig: CopilotClientConfig = {
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

      // Start the client and test connectivity
      try {
        if (this.client) {
          // Some SDK versions have start(), some don't (auto-start)
          const client = this.client as { start?: () => Promise<void>; ping?: () => Promise<unknown> };
          if (typeof client.start === 'function') {
            await client.start();
          }
          if (typeof client.ping === 'function') {
            await client.ping();
          }
          this.ready = true;
          this.error = undefined;
        }
      } catch (pingError) {
        this.ready = false;
        this.error = `Cannot connect to GitHub Copilot CLI: ${pingError instanceof Error ? pingError.message : 'Unknown error'}`;
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

      const client = this.client as {
        createSession: (opts: CopilotSessionOptions) => Promise<{
          sendAndWait: (opts: { prompt: string }) => Promise<CopilotSessionResponse | null>;
          destroy: () => Promise<void>;
        }>;
      };

      const session = await client.createSession({
        model: this.model,
        systemMessage: { content: systemPrompt },
      });

      try {
        const response = await session.sendAndWait({ prompt: userPrompt });
        const responseText = response?.data?.content || '';
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
      const client = this.client as {
        createSession: (opts: CopilotSessionOptions) => Promise<{
          send: (opts: { prompt: string }) => Promise<void>;
          on: (callback: (event: SessionEvent) => void) => void;
          destroy: () => Promise<void>;
        }>;
      };

      const session = await client.createSession({
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
      const client = this.client as { stop?: () => Promise<unknown> };
      if (typeof client.stop === 'function') {
        await client.stop();
      }
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
