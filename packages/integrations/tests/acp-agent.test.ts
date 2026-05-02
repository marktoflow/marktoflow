import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import type { Client } from '@agentclientprotocol/sdk';
import {
  AcpAgentClient,
  ClaudeAcpClient,
  ClaudeAcpInitializer,
  CodexAcpClient,
  CodexAcpInitializer,
  GeminiCliAcpClient,
  GeminiCliAcpInitializer,
  GitHubCopilotAcpClient,
  GitHubCopilotAcpInitializer,
  createAcpInitializer,
  registerIntegrations,
  resolveAcpClientOptions,
  type AcpAgentConnection,
  type AcpProcessHandle,
} from '../src/index.js';

class MockProcess extends EventEmitter implements AcpProcessHandle {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn(() => true);
}

function createMockConnectionFactory(overrides: Partial<AcpAgentConnection> = {}) {
  let capturedClient: Client | undefined;

  const connection: AcpAgentConnection = {
    initialize: vi.fn().mockResolvedValue({
      agentInfo: {
        name: 'Mock ACP Agent',
        version: '1.0.0',
      },
    }),
    newSession: vi.fn().mockResolvedValue({
      sessionId: 'session-1',
    }),
    prompt: vi.fn().mockResolvedValue({
      stopReason: 'end_turn',
      usage: {
        inputTokens: 5,
        outputTokens: 7,
        totalTokens: 12,
      },
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    setSessionMode: vi.fn().mockResolvedValue(undefined),
    unstable_setSessionModel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return {
    connection,
    createConnection: async (client: Client) => {
      capturedClient = client;
      return connection;
    },
    getClient: () => capturedClient,
  };
}

describe('ACP agent adapters', () => {
  it('aggregates ACP session updates into a streamed prompt result', async () => {
    const mockProcess = new MockProcess();
    const chunks: string[] = [];
    const { createConnection, connection, getClient } = createMockConnectionFactory({
      prompt: vi.fn().mockImplementation(async ({ sessionId }) => {
        const client = getClient();
        if (!client) {
          throw new Error('ACP client handler was not captured');
        }

        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'Hello ' },
          },
        });
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'ACP' },
          },
        });
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_thought_chunk',
            content: { type: 'text', text: 'thinking...' },
          },
        });
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 'tool-1',
            title: 'read workflow',
            status: 'completed',
          },
        });
        await client.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'plan',
            entries: [
              {
                content: 'Inspect workflow',
                status: 'completed',
                priority: 'high',
              },
            ],
          },
        });

        return {
          stopReason: 'end_turn',
          usage: {
            inputTokens: 5,
            outputTokens: 7,
            totalTokens: 12,
          },
        };
      }),
    });

    const client = new AcpAgentClient({
      providerId: 'custom-acp',
      displayName: 'Custom ACP Agent',
      command: 'mock-acp',
      model: 'gpt-5.4',
      mode: 'code',
      spawnProcess: vi.fn().mockReturnValue(mockProcess),
      createConnection,
    });

    const result = await client.stream(
      {
        prompt: 'Review the repository state',
      },
      (chunk) => chunks.push(chunk),
      {
        cwd: '.',
        model: 'gpt-5.4',
        mode: 'code',
        mcpServers: {
          local: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
          },
        },
        skills: [
          {
            name: 'repo-review',
            description: 'Review repository changes carefully',
            prompt: 'Focus on API and workflow changes.',
            mcpServers: {
              docs: {
                type: 'http',
                url: 'https://mcp.example.com',
                headers: {
                  authorization: 'Bearer token',
                },
              },
            },
          },
        ],
      }
    );

    expect(chunks).toEqual(['Hello ', 'ACP']);
    expect(result.content).toBe('Hello ACP');
    expect(result.thought).toBe('thinking...');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage).toEqual({
      inputTokens: 5,
      outputTokens: 7,
      thoughtTokens: undefined,
      totalTokens: 12,
    });
    expect(result.toolCalls).toEqual([
      {
        toolCallId: 'tool-1',
        name: 'read workflow',
        kind: undefined,
        status: 'completed',
        rawInput: undefined,
        rawOutput: undefined,
      },
    ]);
    expect(result.plan).toEqual([
      {
        content: 'Inspect workflow',
        status: 'completed',
        priority: 'high',
      },
    ]);
    expect(connection.newSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.any(String),
        mcpServers: expect.arrayContaining([
          expect.objectContaining({
            type: 'stdio',
            name: 'local',
            command: 'npx',
          }),
          expect.objectContaining({
            type: 'http',
            name: 'docs',
            url: 'https://mcp.example.com',
          }),
        ]),
      })
    );
    expect(connection.setSessionMode).toHaveBeenCalledWith({
      sessionId: 'session-1',
      modeId: 'code',
    });
    expect(connection.unstable_setSessionModel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      modelId: 'gpt-5.4',
    });
  });

  it('selects allow_once permission outcomes when configured', async () => {
    const mockProcess = new MockProcess();
    const { createConnection, getClient } = createMockConnectionFactory();
    const client = new AcpAgentClient({
      providerId: 'custom-acp',
      displayName: 'Custom ACP Agent',
      command: 'mock-acp',
      permissionPolicy: 'allow-once',
      spawnProcess: vi.fn().mockReturnValue(mockProcess),
      createConnection,
    });

    await client.start();

    const permissionResponse = await getClient()?.requestPermission({
      sessionId: 'session-1',
      options: [
        {
          optionId: 'reject',
          kind: 'reject_once',
          name: 'Reject once',
        },
        {
          optionId: 'allow',
          kind: 'allow_once',
          name: 'Allow once',
        },
      ],
      toolCall: {
        toolCallId: 'tool-1',
        status: 'pending',
      },
    });

    expect(permissionResponse).toEqual({
      outcome: {
        outcome: 'selected',
        optionId: 'allow',
      },
    });
  });

  it('parses ACP client options from tool config', () => {
    const options = resolveAcpClientOptions(
      {
        sdk: 'custom-acp',
        auth: {
          command: 'custom-acp',
          permissionPolicy: 'allow-always',
        },
        options: {
          args: ['--stdio'],
          model: 'claude-sonnet-4.5',
          mode: 'architect',
          env: {
            ACP_TOKEN: 'test-token',
          },
        },
      },
      {
        providerId: 'custom-acp',
        displayName: 'Custom ACP Agent',
      }
    );

    expect(options).toEqual(
      expect.objectContaining({
        providerId: 'custom-acp',
        displayName: 'Custom ACP Agent',
        command: 'custom-acp',
        args: ['--stdio'],
        model: 'claude-sonnet-4.5',
        mode: 'architect',
        permissionPolicy: 'allow-always',
        env: {
          ACP_TOKEN: 'test-token',
        },
      })
    );
  });

  it('requires a command for custom ACP initializers', async () => {
    const initializer = createAcpInitializer({
      providerId: 'custom-acp',
      displayName: 'Custom ACP Agent',
    });

    await expect(
      initializer.initialize(
        {},
        {
          sdk: 'custom-acp',
          auth: {},
          options: {},
        }
      )
    ).rejects.toThrow('Custom ACP Agent requires a CLI command');
  });

  it('initializes the canonical provider-specific ACP clients', async () => {
    await expect(
      GitHubCopilotAcpInitializer.initialize(
        {},
        {
          sdk: 'copilot-acp',
          options: {},
        }
      )
    ).resolves.toBeInstanceOf(GitHubCopilotAcpClient);
    await expect(
      GeminiCliAcpInitializer.initialize(
        {},
        {
          sdk: 'gemini-acp',
          options: {},
        }
      )
    ).resolves.toBeInstanceOf(GeminiCliAcpClient);
    await expect(
      ClaudeAcpInitializer.initialize(
        {},
        {
          sdk: 'claude-code-acp',
          options: {},
        }
      )
    ).resolves.toBeInstanceOf(ClaudeAcpClient);
    await expect(
      CodexAcpInitializer.initialize(
        {},
        {
          sdk: 'codex-acp',
          options: {},
        }
      )
    ).resolves.toBeInstanceOf(CodexAcpClient);

    const registry = new SDKRegistry(async () => null);
    registerIntegrations(registry);
    registry.registerTools({
      agent: {
        sdk: 'copilot-acp',
      },
    });

    await expect(registry.load('agent')).resolves.toBeInstanceOf(GitHubCopilotAcpClient);
  });
});
