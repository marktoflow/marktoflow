import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QwenProvider, createQwenProvider } from '../../src/server/services/agents/qwen-provider.js';
import type { Workflow } from '../../src/server/services/agents/types.js';

const sendMock = vi.fn().mockResolvedValue(
  'Updated workflow below\n```yaml\nmetadata:\n  name: updated\nsteps: []\n```'
);
const streamMock = vi.fn().mockImplementation(async ({ onChunk }: { onChunk?: (chunk: string) => void }) => {
  const text = 'Updated workflow below\n```yaml\nmetadata:\n  name: updated\nsteps: []\n```';
  if (onChunk) onChunk(text);
  return text;
});
const cancelMock = vi.fn().mockResolvedValue(undefined);
const isQwenSdkAvailableMock = vi.fn().mockResolvedValue(true);

vi.mock('@marktoflow/integrations', () => ({
  isQwenSdkAvailable: (...args: unknown[]) => isQwenSdkAvailableMock(...args),
  QwenCodeClient: vi.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => sendMock(...args),
    stream: (...args: unknown[]) => streamMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
    getStatus: () => ({ ready: true, model: 'qwen-plus', authType: 'qwen-oauth' }),
  })),
}));

describe('QwenProvider', () => {
  let provider: QwenProvider;

  const workflow: Workflow = {
    metadata: { name: 'test' },
    steps: [{ id: 'a', name: 'A' }],
  };

  beforeEach(() => {
    provider = new QwenProvider();
    vi.clearAllMocks();
    isQwenSdkAvailableMock.mockResolvedValue(true);
    isQwenSdkAvailableMock.mockClear();
    sendMock.mockClear();
    streamMock.mockClear();
    cancelMock.mockClear();
  });

  it('has expected id and name', () => {
    expect(provider.id).toBe('qwen-code');
    expect(provider.name).toBe('Qwen Code (SDK)');
  });

  it('initializes and becomes ready', async () => {
    expect(provider.isReady()).toBe(false);
    await provider.initialize({ model: 'qwen-max' });
    expect(provider.isReady()).toBe(true);
    expect(provider.getStatus().model).toBeDefined();
  });

  it('checks availability during initialize without constructor race', async () => {
    isQwenSdkAvailableMock.mockResolvedValueOnce(false);
    const unavailableProvider = new QwenProvider();

    await unavailableProvider.initialize({ model: 'qwen-plus' });

    expect(unavailableProvider.getStatus().available).toBe(false);
    expect(isQwenSdkAvailableMock).toHaveBeenCalledTimes(1);
  });

  it('processes prompt after initialization', async () => {
    await provider.initialize({});
    const result = await provider.processPrompt('Add a step', workflow);
    expect(result.error).toBeUndefined();
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('supports local OpenAI-compatible Qwen endpoints via baseUrl/apiKey', async () => {
    await provider.initialize({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'local-test-key',
      model: 'qwen2.5-coder:14b',
    });

    await provider.processPrompt('Refactor this workflow', workflow);

    expect(sendMock).toHaveBeenCalled();
  });

  it('streams prompt chunks', async () => {
    await provider.initialize({});
    const chunks: string[] = [];
    const result = await provider.streamPrompt('Update workflow', workflow, (c) => chunks.push(c));

    expect(result.error).toBeUndefined();
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('returns suggestions', async () => {
    const suggestions = await provider.getSuggestions(workflow);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('factory creates provider', () => {
    const created = createQwenProvider();
    expect(created).toBeInstanceOf(QwenProvider);
  });
});
