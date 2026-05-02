import { type SDKInitializer, type ToolConfig } from '@marktoflow/core';
import {
  AcpAgentClient,
  resolveAcpClientOptions,
  type AcpAgentClientOptions,
} from './acp-agent.js';

export interface CodexAcpClientOptions
  extends Omit<AcpAgentClientOptions, 'providerId' | 'displayName' | 'command'> {
  cliPath?: string;
  command?: string;
}

export class CodexAcpClient extends AcpAgentClient {
  constructor(options: CodexAcpClientOptions = {}) {
    super({
      providerId: 'codex-acp',
      displayName: 'Codex ACP',
      command: options.command ?? options.cliPath ?? 'codex',
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

export const CodexAcpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    return createCodexAcpClient(config);
  },
};

export function createCodexAcpClient(config: ToolConfig): CodexAcpClient {
  return new CodexAcpClient(
    resolveAcpClientOptions(config, {
      providerId: 'codex-acp',
      displayName: 'Codex ACP',
      command: 'codex',
      args: ['--acp'],
    })
  );
}
