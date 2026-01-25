import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  createAgentActions,
  AgentRunSchema,
  AgentCodeReviewSchema,
  AgentCodeModifySchema,
  AgentResearchSchema,
  AgentWithSubagentsSchema,
  AgentWithMcpSchema,
  PresetSubagents,
} from '../src/adapters/claude-agent-workflow.js';
import { ClaudeAgentClient } from '../src/adapters/claude-agent.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => {
  return {
    query: vi.fn(),
    tool: vi.fn(),
    createSdkMcpServer: vi.fn(),
  };
});

describe('Claude Agent Workflow Actions', () => {
  describe('Action Schemas', () => {
    describe('AgentRunSchema', () => {
      it('should validate minimal input', () => {
        const input = { prompt: 'Hello' };
        const result = AgentRunSchema.parse(input);
        expect(result.prompt).toBe('Hello');
      });

      it('should validate full input', () => {
        const input = {
          prompt: 'Find bugs in this code',
          tools: ['Read', 'Glob', 'Grep'],
          model: 'claude-sonnet-4-20250514',
          cwd: '/workspace',
          permissionMode: 'acceptEdits',
          maxTurns: 25,
          maxBudgetUsd: 2.0,
          systemPrompt: 'You are a code analyzer.',
          resume: 'session_123',
        };
        const result = AgentRunSchema.parse(input);
        expect(result.prompt).toBe('Find bugs in this code');
        expect(result.tools).toEqual(['Read', 'Glob', 'Grep']);
        expect(result.permissionMode).toBe('acceptEdits');
      });

      it('should reject invalid permission mode', () => {
        const input = {
          prompt: 'Hello',
          permissionMode: 'invalid',
        };
        expect(() => AgentRunSchema.parse(input)).toThrow();
      });

      it('should reject invalid tools', () => {
        const input = {
          prompt: 'Hello',
          tools: ['InvalidTool'],
        };
        expect(() => AgentRunSchema.parse(input)).toThrow();
      });
    });

    describe('AgentCodeReviewSchema', () => {
      it('should validate minimal input', () => {
        const input = { prompt: 'Review auth.ts' };
        const result = AgentCodeReviewSchema.parse(input);
        expect(result.prompt).toBe('Review auth.ts');
      });

      it('should validate full input', () => {
        const input = {
          prompt: 'Review the authentication module',
          focusAreas: ['security', 'performance'],
          severity: 'high',
          outputFormat: 'json',
        };
        const result = AgentCodeReviewSchema.parse(input);
        expect(result.focusAreas).toContain('security');
        expect(result.severity).toBe('high');
        expect(result.outputFormat).toBe('json');
      });

      it('should reject invalid severity', () => {
        const input = {
          prompt: 'Review',
          severity: 'invalid',
        };
        expect(() => AgentCodeReviewSchema.parse(input)).toThrow();
      });

      it('should reject invalid output format', () => {
        const input = {
          prompt: 'Review',
          outputFormat: 'xml',
        };
        expect(() => AgentCodeReviewSchema.parse(input)).toThrow();
      });
    });

    describe('AgentCodeModifySchema', () => {
      it('should validate minimal input', () => {
        const input = { prompt: 'Add types' };
        const result = AgentCodeModifySchema.parse(input);
        expect(result.prompt).toBe('Add types');
      });

      it('should validate full input', () => {
        const input = {
          prompt: 'Add TypeScript types to all functions',
          files: ['src/utils.ts', 'src/helpers.ts'],
          dryRun: true,
          createBackup: true,
        };
        const result = AgentCodeModifySchema.parse(input);
        expect(result.files).toHaveLength(2);
        expect(result.dryRun).toBe(true);
        expect(result.createBackup).toBe(true);
      });
    });

    describe('AgentResearchSchema', () => {
      it('should validate minimal input', () => {
        const input = { prompt: 'Best practices for error handling' };
        const result = AgentResearchSchema.parse(input);
        expect(result.prompt).toBe('Best practices for error handling');
      });

      it('should validate full input', () => {
        const input = {
          prompt: 'How to implement OAuth2',
          sources: ['web', 'codebase'],
          depth: 'comprehensive',
        };
        const result = AgentResearchSchema.parse(input);
        expect(result.sources).toContain('web');
        expect(result.depth).toBe('comprehensive');
      });

      it('should reject invalid source', () => {
        const input = {
          prompt: 'Research',
          sources: ['invalid'],
        };
        expect(() => AgentResearchSchema.parse(input)).toThrow();
      });

      it('should reject invalid depth', () => {
        const input = {
          prompt: 'Research',
          depth: 'invalid',
        };
        expect(() => AgentResearchSchema.parse(input)).toThrow();
      });
    });

    describe('AgentWithSubagentsSchema', () => {
      it('should validate minimal input', () => {
        const input = {
          prompt: 'Analyze this code',
          agents: {
            analyzer: {
              description: 'Analyze code',
            },
          },
        };
        const result = AgentWithSubagentsSchema.parse(input);
        expect(result.agents.analyzer.description).toBe('Analyze code');
      });

      it('should validate full agent definition', () => {
        const input = {
          prompt: 'Review and improve',
          agents: {
            reviewer: {
              description: 'Review code',
              tools: ['Read', 'Glob'],
              prompt: 'You are a reviewer',
              model: 'haiku',
            },
          },
        };
        const result = AgentWithSubagentsSchema.parse(input);
        expect(result.agents.reviewer.tools).toContain('Read');
        expect(result.agents.reviewer.model).toBe('haiku');
      });
    });

    describe('AgentWithMcpSchema', () => {
      it('should validate stdio MCP server', () => {
        const input = {
          prompt: 'Use browser',
          mcpServers: {
            playwright: {
              type: 'stdio',
              command: 'npx',
              args: ['@playwright/mcp@latest'],
            },
          },
        };
        const result = AgentWithMcpSchema.parse(input);
        expect(result.mcpServers.playwright.type).toBe('stdio');
        expect(result.mcpServers.playwright.command).toBe('npx');
      });

      it('should validate http MCP server', () => {
        const input = {
          prompt: 'Query database',
          mcpServers: {
            db: {
              type: 'http',
              url: 'http://localhost:3000',
            },
          },
        };
        const result = AgentWithMcpSchema.parse(input);
        expect(result.mcpServers.db.type).toBe('http');
        expect(result.mcpServers.db.url).toBe('http://localhost:3000');
      });

      it('should validate sse MCP server', () => {
        const input = {
          prompt: 'Monitor events',
          mcpServers: {
            events: {
              type: 'sse',
              url: 'https://api.example.com/events',
            },
          },
        };
        const result = AgentWithMcpSchema.parse(input);
        expect(result.mcpServers.events.type).toBe('sse');
      });
    });
  });

  describe('createAgentActions', () => {
    it('should create action handlers', () => {
      const actions = createAgentActions();

      expect(typeof actions.run).toBe('function');
      expect(typeof actions.codeReview).toBe('function');
      expect(typeof actions.codeModify).toBe('function');
      expect(typeof actions.research).toBe('function');
      expect(typeof actions.withSubagents).toBe('function');
      expect(typeof actions.withMcp).toBe('function');
      expect(typeof actions.generate).toBe('function');
      expect(typeof actions.resume).toBe('function');
    });

    it('should allow access to underlying client', () => {
      const actions = createAgentActions();
      const client = actions.getClient();

      expect(client).toBeInstanceOf(ClaudeAgentClient);
    });

    it('should accept base options', () => {
      const actions = createAgentActions({
        model: 'claude-opus-4-20250514',
        permissionMode: 'bypassPermissions',
        maxBudgetUsd: 10.0,
      });

      expect(actions.getClient()).toBeInstanceOf(ClaudeAgentClient);
    });
  });

  describe('PresetSubagents', () => {
    it('should have codeReviewTeam preset', () => {
      expect(PresetSubagents.codeReviewTeam).toBeDefined();
      expect(PresetSubagents.codeReviewTeam['code-reviewer']).toBeDefined();
      expect(PresetSubagents.codeReviewTeam['security-auditor']).toBeDefined();
      expect(PresetSubagents.codeReviewTeam['test-analyzer']).toBeDefined();
    });

    it('should have documentationTeam preset', () => {
      expect(PresetSubagents.documentationTeam).toBeDefined();
      expect(PresetSubagents.documentationTeam['doc-writer']).toBeDefined();
      expect(PresetSubagents.documentationTeam['example-creator']).toBeDefined();
    });

    it('should have refactoringTeam preset', () => {
      expect(PresetSubagents.refactoringTeam).toBeDefined();
      expect(PresetSubagents.refactoringTeam.analyzer).toBeDefined();
      expect(PresetSubagents.refactoringTeam.refactorer).toBeDefined();
      expect(PresetSubagents.refactoringTeam.verifier).toBeDefined();
    });

    it('should have valid tool configurations', () => {
      const reviewer = PresetSubagents.codeReviewTeam['code-reviewer'];
      expect(reviewer.tools).toContain('Read');
      expect(reviewer.tools).toContain('Glob');
      expect(reviewer.tools).toContain('Grep');
    });

    it('should have meaningful descriptions', () => {
      const reviewer = PresetSubagents.codeReviewTeam['code-reviewer'];
      expect(reviewer.description.length).toBeGreaterThan(10);
    });

    it('should have meaningful prompts', () => {
      const reviewer = PresetSubagents.codeReviewTeam['code-reviewer'];
      expect(reviewer.prompt).toBeDefined();
      expect(reviewer.prompt!.length).toBeGreaterThan(20);
    });
  });
});
