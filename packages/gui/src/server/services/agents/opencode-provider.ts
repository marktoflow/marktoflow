/**
 * OpenCode Provider for GUI
 * Supports OpenCode in both CLI and server modes
 *
 * Configuration:
 * - CLI mode: Uses local opencode CLI (must be installed)
 * - Server mode: Connects to opencode server
 *   - Default server: http://localhost:4096
 *   - Configure via baseUrl option in GUI
 *   - Start server with: opencode serve --port 4096
 */

import type {
  AgentProvider,
  AgentCapabilities,
  AgentConfig,
  PromptResult,
  Workflow,
} from './types.js';
import { buildPrompt, generateSuggestions } from './prompts.js';

export class OpenCodeProvider implements AgentProvider {
  private static readonly DEFAULT_PORT = 4096;
  private static readonly DEFAULT_SERVER_URL = `http://localhost:${OpenCodeProvider.DEFAULT_PORT}`;

  readonly id = 'opencode';
  readonly name = 'OpenCode';
  readonly capabilities: AgentCapabilities = {
    streaming: true,
    toolUse: true,
    codeExecution: true,
    systemPrompts: true,
    models: [], // OpenCode supports many models via different backends
  };

  private mode: 'cli' | 'server' = 'cli';
  private serverUrl: string = OpenCodeProvider.DEFAULT_SERVER_URL;
  private ready: boolean = false;
  private error: string | undefined;
  private model?: string;

  async initialize(config: AgentConfig): Promise<void> {
    try {
      // Determine mode (server or CLI)
      if (config.options?.mode === 'server' || config.baseUrl) {
        this.mode = 'server';
        if (config.baseUrl) {
          this.serverUrl = config.baseUrl as string;
        } else if (config.options?.port) {
          // Support direct port configuration
          const port = config.options.port as number;
          this.serverUrl = `http://localhost:${port}`;
        }
      }

      // Set model if provided
      if (config.model) {
        this.model = config.model;
      }

      // Test availability
      if (this.mode === 'server') {
        await this.testServerConnection();
      } else {
        await this.testCLI();
      }

      this.ready = true;
      this.error = undefined;
    } catch (err) {
      this.ready = false;
      this.error = err instanceof Error ? err.message : 'Unknown error initializing OpenCode';
    }
  }

  private async testServerConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/health`).catch(() => null);
      if (!response || !response.ok) {
        throw new Error(
          `OpenCode server not responding at ${this.serverUrl}. Start with: opencode serve --port 4096`
        );
      }
    } catch (err) {
      throw new Error(
        `OpenCode server not available. Start with: opencode serve --port 4096`
      );
    }
  }

  private async testCLI(): Promise<void> {
    // Check if opencode CLI is available
    const { spawn } = await import('node:child_process');
    return new Promise((resolve, reject) => {
      const process = spawn('which', ['opencode']);
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('OpenCode CLI not found. Install from: https://opencode.ai'));
        }
      });
      process.on('error', () => {
        reject(new Error('OpenCode CLI not found. Install from: https://opencode.ai'));
      });
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { ready: boolean; model?: string; error?: string } {
    const status: { ready: boolean; model?: string; error?: string } = {
      ready: this.ready,
      error: this.error,
    };

    // Show current configuration
    if (this.mode === 'server') {
      status.model = `Server: ${this.serverUrl}${this.model ? ` (${this.model})` : ''}`;
    } else {
      status.model = this.model || 'CLI mode';
    }

    return status;
  }

  async processPrompt(
    prompt: string,
    workflow: Workflow,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    if (!this.ready) {
      return {
        explanation: 'OpenCode not available.',
        error: this.error || 'Provider not initialized',
      };
    }

    try {
      const { systemPrompt, userPrompt } = buildPrompt(prompt, workflow, context);
      const fullPrompt = `${systemPrompt}\n\n---\n\nUser request: ${userPrompt}`;

      let responseText: string;

      if (this.mode === 'server') {
        responseText = await this.callServer(fullPrompt);
      } else {
        responseText = await this.callCLI(fullPrompt);
      }

      return await this.parseAIResponse(responseText, workflow);
    } catch (err) {
      return {
        explanation: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private async callServer(prompt: string): Promise<string> {
    // Create session if needed, then send prompt
    const sessionResponse = await fetch(`${this.serverUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to create OpenCode session');
    }

    const sessionData = (await sessionResponse.json()) as { id: string };
    const sessionId = sessionData.id;

    // Send prompt to session
    const promptResponse = await fetch(`${this.serverUrl}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }],
        model: this.model,
      }),
    });

    if (!promptResponse.ok) {
      throw new Error('OpenCode server error');
    }

    const result = (await promptResponse.json()) as { parts?: Array<{ type: string; text?: string }>; message?: string };

    // Extract text from response parts
    if (result.parts) {
      return result.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text || '')
        .join('\n');
    }

    return result.message || '';
  }

  private async callCLI(prompt: string): Promise<string> {
    const { spawn } = await import('node:child_process');

    return new Promise((resolve, reject) => {
      const args = ['run'];
      if (this.model) {
        args.push('--model', this.model);
      }
      args.push(prompt);

      const process = spawn('opencode', args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`OpenCode CLI failed: ${errorOutput || output}`));
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to run OpenCode CLI: ${err.message}`));
      });
    });
  }

  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    _onChunk: (chunk: string) => void,
    context?: { selectedStepId?: string; recentHistory?: string[] }
  ): Promise<PromptResult> {
    // For now, fall back to non-streaming for GUI
    // Server mode streaming would require SSE implementation
    return this.processPrompt(prompt, workflow, context);
  }

  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    return generateSuggestions(workflow, selectedStepId);
  }

  async cancel(): Promise<void> {
    // Would need to implement session cancellation for server mode
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

export function createOpenCodeProvider(config?: AgentConfig): OpenCodeProvider {
  const provider = new OpenCodeProvider();
  if (config) {
    provider.initialize(config);
  }
  return provider;
}
