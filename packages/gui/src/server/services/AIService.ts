/**
 * AI Service - Backwards-compatible wrapper around the Agent Registry
 *
 * This service provides the same interface as before but now supports
 * multiple AI backends through the agent provider system.
 */

import { spawn } from 'node:child_process';
import { getAgentRegistry, type AgentRegistry, type PromptHistoryItem } from './agents/index.js';

interface Workflow {
  metadata: any;
  steps: any[];
  tools?: Record<string, any>;
  inputs?: Record<string, any>;
}

interface PromptResult {
  explanation: string;
  workflow?: Workflow;
  diff?: string;
}

export class AIService {
  private registry: AgentRegistry;
  private initialized: boolean = false;

  constructor() {
    this.registry = getAgentRegistry();
  }

  /**
   * Initialize the service with auto-detection of available providers
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.registry.autoDetectProvider();
      this.initialized = true;
    }
  }

  /**
   * Process a prompt to modify a workflow
   */
  async processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult> {
    await this.initialize();
    return this.registry.processPrompt(prompt, workflow);
  }

  /**
   * Stream a prompt response (if supported by the active provider)
   */
  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void
  ): Promise<PromptResult> {
    await this.initialize();
    return this.registry.streamPrompt(prompt, workflow, onChunk);
  }

  /**
   * Get prompt history
   */
  async getHistory(): Promise<PromptHistoryItem[]> {
    return this.registry.getHistory(20);
  }

  /**
   * Get suggestions for the current workflow
   */
  async getSuggestions(
    workflow: Workflow,
    selectedStepId?: string
  ): Promise<string[]> {
    await this.initialize();
    return this.registry.getSuggestions(workflow, selectedStepId);
  }

  /**
   * Get the current provider status
   */
  async getStatus(): Promise<{
    activeProvider: string | null;
    providers: Array<{
      id: string;
      name: string;
      status: 'ready' | 'available' | 'needs_config' | 'unavailable';
      isActive: boolean;
      description?: string;
      configOptions?: {
        apiKey?: boolean;
        baseUrl?: boolean;
        model?: boolean;
      };
      authType?: 'sdk' | 'api_key' | 'local' | 'demo';
      authInstructions?: string;
      availableModels?: string[];
      oauthSupported?: boolean;
      oauthAuthUrl?: string;
    }>;
  }> {
    // Initialize providers if not already done
    await this.initialize();

    const registryStatus = this.registry.getStatus();

    return {
      activeProvider: registryStatus.activeProvider,
      providers: registryStatus.providers.map((provider) => {
        // Determine status based on ready state, availability, and error
        let status: 'ready' | 'needs_config' | 'unavailable' | 'available';
        if (provider.ready) {
          status = 'ready';
        } else if (provider.error) {
          status = 'unavailable';
        } else if ((provider as any).available) {
          // SDK is available - ready to connect
          status = 'available';
        } else {
          status = 'needs_config';
        }

        // Per-provider metadata
        let configOptions: { apiKey?: boolean; baseUrl?: boolean; model?: boolean; port?: boolean } | undefined;
        let authType: 'sdk' | 'api_key' | 'local' | 'demo' | undefined;
        let authInstructions: string | undefined;
        let availableModels: string[] | undefined;
        let oauthSupported: boolean | undefined;
        let oauthAuthUrl: string | undefined;

        // Get available models from provider capabilities
        const providerInstance = this.registry.getProvider(provider.id);
        if (providerInstance?.capabilities?.models?.length) {
          availableModels = providerInstance.capabilities.models;
        }

        switch (provider.id) {
          case 'claude-agent':
            authType = 'sdk';
            authInstructions = 'Authenticate with Claude CLI OAuth or provide ANTHROPIC_API_KEY.';
            oauthSupported = true;
            oauthAuthUrl = 'https://claude.ai/login';
            break;
          case 'copilot':
            authType = 'sdk';
            authInstructions = 'Uses GitHub Copilot CLI OAuth. Authenticate using copilot login.';
            oauthSupported = true;
            oauthAuthUrl = 'https://github.com/login/device';
            break;
          case 'codex':
            authType = 'sdk';
            authInstructions = 'Authenticate with Codex CLI OAuth or set OPENAI_API_KEY.';
            oauthSupported = true;
            oauthAuthUrl = 'https://platform.openai.com/';
            // Only show config options when Codex is NOT already ready
            if (!provider.ready) {
              configOptions = { apiKey: true, model: true };
            }
            break;
          case 'opencode':
            authType = 'sdk';
            authInstructions = 'Install OpenCode CLI from https://opencode.ai or start server mode with: opencode serve --port 4096';
            configOptions = { port: true, model: true };
            break;
          case 'gemini-cli':
            authType = 'sdk';
            authInstructions = 'Authenticate with Gemini OAuth (marktoflow connect gemini-cli) or set GEMINI_API_KEY.';
            oauthSupported = true;
            oauthAuthUrl = 'https://accounts.google.com/';
            break;
          case 'qwen-code':
            authType = 'sdk';
            authInstructions = 'Use Qwen OAuth (`qwen login`) or connect to a local OpenAI-compatible endpoint via Base URL/API key.';
            configOptions = { apiKey: true, baseUrl: true, model: true };
            break;
          case 'openai':
            authType = 'api_key';
            authInstructions = 'Set OPENAI_API_KEY environment variable or provide API key in configuration.';
            configOptions = { apiKey: true, baseUrl: true, model: true };
            break;
          case 'ollama':
            authType = 'local';
            authInstructions = 'Start Ollama locally: run "ollama serve" in your terminal.';
            configOptions = { baseUrl: true, model: true };
            break;
          case 'demo':
            authType = 'demo';
            break;
        }

        // Build description
        let description: string | undefined;
        if (provider.model) {
          description = `Model: ${provider.model}`;
        } else if (authType === 'sdk') {
          description = 'SDK-based authentication';
        } else if (authType === 'local') {
          description = 'Local inference';
        } else if (authType === 'demo') {
          description = 'Simulated responses for testing';
        }

        return {
          id: provider.id,
          name: provider.name,
          status,
          isActive: provider.id === registryStatus.activeProvider,
          description,
          configOptions,
          authType,
          authInstructions,
          availableModels,
          oauthSupported,
          oauthAuthUrl,
        };
      }),
    };
  }

  /**
   * Switch to a different provider
   */
  async setProvider(
    providerId: string,
    config?: { apiKey?: string; baseUrl?: string; model?: string }
  ): Promise<boolean> {
    return this.registry.setActiveProvider(providerId, config);
  }

  /**
   * Start an OAuth login flow for SDK-based providers.
   *
   * This launches the provider CLI login command in the background and
   * returns a suggested auth URL for the GUI to open in a separate tab.
   */
  async startOAuthFlow(providerId: string): Promise<{ message: string; authUrl?: string }> {
    // SECURITY: Explicit whitelist of trusted CLI commands by provider ID.
    // Never construct command names or arguments from user input.
    const providerCommands: Record<string, { commands: Array<{ command: string; args: string[] }>; authUrl?: string }> = {
      'claude-agent': {
        commands: [{ command: 'claude', args: ['login'] }],
        authUrl: 'https://claude.ai/login',
      },
      'gemini-cli': {
        commands: [{ command: 'marktoflow', args: ['connect', 'gemini-cli'] }],
        authUrl: 'https://accounts.google.com/',
      },
      codex: {
        commands: [{ command: 'codex', args: ['login'] }],
        authUrl: 'https://platform.openai.com/',
      },
      copilot: {
        commands: [
          { command: 'copilot', args: ['login'] },
          { command: 'github-copilot-cli', args: ['login'] },
        ],
        authUrl: 'https://github.com/login/device',
      },
    };

    const config = providerCommands[providerId];
    if (!config) {
      throw new Error(`OAuth login is not supported for provider: ${providerId}`);
    }

    let lastError: Error | null = null;
    let launchedCommand: string | null = null;

    for (const candidate of config.commands) {
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(candidate.command, candidate.args, {
            cwd: process.cwd(),
            env: process.env,
            detached: true,
            stdio: 'ignore',
          });

          child.once('error', (err) => {
            reject(new Error(`Failed to start '${candidate.command} ${candidate.args.join(' ')}': ${err.message}`));
          });

          child.once('spawn', () => {
            child.unref();
            resolve();
          });
        });

        launchedCommand = `${candidate.command} ${candidate.args.join(' ')}`;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!launchedCommand) {
      throw new Error(
        `Unable to start OAuth command for ${providerId}. ${lastError?.message ?? 'Unknown error'}`
      );
    }

    return {
      message: `OAuth flow started with '${launchedCommand}'. Complete authentication in the browser tab, then click Connect again.`,
      authUrl: config.authUrl,
    };
  }

  /**
   * Get the registry for direct access to providers
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}
