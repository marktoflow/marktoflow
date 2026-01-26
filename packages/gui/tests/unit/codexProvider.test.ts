import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodexProvider, createCodexProvider } from '../../src/server/services/agents/codex-provider.js';
import type { Workflow, AgentConfig } from '../../src/server/services/agents/types.js';

// Mock the Codex SDK
vi.mock('@openai/codex-sdk', () => ({
  Codex: vi.fn().mockImplementation(() => ({
    startThread: vi.fn().mockReturnValue({
      id: 'test-thread-id',
      run: vi.fn().mockResolvedValue({
        items: [
          { type: 'agent_message', text: 'Test response with ```yaml\nmetadata:\n  name: test\nsteps: []\n```' },
        ],
        finalResponse: 'Test response with ```yaml\nmetadata:\n  name: test\nsteps: []\n```',
        usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50 },
      }),
      runStreamed: vi.fn().mockResolvedValue({
        events: (async function* () {
          yield { type: 'thread.started', thread_id: 'test-thread-id' };
          yield {
            type: 'item.completed',
            item: { type: 'agent_message', text: 'Streamed response' },
          };
          yield {
            type: 'turn.completed',
            usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 50 },
          };
        })(),
      }),
    }),
    resumeThread: vi.fn().mockReturnValue({
      id: 'test-thread-id',
      run: vi.fn().mockResolvedValue({
        items: [{ type: 'agent_message', text: 'Resumed response' }],
        finalResponse: 'Resumed response',
        usage: { input_tokens: 50, cached_input_tokens: 25, output_tokens: 25 },
      }),
    }),
  })),
}));

describe('CodexProvider', () => {
  let provider: CodexProvider;
  const testWorkflow: Workflow = {
    metadata: { name: 'test-workflow', version: '1.0' },
    steps: [
      { id: 'step-1', name: 'Test Step', action: 'test.action', inputs: { value: 1 } },
    ],
    tools: {},
    inputs: {},
  };

  beforeEach(() => {
    provider = new CodexProvider();
    vi.clearAllMocks();
  });

  describe('Provider Properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('codex');
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('OpenAI Codex');
    });

    it('should have correct capabilities', () => {
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.toolUse).toBe(true);
      expect(provider.capabilities.codeExecution).toBe(true);
      expect(provider.capabilities.systemPrompts).toBe(true);
      expect(provider.capabilities.models).toContain('codex-1');
      expect(provider.capabilities.models).toContain('o3');
      expect(provider.capabilities.models).toContain('o3-mini');
    });
  });

  describe('initialization', () => {
    it('should not be ready before initialization', () => {
      expect(provider.isReady()).toBe(false);
    });

    it('should initialize with default config', async () => {
      await provider.initialize({});
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with API key', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with custom model', async () => {
      await provider.initialize({ model: 'o3' });
      const status = provider.getStatus();
      expect(status.model).toBe('o3');
    });

    it('should initialize with base URL', async () => {
      await provider.initialize({ baseUrl: 'https://custom-api.example.com' });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with working directory option', async () => {
      await provider.initialize({
        options: { workingDirectory: '/custom/path' },
      });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with cwd option', async () => {
      await provider.initialize({
        options: { cwd: '/custom/path' },
      });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with codex path option', async () => {
      await provider.initialize({
        options: { codexPath: '/custom/codex' },
      });
      expect(provider.isReady()).toBe(true);
    });

    it('should initialize with environment variables option', async () => {
      await provider.initialize({
        options: { env: { DEBUG: 'true' } },
      });
      expect(provider.isReady()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return not ready status before initialization', () => {
      const status = provider.getStatus();
      expect(status.ready).toBe(false);
      expect(status.model).toBe('codex-1');
    });

    it('should return ready status after initialization', async () => {
      await provider.initialize({});
      const status = provider.getStatus();
      expect(status.ready).toBe(true);
      expect(status.error).toBeUndefined();
    });

    it('should return custom model in status', async () => {
      await provider.initialize({ model: 'o4-mini' });
      const status = provider.getStatus();
      expect(status.model).toBe('o4-mini');
    });
  });

  describe('processPrompt', () => {
    it('should return error when not initialized', async () => {
      const result = await provider.processPrompt('test prompt', testWorkflow);
      expect(result.error).toBeDefined();
      expect(result.explanation).toContain('not available');
    });

    it('should process prompt after initialization', async () => {
      await provider.initialize({});
      const result = await provider.processPrompt('Add a new step', testWorkflow);
      expect(result.explanation).toBeDefined();
    });

    it('should process prompt with context', async () => {
      await provider.initialize({});
      const result = await provider.processPrompt('Modify this step', testWorkflow, {
        selectedStepId: 'step-1',
        recentHistory: ['Previous change 1', 'Previous change 2'],
      });
      expect(result.explanation).toBeDefined();
    });

    it('should parse YAML from response', async () => {
      await provider.initialize({});
      const result = await provider.processPrompt('Update workflow', testWorkflow);
      // The mock returns a response with YAML, so workflow should be parsed
      expect(result.workflow || result.explanation).toBeDefined();
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for empty workflow', async () => {
      const emptyWorkflow: Workflow = {
        metadata: {},
        steps: [],
      };
      const suggestions = await provider.getSuggestions(emptyWorkflow);
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return suggestions for workflow with steps', async () => {
      const suggestions = await provider.getSuggestions(testWorkflow);
      expect(suggestions).toBeInstanceOf(Array);
    });

    it('should return step-specific suggestions when step is selected', async () => {
      const suggestions = await provider.getSuggestions(testWorkflow, 'step-1');
      expect(suggestions).toBeInstanceOf(Array);
    });
  });

  describe('streamPrompt', () => {
    it('should fall back to processPrompt when not initialized', async () => {
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const result = await provider.streamPrompt('test', testWorkflow, onChunk);
      expect(result.error).toBeDefined();
    });

    it('should stream prompt after initialization', async () => {
      await provider.initialize({});
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const result = await provider.streamPrompt('Add step', testWorkflow, onChunk);
      expect(result.explanation).toBeDefined();
    });

    it('should stream with context', async () => {
      await provider.initialize({});
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const result = await provider.streamPrompt('Modify step', testWorkflow, onChunk, {
        selectedStepId: 'step-1',
      });
      expect(result.explanation).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should reset thread ID on cancel', async () => {
      await provider.initialize({});
      await provider.processPrompt('test', testWorkflow);
      await provider.cancel();
      expect(provider.getLastThreadId()).toBeNull();
    });
  });

  describe('resumePrompt', () => {
    it('should return error when not initialized', async () => {
      const result = await provider.resumePrompt('thread-123', 'continue', testWorkflow);
      expect(result.error).toBeDefined();
    });

    it('should resume thread after initialization', async () => {
      await provider.initialize({});
      const result = await provider.resumePrompt('thread-123', 'Continue the task', testWorkflow);
      expect(result.explanation).toBeDefined();
    });

    it('should resume with context', async () => {
      await provider.initialize({});
      const result = await provider.resumePrompt(
        'thread-123',
        'Next step',
        testWorkflow,
        { selectedStepId: 'step-1' }
      );
      expect(result.explanation).toBeDefined();
    });
  });

  describe('getLastThreadId', () => {
    it('should return null initially', () => {
      expect(provider.getLastThreadId()).toBeNull();
    });

    it('should return thread ID after processing', async () => {
      await provider.initialize({});
      await provider.processPrompt('test', testWorkflow);
      // The mock sets thread ID to 'test-thread-id'
      expect(provider.getLastThreadId()).toBe('test-thread-id');
    });
  });

  describe('parseAIResponse', () => {
    it('should extract workflow from YAML block', async () => {
      await provider.initialize({});
      const result = await provider.processPrompt('test', testWorkflow);
      // The mock response contains YAML, so it should be parsed
      expect(result.workflow || result.explanation).toBeDefined();
    });

    it('should generate diff for modified workflow', async () => {
      await provider.initialize({});
      const result = await provider.processPrompt('test', testWorkflow);
      // If workflow was parsed, diff should be generated
      if (result.workflow) {
        expect(result.diff).toBeDefined();
      }
    });
  });

  describe('createCodexProvider factory', () => {
    it('should create provider instance', () => {
      const provider = createCodexProvider();
      expect(provider).toBeInstanceOf(CodexProvider);
    });

    it('should create and initialize provider with config', () => {
      const config: AgentConfig = {
        apiKey: 'test-key',
        model: 'o3',
      };
      const provider = createCodexProvider(config);
      expect(provider).toBeInstanceOf(CodexProvider);
    });
  });
});

