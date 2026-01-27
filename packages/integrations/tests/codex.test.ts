import { describe, it, expect, beforeEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import {
  CodexClient,
  CodexInitializer,
} from '../src/adapters/codex.js';
import {
  createCodexActions,
  CodexPresetConfigs,
  CodexReviewPrompts,
  CodexChatSchema,
  CodexCodeModifySchema,
  CodexCodeAnalyzeSchema,
  CodexCodeReviewSchema,
  CodexWebSearchSchema,
  CodexExecuteSchema,
  CodexStructuredSchema,
  CodexResumeSchema,
  CodexWithImagesSchema,
} from '../src/adapters/codex-workflow.js';
import {
  CodexThreadOptionsSchema,
  CodexClientConfigSchema,
  CodexWorkflowConfigSchema,
  InputSchema,
} from '../src/adapters/codex-types.js';

describe('OpenAI Codex Adapter', () => {
  let registry: SDKRegistry;

  beforeEach(() => {
    registry = new SDKRegistry();
  });

  describe('CodexInitializer', () => {
    it('should initialize with default options', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {},
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with API key from auth', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        auth: {
          api_key: 'test-api-key',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with base URL', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {
          baseUrl: 'https://custom-api.example.com',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with custom model', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {
          model: 'o3-mini',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with working directory', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {
          workingDirectory: '/tmp',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with sandbox mode', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {
          sandboxMode: 'read-only',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should initialize with reasoning effort', async () => {
      const config = {
        sdk: '@openai/codex-sdk',
        options: {
          reasoningEffort: 'high',
        },
      };

      const client = await CodexInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(CodexClient);
    });
  });

  describe('CodexClient Construction', () => {
    it('should create client with default options', () => {
      const client = new CodexClient();
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should create client with API key', () => {
      const client = new CodexClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should create client with base URL', () => {
      const client = new CodexClient({ baseUrl: 'https://api.example.com' });
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should create client with codex path override', () => {
      const client = new CodexClient({ codexPathOverride: '/custom/codex' });
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should create client with environment variables', () => {
      const client = new CodexClient({ env: { CUSTOM_VAR: 'value' } });
      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should create client with default thread options', () => {
      const client = new CodexClient({
        defaultThreadOptions: {
          model: 'o3',
          sandboxMode: 'workspace-write',
          skipGitRepoCheck: true,
        },
      });
      expect(client).toBeInstanceOf(CodexClient);
    });
  });

  describe('Client Methods', () => {
    it('should have send method', () => {
      const client = new CodexClient();
      expect(client.send).toBeDefined();
      expect(typeof client.send).toBe('function');
    });

    it('should have stream method', () => {
      const client = new CodexClient();
      expect(client.stream).toBeDefined();
      expect(typeof client.stream).toBe('function');
    });

    it('should have sendWithThread method', () => {
      const client = new CodexClient();
      expect(client.sendWithThread).toBeDefined();
      expect(typeof client.sendWithThread).toBe('function');
    });

    it('should have streamWithThread method', () => {
      const client = new CodexClient();
      expect(client.streamWithThread).toBeDefined();
      expect(typeof client.streamWithThread).toBe('function');
    });

    it('should have resumeAndSend method', () => {
      const client = new CodexClient();
      expect(client.resumeAndSend).toBeDefined();
      expect(typeof client.resumeAndSend).toBe('function');
    });

    it('should have resumeAndStream method', () => {
      const client = new CodexClient();
      expect(client.resumeAndStream).toBeDefined();
      expect(typeof client.resumeAndStream).toBe('function');
    });

    it('should have startThread method', () => {
      const client = new CodexClient();
      expect(client.startThread).toBeDefined();
      expect(typeof client.startThread).toBe('function');
    });

    it('should have resumeThread method', () => {
      const client = new CodexClient();
      expect(client.resumeThread).toBeDefined();
      expect(typeof client.resumeThread).toBe('function');
    });

    it('should have getLastThreadId method', () => {
      const client = new CodexClient();
      expect(client.getLastThreadId).toBeDefined();
      expect(typeof client.getLastThreadId).toBe('function');
    });

    it('should have getActiveThread method', () => {
      const client = new CodexClient();
      expect(client.getActiveThread).toBeDefined();
      expect(typeof client.getActiveThread).toBe('function');
    });

    it('should have sendStructured method', () => {
      const client = new CodexClient();
      expect(client.sendStructured).toBeDefined();
      expect(typeof client.sendStructured).toBe('function');
    });

    it('should have modifyCode method', () => {
      const client = new CodexClient();
      expect(client.modifyCode).toBeDefined();
      expect(typeof client.modifyCode).toBe('function');
    });

    it('should have executeCommands method', () => {
      const client = new CodexClient();
      expect(client.executeCommands).toBeDefined();
      expect(typeof client.executeCommands).toBe('function');
    });

    it('should have webSearch method', () => {
      const client = new CodexClient();
      expect(client.webSearch).toBeDefined();
      expect(typeof client.webSearch).toBe('function');
    });

    it('should have analyzeCode method', () => {
      const client = new CodexClient();
      expect(client.analyzeCode).toBeDefined();
      expect(typeof client.analyzeCode).toBe('function');
    });

    it('should return null for getLastThreadId initially', () => {
      const client = new CodexClient();
      expect(client.getLastThreadId()).toBeNull();
    });

    it('should return null for getActiveThread initially', () => {
      const client = new CodexClient();
      expect(client.getActiveThread()).toBeNull();
    });
  });

  describe('Integration with SDKRegistry', () => {
    it('should be registered in SDK registry', () => {
      expect(CodexInitializer).toBeDefined();
      expect(CodexInitializer.initialize).toBeDefined();
    });
  });
});

