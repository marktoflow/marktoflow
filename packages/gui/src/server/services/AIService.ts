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
      status: 'ready' | 'needs_config' | 'unavailable';
      isActive: boolean;
      description?: string;
      configOptions?: {
        apiKey?: boolean;
        baseUrl?: boolean;
        model?: boolean;
      };
    }>;
  }> {
    // Initialize providers if not already done
    await this.initialize();

    const registryStatus = this.registry.getStatus();

    return {
      activeProvider: registryStatus.activeProvider,
      providers: registryStatus.providers.map((provider) => {
        // Determine status based on ready state and error
        let status: 'ready' | 'needs_config' | 'unavailable';
        if (provider.ready) {
          status = 'ready';
        } else if (provider.error) {
          status = 'unavailable';
        } else {
          status = 'needs_config';
        }

        // Determine which config options are needed based on provider ID
        let configOptions: { apiKey?: boolean; baseUrl?: boolean; model?: boolean } | undefined;
        if (provider.id === 'claude') {
          configOptions = { apiKey: true, model: true };
        } else if (provider.id === 'ollama') {
          configOptions = { baseUrl: true, model: true };
        } else if (provider.id === 'codex') {
          configOptions = { apiKey: true, model: true };
        }

        return {
          id: provider.id,
          name: provider.name,
          status,
          isActive: provider.id === registryStatus.activeProvider,
          description: provider.model ? `Model: ${provider.model}` : undefined,
          configOptions,
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

  /**
   * List available models for a specific provider
   * @param providerId - The provider ID to list models for
   * @returns Object containing models array and whether it was dynamically fetched
   */
  async listModels(providerId: string): Promise<{ models: string[]; dynamic: boolean }> {
    await this.initialize();
    return this.registry.listModels(providerId);
  }
}
