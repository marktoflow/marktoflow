import { describe, expect, it } from 'vitest';
import { asSecret } from '../src/auth.js';
import { AgentError, toAgentError } from '../src/errors.js';
import { createAgentsSDK } from '../src/sdk.js';

describe('AgentsSDK providers', () => {
  it('registers default providers', () => {
    const sdk = createAgentsSDK();
    const ids = sdk.listProviders().map((provider) => provider.id).sort();

    expect(ids).toEqual(['claude', 'codex', 'copilot', 'gemini', 'qwen']);
  });

  it('creates clients for built-in providers', async () => {
    const sdk = createAgentsSDK();

    const providers = ['claude', 'codex', 'copilot', 'qwen', 'gemini'];
    for (const provider of providers) {
      const client = await sdk.createClient({
        provider,
        config: {},
        auth: {
          type: 'api_key',
          apiKey: asSecret('test-secret-key'),
        },
      });

      const output = await client.invoke({ input: 'ping' });
      expect(output.output).toContain(`[stub:${provider}]`);
      expect(output.raw).toMatchObject({ authType: 'api_key' });
    }
  });

  it('filters providers by capability', () => {
    const sdk = createAgentsSDK();

    const vision = sdk.providersByCapability('vision').map((provider) => provider.id);
    expect(vision).toEqual(expect.arrayContaining(['claude', 'qwen', 'gemini']));
    expect(vision).not.toContain('codex');
    expect(vision).not.toContain('copilot');
  });

  it('exposes differentiated provider metadata and current codex model ids', () => {
    const sdk = createAgentsSDK();
    const byId = new Map(sdk.listProviders().map((provider) => [provider.id, provider]));

    expect(byId.get('codex')?.defaultModel).toBe('codex-mini-latest');
    expect(byId.get('codex')?.models).toEqual(expect.arrayContaining(['codex-mini-latest', 'codex-latest']));
    expect(byId.get('copilot')?.defaultModel).toBe('codex-mini-latest');

    expect(byId.get('claude')?.capabilities).toContain('mcp');
    expect(byId.get('codex')?.capabilities).toContain('code-exec');
    expect(byId.get('codex')?.capabilities).not.toContain('vision');
    expect(byId.get('gemini')?.capabilities).toContain('vision');
    expect(byId.get('gemini')?.capabilities).not.toContain('mcp');
    expect(byId.get('copilot')?.capabilities).not.toContain('structured-output');
  });

  it('throws a normalized error when provider does not exist', async () => {
    const sdk = createAgentsSDK();

    await expect(
      sdk.createClient({
        provider: 'not-real',
        config: {},
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
  });
});

describe('toAgentError', () => {
  it('maps common provider errors to normalized codes', () => {
    expect(toAgentError({ status: 401, message: 'Unauthorized' }).code).toBe('AUTHENTICATION_FAILED');
    expect(toAgentError({ status: 403, message: 'Forbidden' }).code).toBe('AUTHORIZATION_FAILED');
    expect(toAgentError({ status: 429, message: 'Rate limit exceeded' }).code).toBe('RATE_LIMITED');
    expect(toAgentError({ message: 'network connection reset' }).code).toBe('NETWORK_ERROR');
    expect(toAgentError({ name: 'AbortError', message: 'timeout waiting' }).code).toBe('TIMEOUT');
  });

  it('passes AgentError through unchanged', () => {
    const existing = new AgentError('UNSUPPORTED_CAPABILITY', 'not supported');
    const normalized = toAgentError(existing);
    expect(normalized).toBe(existing);
  });
});
