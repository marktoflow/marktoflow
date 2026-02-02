import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, OllamaInitializer, OllamaClient } from '../src/index.js';

// Mock the ollama module
vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      model: 'llama3.2',
      created_at: new Date().toISOString(),
      response: 'Hello! I am a helpful AI assistant.',
      done: true,
      total_duration: 1000000000, // 1 second in nanoseconds
      prompt_eval_count: 10,
      eval_count: 20,
    }),
    chat: vi.fn().mockResolvedValue({
      model: 'llama3.2',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: 'I can help you with that!' },
      done: true,
      total_duration: 1500000000,
      prompt_eval_count: 15,
      eval_count: 25,
    }),
    embed: vi.fn().mockResolvedValue({
      model: 'llama3.2',
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
    }),
    list: vi.fn().mockResolvedValue({
      models: [
        {
          name: 'llama3.2',
          digest: 'abc123',
          size: 4000000000,
          modified_at: new Date().toISOString(),
          details: { parameter_size: '7B', quantization_level: 'Q4_0' },
        },
        {
          name: 'mistral',
          digest: 'def456',
          size: 3500000000,
          modified_at: new Date().toISOString(),
        },
      ],
    }),
    ps: vi.fn().mockResolvedValue({
      models: [
        {
          name: 'llama3.2',
          digest: 'abc123',
          size: 4000000000,
          size_vram: 3500000000,
          expires_at: new Date(Date.now() + 300000).toISOString(),
        },
      ],
    }),
    pull: vi.fn().mockResolvedValue({ status: 'success' }),
    show: vi.fn().mockResolvedValue({
      modelfile: 'FROM llama3.2',
      parameters: 'temperature 0.7',
      template: '{{ .Prompt }}',
    }),
    delete: vi.fn().mockResolvedValue({}),
    copy: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ status: 'success' }),
  })),
}));