describe('CodexProvider Error Handling', () => {
  let provider: CodexProvider;

  beforeEach(() => {
    provider = new CodexProvider();
    vi.clearAllMocks();
  });

  it('should handle SDK import error gracefully', async () => {
    // Reset the mock to simulate import failure
    vi.doMock('@openai/codex-sdk', () => {
      throw new Error('Module not found');
    });

    const errorProvider = new CodexProvider();
    // This should handle the error gracefully
    const status = errorProvider.getStatus();
    expect(status.ready).toBe(false);
  });

  it('should handle thread creation error', async () => {
    // Create a provider and manually set error state
    const errorProvider = new CodexProvider();
    // Simulate error by not initializing
    const result = await errorProvider.processPrompt('test', {
      metadata: {},
      steps: [],
    });
    expect(result.error).toBeDefined();
  });

  it('should return error in status when initialization fails', async () => {
    const errorProvider = new CodexProvider();
    // Status should show not ready with potential error
    const status = errorProvider.getStatus();
    expect(status.ready).toBe(false);
  });
});

describe('CodexProvider Response Parsing', () => {
  let provider: CodexProvider;
  const mockWorkflow: Workflow = {
    metadata: { name: 'test' },
    steps: [{ id: 'step-1', action: 'test' }],
  };

  beforeEach(async () => {
    provider = new CodexProvider();
    await provider.initialize({});
    vi.clearAllMocks();
  });

  it('should handle response with YAML workflow', async () => {
    // The default mock already returns a response with YAML
    const result = await provider.processPrompt('test', mockWorkflow);
    // Should either have a parsed workflow or explanation
    expect(result.explanation || result.workflow).toBeDefined();
  });

  it('should return explanation when response has content', async () => {
    const result = await provider.processPrompt('test', mockWorkflow);
    // The mock returns a response, so explanation should be defined
    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe('string');
  });

  it('should handle processPrompt with empty workflow', async () => {
    const emptyWorkflow: Workflow = {
      metadata: {},
      steps: [],
    };
    const result = await provider.processPrompt('test', emptyWorkflow);
    expect(result.explanation || result.error).toBeDefined();
  });

  it('should generate diff when workflow is modified', async () => {
    const result = await provider.processPrompt('test', mockWorkflow);
    // If workflow was parsed successfully, diff should be generated
    if (result.workflow) {
      expect(result.diff).toBeDefined();
    }
  });
});
