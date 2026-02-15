import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, OpenAIInitializer, OpenAIClient } from '../src/index.js';

// Track mock call args for tool-calling tests — vi.hoisted runs before mock hoisting
const { mockCreateFn } = vi.hoisted(() => ({
  mockCreateFn: vi.fn(),
}));

// Mock the openai module
vi.mock('openai', () => {
  mockCreateFn.mockResolvedValue({
    id: 'chatcmpl-abc123',
    object: 'chat.completion',
    created: 1700000000,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello! How can I help you?' },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18,
    },
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreateFn,
        },
      },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
              index: 0,
            },
          ],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 5,
            total_tokens: 5,
          },
        }),
      },
      models: {
        list: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield { id: 'gpt-4o', owned_by: 'openai' };
            yield { id: 'gpt-4o-mini', owned_by: 'openai' };
          },
        }),
      },
    })),
  };
});

describe('OpenAI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the default mock response
    mockCreateFn.mockResolvedValue({
      id: 'chatcmpl-abc123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello! How can I help you?' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18,
      },
    });
  });

  describe('Registration', () => {
    it('should register openai initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: {},
      };

      const client = OpenAIInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(Promise);
      return expect(client).resolves.toBeInstanceOf(OpenAIClient);
    });

    it('should register openai-compatible initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      registry.registerTools({
        test: { sdk: 'openai-compatible' },
      });

      expect(registry.has('test')).toBe(true);
    });

    it('should register vllm initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      registry.registerTools({
        test: { sdk: 'vllm' },
      });

      expect(registry.has('test')).toBe(true);
    });
  });

  describe('OpenAIClient', () => {
    let client: OpenAIClient;

    beforeEach(async () => {
      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: { model: 'gpt-4o' },
      };
      client = (await OpenAIInitializer.initialize({}, config)) as OpenAIClient;
    });

    it('should create client with default config', async () => {
      const config = { sdk: 'openai', options: {} };
      const defaultClient = await OpenAIInitializer.initialize({}, config);
      expect(defaultClient).toBeInstanceOf(OpenAIClient);
    });

    it('should create client with VLLM config', async () => {
      const config = {
        sdk: 'openai',
        auth: {
          base_url: 'http://localhost:8000/v1',
          api_key: 'dummy-key',
        },
        options: { model: 'glm-4.7-flash' },
      };
      const vllmClient = (await OpenAIInitializer.initialize({}, config)) as OpenAIClient;
      expect(vllmClient).toBeInstanceOf(OpenAIClient);
      expect(vllmClient.getDefaultModel()).toBe('glm-4.7-flash');
    });

    it('should use OPENAI_API_KEY from environment', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-test-key';

      const config = { sdk: 'openai', options: { model: 'gpt-4o' } };
      const envClient = await OpenAIInitializer.initialize({}, config);
      expect(envClient).toBeInstanceOf(OpenAIClient);

      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      else delete process.env.OPENAI_API_KEY;
    });

    it('should use dummy key when no API key provided', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const config = {
        sdk: 'openai',
        auth: { base_url: 'http://localhost:8000/v1' },
        options: {},
      };
      const localClient = await OpenAIInitializer.initialize({}, config);
      expect(localClient).toBeInstanceOf(OpenAIClient);

      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should generate simple text response', async () => {
      const response = await client.generate('Hello');
      expect(response).toBe('Hello! How can I help you?');
    });

    it('should perform chat completion', async () => {
      const result = await client.chatCompletion({
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('choices');
      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
      expect(result.usage).toHaveProperty('total_tokens', 18);
    });

    it('should return OpenAI-compatible chat.completions', async () => {
      const result = await client.chat.completions({
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(result).toHaveProperty('choices');
      expect(result.choices[0]).toHaveProperty('message');
      expect(result.choices[0].message).toHaveProperty('content');
    });

    it('should create embeddings', async () => {
      const result = await client.embeddings({ input: 'Hello world' });

      expect(result).toHaveProperty('data');
      expect(result.data[0]).toHaveProperty('embedding');
      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should list models', async () => {
      const models = await client.listModels();

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBe(2);
      expect(models[0]).toHaveProperty('id', 'gpt-4o');
      expect(models[0]).toHaveProperty('owned_by', 'openai');
    });

    it('should check availability', async () => {
      const available = await client.isAvailable();
      expect(available).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const errorClient = new OpenAIClient({ apiKey: 'test' });
      const available = await errorClient.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should pass custom organization to SDK', async () => {
      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: { organization: 'org-abc123', model: 'gpt-4o' },
      };
      const orgClient = await OpenAIInitializer.initialize({}, config);
      expect(orgClient).toBeInstanceOf(OpenAIClient);
    });

    describe('Default Model', () => {
      it('should get default model', () => {
        expect(client.getDefaultModel()).toBe('gpt-4o');
      });

      it('should set default model', () => {
        client.setDefaultModel('gpt-4o-mini');
        expect(client.getDefaultModel()).toBe('gpt-4o-mini');
      });
    });

    describe('Auto-detect Model', () => {
      it('should auto-detect model from server', async () => {
        const detected = await client.autoDetectModel();
        expect(detected).toBe('gpt-4o');
        expect(client.getDefaultModel()).toBe('gpt-4o');
      });
    });
  });

  // ==========================================================================
  // Tool Calling Tests
  // ==========================================================================

  describe('Tool Calling', () => {
    let client: OpenAIClient;

    beforeEach(async () => {
      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: { model: 'gpt-4o' },
      };
      client = (await OpenAIInitializer.initialize({}, config)) as OpenAIClient;
    });

    const weatherTool = {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
          },
          required: ['location'],
        },
      },
    };

    const searchTool = {
      type: 'function' as const,
      function: {
        name: 'search',
        description: 'Search the web',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    };

    it('should pass tools to chatCompletion', async () => {
      await client.chatCompletion({
        messages: [{ role: 'user', content: 'What is the weather in London?' }],
        tools: [weatherTool],
        tool_choice: 'auto',
      });

      expect(mockCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [weatherTool],
          tool_choice: 'auto',
        }),
      );
    });

    it('should pass response_format to chatCompletion', async () => {
      await client.chatCompletion({
        messages: [{ role: 'user', content: 'Return JSON' }],
        response_format: { type: 'json_object' },
      });

      expect(mockCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should return tool_calls in response', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-tool1',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"London"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
      });

      const result = await client.chatCompletion({
        messages: [{ role: 'user', content: 'Weather in London?' }],
        tools: [weatherTool],
      });

      expect(result.choices[0].message.tool_calls).toBeDefined();
      expect(result.choices[0].message.tool_calls![0].function.name).toBe('get_weather');
      expect(result.choices[0].message.tool_calls![0].function.arguments).toBe('{"location":"London"}');
      expect(result.choices[0].finish_reason).toBe('tool_calls');
    });

    it('should handle tool_choice with specific function', async () => {
      await client.chatCompletion({
        messages: [{ role: 'user', content: 'Weather?' }],
        tools: [weatherTool, searchTool],
        tool_choice: { type: 'function', function: { name: 'get_weather' } },
      });

      expect(mockCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_choice: { type: 'function', function: { name: 'get_weather' } },
        }),
      );
    });

    it('should include tool_calls in chat.completions interface', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-tool2',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_xyz',
                  type: 'function',
                  function: { name: 'search', arguments: '{"query":"test"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });

      const result = await client.chat.completions({
        messages: [{ role: 'user', content: 'search test' }],
        tools: [searchTool],
      });

      expect(result.choices[0].message.tool_calls).toBeDefined();
      expect(result.choices[0].message.tool_calls![0].function.name).toBe('search');
    });
  });

  // ==========================================================================
  // Agentic Tool Loop Tests
  // ==========================================================================

  describe('chatWithTools — Agentic Loop', () => {
    let client: OpenAIClient;

    const weatherTool = {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get weather',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    };

    beforeEach(async () => {
      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: { model: 'gpt-4o' },
      };
      client = (await OpenAIInitializer.initialize({}, config)) as OpenAIClient;
    });

    it('should return immediately if no tool calls', async () => {
      // Default mock returns a text response (no tool_calls)
      const executor = vi.fn();

      const result = await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'Hello' }],
          tools: [weatherTool],
        },
        executor,
      );

      expect(executor).not.toHaveBeenCalled();
      expect(result.choices[0].message.content).toBe('Hello! How can I help you?');
    });

    it('should execute tool calls and return final response', async () => {
      // First call: model requests a tool call
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_weather_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"London"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
      });

      // Second call: model returns final text response
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-2',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'The weather in London is 15°C and cloudy.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
      });

      const executor = vi.fn().mockResolvedValue({ temp: '15°C', condition: 'cloudy' });

      const result = await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'What is the weather in London?' }],
          tools: [weatherTool],
        },
        executor,
      );

      // Tool executor was called with correct args
      expect(executor).toHaveBeenCalledTimes(1);
      expect(executor).toHaveBeenCalledWith('get_weather', { location: 'London' });

      // Final response is the text answer
      expect(result.choices[0].message.content).toBe('The weather in London is 15°C and cloudy.');

      // Second API call should include tool result message
      const secondCallMessages = mockCreateFn.mock.calls[1][0].messages;
      expect(secondCallMessages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call_weather_1',
        }),
      );
    });

    it('should handle multiple tool calls in one turn', async () => {
      // Model requests two tool calls at once
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-multi',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"London"}' },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });

      // Final response after both tool results
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-final',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'London: 15°C, Paris: 20°C' },
            finish_reason: 'stop',
          },
        ],
      });

      const executor = vi.fn()
        .mockResolvedValueOnce({ temp: '15°C' })
        .mockResolvedValueOnce({ temp: '20°C' });

      const result = await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'Weather in London and Paris?' }],
          tools: [weatherTool],
        },
        executor,
      );

      expect(executor).toHaveBeenCalledTimes(2);
      expect(result.choices[0].message.content).toBe('London: 15°C, Paris: 20°C');
    });

    it('should handle multi-turn tool calling', async () => {
      // Turn 1: first tool call
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-t1',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_a', type: 'function', function: { name: 'get_weather', arguments: '{"location":"London"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      // Turn 2: second tool call based on first result
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-t2',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_b', type: 'function', function: { name: 'get_weather', arguments: '{"location":"Paris"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      // Turn 3: final response
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-t3',
        object: 'chat.completion',
        created: 1700000002,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Both checked!' },
          finish_reason: 'stop',
        }],
      });

      const executor = vi.fn().mockResolvedValue({ temp: '18°C' });

      const result = await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'Check weather in London then Paris' }],
          tools: [weatherTool],
        },
        executor,
      );

      expect(executor).toHaveBeenCalledTimes(2);
      expect(mockCreateFn).toHaveBeenCalledTimes(3);
      expect(result.choices[0].message.content).toBe('Both checked!');
    });

    it('should respect maxTurns limit', async () => {
      // Always return tool calls (infinite loop scenario)
      mockCreateFn.mockResolvedValue({
        id: 'chatcmpl-loop',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_loop', type: 'function', function: { name: 'get_weather', arguments: '{"location":"X"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      const executor = vi.fn().mockResolvedValue('result');

      await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'loop' }],
          tools: [weatherTool],
          maxTurns: 3,
        },
        executor,
      );

      // 3 tool-calling turns + 1 final summary call (without tools)
      expect(executor).toHaveBeenCalledTimes(3);
      expect(mockCreateFn).toHaveBeenCalledTimes(4);
    });

    it('should handle tool execution errors gracefully', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-err',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_err', type: 'function', function: { name: 'get_weather', arguments: '{"location":"X"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      // Final response after error
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-after-err',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Sorry, could not get weather.' },
          finish_reason: 'stop',
        }],
      });

      const executor = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'weather?' }],
          tools: [weatherTool],
        },
        executor,
      );

      // Error should be sent back as tool result
      const secondCallMessages = mockCreateFn.mock.calls[1][0].messages;
      const toolMessage = secondCallMessages.find((m: any) => m.role === 'tool');
      expect(toolMessage.content).toContain('Network timeout');
      expect(result.choices[0].message.content).toBe('Sorry, could not get weather.');
    });

    it('should call onToolCall and onToolResult callbacks', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-cb',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_cb', type: 'function', function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-cb2',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Done!' },
          finish_reason: 'stop',
        }],
      });

      const onToolCall = vi.fn();
      const onToolResult = vi.fn();
      const executor = vi.fn().mockResolvedValue({ temp: '25°C' });

      await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'Weather in Tokyo?' }],
          tools: [weatherTool],
          onToolCall,
          onToolResult,
        },
        executor,
      );

      expect(onToolCall).toHaveBeenCalledTimes(1);
      expect(onToolCall).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'call_cb', function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' } }),
      );

      expect(onToolResult).toHaveBeenCalledTimes(1);
      expect(onToolResult).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'call_cb' }),
        { temp: '25°C' },
      );
    });

    it('should handle string tool results', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-str',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant', content: null,
            tool_calls: [{ id: 'call_str', type: 'function', function: { name: 'get_weather', arguments: '{"location":"X"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      });

      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-str2',
        object: 'chat.completion',
        created: 1700000001,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'OK' },
          finish_reason: 'stop',
        }],
      });

      // Return a plain string from executor
      const executor = vi.fn().mockResolvedValue('Sunny and warm');

      await client.chatWithTools(
        {
          messages: [{ role: 'user', content: 'weather?' }],
          tools: [weatherTool],
        },
        executor,
      );

      const secondCallMessages = mockCreateFn.mock.calls[1][0].messages;
      const toolMessage = secondCallMessages.find((m: any) => m.role === 'tool');
      // String results should be passed through directly
      expect(toolMessage.content).toBe('Sunny and warm');
    });
  });

  // ==========================================================================
  // Structured Output Tests
  // ==========================================================================

  describe('Structured Output', () => {
    let client: OpenAIClient;

    beforeEach(async () => {
      const config = {
        sdk: 'openai',
        auth: { api_key: 'test-key' },
        options: { model: 'gpt-4o' },
      };
      client = (await OpenAIInitializer.initialize({}, config)) as OpenAIClient;
    });

    it('should generate JSON with json_object mode', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-json',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: '{"name": "London", "temp": 15}' },
          finish_reason: 'stop',
        }],
      });

      const result = await client.generateJSON({
        messages: [{ role: 'user', content: 'Weather as JSON' }],
      });

      expect(result).toEqual({ name: 'London', temp: 15 });
      expect(mockCreateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should generate structured output with JSON schema', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-schema',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: '{"city": "London", "temperature": 15, "unit": "celsius"}' },
          finish_reason: 'stop',
        }],
      });

      const result = await client.generateStructured<{ city: string; temperature: number; unit: string }>({
        messages: [{ role: 'user', content: 'Weather in London' }],
        schema: {
          name: 'weather',
          schema: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              temperature: { type: 'number' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['city', 'temperature', 'unit'],
          },
          strict: true,
        },
      });

      expect(result.city).toBe('London');
      expect(result.temperature).toBe(15);
      expect(result.unit).toBe('celsius');
    });

    it('should throw on empty response in generateJSON', async () => {
      mockCreateFn.mockResolvedValueOnce({
        id: 'chatcmpl-empty',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: '' },
          finish_reason: 'stop',
        }],
      });

      await expect(
        client.generateJSON({
          messages: [{ role: 'user', content: 'give json' }],
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Type Validation Tests
  // ==========================================================================

  describe('OpenAI Types', () => {
    it('should export validation schemas', async () => {
      const { OpenAIClientConfigSchema, OpenAIChatOptionsSchema, OpenAIToolSchema } = await import(
        '../src/adapters/openai-types.js'
      );

      expect(OpenAIClientConfigSchema).toBeDefined();
      expect(OpenAIChatOptionsSchema).toBeDefined();
      expect(OpenAIToolSchema).toBeDefined();
    });

    it('should validate client config', async () => {
      const { OpenAIClientConfigSchema } = await import('../src/adapters/openai-types.js');

      const result = OpenAIClientConfigSchema.safeParse({
        baseUrl: 'http://localhost:8000/v1',
        apiKey: 'test-key',
        model: 'gpt-4o',
      });
      expect(result.success).toBe(true);
    });

    it('should validate chat options with tools', async () => {
      const { OpenAIChatOptionsSchema } = await import('../src/adapters/openai-types.js');

      const result = OpenAIChatOptionsSchema.safeParse({
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: { type: 'object', properties: { location: { type: 'string' } } },
            },
          },
        ],
        tool_choice: 'auto',
      });
      expect(result.success).toBe(true);
    });

    it('should validate response_format options', async () => {
      const { OpenAIChatOptionsSchema } = await import('../src/adapters/openai-types.js');

      const jsonMode = OpenAIChatOptionsSchema.safeParse({
        messages: [{ role: 'user', content: 'JSON please' }],
        response_format: { type: 'json_object' },
      });
      expect(jsonMode.success).toBe(true);

      const schemaMode = OpenAIChatOptionsSchema.safeParse({
        messages: [{ role: 'user', content: 'Structured' }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'test',
            schema: { type: 'object', properties: {} },
            strict: true,
          },
        },
      });
      expect(schemaMode.success).toBe(true);
    });

    it('should validate tool messages', async () => {
      const { OpenAIChatMessageSchema } = await import('../src/adapters/openai-types.js');

      const toolMsg = OpenAIChatMessageSchema.safeParse({
        role: 'tool',
        content: '{"result": "ok"}',
        tool_call_id: 'call_abc123',
      });
      expect(toolMsg.success).toBe(true);

      const assistantWithTools = OpenAIChatMessageSchema.safeParse({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_abc',
            type: 'function',
            function: { name: 'test', arguments: '{}' },
          },
        ],
      });
      expect(assistantWithTools.success).toBe(true);
    });

    it('should validate tool definitions', async () => {
      const { OpenAIToolSchema } = await import('../src/adapters/openai-types.js');

      const result = OpenAIToolSchema.safeParse({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
