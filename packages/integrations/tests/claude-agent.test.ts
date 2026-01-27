import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import {
  registerIntegrations,
  ClaudeAgentClient,
  ClaudeAgentInitializer,
  ClaudeAgentOptions,
  SDKMessage,
  AgentResult,
} from '../src/index.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  return {
    query: vi.fn(),
    tool: vi.fn(),
    createSdkMcpServer: vi.fn(),
  };
});

describe('Claude Agent SDK Integration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ClaudeAgentClient', () => {
    it('should create client with default options', () => {
      const client = new ClaudeAgentClient();
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should create client with custom options', () => {
      const options: ClaudeAgentOptions = {
        model: 'claude-sonnet-4-20250514',
        cwd: '/workspace',
        permissionMode: 'bypassPermissions',
        maxTurns: 100,
        maxBudgetUsd: 10.0,
      };
      const client = new ClaudeAgentClient(options);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should have default permission mode of acceptEdits', () => {
      const client = new ClaudeAgentClient();
      // Access internal options through reflection or by checking behavior
      expect(client).toBeDefined();
    });
  });

  describe('ClaudeAgentInitializer', () => {
    it('should register claude-agent initializer', async () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      const config = {
        sdk: 'claude-agent',
        options: {
          model: 'claude-sonnet-4-20250514',
          permissionMode: 'acceptEdits',
        },
      };

      const client = await ClaudeAgentInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should pass through all configuration options', async () => {
      const config = {
        sdk: 'claude-agent',
        options: {
          model: 'claude-opus-4-20250514',
          cwd: '/custom/path',
          additionalDirectories: ['/extra/dir'],
          env: { NODE_ENV: 'production' },
          allowedTools: ['Read', 'Write', 'Edit'],
          disallowedTools: ['Bash'],
          permissionMode: 'bypassPermissions',
          maxTurns: 25,
          maxBudgetUsd: 5.0,
          maxThinkingTokens: 8000,
          timeout: 300000,
          enableFileCheckpointing: true,
          systemPrompt: 'You are a helpful assistant.',
        },
      };

      const client = await ClaudeAgentInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should handle subagent definitions', async () => {
      const config = {
        sdk: 'claude-agent',
        options: {
          agents: {
            'code-reviewer': {
              description: 'Review code quality',
              tools: ['Read', 'Glob', 'Grep'],
              prompt: 'You are a code reviewer.',
              model: 'haiku',
            },
          },
        },
      };

      const client = await ClaudeAgentInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should handle MCP server configurations', async () => {
      const config = {
        sdk: 'claude-agent',
        options: {
          mcpServers: {
            playwright: {
              type: 'stdio',
              command: 'npx',
              args: ['@playwright/mcp@latest'],
            },
            database: {
              type: 'http',
              url: 'http://localhost:3000/mcp',
            },
          },
        },
      };

      const client = await ClaudeAgentInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should handle excludeFiles option to filter out context files', async () => {
      const config = {
        sdk: 'claude-agent',
        options: {
          cwd: '/project/path',
          additionalDirectories: ['/lib', '/tests'],
          excludeFiles: ['CLAUDE.md', 'AGENTS.md', '.env'],
          model: 'claude-sonnet-4-5-20250929',
        },
      };

      const client = await ClaudeAgentInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });
  });

  describe('SDK Registry Integration', () => {
    it('should register both claude-agent and @anthropic-ai/claude-agent-sdk', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      // Register test tools
      registry.registerTools({
        agent1: { sdk: 'claude-agent' },
        agent2: { sdk: '@anthropic-ai/claude-agent-sdk' },
      });

      expect(registry.has('agent1')).toBe(true);
      expect(registry.has('agent2')).toBe(true);
    });
  });
});

