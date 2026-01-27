import { describe, it, expect, beforeEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import {
  GitHubCopilotClient,
  GitHubCopilotInitializer,
  createCopilotTool,
} from '../src/adapters/github-copilot.js';
import {
  createCopilotActions,
  CopilotPresetAgents,
  CopilotChatSchema,
  CopilotCodeReviewSchema,
  CopilotWithToolsSchema,
  CopilotWithAgentsSchema,
  CopilotWithMcpSchema,
} from '../src/adapters/github-copilot-workflow.js';

describe('GitHub Copilot Adapter', () => {
  let registry: SDKRegistry;

  beforeEach(() => {
    registry = new SDKRegistry();
  });

  describe('GitHubCopilotInitializer', () => {
    it('should initialize with default options', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {},
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with CLI path from auth', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        auth: {
          cli_path: '/custom/path/to/copilot',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with CLI URL', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {
          cliUrl: 'localhost:4321',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with custom model', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {
          model: 'gpt-5',
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should initialize with excludeFiles option', async () => {
      const config = {
        sdk: '@github/copilot-sdk',
        options: {
          excludeFiles: ['CLAUDE.md', 'AGENTS.md', '.env'],
        },
      };

      const client = await GitHubCopilotInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });
  });

  describe('GitHubCopilotClient Construction', () => {
    it('should create client with default options', () => {
      const client = new GitHubCopilotClient();
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom model', () => {
      const client = new GitHubCopilotClient({ model: 'gpt-5' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom CLI path', () => {
      const client = new GitHubCopilotClient({ cliPath: '/custom/path/copilot' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with external CLI URL', () => {
      const client = new GitHubCopilotClient({ cliUrl: 'localhost:4321' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with custom log level', () => {
      const client = new GitHubCopilotClient({ logLevel: 'debug' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with autoStart disabled', () => {
      const client = new GitHubCopilotClient({ autoStart: false });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with working directory', () => {
      const client = new GitHubCopilotClient({ cwd: '/tmp' });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });

    it('should create client with environment variables', () => {
      const client = new GitHubCopilotClient({ env: { CUSTOM_VAR: 'value' } });
      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });
  });

  describe('Client Methods', () => {
    it('should have send method', () => {
      const client = new GitHubCopilotClient();
      expect(client.send).toBeDefined();
      expect(typeof client.send).toBe('function');
    });

    it('should have stream method', () => {
      const client = new GitHubCopilotClient();
      expect(client.stream).toBeDefined();
      expect(typeof client.stream).toBe('function');
    });

    it('should have createSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.createSession).toBeDefined();
      expect(typeof client.createSession).toBe('function');
    });

    it('should have resumeSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.resumeSession).toBeDefined();
      expect(typeof client.resumeSession).toBe('function');
    });

    it('should have stop method', () => {
      const client = new GitHubCopilotClient();
      expect(client.stop).toBeDefined();
      expect(typeof client.stop).toBe('function');
    });

    it('should have forceStop method', () => {
      const client = new GitHubCopilotClient();
      expect(client.forceStop).toBeDefined();
      expect(typeof client.forceStop).toBe('function');
    });

    it('should have ping method', () => {
      const client = new GitHubCopilotClient();
      expect(client.ping).toBeDefined();
      expect(typeof client.ping).toBe('function');
    });

    it('should have checkAuth method', () => {
      const client = new GitHubCopilotClient();
      expect(client.checkAuth).toBeDefined();
      expect(typeof client.checkAuth).toBe('function');
    });

    it('should have getState method', () => {
      const client = new GitHubCopilotClient();
      expect(client.getState).toBeDefined();
      expect(typeof client.getState).toBe('function');
    });

    it('should have sendWithSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.sendWithSession).toBeDefined();
      expect(typeof client.sendWithSession).toBe('function');
    });

    it('should have streamWithSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.streamWithSession).toBeDefined();
      expect(typeof client.streamWithSession).toBe('function');
    });

    it('should have sendWithTools method', () => {
      const client = new GitHubCopilotClient();
      expect(client.sendWithTools).toBeDefined();
      expect(typeof client.sendWithTools).toBe('function');
    });

    it('should have sendWithAgents method', () => {
      const client = new GitHubCopilotClient();
      expect(client.sendWithAgents).toBeDefined();
      expect(typeof client.sendWithAgents).toBe('function');
    });

    it('should have sendWithMcp method', () => {
      const client = new GitHubCopilotClient();
      expect(client.sendWithMcp).toBeDefined();
      expect(typeof client.sendWithMcp).toBe('function');
    });

    it('should have listModels method', () => {
      const client = new GitHubCopilotClient();
      expect(client.listModels).toBeDefined();
      expect(typeof client.listModels).toBe('function');
    });

    it('should have listSessions method', () => {
      const client = new GitHubCopilotClient();
      expect(client.listSessions).toBeDefined();
      expect(typeof client.listSessions).toBe('function');
    });

    it('should have deleteSession method', () => {
      const client = new GitHubCopilotClient();
      expect(client.deleteSession).toBeDefined();
      expect(typeof client.deleteSession).toBe('function');
    });

    it('should have getLastSessionId method', () => {
      const client = new GitHubCopilotClient();
      expect(client.getLastSessionId).toBeDefined();
      expect(typeof client.getLastSessionId).toBe('function');
    });

    it('should have resumeAndSend method', () => {
      const client = new GitHubCopilotClient();
      expect(client.resumeAndSend).toBeDefined();
      expect(typeof client.resumeAndSend).toBe('function');
    });

    it('should have getStatus method', () => {
      const client = new GitHubCopilotClient();
      expect(client.getStatus).toBeDefined();
      expect(typeof client.getStatus).toBe('function');
    });

    it('should have getAuthStatus method', () => {
      const client = new GitHubCopilotClient();
      expect(client.getAuthStatus).toBeDefined();
      expect(typeof client.getAuthStatus).toBe('function');
    });
  });

  describe('createCopilotTool Helper', () => {
    it('should create a tool definition', () => {
      const tool = createCopilotTool<{ location: string }>('get_weather', {
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
        },
        handler: async (args) => ({ temperature: 72, location: args.location }),
      });

      expect(tool.name).toBe('get_weather');
      expect(tool.description).toBe('Get weather for a location');
      expect(tool.parameters).toBeDefined();
      expect(tool.handler).toBeDefined();
    });

    it('should create a tool without parameters', () => {
      const tool = createCopilotTool('get_time', {
        description: 'Get current time',
        handler: async () => ({ time: new Date().toISOString() }),
      });

      expect(tool.name).toBe('get_time');
      expect(tool.parameters).toBeUndefined();
    });
  });

  describe('Integration with SDKRegistry', () => {
    it('should be registered in SDK registry', () => {
      expect(GitHubCopilotInitializer).toBeDefined();
      expect(GitHubCopilotInitializer.initialize).toBeDefined();
    });
  });
});

describe('GitHub Copilot Workflow Actions', () => {
  describe('createCopilotActions', () => {
    it('should create action handlers', () => {
      const actions = createCopilotActions();

      expect(actions.chat).toBeDefined();
      expect(actions.codeReview).toBeDefined();
      expect(actions.codeModify).toBeDefined();
      expect(actions.withTools).toBeDefined();
      expect(actions.withAgents).toBeDefined();
      expect(actions.withMcp).toBeDefined();
      expect(actions.listModels).toBeDefined();
      expect(actions.listSessions).toBeDefined();
      expect(actions.deleteSession).toBeDefined();
      expect(actions.getAuthStatus).toBeDefined();
      expect(actions.getStatus).toBeDefined();
      expect(actions.getClient).toBeDefined();
    });

    it('should return client from getClient', () => {
      const actions = createCopilotActions();
      const client = actions.getClient();

      expect(client).toBeInstanceOf(GitHubCopilotClient);
    });
  });

  describe('Workflow Schemas', () => {
    describe('CopilotChatSchema', () => {
      it('should validate basic chat input', () => {
        const input = { prompt: 'Hello' };
        const result = CopilotChatSchema.parse(input);
        expect(result.prompt).toBe('Hello');
      });

      it('should validate chat with all options', () => {
        const input = {
          prompt: 'Explain this code',
          model: 'gpt-4.1',
          systemMessage: 'You are a helpful assistant',
          streaming: true,
          sessionId: 'session-123',
          attachments: [
            { type: 'file' as const, path: '/path/to/file.ts' },
          ],
        };
        const result = CopilotChatSchema.parse(input);
        expect(result.model).toBe('gpt-4.1');
        expect(result.streaming).toBe(true);
        expect(result.attachments).toHaveLength(1);
      });

      it('should validate chat with excludeFiles option', () => {
        const input = {
          prompt: 'Explain this code',
          excludeFiles: ['CLAUDE.md', 'AGENTS.md', '.env'],
        };
        const result = CopilotChatSchema.parse(input);
        expect(result.excludeFiles).toHaveLength(3);
        expect(result.excludeFiles).toContain('CLAUDE.md');
      });
    });

    describe('CopilotCodeReviewSchema', () => {
      it('should validate basic code review input', () => {
        const input = { prompt: 'Review this code' };
        const result = CopilotCodeReviewSchema.parse(input);
        expect(result.prompt).toBe('Review this code');
      });

      it('should validate code review with all options', () => {
        const input = {
          prompt: 'Review for security issues',
          files: ['src/auth.ts', 'src/api.ts'],
          focusAreas: ['security', 'performance'],
          outputFormat: 'json' as const,
        };
        const result = CopilotCodeReviewSchema.parse(input);
        expect(result.files).toHaveLength(2);
        expect(result.focusAreas).toContain('security');
      });

      it('should validate code review with excludeFiles option', () => {
        const input = {
          prompt: 'Review this code',
          excludeFiles: ['CLAUDE.md', 'AGENTS.md'],
        };
        const result = CopilotCodeReviewSchema.parse(input);
        expect(result.excludeFiles).toHaveLength(2);
        expect(result.excludeFiles).toContain('AGENTS.md');
      });
    });

    describe('CopilotWithToolsSchema', () => {
      it('should validate tools input', () => {
        const input = {
          prompt: 'Get the weather',
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for location',
              parameters: { type: 'object' },
            },
          ],
        };
        const result = CopilotWithToolsSchema.parse(input);
        expect(result.tools).toHaveLength(1);
        expect(result.tools[0].name).toBe('get_weather');
      });
    });

    describe('CopilotWithAgentsSchema', () => {
      it('should validate agents input', () => {
        const input = {
          prompt: 'Analyze this code',
          agents: [
            {
              name: 'analyzer',
              displayName: 'Code Analyzer',
              description: 'Analyzes code',
              prompt: 'You are an expert code analyzer',
            },
          ],
        };
        const result = CopilotWithAgentsSchema.parse(input);
        expect(result.agents).toHaveLength(1);
        expect(result.agents[0].name).toBe('analyzer');
      });
    });

    describe('CopilotWithMcpSchema', () => {
      it('should validate local MCP server input', () => {
        const input = {
          prompt: 'Open browser',
          mcpServers: {
            playwright: {
              tools: '*' as const,
              command: 'npx',
              args: ['@playwright/mcp@latest'],
            },
          },
        };
        const result = CopilotWithMcpSchema.parse(input);
        expect(result.mcpServers.playwright).toBeDefined();
      });

      it('should validate remote MCP server input', () => {
        const input = {
          prompt: 'Use remote service',
          mcpServers: {
            remote: {
              type: 'http' as const,
              tools: ['tool1', 'tool2'],
              url: 'https://mcp.example.com',
              headers: { Authorization: 'Bearer token' },
            },
          },
        };
        const result = CopilotWithMcpSchema.parse(input);
        expect(result.mcpServers.remote.type).toBe('http');
      });
    });
  });

  describe('CopilotPresetAgents', () => {
    it('should have code review team', () => {
      expect(CopilotPresetAgents.codeReviewTeam).toBeDefined();
      expect(CopilotPresetAgents.codeReviewTeam).toHaveLength(3);
      expect(CopilotPresetAgents.codeReviewTeam.map((a) => a.name)).toContain('code-reviewer');
      expect(CopilotPresetAgents.codeReviewTeam.map((a) => a.name)).toContain('security-auditor');
      expect(CopilotPresetAgents.codeReviewTeam.map((a) => a.name)).toContain('test-analyzer');
    });

    it('should have documentation team', () => {
      expect(CopilotPresetAgents.documentationTeam).toBeDefined();
      expect(CopilotPresetAgents.documentationTeam).toHaveLength(2);
      expect(CopilotPresetAgents.documentationTeam.map((a) => a.name)).toContain('doc-writer');
      expect(CopilotPresetAgents.documentationTeam.map((a) => a.name)).toContain('example-creator');
    });

    it('should have refactoring team', () => {
      expect(CopilotPresetAgents.refactoringTeam).toBeDefined();
      expect(CopilotPresetAgents.refactoringTeam).toHaveLength(2);
      expect(CopilotPresetAgents.refactoringTeam.map((a) => a.name)).toContain('analyzer');
      expect(CopilotPresetAgents.refactoringTeam.map((a) => a.name)).toContain('refactorer');
    });

    it('should have prompts for all agents', () => {
      const allAgents = [
        ...CopilotPresetAgents.codeReviewTeam,
        ...CopilotPresetAgents.documentationTeam,
        ...CopilotPresetAgents.refactoringTeam,
      ];

      for (const agent of allAgents) {
        expect(agent.prompt).toBeDefined();
        expect(agent.prompt.length).toBeGreaterThan(0);
      }
    });
  });
});
