/**
 * Agent Provider Registry
 * Manages all available AI agent providers and provides a unified interface
 */

import type {
  AgentProvider,
  AgentProviderEntry,
  AgentConfig,
  PromptResult,
  PromptHistoryItem,
  Workflow,
} from './types.js';
import { createClaudeProvider } from './claude-provider.js';
import { createDemoProvider } from './demo-provider.js';
import { createOllamaProvider } from './ollama-provider.js';

/**
 * Registry of all available agent providers
 */
export class AgentRegistry {
  private providers: Map<string, AgentProvider> = new Map();
  private activeProviderId: string = 'demo';
  private history: PromptHistoryItem[] = [];

  constructor() {
    // Register built-in providers
    this.registerProvider({
      id: 'claude',
      name: 'Claude (Anthropic)',
      factory: createClaudeProvider,
    });
    this.registerProvider({
      id: 'demo',
      name: 'Demo Mode',
      factory: createDemoProvider,
    });
    this.registerProvider({
      id: 'ollama',
      name: 'Ollama (Local)',
      factory: createOllamaProvider,
    });
  }

  /**
   * Register a new provider
   */
  registerProvider(entry: AgentProviderEntry): void {
    const provider = entry.factory(entry.defaultConfig);
    this.providers.set(entry.id, provider);
  }

  /**
   * Get all registered providers
   */
  getProviders(): Array<{ id: string; name: string; ready: boolean }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.name,
      ready: provider.isReady(),
    }));
  }

  /**
   * Get a specific provider
   */
  getProvider(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get the active provider
   */
  getActiveProvider(): AgentProvider {
    return this.providers.get(this.activeProviderId) || this.providers.get('demo')!;
  }

  /**
   * Set the active provider
   */
  async setActiveProvider(id: string, config?: AgentConfig): Promise<boolean> {
    const provider = this.providers.get(id);
    if (!provider) {
      return false;
    }

    if (config) {
      await provider.initialize(config);
    }

    if (provider.isReady()) {
      this.activeProviderId = id;
      return true;
    }

    return false;
  }

  /**
   * Get the active provider ID
   */
  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  /**
   * Auto-detect and set the best available provider
   */
  async autoDetectProvider(): Promise<string> {
    // Try Claude first (if API key is available)
    const claudeProvider = this.providers.get('claude');
    if (claudeProvider) {
      await claudeProvider.initialize({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      if (claudeProvider.isReady()) {
        this.activeProviderId = 'claude';
        return 'claude';
      }
    }

    // Try Ollama (if running locally)
    const ollamaProvider = this.providers.get('ollama');
    if (ollamaProvider) {
      await ollamaProvider.initialize({
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      });
      if (ollamaProvider.isReady()) {
        this.activeProviderId = 'ollama';
        return 'ollama';
      }
    }

    // Fall back to demo mode
    this.activeProviderId = 'demo';
    return 'demo';
  }

  /**
   * Process a prompt using the active provider
   */
  async processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult> {
    const provider = this.getActiveProvider();
    const result = await provider.processPrompt(prompt, workflow);

    // Record in history
    this.history.unshift({
      prompt,
      response: result.explanation,
      timestamp: new Date(),
      success: !result.error,
      provider: provider.id,
    });

    // Keep only last 50 items
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }

    return result;
  }

  /**
   * Get suggestions using the active provider
   */
  async getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]> {
    const provider = this.getActiveProvider();
    return provider.getSuggestions(workflow, selectedStepId);
  }

  /**
   * Stream a prompt using the active provider (if supported)
   */
  async streamPrompt(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void
  ): Promise<PromptResult> {
    const provider = this.getActiveProvider();

    if (provider.streamPrompt) {
      const result = await provider.streamPrompt(prompt, workflow, onChunk);

      this.history.unshift({
        prompt,
        response: result.explanation,
        timestamp: new Date(),
        success: !result.error,
        provider: provider.id,
      });

      return result;
    }

    // Fall back to non-streaming
    return this.processPrompt(prompt, workflow);
  }

  /**
   * Get prompt history
   */
  getHistory(limit: number = 20): PromptHistoryItem[] {
    return this.history.slice(0, limit);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get provider status
   */
  getStatus(): {
    activeProvider: string;
    providers: Array<{ id: string; name: string; ready: boolean; model?: string; error?: string }>;
  } {
    return {
      activeProvider: this.activeProviderId,
      providers: Array.from(this.providers.entries()).map(([id, provider]) => ({
        id,
        name: provider.name,
        ...provider.getStatus(),
      })),
    };
  }
}

// Singleton instance
let registryInstance: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!registryInstance) {
    registryInstance = new AgentRegistry();
  }
  return registryInstance;
}

export function createAgentRegistry(): AgentRegistry {
  return new AgentRegistry();
}