describe('Ollama Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration', () => {
    it('should register ollama initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      const config = {
        sdk: 'ollama',
        options: { host: 'http://localhost:11434' },
      };

      const client = OllamaInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(Promise);

      return expect(client).resolves.toBeInstanceOf(OllamaClient);
    });

    it('should use default host if not provided', async () => {
      const config = {
        sdk: 'ollama',
        options: {},
      };

      const client = await OllamaInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(OllamaClient);
    });

    it('should accept custom model configuration', async () => {
      const config = {
        sdk: 'ollama',
        options: {
          host: 'http://custom-host:11434',
          model: 'mistral',
        },
      };

      const client = (await OllamaInitializer.initialize({}, config)) as OllamaClient;
      expect(client).toBeInstanceOf(OllamaClient);
      expect(client.getDefaultModel()).toBe('mistral');
    });
  });

  describe('OllamaClient', () => {
    let client: OllamaClient;

    beforeEach(async () => {
      const config = {
        sdk: 'ollama',
        options: { host: 'http://localhost:11434', model: 'llama3.2' },
      };
      client = (await OllamaInitializer.initialize({}, config)) as OllamaClient;
    });

    describe('generate()', () => {
      it('should generate text from prompt', async () => {
        const response = await client.generate('Hello, how are you?');

        expect(response).toBe('Hello! I am a helpful AI assistant.');
      });

      it('should accept custom model in generate', async () => {
        const response = await client.generate('Hello', 'mistral');

        expect(response).toBe('Hello! I am a helpful AI assistant.');
      });
    });

    describe('generateFull()', () => {
      it('should return full result with metadata', async () => {
        const result = await client.generateFull({
          prompt: 'Tell me a joke',
        });

        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('model', 'llama3.2');
        expect(result).toHaveProperty('done', true);
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('usage');
        expect(result.usage).toHaveProperty('prompt_tokens', 10);
        expect(result.usage).toHaveProperty('completion_tokens', 20);
        expect(result.usage).toHaveProperty('total_tokens', 30);
      });

      it('should accept generation options', async () => {
        const result = await client.generateFull({
          prompt: 'Tell me a story',
          system: 'You are a storyteller.',
          options: {
            temperature: 0.8,
            top_k: 50,
            top_p: 0.9,
          },
        });

        expect(result.content).toBeTruthy();
      });
    });

    describe('chat()', () => {
      it('should handle chat messages', async () => {
        const result = await client.chat({
          messages: [
            { role: 'user', content: 'Hello!' },
          ],
        });

        expect(result).toHaveProperty('content', 'I can help you with that!');
        expect(result).toHaveProperty('model', 'llama3.2');
        expect(result).toHaveProperty('done', true);
      });

      it('should handle multi-turn conversations', async () => {
        const result = await client.chat({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'What is 2+2?' },
            { role: 'assistant', content: '2+2 equals 4.' },
            { role: 'user', content: 'And 3+3?' },
          ],
        });

        expect(result.content).toBeTruthy();
      });
    });

    describe('embeddings()', () => {
      it('should generate embeddings for single text', async () => {
        const embeddings = await client.embeddings({
          input: 'Hello world',
        });

        expect(embeddings).toBeInstanceOf(Array);
        expect(embeddings[0]).toBeInstanceOf(Array);
        expect(embeddings[0].length).toBeGreaterThan(0);
      });

      it('should generate embeddings for multiple texts', async () => {
        const embeddings = await client.embeddings({
          input: ['Hello', 'World'],
        });

        expect(embeddings).toBeInstanceOf(Array);
        expect(embeddings.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('embed()', () => {
      it('should generate embedding for single text (convenience method)', async () => {
        const embedding = await client.embed('Hello world');

        expect(embedding).toBeInstanceOf(Array);
        expect(embedding.length).toBeGreaterThan(0);
      });
    });

    describe('Model Management', () => {
      it('should list available models', async () => {
        const models = await client.listModels();

        expect(models).toBeInstanceOf(Array);
        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('name');
        expect(models[0]).toHaveProperty('size');
      });

      it('should list running models', async () => {
        const models = await client.listRunning();

        expect(models).toBeInstanceOf(Array);
        expect(models[0]).toHaveProperty('name');
        expect(models[0]).toHaveProperty('size_vram');
      });

      it('should check if model is available', async () => {
        const hasLlama = await client.hasModel('llama3.2');
        const hasUnknown = await client.hasModel('unknown-model');

        expect(hasLlama).toBe(true);
        expect(hasUnknown).toBe(false);
      });

      it('should check Ollama availability', async () => {
        const available = await client.isAvailable();

        expect(available).toBe(true);
      });
    });

    describe('Default Model', () => {
      it('should get default model', () => {
        expect(client.getDefaultModel()).toBe('llama3.2');
      });

      it('should set default model', () => {
        client.setDefaultModel('mistral');
        expect(client.getDefaultModel()).toBe('mistral');
      });
    });

    describe('OpenAI-Compatible Interface', () => {
      it('should support chat.completions.create()', async () => {
        const result = await client.chatCompletions.create({
          model: 'llama3.2',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

        expect(result).toHaveProperty('choices');
        expect(result.choices).toBeInstanceOf(Array);
        expect(result.choices[0]).toHaveProperty('message');
        expect(result.choices[0].message).toHaveProperty('role', 'assistant');
        expect(result.choices[0].message).toHaveProperty('content');
      });

      it('should support embeddings.create()', async () => {
        const result = await client.embeddingsCreate.create({
          model: 'llama3.2',
          input: 'Hello world',
        });

        expect(result).toHaveProperty('data');
        expect(result.data).toBeInstanceOf(Array);
        expect(result.data[0]).toHaveProperty('embedding');
        expect(result.data[0]).toHaveProperty('index', 0);
      });
    });
  });
});

describe('Ollama Types', () => {
  it('should export all required types', async () => {
    const { OllamaClientConfigSchema, OllamaGenerateOptionsSchema } = await import(
      '../src/adapters/ollama-types.js'
    );

    expect(OllamaClientConfigSchema).toBeDefined();
    expect(OllamaGenerateOptionsSchema).toBeDefined();
  });

  it('should validate client config', async () => {
    const { OllamaClientConfigSchema } = await import('../src/adapters/ollama-types.js');

    const validConfig = {
      host: 'http://localhost:11434',
      model: 'llama3.2',
    };

    const result = OllamaClientConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should validate generate options', async () => {
    const { OllamaGenerateOptionsSchema } = await import('../src/adapters/ollama-types.js');

    const validOptions = {
      prompt: 'Hello',
      model: 'llama3.2',
      options: {
        temperature: 0.7,
        top_k: 50,
      },
    };

    const result = OllamaGenerateOptionsSchema.safeParse(validOptions);
    expect(result.success).toBe(true);
  });
});
