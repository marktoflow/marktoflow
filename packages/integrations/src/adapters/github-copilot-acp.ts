import { type SDKInitializer, type ToolConfig } from '@marktoflow/core';
import {
  AcpAgentClient,
  resolveAcpClientOptions,
  type AcpAgentClientOptions,
} from './acp-agent.js';

export interface GitHubCopilotAcpClientOptions
  extends Omit<AcpAgentClientOptions, 'providerId' | 'displayName' | 'command'> {
  cliPath?: string;
  command?: string;
}

export class GitHubCopilotAcpClient extends AcpAgentClient {
  constructor(options: GitHubCopilotAcpClientOptions = {}) {
    super({
      providerId: 'copilot-acp',
      displayName: 'GitHub Copilot ACP',
      command: options.command ?? options.cliPath ?? 'copilot',
      args: options.args ?? ['--acp', '--stdio'],
      cwd: options.cwd,
      env: options.env,
      model: options.model ?? 'gpt-4.1',
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

export const GitHubCopilotAcpInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    return createGitHubCopilotAcpClient(config);
  },
};

export function createGitHubCopilotAcpClient(config: ToolConfig): GitHubCopilotAcpClient {
  return new GitHubCopilotAcpClient(
    resolveAcpClientOptions(config, {
      providerId: 'copilot-acp',
      displayName: 'GitHub Copilot ACP',
      command: 'copilot',
      args: ['--acp', '--stdio'],
      model: 'gpt-4.1',
    })
  );
}
