import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve as resolveFilePath } from 'node:path';
import { Readable, Writable } from 'node:stream';
import {
  type AgentMcpServerConfig,
  type AgentPlanEntry,
  type AgentPromptRequest,
  type AgentPromptResult,
  type AgentRuntimeCapabilities,
  type AgentRuntimeClient,
  type AgentSessionConfig,
  type AgentSkillDefinition,
  type AgentToolCall,
  type SDKInitializer,
  type ToolConfig,
} from '@marktoflow/core';
import {
  type Client,
  type InitializeResponse,
  type McpServer,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionInfo,
  type SessionNotification,
  type ToolCall,
  type ToolCallUpdate,
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
} from '@agentclientprotocol/sdk';

export type AcpPermissionPolicy = 'cancel' | 'allow-once' | 'allow-always';

export interface AcpProcessHandle {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  once(event: 'error', listener: (error: Error) => void): this;
  removeListener(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  removeListener(event: 'error', listener: (error: Error) => void): this;
}

type AcpStream = ReturnType<typeof ndJsonStream>;
export type AcpAgentConnection = Pick<
  ClientSideConnection,
  'initialize' | 'newSession' | 'prompt' | 'cancel'
> &
  Partial<
    Pick<
      ClientSideConnection,
      | 'closeSession'
      | 'listSessions'
      | 'loadSession'
      | 'resumeSession'
      | 'setSessionMode'
      | 'unstable_setSessionModel'
    >
  >;

export type AcpProcessSpawner = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv }
) => AcpProcessHandle;

export type AcpConnectionFactory = (
  client: Client,
  stream: AcpStream
) => AcpAgentConnection | Promise<AcpAgentConnection>;

export interface AcpAgentClientOptions {
  providerId: string;
  displayName?: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  model?: string;
  mode?: string;
  systemMessage?: string;
  autoStart?: boolean;
  permissionPolicy?: AcpPermissionPolicy;
  mcpServers?: Record<string, AgentMcpServerConfig>;
  skills?: AgentSkillDefinition[];
  spawnProcess?: AcpProcessSpawner;
  createConnection?: AcpConnectionFactory;
}

export interface AcpInitializerDefaults {
  providerId: string;
  displayName: string;
  command?: string;
  args?: string[];
  model?: string;
  mode?: string;
  autoStart?: boolean;
  permissionPolicy?: AcpPermissionPolicy;
}

export interface AcpChatCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: unknown;
  }>;
  model?: string;
  sessionId?: string;
  cwd?: string;
  mode?: string;
  systemMessage?: string;
  additionalDirectories?: string[];
  stream?: boolean;
}

export interface AcpChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SessionCollector {
  contentChunks: string[];
  thoughtChunks: string[];
  toolCalls: Map<string, AgentToolCall>;
  plan: AgentPlanEntry[];
  usage?: AgentPromptResult['usage'];
  onChunk?: (chunk: string) => void;
}

interface SessionState {
  config: AgentSessionConfig;
  info?: Pick<SessionInfo, 'sessionId' | 'title' | 'updatedAt'>;
}

const DEFAULT_CAPABILITIES: AgentRuntimeCapabilities = {
  prompt: true,
  streaming: true,
  sessionLifecycle: true,
  cancellation: true,
  mcp: true,
  skills: true,
  modelSelection: true,
  modeSelection: true,
  toolPermissions: true,
};

export class AcpAgentClient implements AgentRuntimeClient {
  readonly providerId: string;
  readonly transport = 'acp' as const;
  readonly capabilities: AgentRuntimeCapabilities = { ...DEFAULT_CAPABILITIES };
  readonly chat: {
    completions: {
      create: (request: AcpChatCompletionRequest) => Promise<AcpChatCompletionResponse>;
    };
  };

