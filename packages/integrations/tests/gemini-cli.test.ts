import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SDKRegistry } from '@marktoflow/core';
import { registerIntegrations, GeminiCliInitializer, GeminiCliClient } from '../src/index.js';
import {
  extractGeminiCliCredentials,
  clearCredentialsCache,
  parseGeminiAuth,
  refreshAccessToken,
  loadGeminiCliOAuthCredentials,
} from '../src/adapters/gemini-cli-oauth.js';
import {
  GeminiCliClientConfigSchema,
  GeminiCliChatOptionsSchema,
} from '../src/adapters/gemini-cli-types.js';

// ============================================================================
// Mock fetch for Gemini API calls
// ============================================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockGenerateContent(
  text: string,
  usage?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: usage || {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    }),
    text: async () => '',
  };
}

/** Simulate a Code Assist OAuth response: candidates nested under "response" */
function mockCodeAssistGenerateContent(
  text: string,
  usage?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number }
) {
  return {
    ok: true,
    json: async () => ({
      response: {
        candidates: [{ content: { parts: [{ text }] } }],
        usageMetadata: usage || {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
      traceId: 'test-trace-id',
    }),
    text: async () => '',
  };
}

function mockListModels() {
  return {
    ok: true,
    json: async () => ({
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          description: 'Fast and efficient',
          inputTokenLimit: 1048576,
          outputTokenLimit: 8192,
          supportedGenerationMethods: ['generateContent', 'countTokens'],
        },
        {
          name: 'models/gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          description: 'Most capable',
          inputTokenLimit: 2097152,
          outputTokenLimit: 8192,
          supportedGenerationMethods: ['generateContent', 'countTokens'],
        },
      ],
    }),
    text: async () => '',
  };
}

function mockTokenRefresh() {
  return {
    ok: true,
    json: async () => ({
      access_token: 'new-access-token',
      expires_in: 3600,
    }),
    text: async () => '',
  };
}

function createApiKeyClient(): GeminiCliClient {
  return new GeminiCliClient({
    auth: { mode: 'api_key', apiKey: 'test-api-key' },
    model: 'gemini-2.5-flash',
  });
}

function createOAuthClient(): GeminiCliClient {
  return new GeminiCliClient({
    auth: {
      mode: 'oauth',
      refreshToken: 'test-refresh-token',
      accessToken: 'test-access-token',
      expiresAt: Date.now() + 3600000,
      projectId: 'test-project',
    },
    model: 'gemini-2.5-flash',
  });
}

// ============================================================================
// Registration Tests
// ============================================================================

