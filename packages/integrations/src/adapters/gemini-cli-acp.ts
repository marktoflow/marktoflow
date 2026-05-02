import { type SDKInitializer, type ToolConfig } from '@marktoflow/core';
import {
  AcpAgentClient,
  resolveAcpClientOptions,
  type AcpAgentClientOptions,
} from './acp-agent.js';

export interface GeminiCliAcpClientOptions
  extends Omit<AcpAgentClientOptions, 'providerId' | 'displayName' | 'command'> {
  cliPath?: string;
  command?: string;
}

export class GeminiCliAcpClient extends AcpAgentClient {
  constructor(options: GeminiCliAcpClientOptions = {}) {
    super({
      providerId: 'gemini-acp',
      displayName: 'Gemini CLI ACP',
      command: options.command ?? options.cliPath ?? 'gemini',
      args: options.args ?? ['--acp'],
      cwd: options.cwd,
      env: options.env,
      model: options.model ?? 'gemini-2.5-pro',
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

export const GeminiCliAcpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    return createGeminiCliAcpClient(config);
  },
};

export function createGeminiCliAcpClient(config: ToolConfig): GeminiCliAcpClient {
  return new GeminiCliAcpClient(
    resolveAcpClientOptions(config, {
      providerId: 'gemini-acp',
      displayName: 'Gemini CLI ACP',
      command: 'gemini',
      args: ['--acp'],
      model: 'gemini-2.5-pro',
    })
  );
}