  private readonly displayName: string;
  private readonly command: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private readonly autoStart: boolean;
  private readonly permissionPolicy: AcpPermissionPolicy;
  private readonly spawnProcess: AcpProcessSpawner;
  private readonly createConnection: AcpConnectionFactory;
  private readonly defaultSessionConfig: AgentSessionConfig;
  private readonly sessionCollectors = new Map<string, SessionCollector>();
  private readonly sessions = new Map<string, SessionState>();

  private process?: AcpProcessHandle;
  private connection?: AcpAgentConnection;
  private initializeResponse?: InitializeResponse;
  private startPromise?: Promise<void>;
  private stderrTail = '';
  private lastProcessError?: Error;

  constructor(options: AcpAgentClientOptions) {
    this.providerId = options.providerId;
    this.displayName = options.displayName ?? options.providerId;
    this.command = options.command;
    this.args = options.args ?? [];
    this.env = options.env;
    this.autoStart = options.autoStart ?? false;
    this.permissionPolicy = options.permissionPolicy ?? 'cancel';
    this.defaultSessionConfig = {
      cwd: options.cwd,
      model: options.model,
      mode: options.mode,
      systemMessage: options.systemMessage,
      mcpServers: options.mcpServers,
      skills: options.skills,
    };
    this.spawnProcess = options.spawnProcess ?? defaultSpawnProcess;
    this.createConnection =
      options.createConnection ??
      ((client, stream) => new ClientSideConnection(() => client, stream));
    this.chat = {
      completions: {
        create: async (request) => this.createChatCompletion(request),
      },
    };

    if (this.autoStart) {
      void this.start();
    }
  }

