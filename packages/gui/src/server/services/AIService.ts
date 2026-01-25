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
  getStatus(): {
    activeProvider: string;
    providers: Array<{ id: string; name: string; ready: boolean; model?: string; error?: string }>;
  } {
    return this.registry.getStatus();
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
