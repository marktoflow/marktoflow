import { type SDKInitializer, type ToolConfig } from '@marktoflow/core';
import {
  AcpAgentClient,
  resolveAcpClientOptions,
  type AcpAgentClientOptions,
} from './acp-agent.js';

export interface ClaudeAcpClientOptions
  extends Omit<AcpAgentClientOptions, 'providerId' | 'displayName' | 'command'> {
  command?: string;
}

export class ClaudeAcpClient extends AcpAgentClient {
  constructor(options: ClaudeAcpClientOptions = {}) {
    super({
      providerId: 'claude-code-acp',
      displayName: 'Claude Code ACP',
      command: options.command ?? 'claude',
      args: options.args ?? ['--acp'],
      cwd: options.cwd,
      env: options.env,
      model: options.model,
      mode: options.mode,
      systemMessage: options.systemMessage,
      autoStart: options.autoStart,
      permissionPolicy: options.permissionPolicy,
      mcpServers: options.mcpServers,
      skills: options.skills,
      spawnProcess: options.spawnProcess,
      createConnection: options.createConnection,
    });
  }
}

export const ClaudeAcpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    return createClaudeAcpClient(config);
  },
};

export function createClaudeAcpClient(config: ToolConfig): ClaudeAcpClient {
  return new ClaudeAcpClient(
    resolveAcpClientOptions(config, {
      providerId: 'claude-code-acp',
      displayName: 'Claude Code ACP',
      command: 'claude',
      args: ['--acp'],
    })
  );
}