  async start(): Promise<void> {
    if (this.connection) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = undefined;
    });

    return this.startPromise;
  }

  async createSession(config?: AgentSessionConfig): Promise<{ sessionId: string }> {
    await this.start();

    const sessionConfig = this.resolveSessionConfig(config);
    const connection = this.requireConnection();
    const response = await connection.newSession({
      cwd: resolvePath(sessionConfig.cwd),
      additionalDirectories: normalizeDirectories(sessionConfig.additionalDirectories),
      mcpServers: toAcpMcpServers(sessionConfig),
    });

    await this.applySessionSettings(response.sessionId, sessionConfig);
    this.sessions.set(response.sessionId, {
      config: sessionConfig,
      info: {
        sessionId: response.sessionId,
      },
    });

    return { sessionId: response.sessionId };
  }

  async resumeSession(
    sessionId: string,
    config?: AgentSessionConfig
  ): Promise<{ sessionId: string }> {
    await this.start();

    const sessionConfig = this.resolveSessionConfig(config);
    const connection = this.requireConnection();

    if (connection.resumeSession) {
      await connection.resumeSession({
        sessionId,
        cwd: resolvePath(sessionConfig.cwd),
        additionalDirectories: normalizeDirectories(sessionConfig.additionalDirectories),
        mcpServers: toAcpMcpServers(sessionConfig),
      });
    } else if (connection.loadSession) {
      await connection.loadSession({
        sessionId,
        cwd: resolvePath(sessionConfig.cwd),
        additionalDirectories: normalizeDirectories(sessionConfig.additionalDirectories),
        mcpServers: toAcpMcpServers(sessionConfig),
      });
    } else {
      throw new Error(`${this.displayName} does not support resuming ACP sessions`);
    }

    await this.applySessionSettings(sessionId, sessionConfig);
    this.sessions.set(sessionId, {
      config: sessionConfig,
      info: {
        sessionId,
      },
    });

    return { sessionId };
  }

  async send(
    request: AgentPromptRequest,
    sessionConfig?: AgentSessionConfig
  ): Promise<AgentPromptResult> {
    return this.sendInternal(request, undefined, sessionConfig);
  }

  async stream(
    request: AgentPromptRequest,
    onChunk: (chunk: string) => void,
    sessionConfig?: AgentSessionConfig
  ): Promise<AgentPromptResult> {
    return this.sendInternal(request, onChunk, sessionConfig);
  }

  async cancel(sessionId: string): Promise<void> {
    await this.start();
    await this.requireConnection().cancel({ sessionId });
  }

  async closeSession(sessionId: string): Promise<void> {
    const connection = this.connection;
    if (!connection?.closeSession) {
      return;
    }

    await connection.closeSession({ sessionId });
    this.sessions.delete(sessionId);
    this.sessionCollectors.delete(sessionId);
  }

  async listSessions(): Promise<Array<{ id: string; title?: string; updatedAt?: string }>> {
    await this.start();

    const connection = this.requireConnection();
    if (!connection.listSessions) {
      return Array.from(this.sessions.entries()).map(([id, state]) => ({
        id,
        title: state.info?.title ?? undefined,
        updatedAt: state.info?.updatedAt ?? undefined,
      }));
    }

    const response = await connection.listSessions({});
    return response.sessions.map((session: SessionInfo) => ({
      id: session.sessionId,
      title: session.title ?? undefined,
      updatedAt: session.updatedAt ?? undefined,
    }));
  }

  async listModels(): Promise<Array<{ id: string; name?: string }>> {
    const model = this.defaultSessionConfig.model;
    return model ? [{ id: model, name: model }] : [];
  }

  async ping(): Promise<{ providerId: string; agentInfo?: InitializeResponse['agentInfo'] }> {
    await this.start();
    return {
      providerId: this.providerId,
      agentInfo: this.initializeResponse?.agentInfo,
    };
  }

  getState(): {
    started: boolean;
    providerId: string;
    command: string;
    args: string[];
    sessionIds: string[];
    agentInfo?: InitializeResponse['agentInfo'];
  } {
    return {
      started: !!this.connection,
      providerId: this.providerId,
      command: this.command,
      args: [...this.args],
      sessionIds: Array.from(this.sessions.keys()),
      agentInfo: this.initializeResponse?.agentInfo,
    };
  }

  async stop(): Promise<void> {
    const connection = this.connection;
    if (connection?.closeSession) {
      const sessionIds = Array.from(this.sessions.keys());
      await Promise.allSettled(sessionIds.map((sessionId) => connection.closeSession?.({ sessionId })));
    }

    this.resetRuntimeState();
    this.stopProcess('SIGTERM');
  }

  async forceStop(): Promise<void> {
    this.resetRuntimeState();
    this.stopProcess('SIGKILL');
  }

  protected resolveSessionConfig(config?: AgentSessionConfig): AgentSessionConfig {
    return {
      cwd: config?.cwd ?? this.defaultSessionConfig.cwd,
      additionalDirectories: config?.additionalDirectories ?? this.defaultSessionConfig.additionalDirectories,
      model: config?.model ?? this.defaultSessionConfig.model,
      mode: config?.mode ?? this.defaultSessionConfig.mode,
      systemMessage: config?.systemMessage ?? this.defaultSessionConfig.systemMessage,
      mcpServers: mergeMcpServers(this.defaultSessionConfig.mcpServers, config?.mcpServers),
      skills: mergeSkills(this.defaultSessionConfig.skills, config?.skills),
      metadata: {
        ...(this.defaultSessionConfig.metadata ?? {}),
        ...(config?.metadata ?? {}),
      },
    };
  }

  private async startInternal(): Promise<void> {
    const child = this.spawnProcess(this.command, this.args, {
      cwd: this.defaultSessionConfig.cwd,
      env: {
        ...process.env,
        ...(this.env ?? {}),
      },
    });

    this.process = child;
    this.stderrTail = '';
    this.lastProcessError = undefined;

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      this.stderrTail = trimTail(`${this.stderrTail}${chunk}`);
    });
    child.once('exit', this.onProcessExit);
    child.once('error', this.onProcessError);

    const stream = ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    );

    const client: Client = {
      requestPermission: async (params) => this.handlePermissionRequest(params),
      sessionUpdate: async (params) => this.handleSessionUpdate(params),
    };

    try {
      this.connection = await this.createConnection(client, stream);
      this.initializeResponse = await this.requireConnection().initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientInfo: {
          name: 'marktoflow',
          version: '2.0.0',
        },
      });
    } catch (error) {
      this.stopProcess('SIGKILL');
      this.resetRuntimeState();
      throw this.decorateError(error);
    }
  }

  private async sendInternal(
    request: AgentPromptRequest,
    onChunk?: (chunk: string) => void,
    sessionConfig?: AgentSessionConfig
  ): Promise<AgentPromptResult> {
    await this.start();

    const resolvedSessionConfig = this.resolveSessionConfig(sessionConfig);
    const sessionId = await this.resolveSessionId(request.sessionId, resolvedSessionConfig);
    const collector: SessionCollector = {
      contentChunks: [],
      thoughtChunks: [],
      toolCalls: new Map(),
      plan: [],
      onChunk,
    };

    this.sessionCollectors.set(sessionId, collector);

    try {
      const response = await this.requireConnection().prompt({
        sessionId,
        messageId: request.messageId ?? randomUUID(),
        prompt: [
          {
            type: 'text',
            text: buildPromptText(request.prompt, resolvedSessionConfig),
          },
        ],
      });

      return {
        sessionId,
        content: collector.contentChunks.join(''),
        thought: collector.thoughtChunks.length > 0 ? collector.thoughtChunks.join('') : undefined,
        stopReason: response.stopReason,
        usage: response.usage
          ? {
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
              thoughtTokens: response.usage.thoughtTokens ?? undefined,
              totalTokens: response.usage.totalTokens,
            }
          : collector.usage,
        toolCalls:
          collector.toolCalls.size > 0 ? Array.from(collector.toolCalls.values()) : undefined,
        plan: collector.plan.length > 0 ? collector.plan : undefined,
        raw: response,
      };
    } catch (error) {
      throw this.decorateError(error);
    } finally {
      this.sessionCollectors.delete(sessionId);
    }
  }

  private async resolveSessionId(
    sessionId: string | undefined,
    sessionConfig: AgentSessionConfig
  ): Promise<string> {
    if (!sessionId) {
      const session = await this.createSession(sessionConfig);
      return session.sessionId;
    }

    if (!this.sessions.has(sessionId)) {
      await this.resumeSession(sessionId, sessionConfig);
      return sessionId;
    }

    await this.applySessionSettings(sessionId, sessionConfig);
    return sessionId;
  }

  private async applySessionSettings(
    sessionId: string,
    sessionConfig: AgentSessionConfig
  ): Promise<void> {
    const connection = this.requireConnection();

    if (sessionConfig.mode && connection.setSessionMode) {
      await connection.setSessionMode({
        sessionId,
        modeId: sessionConfig.mode,
      });
    }

    if (sessionConfig.model && connection.unstable_setSessionModel) {
      await connection.unstable_setSessionModel({
        sessionId,
        modelId: sessionConfig.model,
      });
    }
  }

  private requireConnection(): AcpAgentConnection {
    if (!this.connection) {
      throw new Error(`${this.displayName} ACP connection is not started`);
    }
    return this.connection;
  }

  private async handlePermissionRequest(
    request: RequestPermissionRequest
  ): Promise<RequestPermissionResponse> {
    const preferredKinds =
      this.permissionPolicy === 'allow-always'
        ? ['allow_always', 'allow_once']
        : this.permissionPolicy === 'allow-once'
          ? ['allow_once']
          : [];

    const selectedOption = request.options.find((option) =>
      preferredKinds.includes(option.kind)
    );

    if (!selectedOption) {
      return {
        outcome: {
          outcome: 'cancelled',
        },
      };
    }

    return {
      outcome: {
        outcome: 'selected',
        optionId: selectedOption.optionId,
      },
    };
  }

  private async handleSessionUpdate(notification: SessionNotification): Promise<void> {
    const collector = this.sessionCollectors.get(notification.sessionId);
    const update = notification.update;

    if (update.sessionUpdate === 'agent_message_chunk') {
      const text = contentBlockToText(update.content);
      if (text && collector) {
        collector.contentChunks.push(text);
        collector.onChunk?.(text);
      }
      return;
    }

    if (update.sessionUpdate === 'agent_thought_chunk') {
      const text = contentBlockToText(update.content);
      if (text && collector) {
        collector.thoughtChunks.push(text);
      }
      return;
    }

    if (update.sessionUpdate === 'tool_call') {
      this.upsertToolCall(notification.sessionId, update, collector);
      return;
    }

    if (update.sessionUpdate === 'tool_call_update') {
      this.upsertToolCall(notification.sessionId, update, collector);
      return;
    }

    if (update.sessionUpdate === 'plan' && collector) {
      collector.plan = update.entries.map((entry) => ({
        content: entry.content,
        status: entry.status,
        priority: entry.priority,
      }));
      return;
    }

    if (update.sessionUpdate === 'usage_update' && collector) {
      collector.usage = {
        totalTokens: update.used,
      };
      return;
    }

    if (update.sessionUpdate === 'session_info_update') {
      const state = this.sessions.get(notification.sessionId);
      if (state) {
        state.info = {
          sessionId: notification.sessionId,
          title: update.title ?? state.info?.title,
          updatedAt: update.updatedAt ?? state.info?.updatedAt,
        };
      }
    }
  }

  private upsertToolCall(
    sessionId: string,
    update: ToolCall | ToolCallUpdate,
    collector?: SessionCollector
  ): void {
    const toolCallId = update.toolCallId;
    const current: AgentToolCall = collector?.toolCalls.get(toolCallId) ?? {
      toolCallId,
    };

    const next = {
      ...current,
      name:
        ('title' in update && update.title !== undefined ? update.title : undefined) ??
        current.name,
      kind: ('kind' in update && update.kind !== undefined ? update.kind : undefined) ?? current.kind,
      status:
        ('status' in update && update.status !== undefined ? update.status : undefined) ??
        current.status,
      rawInput:
        ('rawInput' in update && update.rawInput !== undefined ? update.rawInput : undefined) ??
        current.rawInput,
      rawOutput:
        ('rawOutput' in update && update.rawOutput !== undefined ? update.rawOutput : undefined) ??
        current.rawOutput,
    };

    if (collector) {
      collector.toolCalls.set(toolCallId, next);
    }

    const state = this.sessions.get(sessionId);
    if (state) {
      this.sessions.set(sessionId, state);
    }
  }

  private async createChatCompletion(
    request: AcpChatCompletionRequest
  ): Promise<AcpChatCompletionResponse> {
    if (request.stream) {
      throw new Error('ACP chat.completions.create does not support stream=true; use stream() instead');
    }

    const systemMessages = request.messages
      .filter((message) => message.role === 'system')
      .map((message) => normalizeContent(message.content));
    const nonSystemMessages = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => `${message.role.toUpperCase()}:\n${normalizeContent(message.content)}`);

    const sessionConfig: AgentSessionConfig = {
      cwd: request.cwd,
      additionalDirectories: request.additionalDirectories,
      model: request.model,
      mode: request.mode,
      systemMessage: [request.systemMessage, ...systemMessages].filter(Boolean).join('\n\n') || undefined,
    };

    const result = await this.send(
      {
        sessionId: request.sessionId,
        prompt: nonSystemMessages.join('\n\n'),
      },
      sessionConfig
    );

    return {
      id: `chatcmpl-${randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model ?? this.defaultSessionConfig.model ?? this.providerId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.content,
          },
          finish_reason: result.stopReason ?? null,
        },
      ],
      usage: result.usage
        ? {
            prompt_tokens: result.usage.inputTokens ?? 0,
            completion_tokens: result.usage.outputTokens ?? 0,
            total_tokens: result.usage.totalTokens ?? 0,
          }
        : undefined,
    };
  }

  private resetRuntimeState(): void {
    this.connection = undefined;
    this.initializeResponse = undefined;
    this.sessionCollectors.clear();
    this.sessions.clear();
  }

  private stopProcess(signal: NodeJS.Signals): void {
    const child = this.process;
    this.process = undefined;
    if (!child) {
      return;
    }

    child.removeListener('exit', this.onProcessExit);
    child.removeListener('error', this.onProcessError);

    try {
      child.kill(signal);
    } catch {
      // Ignore shutdown failures from already-exited processes.
    }
  }

  private decorateError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = this.stderrTail.trim();
    const processError = this.lastProcessError?.message;
    const details = [message, processError, stderr].filter(Boolean).join('\n');
    return new Error(details);
  }

  private readonly onProcessExit = () => {
    this.process = undefined;
    this.resetRuntimeState();
  };

  private readonly onProcessError = (error: Error) => {
    this.lastProcessError = error;
  };
}

export function resolveAcpClientOptions(
  config: ToolConfig,
  defaults: AcpInitializerDefaults
): AcpAgentClientOptions {
  const auth = (config.auth ?? {}) as Record<string, unknown>;
  const options = (config.options ?? {}) as Record<string, unknown>;
  const command =
    asString(auth['command']) ??
    asString(auth['cli_path']) ??
    asString(options['command']) ??
    asString(options['cliPath']) ??
    defaults.command;

  if (!command) {
    throw new Error(
      `${defaults.displayName} requires a CLI command. Set auth.command or options.command.`
    );
  }

  const args = asStringArray(options['args']) ?? asStringArray(auth['args']) ?? defaults.args ?? [];
  const env = mergeStringMaps(options['env'], auth['env']);

  return {
    providerId: defaults.providerId,
    displayName: defaults.displayName,
    command,
    args,
    cwd: asString(options['cwd']) ?? asString(auth['cwd']) ?? undefined,
    env,
    model: asString(options['model']) ?? defaults.model,
    mode: asString(options['mode']) ?? defaults.mode,
    systemMessage: asString(options['systemMessage']) ?? undefined,
    autoStart: asBoolean(options['autoStart']) ?? defaults.autoStart ?? false,
    permissionPolicy:
      asPermissionPolicy(options['permissionPolicy']) ??
      asPermissionPolicy(auth['permissionPolicy']) ??
      defaults.permissionPolicy,
    mcpServers: asRecord<AgentMcpServerConfig>(options['mcpServers']),
    skills: asSkills(options['skills']),
  };
}

export function createAcpInitializer(defaults: AcpInitializerDefaults): SDKInitializer {
  return {
    async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
      return new AcpAgentClient(resolveAcpClientOptions(config, defaults));
    },
  };
}

function defaultSpawnProcess(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv }
): AcpProcessHandle {
  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as unknown as AcpProcessHandle;
}

function mergeMcpServers(
  base?: Record<string, AgentMcpServerConfig>,
  override?: Record<string, AgentMcpServerConfig>
): Record<string, AgentMcpServerConfig> | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(override ?? {}),
  };
}

function mergeSkills(
  base?: AgentSkillDefinition[],
  override?: AgentSkillDefinition[]
): AgentSkillDefinition[] | undefined {
  if (!base?.length && !override?.length) {
    return undefined;
  }

  const merged = [...(base ?? []), ...(override ?? [])];
  return merged.length > 0 ? merged : undefined;
}

function toAcpMcpServers(sessionConfig: AgentSessionConfig): McpServer[] {
  const mergedMcpServers: Record<string, AgentMcpServerConfig> = {
    ...(sessionConfig.mcpServers ?? {}),
  };

  for (const skill of sessionConfig.skills ?? []) {
    Object.assign(mergedMcpServers, skill.mcpServers ?? {});
  }

  return Object.entries(mergedMcpServers).map(([name, config]) => {
    const serverName = config.name ?? name;

    if (config.type === 'stdio') {
      if (!config.command) {
        throw new Error(`MCP server '${serverName}' is missing a command`);
      }

      return {
        type: 'stdio',
        name: serverName,
        command: config.command,
        args: config.args ?? [],
        env: toEnvVariables(config.env),
      };
    }

    if (!config.url) {
      throw new Error(`MCP server '${serverName}' is missing a url`);
    }

    return {
      type: config.type,
      name: serverName,
      url: config.url,
      headers: toHeaders(config.headers),
    } as McpServer;
  });
}

function buildPromptText(prompt: string, sessionConfig: AgentSessionConfig): string {
  const sections: string[] = [];

  if (sessionConfig.systemMessage) {
    sections.push(`System instructions:\n${sessionConfig.systemMessage}`);
  }

  if (sessionConfig.skills?.length) {
    const skillBlocks = sessionConfig.skills
      .map((skill) => {
        const details = [
          skill.description ? `Description: ${skill.description}` : undefined,
          skill.prompt ? `Instructions:\n${skill.prompt}` : undefined,
          skill.tools?.length ? `Tools: ${skill.tools.join(', ')}` : undefined,
        ]
          .filter(Boolean)
          .join('\n');

        return `Skill: ${skill.name}${details ? `\n${details}` : ''}`;
      })
      .join('\n\n');

    if (skillBlocks) {
      sections.push(`Enabled skills:\n${skillBlocks}`);
    }
  }

  sections.push(prompt);
  return sections.join('\n\n');
}

function contentBlockToText(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  if ('type' in content && content.type === 'text' && 'text' in content && typeof content.text === 'string') {
    return content.text;
  }

  if ('type' in content && content.type === 'resource_link' && 'uri' in content && typeof content.uri === 'string') {
    return content.uri;
  }

  return '';
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (
          item &&
          typeof item === 'object' &&
          'type' in item &&
          item.type === 'text' &&
          'text' in item &&
          typeof item.text === 'string'
        ) {
          return item.text;
        }

        return JSON.stringify(item);
      })
      .join('\n');
  }

  if (content === null || content === undefined) {
    return '';
  }

  return JSON.stringify(content);
}

function toHeaders(headers?: Record<string, string>): Array<{ name: string; value: string }> {
  return Object.entries(headers ?? {}).map(([name, value]) => ({ name, value }));
}

function toEnvVariables(env?: Record<string, string>): Array<{ name: string; value: string }> {
  return Object.entries(env ?? {}).map(([name, value]) => ({ name, value }));
}

function normalizeDirectories(directories?: string[]): string[] | undefined {
  if (!directories?.length) {
    return undefined;
  }

  return directories.map((directory) => resolvePath(directory));
}

function resolvePath(pathValue?: string): string {
  return resolveFilePath(pathValue ?? process.cwd());
}

function trimTail(text: string, maxLength = 8192): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(text.length - maxLength);
}

function mergeStringMaps(
  first: unknown,
  second: unknown
): Record<string, string> | undefined {
  const firstMap = asRecord<string>(first) ?? {};
  const secondMap = asRecord<string>(second) ?? {};
  const merged = {
    ...secondMap,
    ...firstMap,
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function asPermissionPolicy(value: unknown): AcpPermissionPolicy | undefined {
  return value === 'cancel' || value === 'allow-once' || value === 'allow-always'
    ? value
    : undefined;
}

function asSkills(value: unknown): AgentSkillDefinition[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const skills = value.filter((item): item is AgentSkillDefinition => {
    return !!item && typeof item === 'object' && 'name' in item && typeof item.name === 'string';
  });

  return skills.length > 0 ? skills : undefined;
}

function asRecord<T>(value: unknown): Record<string, T> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, T>;
}