describe('OpenAI Codex Workflow Actions', () => {
  describe('createCodexActions', () => {
    it('should create action handlers', () => {
      const actions = createCodexActions();

      expect(actions.chat).toBeDefined();
      expect(actions.codeModify).toBeDefined();
      expect(actions.codeAnalyze).toBeDefined();
      expect(actions.codeReview).toBeDefined();
      expect(actions.webSearch).toBeDefined();
      expect(actions.execute).toBeDefined();
      expect(actions.structured).toBeDefined();
      expect(actions.resume).toBeDefined();
      expect(actions.withImages).toBeDefined();
      expect(actions.stream).toBeDefined();
      expect(actions.getLastThreadId).toBeDefined();
      expect(actions.getClient).toBeDefined();
    });

    it('should return client from getClient', () => {
      const actions = createCodexActions();
      const client = actions.getClient();

      expect(client).toBeInstanceOf(CodexClient);
    });

    it('should return null for getLastThreadId initially', () => {
      const actions = createCodexActions();
      expect(actions.getLastThreadId()).toBeNull();
    });
  });

  describe('Workflow Schemas', () => {
    describe('CodexChatSchema', () => {
      it('should validate basic chat input', () => {
        const input = { prompt: 'Hello' };
        const result = CodexChatSchema.parse(input);
        expect(result.prompt).toBe('Hello');
      });

      it('should validate chat with all options', () => {
        const input = {
          prompt: 'Explain this code',
          model: 'o3-mini',
          workingDirectory: '/tmp',
          reasoningEffort: 'high' as const,
          sandboxMode: 'read-only' as const,
          webSearch: true,
          threadId: 'thread-123',
        };
        const result = CodexChatSchema.parse(input);
        expect(result.model).toBe('o3-mini');
        expect(result.reasoningEffort).toBe('high');
        expect(result.webSearch).toBe(true);
      });
    });

    describe('CodexCodeModifySchema', () => {
      it('should validate basic code modify input', () => {
        const input = { prompt: 'Add types' };
        const result = CodexCodeModifySchema.parse(input);
        expect(result.prompt).toBe('Add types');
      });

      it('should validate code modify with all options', () => {
        const input = {
          prompt: 'Refactor the auth module',
          workingDirectory: '/src',
          additionalDirectories: ['/tests', '/lib'],
          reasoningEffort: 'xhigh' as const,
        };
        const result = CodexCodeModifySchema.parse(input);
        expect(result.additionalDirectories).toHaveLength(2);
        expect(result.reasoningEffort).toBe('xhigh');
      });

      it('should validate code modify with excludeFiles option', () => {
        const input = {
          prompt: 'Refactor the auth module',
          workingDirectory: '/src',
          excludeFiles: ['CLAUDE.md', 'AGENTS.md', '.env'],
        };
        const result = CodexCodeModifySchema.parse(input);
        expect(result.excludeFiles).toHaveLength(3);
        expect(result.excludeFiles).toContain('CLAUDE.md');
      });
    });

    describe('CodexCodeAnalyzeSchema', () => {
      it('should validate basic analyze input', () => {
        const input = { prompt: 'Explain the architecture' };
        const result = CodexCodeAnalyzeSchema.parse(input);
        expect(result.prompt).toBe('Explain the architecture');
      });

      it('should validate analyze with directories', () => {
        const input = {
          prompt: 'Find security issues',
          workingDirectory: '/src',
          additionalDirectories: ['/lib'],
        };
        const result = CodexCodeAnalyzeSchema.parse(input);
        expect(result.additionalDirectories).toContain('/lib');
      });

      it('should validate analyze with excludeFiles option', () => {
        const input = {
          prompt: 'Analyze the codebase',
          workingDirectory: '/src',
          excludeFiles: ['CLAUDE.md', 'AGENTS.md'],
        };
        const result = CodexCodeAnalyzeSchema.parse(input);
        expect(result.excludeFiles).toHaveLength(2);
        expect(result.excludeFiles).toContain('AGENTS.md');
      });
    });

    describe('CodexCodeReviewSchema', () => {
      it('should validate basic code review input', () => {
        const input = { prompt: 'Review this code' };
        const result = CodexCodeReviewSchema.parse(input);
        expect(result.prompt).toBe('Review this code');
      });

      it('should validate code review with all options', () => {
        const input = {
          prompt: 'Review for security issues',
          files: ['src/auth.ts', 'src/api.ts'],
          focusAreas: ['security', 'performance'],
          workingDirectory: '/project',
        };
        const result = CodexCodeReviewSchema.parse(input);
        expect(result.files).toHaveLength(2);
        expect(result.focusAreas).toContain('security');
      });
    });

    describe('CodexWebSearchSchema', () => {
      it('should validate basic web search input', () => {
        const input = { prompt: 'Find React best practices' };
        const result = CodexWebSearchSchema.parse(input);
        expect(result.prompt).toBe('Find React best practices');
      });

      it('should validate web search with mode', () => {
        const input = {
          prompt: 'Latest news',
          searchMode: 'live' as const,
        };
        const result = CodexWebSearchSchema.parse(input);
        expect(result.searchMode).toBe('live');
      });

      it('should validate cached search mode', () => {
        const input = {
          prompt: 'Documentation',
          searchMode: 'cached' as const,
        };
        const result = CodexWebSearchSchema.parse(input);
        expect(result.searchMode).toBe('cached');
      });
    });

    describe('CodexExecuteSchema', () => {
      it('should validate basic execute input', () => {
        const input = { prompt: 'Run tests' };
        const result = CodexExecuteSchema.parse(input);
        expect(result.prompt).toBe('Run tests');
      });

      it('should validate execute with all options', () => {
        const input = {
          prompt: 'Build and deploy',
          workingDirectory: '/project',
          approvalPolicy: 'never' as const,
        };
        const result = CodexExecuteSchema.parse(input);
        expect(result.approvalPolicy).toBe('never');
      });

      it('should validate all approval policies', () => {
        const policies = ['never', 'on-request', 'on-failure', 'untrusted'] as const;
        for (const policy of policies) {
          const input = {
            prompt: 'test',
            approvalPolicy: policy,
          };
          const result = CodexExecuteSchema.parse(input);
          expect(result.approvalPolicy).toBe(policy);
        }
      });
    });

    describe('CodexStructuredSchema', () => {
      it('should validate structured output input', () => {
        const input = {
          prompt: 'List functions',
          schema: {
            type: 'object',
            properties: {
              functions: { type: 'array' },
            },
          },
        };
        const result = CodexStructuredSchema.parse(input);
        expect(result.schema).toBeDefined();
      });

      it('should validate structured with working directory', () => {
        const input = {
          prompt: 'Extract types',
          schema: { type: 'array' },
          workingDirectory: '/src',
        };
        const result = CodexStructuredSchema.parse(input);
        expect(result.workingDirectory).toBe('/src');
      });
    });

    describe('CodexResumeSchema', () => {
      it('should validate resume input', () => {
        const input = {
          threadId: 'thread-abc-123',
          prompt: 'Continue the previous task',
        };
        const result = CodexResumeSchema.parse(input);
        expect(result.threadId).toBe('thread-abc-123');
        expect(result.prompt).toBe('Continue the previous task');
      });

      it('should validate resume with working directory', () => {
        const input = {
          threadId: 'thread-xyz',
          prompt: 'Next step',
          workingDirectory: '/workspace',
        };
        const result = CodexResumeSchema.parse(input);
        expect(result.workingDirectory).toBe('/workspace');
      });
    });

    describe('CodexWithImagesSchema', () => {
      it('should validate images input', () => {
        const input = {
          prompt: 'Implement this UI',
          images: ['/mockups/design.png'],
        };
        const result = CodexWithImagesSchema.parse(input);
        expect(result.images).toHaveLength(1);
      });

      it('should validate multiple images', () => {
        const input = {
          prompt: 'Match these mockups',
          images: ['/mockup1.png', '/mockup2.png', '/mockup3.png'],
          workingDirectory: '/src/components',
        };
        const result = CodexWithImagesSchema.parse(input);
        expect(result.images).toHaveLength(3);
      });
    });
  });

  describe('CodexPresetConfigs', () => {
    it('should have read-only config', () => {
      expect(CodexPresetConfigs.readOnly).toBeDefined();
      expect(CodexPresetConfigs.readOnly.sandboxMode).toBe('read-only');
      expect(CodexPresetConfigs.readOnly.skipGitRepoCheck).toBe(true);
    });

    it('should have code modification config', () => {
      expect(CodexPresetConfigs.codeModification).toBeDefined();
      expect(CodexPresetConfigs.codeModification.sandboxMode).toBe('workspace-write');
      expect(CodexPresetConfigs.codeModification.modelReasoningEffort).toBe('high');
    });

    it('should have full access config', () => {
      expect(CodexPresetConfigs.fullAccess).toBeDefined();
      expect(CodexPresetConfigs.fullAccess.sandboxMode).toBe('danger-full-access');
      expect(CodexPresetConfigs.fullAccess.approvalPolicy).toBe('never');
      expect(CodexPresetConfigs.fullAccess.networkAccessEnabled).toBe(true);
    });

    it('should have research config', () => {
      expect(CodexPresetConfigs.research).toBeDefined();
      expect(CodexPresetConfigs.research.webSearchMode).toBe('live');
      expect(CodexPresetConfigs.research.networkAccessEnabled).toBe(true);
    });

    it('should have high reasoning config', () => {
      expect(CodexPresetConfigs.highReasoning).toBeDefined();
      expect(CodexPresetConfigs.highReasoning.modelReasoningEffort).toBe('xhigh');
    });
  });

  describe('CodexReviewPrompts', () => {
    it('should have security review prompt', () => {
      expect(CodexReviewPrompts.security).toBeDefined();
      expect(CodexReviewPrompts.security).toContain('security');
      expect(CodexReviewPrompts.security).toContain('OWASP');
    });

    it('should have performance review prompt', () => {
      expect(CodexReviewPrompts.performance).toBeDefined();
      expect(CodexReviewPrompts.performance).toContain('performance');
      expect(CodexReviewPrompts.performance).toContain('Algorithm');
    });

    it('should have quality review prompt', () => {
      expect(CodexReviewPrompts.quality).toBeDefined();
      expect(CodexReviewPrompts.quality).toContain('quality');
      expect(CodexReviewPrompts.quality).toContain('duplication');
    });

    it('should have TypeScript review prompt', () => {
      expect(CodexReviewPrompts.typescript).toBeDefined();
      expect(CodexReviewPrompts.typescript).toContain('TypeScript');
      expect(CodexReviewPrompts.typescript).toContain('type');
    });
  });
});