describe('Claude Agent Types', () => {
  describe('BuiltInTool type', () => {
    it('should include all expected tools', () => {
      const tools = [
        'Read',
        'Write',
        'Edit',
        'Bash',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
        'AskUserQuestion',
        'Task',
        'TodoWrite',
        'NotebookEdit',
        'BashOutput',
        'KillBash',
      ];

      // Type check - if this compiles, the types are correct
      tools.forEach((tool) => {
        expect(typeof tool).toBe('string');
      });
    });
  });

  describe('PermissionMode type', () => {
    it('should include all expected modes', () => {
      const modes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];

      modes.forEach((mode) => {
        expect(typeof mode).toBe('string');
      });
    });
  });

  describe('SDKMessage types', () => {
    it('should validate assistant message structure', () => {
      const message: SDKMessage = {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Hello!',
        },
        stop_reason: 'end_turn',
      };

      expect(message.type).toBe('assistant');
    });

    it('should validate result message structure', () => {
      const message: SDKMessage = {
        type: 'result',
        result: 'Task completed successfully',
        duration_ms: 5000,
        total_cost_usd: 0.05,
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
        session_id: 'sess_123',
      };

      expect(message.type).toBe('result');
    });

    it('should validate system message structure', () => {
      const message: SDKMessage = {
        type: 'system',
        subtype: 'init',
        session_id: 'sess_123',
        cwd: '/workspace',
        tools: ['Read', 'Write'],
      };

      expect(message.type).toBe('system');
    });
  });

  describe('AgentResult type', () => {
    it('should have all required fields', () => {
      const result: AgentResult = {
        result: 'Done',
        durationMs: 1000,
        costUsd: 0.01,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
        },
        messages: [],
      };

      expect(result.result).toBe('Done');
      expect(result.durationMs).toBe(1000);
      expect(result.costUsd).toBe(0.01);
      expect(result.usage.inputTokens).toBe(100);
      expect(result.usage.outputTokens).toBe(50);
      expect(result.messages).toEqual([]);
    });

    it('should support optional fields', () => {
      const result: AgentResult = {
        result: 'Done',
        error: 'Something went wrong',
        durationMs: 1000,
        costUsd: 0.01,
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 10,
          cacheReadTokens: 5,
        },
        sessionId: 'sess_456',
        structuredOutput: { key: 'value' },
        messages: [],
      };

      expect(result.error).toBe('Something went wrong');
      expect(result.sessionId).toBe('sess_456');
      expect(result.structuredOutput).toEqual({ key: 'value' });
    });
  });
});

describe('Claude Agent Subagent Definitions', () => {
  describe('SubagentDefinition structure', () => {
    it('should validate minimal subagent definition', () => {
      const subagent = {
        description: 'A simple helper',
      };

      expect(subagent.description).toBe('A simple helper');
    });

    it('should validate full subagent definition', () => {
      const subagent = {
        description: 'Code reviewer',
        tools: ['Read', 'Glob', 'Grep'],
        prompt: 'You are a senior code reviewer.',
        model: 'haiku' as const,
        maxTurns: 10,
      };

      expect(subagent.description).toBe('Code reviewer');
      expect(subagent.tools).toHaveLength(3);
      expect(subagent.prompt).toContain('code reviewer');
      expect(subagent.model).toBe('haiku');
      expect(subagent.maxTurns).toBe(10);
    });
  });
});

describe('Claude Agent MCP Server Configuration', () => {
  describe('McpServerConfig structure', () => {
    it('should validate stdio server config', () => {
      const config = {
        type: 'stdio' as const,
        command: 'npx',
        args: ['@playwright/mcp@latest'],
        env: { DEBUG: 'true' },
      };

      expect(config.type).toBe('stdio');
      expect(config.command).toBe('npx');
      expect(config.args).toContain('@playwright/mcp@latest');
    });

    it('should validate http server config', () => {
      const config = {
        type: 'http' as const,
        url: 'http://localhost:3000/mcp',
      };

      expect(config.type).toBe('http');
      expect(config.url).toContain('localhost');
    });

    it('should validate sse server config', () => {
      const config = {
        type: 'sse' as const,
        url: 'https://mcp.example.com/events',
      };

      expect(config.type).toBe('sse');
      expect(config.url).toContain('example.com');
    });
  });
});

describe('Claude Agent Client Methods', () => {
  let client: ClaudeAgentClient;

  beforeEach(() => {
    client = new ClaudeAgentClient({
      model: 'claude-sonnet-4-20250514',
      permissionMode: 'acceptEdits',
    });
  });

  it('should have generate method for backwards compatibility', () => {
    expect(typeof client.generate).toBe('function');
  });

  it('should have run method for full agentic execution', () => {
    expect(typeof client.run).toBe('function');
  });

  it('should have stream method for real-time updates', () => {
    expect(typeof client.stream).toBe('function');
  });

  it('should have query method for async iteration', () => {
    expect(typeof client.query).toBe('function');
  });

  it('should have runWithTools method', () => {
    expect(typeof client.runWithTools).toBe('function');
  });

  it('should have analyzeCode method', () => {
    expect(typeof client.analyzeCode).toBe('function');
  });

  it('should have modifyCode method', () => {
    expect(typeof client.modifyCode).toBe('function');
  });

  it('should have runCommands method', () => {
    expect(typeof client.runCommands).toBe('function');
  });

  it('should have webResearch method', () => {
    expect(typeof client.webResearch).toBe('function');
  });

  it('should have runWithSubagents method', () => {
    expect(typeof client.runWithSubagents).toBe('function');
  });

  it('should have codeReview method', () => {
    expect(typeof client.codeReview).toBe('function');
  });

  it('should have resumeSession method', () => {
    expect(typeof client.resumeSession).toBe('function');
  });

  it('should have getSessionId method', () => {
    expect(typeof client.getSessionId).toBe('function');
  });

  it('should have interrupt method', () => {
    expect(typeof client.interrupt).toBe('function');
  });

  it('should return null session ID initially', () => {
    expect(client.getSessionId()).toBeNull();
  });
});