describe('Gemini CLI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCredentialsCache();
  });

  describe('Registration', () => {
    it('should register google-gemini-cli initializer', () => {
      const registry = new SDKRegistry();
      registerIntegrations(registry);

      // The initializer should be registered
      expect(GeminiCliInitializer).toBeDefined();
      expect(GeminiCliInitializer.initialize).toBeInstanceOf(Function);
    });

    it('should initialize with API key auth', async () => {
      const config = {
        sdk: 'google-gemini-cli',
        auth: { api_key: 'test-key' },
        options: { model: 'gemini-2.5-flash' },
      };

      const client = await GeminiCliInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GeminiCliClient);
    });

    it('should initialize with OAuth auth', async () => {
      const config = {
        sdk: 'google-gemini-cli',
        auth: {
          refresh_token: 'test-refresh',
          project_id: 'test-project',
        },
        options: {},
      };

      const client = await GeminiCliInitializer.initialize({}, config);
      expect(client).toBeInstanceOf(GeminiCliClient);
    });

    it('should use default model if not specified', async () => {
      const config = {
        sdk: 'google-gemini-cli',
        auth: { api_key: 'test-key' },
        options: {},
      };

      const client = (await GeminiCliInitializer.initialize({}, config)) as GeminiCliClient;
      expect(client.getDefaultModel()).toBe('gemini-2.5-flash');
    });

    it('should accept custom model', async () => {
      const config = {
        sdk: 'google-gemini-cli',
        auth: { api_key: 'test-key' },
        options: { model: 'gemini-2.5-pro' },
      };

      const client = (await GeminiCliInitializer.initialize({}, config)) as GeminiCliClient;
      expect(client.getDefaultModel()).toBe('gemini-2.5-pro');
    });

    it('should throw on missing auth', async () => {
      const config = {
        sdk: 'google-gemini-cli',
        auth: {},
        options: {},
      };

      // Redirect HOME so no ~/.gemini/oauth_creds.json is found
      const origHome = process.env.HOME;
      process.env.HOME = '/nonexistent-path-for-testing';
      try {
        await expect(GeminiCliInitializer.initialize({}, config)).rejects.toThrow(
          /api_key or refresh_token/
        );
      } finally {
        process.env.HOME = origHome;
      }
    });
  });

  // ============================================================================
  // Client Tests (API Key Mode)
  // ============================================================================

  describe('GeminiCliClient (API Key)', () => {
    let client: GeminiCliClient;

    beforeEach(() => {
      client = createApiKeyClient();
    });

    describe('generate()', () => {
      it('should generate text from prompt', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('Hello! How can I help?'));

        const response = await client.generate('Hello');
        expect(response).toBe('Hello! How can I help?');
      });

      it('should use default model', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('response'));

        await client.generate('test');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('gemini-2.5-flash'),
          expect.any(Object)
        );
      });

      it('should use custom model when specified', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('response'));

        await client.generate('test', 'gemini-2.5-pro');
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('gemini-2.5-pro'),
          expect.any(Object)
        );
      });
    });

    describe('chat()', () => {
      it('should handle chat messages', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('I can help with that!'));

        const result = await client.chat({
          messages: [{ role: 'user', parts: [{ text: 'Hello!' }] }],
        });

        expect(result.content).toBe('I can help with that!');
        expect(result.model).toBe('gemini-2.5-flash');
        expect(result.done).toBe(true);
      });

      it('should return usage metadata', async () => {
        mockFetch.mockResolvedValueOnce(
          mockGenerateContent('response', {
            promptTokenCount: 5,
            candidatesTokenCount: 15,
            totalTokenCount: 20,
          })
        );

        const result = await client.chat({
          messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        });

        expect(result.usage).toEqual({
          promptTokens: 5,
          completionTokens: 15,
          totalTokens: 20,
        });
      });

      it('should pass system instruction', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('I am a pirate'));

        await client.chat({
          messages: [{ role: 'user', parts: [{ text: 'Who are you?' }] }],
          systemInstruction: 'You are a pirate.',
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.systemInstruction).toEqual({
          parts: [{ text: 'You are a pirate.' }],
        });
      });

      it('should pass generation config', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('response'));

        await client.chat({
          messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 1024,
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.generationConfig).toEqual({
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 1024,
        });
      });

      it('should include API key in URL', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('response'));

        await client.chat({
          messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('key=test-api-key'),
          expect.any(Object)
        );
      });

      it('should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        });

        await expect(
          client.chat({ messages: [{ role: 'user', parts: [{ text: 'Hi' }] }] })
        ).rejects.toThrow('Gemini API error 403');
      });
    });

    describe('listModels()', () => {
      it('should list available models', async () => {
        mockFetch.mockResolvedValueOnce(mockListModels());

        const models = await client.listModels();

        expect(models).toHaveLength(2);
        expect(models[0].name).toBe('gemini-2.5-flash');
        expect(models[0].displayName).toBe('Gemini 2.5 Flash');
        expect(models[1].name).toBe('gemini-2.5-pro');
      });

      it('should strip models/ prefix from name', async () => {
        mockFetch.mockResolvedValueOnce(mockListModels());

        const models = await client.listModels();
        expect(models[0].name).not.toContain('models/');
      });
    });

    describe('parseThinking()', () => {
      it('should extract thinking content from <think> tags', () => {
        const { content, thinking } = client.parseThinking(
          '<think>Let me reason about this.</think>The answer is 42.'
        );
        expect(content).toBe('The answer is 42.');
        expect(thinking).toBe('Let me reason about this.');
      });

      it('should return content as-is when no think tags', () => {
        const { content, thinking } = client.parseThinking('Just a normal response.');
        expect(content).toBe('Just a normal response.');
        expect(thinking).toBeUndefined();
      });
    });

    describe('Default Model', () => {
      it('should get default model', () => {
        expect(client.getDefaultModel()).toBe('gemini-2.5-flash');
      });

      it('should set default model', () => {
        client.setDefaultModel('gemini-2.5-pro');
        expect(client.getDefaultModel()).toBe('gemini-2.5-pro');
      });
    });

    describe('OpenAI-Compatible Interface', () => {
      it('should support chat.completions.create()', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('Hello from Gemini!'));

        const result = await client.chatCompletions.create({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hello!' }],
        });

        expect(result.choices).toHaveLength(1);
        expect(result.choices[0].message.role).toBe('assistant');
        expect(result.choices[0].message.content).toBe('Hello from Gemini!');
      });

      it('should extract system message for system instruction', async () => {
        mockFetch.mockResolvedValueOnce(mockGenerateContent('response'));

        await client.chatCompletions.create({
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.systemInstruction).toEqual({
          parts: [{ text: 'You are helpful.' }],
        });
        // System message should be filtered from contents
        expect(body.contents).toHaveLength(1);
        expect(body.contents[0].role).toBe('user');
      });
    });
  });

  // ============================================================================
  // OAuth Client Tests
  // ============================================================================

  describe('GeminiCliClient (OAuth)', () => {
    it('should use Bearer token in headers', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('response'));

      await client.generate('test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-access-token');
      expect(headers['x-goog-api-key']).toBeUndefined();
    });

    it('should call the Code Assist endpoint, not generativelanguage.googleapis.com', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('response'));

      await client.generate('test');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('cloudcode-pa.googleapis.com');
      expect(url).not.toContain('generativelanguage.googleapis.com');
    });

    it('should wrap request body for Code Assist endpoint', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('response'));

      await client.chat({
        messages: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Must have top-level model + project + request wrapper
      expect(body.model).toBe('gemini-2.5-flash');
      expect(body.project).toBe('test-project');
      expect(body.request).toBeDefined();
      expect(body.request.contents).toBeDefined();
      // Contents should NOT be at top level
      expect(body.contents).toBeUndefined();
    });

    it('should use snake_case system_instruction for Code Assist endpoint', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('Arrr!'));

      await client.chat({
        messages: [{ role: 'user', parts: [{ text: 'Who are you?' }] }],
        systemInstruction: 'You are a pirate.',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.request.system_instruction).toEqual({ parts: [{ text: 'You are a pirate.' }] });
      expect(body.request.systemInstruction).toBeUndefined();
    });

    it('should unwrap response from Code Assist "response" wrapper', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('Hello from Code Assist!'));

      const result = await client.generate('Hello');
      expect(result).toBe('Hello from Code Assist!');
    });

    it('should return usage metadata from Code Assist response', async () => {
      const client = createOAuthClient();
      mockFetch.mockResolvedValueOnce(
        mockCodeAssistGenerateContent('response', {
          promptTokenCount: 5,
          candidatesTokenCount: 15,
          totalTokenCount: 20,
        })
      );

      const result = await client.chat({
        messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      });

      expect(result.usage).toEqual({
        promptTokens: 5,
        completionTokens: 15,
        totalTokens: 20,
      });
    });

    it('should return static model list in OAuth mode (no fetch call)', async () => {
      const client = createOAuthClient();
      const models = await client.listModels();

      // No fetch should have been made
      expect(mockFetch).not.toHaveBeenCalled();
      expect(models.length).toBeGreaterThan(0);
      expect(models.map((m) => m.name)).toContain('gemini-2.5-flash');
      expect(models.map((m) => m.name)).toContain('gemini-2.5-pro');
    });

    it('should refresh expired token', async () => {
      const client = new GeminiCliClient({
        auth: {
          mode: 'oauth',
          refreshToken: 'test-refresh-token',
          accessToken: 'expired-token',
          expiresAt: Date.now() - 1000, // expired
          projectId: 'test-project',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      });

      // First call: token refresh
      mockFetch.mockResolvedValueOnce(mockTokenRefresh());
      // Second call: actual API call
      mockFetch.mockResolvedValueOnce(mockCodeAssistGenerateContent('response'));

      await client.generate('test');

      // Should have made two fetch calls: refresh + generate
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // First call should be token refresh
      expect(mockFetch.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    });
  });

  // ============================================================================
  // OAuth Utility Tests
  // ============================================================================

  describe('parseGeminiAuth()', () => {
    it('should parse API key auth', async () => {
      const result = await parseGeminiAuth({ api_key: 'my-key' });
      expect(result).toEqual({ mode: 'api_key', apiKey: 'my-key' });
    });

    it('should parse apiKey (camelCase)', async () => {
      const result = await parseGeminiAuth({ apiKey: 'my-key' });
      expect(result).toEqual({ mode: 'api_key', apiKey: 'my-key' });
    });

    it('should parse OAuth auth with refresh_token', async () => {
      const result = await parseGeminiAuth({
        refresh_token: 'my-refresh',
        project_id: 'my-project',
      });
      expect(result).toEqual({
        mode: 'oauth',
        refreshToken: 'my-refresh',
        projectId: 'my-project',
        clientId: undefined,
        clientSecret: undefined,
      });
    });

    it('should parse OAuth auth with camelCase keys', async () => {
      const result = await parseGeminiAuth({
        refreshToken: 'my-refresh',
        projectId: 'my-project',
        clientId: 'my-client',
        clientSecret: 'my-secret',
      });
      expect(result).toEqual({
        mode: 'oauth',
        refreshToken: 'my-refresh',
        projectId: 'my-project',
        clientId: 'my-client',
        clientSecret: 'my-secret',
      });
    });

    it('should throw on missing auth when no stored credentials found', async () => {
      // Temporarily point HOME to a directory with no .gemini/oauth_creds.json
      const origHome = process.env.HOME;
      process.env.HOME = '/nonexistent-path-for-testing';
      try {
        await expect(parseGeminiAuth({})).rejects.toThrow(/api_key or refresh_token/);
      } finally {
        process.env.HOME = origHome;
      }
    });

    it('should auto-discover OAuth credentials from stored file when no auth provided', async () => {
      // Write a temporary oauth_creds.json so auto-discovery has something to find
      const tmpHome = join(tmpdir(), `marktoflow-test-${Date.now()}`);
      mkdirSync(join(tmpHome, '.gemini'), { recursive: true });
      writeFileSync(
        join(tmpHome, '.gemini', 'oauth_creds.json'),
        JSON.stringify({ refresh_token: 'auto-discovered-token' })
      );
      const origHome = process.env.HOME;
      process.env.HOME = tmpHome;
      try {
        // Pass empty auth — should fall through to auto-discovery
        const result = await parseGeminiAuth({});
        expect(result.mode).toBe('oauth');
        if (result.mode === 'oauth') {
          expect(result.refreshToken).toBe('auto-discovered-token');
        }
      } finally {
        process.env.HOME = origHome;
        rmSync(tmpHome, { recursive: true, force: true });
      }
    });
  });

  describe('extractGeminiCliCredentials()', () => {
    it('should return consistent results (null or credentials object)', () => {
      clearCredentialsCache();
      const result = extractGeminiCliCredentials();
      // Result is either null (not installed) or an object with clientId/clientSecret
      if (result !== null) {
        expect(result).toHaveProperty('clientId');
        expect(result).toHaveProperty('clientSecret');
        expect(result.clientId).toMatch(/\.apps\.googleusercontent\.com$/);
        expect(result.clientSecret).toMatch(/^GOCSPX-/);
      }
    });

    it('should cache results on repeated calls', () => {
      clearCredentialsCache();
      const result1 = extractGeminiCliCredentials();
      const result2 = extractGeminiCliCredentials();
      // Same reference (cached)
      if (result1 === null) {
        expect(result2).toBeNull();
      } else {
        expect(result2).toBe(result1);
      }
    });
  });

  describe('refreshAccessToken()', () => {
    it('should refresh token successfully', async () => {
      mockFetch.mockResolvedValueOnce(mockTokenRefresh());

      const result = await refreshAccessToken('my-refresh', 'my-client-id', 'my-secret');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should throw on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      await expect(refreshAccessToken('bad-token', 'client', 'secret')).rejects.toThrow(
        'Token refresh failed'
      );
    });
  });
});

// ============================================================================
// Type Validation Tests
// ============================================================================

describe('Gemini CLI Types', () => {
  it('should export Zod schemas', () => {
    expect(GeminiCliClientConfigSchema).toBeDefined();
    expect(GeminiCliChatOptionsSchema).toBeDefined();
  });

  it('should validate client config', () => {
    const valid = { model: 'gemini-2.5-flash', timeout: 30000 };
    const result = GeminiCliClientConfigSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate empty client config', () => {
    const result = GeminiCliClientConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate chat options', () => {
    const valid = {
      messages: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1024,
    };
    const result = GeminiCliChatOptionsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid temperature', () => {
    const invalid = {
      messages: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      temperature: 5,
    };
    const result = GeminiCliChatOptionsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid role', () => {
    const invalid = {
      messages: [{ role: 'system', parts: [{ text: 'Hello' }] }],
    };
    const result = GeminiCliChatOptionsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