describe('Codex Type Schemas', () => {
  describe('CodexThreadOptionsSchema', () => {
    it('should validate empty options', () => {
      const result = CodexThreadOptionsSchema.parse({});
      expect(result).toEqual({});
    });

    it('should validate all thread options', () => {
      const input = {
        model: 'o3',
        sandboxMode: 'workspace-write' as const,
        workingDirectory: '/tmp',
        skipGitRepoCheck: true,
        modelReasoningEffort: 'high' as const,
        networkAccessEnabled: true,
        webSearchMode: 'live' as const,
        approvalPolicy: 'never' as const,
        additionalDirectories: ['/lib', '/tests'],
      };
      const result = CodexThreadOptionsSchema.parse(input);
      expect(result.model).toBe('o3');
      expect(result.sandboxMode).toBe('workspace-write');
      expect(result.additionalDirectories).toHaveLength(2);
    });

    it('should validate all sandbox modes', () => {
      const modes = ['read-only', 'workspace-write', 'danger-full-access'] as const;
      for (const mode of modes) {
        const result = CodexThreadOptionsSchema.parse({ sandboxMode: mode });
        expect(result.sandboxMode).toBe(mode);
      }
    });

    it('should validate all reasoning efforts', () => {
      const efforts = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
      for (const effort of efforts) {
        const result = CodexThreadOptionsSchema.parse({ modelReasoningEffort: effort });
        expect(result.modelReasoningEffort).toBe(effort);
      }
    });

    it('should validate all web search modes', () => {
      const modes = ['disabled', 'cached', 'live'] as const;
      for (const mode of modes) {
        const result = CodexThreadOptionsSchema.parse({ webSearchMode: mode });
        expect(result.webSearchMode).toBe(mode);
      }
    });

    it('should validate all approval policies', () => {
      const policies = ['never', 'on-request', 'on-failure', 'untrusted'] as const;
      for (const policy of policies) {
        const result = CodexThreadOptionsSchema.parse({ approvalPolicy: policy });
        expect(result.approvalPolicy).toBe(policy);
      }
    });
  });

  describe('CodexClientConfigSchema', () => {
    it('should validate empty config', () => {
      const result = CodexClientConfigSchema.parse({});
      expect(result).toEqual({});
    });

    it('should validate all client config options', () => {
      const input = {
        codexPathOverride: '/custom/codex',
        baseUrl: 'https://api.example.com',
        apiKey: 'sk-test-key',
        env: { NODE_ENV: 'production' },
      };
      const result = CodexClientConfigSchema.parse(input);
      expect(result.codexPathOverride).toBe('/custom/codex');
      expect(result.apiKey).toBe('sk-test-key');
    });
  });

  describe('CodexWorkflowConfigSchema', () => {
    it('should validate empty workflow config', () => {
      const result = CodexWorkflowConfigSchema.parse({});
      expect(result).toEqual({});
    });

    it('should validate complete workflow config', () => {
      const input = {
        model: 'codex-1',
        workingDirectory: '/workspace',
        skipGitRepoCheck: true,
        sandboxMode: 'workspace-write' as const,
        reasoningEffort: 'high' as const,
        webSearchMode: 'live' as const,
        approvalPolicy: 'on-request' as const,
        additionalDirectories: ['/lib'],
        env: { DEBUG: 'true' },
      };
      const result = CodexWorkflowConfigSchema.parse(input);
      expect(result.model).toBe('codex-1');
      expect(result.env?.DEBUG).toBe('true');
    });
  });

  describe('InputSchema', () => {
    it('should validate string input', () => {
      const result = InputSchema.parse('Hello, Codex!');
      expect(result).toBe('Hello, Codex!');
    });

    it('should validate text input array', () => {
      const input = [{ type: 'text' as const, text: 'Hello' }];
      const result = InputSchema.parse(input);
      expect(result).toHaveLength(1);
    });

    it('should validate local image input', () => {
      const input = [{ type: 'local_image' as const, path: '/path/to/image.png' }];
      const result = InputSchema.parse(input);
      expect(result).toHaveLength(1);
    });

    it('should validate mixed input array', () => {
      const input = [
        { type: 'text' as const, text: 'Analyze this image' },
        { type: 'local_image' as const, path: '/mockup.png' },
      ];
      const result = InputSchema.parse(input);
      expect(result).toHaveLength(2);
    });
  });
});
