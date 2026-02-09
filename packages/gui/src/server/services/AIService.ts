/**
 * AI Service - Backwards-compatible wrapper around the Agent Registry
 *
 * This service provides the same interface as before but now supports
 * multiple AI backends through the agent provider system.
 */

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

        // Get available models from provider capabilities
        const providerInstance = this.registry.getProvider(provider.id);
        if (providerInstance?.capabilities?.models?.length) {
          availableModels = providerInstance.capabilities.models;
        }

        switch (provider.id) {
          case 'claude-agent':
            authType = 'sdk';
            authInstructions = 'Set ANTHROPIC_API_KEY environment variable or authenticate using the Claude CLI.';
            break;
          case 'copilot':
            authType = 'sdk';
            authInstructions = 'Uses GitHub Copilot CLI. Ensure you are authenticated: copilot login';
            break;
          case 'codex':
            authType = 'sdk';
            authInstructions = 'Set the OPENAI_API_KEY environment variable, then restart the GUI server.';
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
   * Get the registry for direct access to providers
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}
