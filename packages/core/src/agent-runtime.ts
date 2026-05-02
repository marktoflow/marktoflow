/**
 * Shared runtime types for agent providers and transports.
 */

export type AgentTransport = 'acp' | 'sdk' | 'api' | 'cli' | 'server';

export interface AgentRuntimeCapabilities {
  prompt: boolean;
  streaming: boolean;
  sessionLifecycle: boolean;
  cancellation: boolean;
  mcp: boolean;
  skills: boolean;
  modelSelection: boolean;
  modeSelection: boolean;
  toolPermissions: boolean;
}

export interface AgentMcpServerConfig {
  type: 'stdio' | 'http' | 'sse';
  name?: string;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

export interface AgentSkillDefinition {
  name: string;
  description?: string;
  prompt?: string;
  tools?: string[];
  mcpServers?: Record<string, AgentMcpServerConfig>;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionConfig {
  cwd?: string;
  additionalDirectories?: string[];
  model?: string;
  mode?: string;
  systemMessage?: string;
  mcpServers?: Record<string, AgentMcpServerConfig>;
  skills?: AgentSkillDefinition[];
  metadata?: Record<string, unknown>;
}

export interface AgentPromptRequest {
  sessionId?: string;
  prompt: string;
  messageId?: string;
}

export interface AgentUsage {
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
}

export interface AgentToolCall {
  toolCallId?: string;
  name?: string;
  kind?: string;
  status?: string;
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface AgentPlanEntry {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface AgentPromptResult {
  content: string;
  sessionId: string;
  stopReason?: string;
  thought?: string;
  usage?: AgentUsage;
  toolCalls?: AgentToolCall[];
  plan?: AgentPlanEntry[];
  raw?: unknown;
}

export interface AgentRuntimeClient {
  readonly providerId: string;
  readonly transport: AgentTransport;
  readonly capabilities: AgentRuntimeCapabilities;

  createSession(config?: AgentSessionConfig): Promise<{ sessionId: string }>;
  resumeSession(sessionId: string, config?: AgentSessionConfig): Promise<{ sessionId: string }>;
  send(request: AgentPromptRequest, sessionConfig?: AgentSessionConfig): Promise<AgentPromptResult>;
  stream(
    request: AgentPromptRequest,
    onChunk: (chunk: string) => void,
    sessionConfig?: AgentSessionConfig
  ): Promise<AgentPromptResult>;
  stop(): Promise<void>;
}

export interface AgentProviderDefinition {
  id: string;
  displayName: string;
  transport: AgentTransport;
  capabilities: AgentRuntimeCapabilities;
  description?: string;
  aliases?: string[];
}

export class AgentProviderRegistry {
  private readonly providers = new Map<string, AgentProviderDefinition>();
  private readonly aliases = new Map<string, string>();

  register(provider: AgentProviderDefinition): void {
    const id = normalizeKey(provider.id);
    const normalizedProvider: AgentProviderDefinition = provider.aliases
      ? {
          ...provider,
          id,
          aliases: provider.aliases.map(normalizeKey),
        }
      : {
          ...provider,
          id,
        };
    this.providers.set(id, normalizedProvider);

    this.aliases.set(id, id);
    for (const alias of provider.aliases ?? []) {
      this.aliases.set(normalizeKey(alias), id);
    }
  }

  get(idOrAlias: string): AgentProviderDefinition | undefined {
    const resolvedId = this.aliases.get(normalizeKey(idOrAlias));
    return resolvedId ? this.providers.get(resolvedId) : undefined;
  }

  has(idOrAlias: string): boolean {
    return this.get(idOrAlias) !== undefined;
  }

  list(): AgentProviderDefinition[] {
    return Array.from(this.providers.values()).sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}
