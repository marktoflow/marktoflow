/**
 * Abstract types for AI agent providers
 * Allows the GUI to work with any agent backend (Claude, OpenCode, Ollama, etc.)
 */

export interface Workflow {
  metadata: Record<string, unknown>;
  steps: WorkflowStep[];
  tools?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name?: string;
  action?: string;
  inputs?: Record<string, unknown>;
  outputVariable?: string;
  errorHandling?: {
    action: 'stop' | 'continue' | 'retry';
    maxRetries?: number;
  };
  conditions?: string[];
}

export interface PromptResult {
  explanation: string;
  workflow?: Workflow;
  diff?: string;
  error?: string;
}

export interface PromptHistoryItem {
  prompt: string;
  response: string;
  timestamp: Date;
  success: boolean;
  provider: string;
}

export interface AgentCapabilities {
  /** Whether the provider supports streaming responses */
  streaming: boolean;
  /** Whether the provider supports tool use */
  toolUse: boolean;
  /** Whether the provider supports code execution */
  codeExecution: boolean;
  /** Whether the provider supports system prompts */
  systemPrompts: boolean;
  /** Maximum context length in tokens */
  maxContextLength?: number;
  /** List of available models */
  models: string[];
}

export interface AgentConfig {
  /** API key or authentication token */
  apiKey?: string;
  /** Base URL for API requests */
  baseUrl?: string;
  /** Default model to use */
  model?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Abstract interface for AI agent providers
 * Each provider (Claude, OpenCode, Ollama) implements this interface
 */
export interface AgentProvider {
  /** Unique identifier for this provider */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Provider capabilities */
  readonly capabilities: AgentCapabilities;

  /**
   * Initialize the provider with configuration
   * @param config - Provider configuration
   */
  initialize(config: AgentConfig): Promise<void>;

  /**
   * Check if the provider is ready and properly configured
   */
  isReady(): boolean;

  /**
   * Process a natural language prompt to modify a workflow
   * @param prompt - User's natural language request
   * @param workflow - Current workflow to modify
   */
  processPrompt(prompt: string, workflow: Workflow): Promise<PromptResult>;

  /**
   * Get suggested prompts based on the current workflow
   * @param workflow - Current workflow
   * @param selectedStepId - Optional selected step ID
   */
  getSuggestions(workflow: Workflow, selectedStepId?: string): Promise<string[]>;

  /**
   * Stream a response (if supported)
   * @param prompt - User prompt
   * @param workflow - Current workflow
   * @param onChunk - Callback for each chunk
   */
  streamPrompt?(
    prompt: string,
    workflow: Workflow,
    onChunk: (chunk: string) => void
  ): Promise<PromptResult>;

  /**
   * Cancel any ongoing request
   */
  cancel?(): Promise<void>;

  /**
   * Get provider-specific health status
   */
  getStatus(): {
    ready: boolean;
    model?: string;
    error?: string;
  };
}

/**
 * Factory function type for creating agent providers
 */
export type AgentProviderFactory = (config?: AgentConfig) => AgentProvider;

/**
 * Registry entry for agent providers
 */
export interface AgentProviderEntry {
  id: string;
  name: string;
  factory: AgentProviderFactory;
  defaultConfig?: AgentConfig;
}
