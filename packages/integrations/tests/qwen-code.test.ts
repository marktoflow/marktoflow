import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QwenCodeClient, QwenCodeInitializer } from '../src/adapters/qwen-code.js';

const queryMock = vi.fn().mockImplementation(() => {
  async function* stream() {
    yield {
      type: 'assistant',
      message: { content: 'Hello from Qwen' },
    };
    yield {
      type: 'result',
      result: 'Hello from Qwen',
      is_error: false,
    };
  }

  return {
    [Symbol.asyncIterator]: stream,
    close: vi.fn().mockResolvedValue(undefined),
    interrupt: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@qwen-code/sdk', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

describe('QwenCodeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockClear();
  });

  it('sends prompt and returns final text', async () => {
    const client = new QwenCodeClient({ model: 'qwen-plus' });
    const result = await client.send({ prompt: 'Hello' });

    expect(result).toBe('Hello from Qwen');
    expect(queryMock).toHaveBeenCalled();
  });

  it('streams chunks and returns final text', async () => {
    const client = new QwenCodeClient({ model: 'qwen-plus' });
    const chunks: string[] = [];

    const result = await client.stream({
      prompt: 'Stream hello',
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(result).toBe('Hello from Qwen');
    expect(chunks.join('')).toContain('Hello from Qwen');
  });

  it('uses openai auth mode with local baseUrl/apiKey', async () => {
    const client = new QwenCodeClient({
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'local-key',
    });

    await client.send({ prompt: 'Use local model' });

    const call = queryMock.mock.calls[0][0] as { options?: Record<string, unknown> };
    expect(call.options?.authType).toBe('openai');
    const env = call.options?.env as Record<string, string>;
    expect(env.OPENAI_BASE_URL).toBe('http://localhost:11434/v1');
    expect(env.OPENAI_API_KEY).toBe('local-key');
  });

  it('supports OpenAI-compatible chat completions shape', async () => {
    const client = new QwenCodeClient();
    const response = await client.chat.completions({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.choices[0].message.content).toBe('Hello from Qwen');
  });

  it('initializer returns configured client', async () => {
    const client = (await QwenCodeInitializer.initialize({}, {
      sdk: 'qwen-code',
      auth: { api_key: 'x', base_url: 'http://localhost:11434/v1' },
      options: { model: 'qwen2.5-coder:14b' },
    })) as QwenCodeClient;

    expect(client).toBeInstanceOf(QwenCodeClient);
    expect(client.getStatus().model).toBe('qwen2.5-coder:14b');
  });

  it('cancel interrupts active query and cleans up', async () => {
    let releaseInterrupt: (() => void) | null = null;
    const interrupted = new Promise<void>((resolve) => {
      releaseInterrupt = resolve;
    });
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const interruptMock = vi.fn().mockImplementation(async () => {
      releaseInterrupt?.();
    });

    queryMock.mockImplementationOnce(() => ({
      async *[Symbol.asyncIterator]() {
        await interrupted;
        throw new Error('interrupted');
      },
      close: closeMock,
      interrupt: interruptMock,
    }));

    const client = new QwenCodeClient({ model: 'qwen-plus' });
    const sendPromise = client.send({ prompt: 'long running prompt' });

    await Promise.resolve();
    await client.cancel();

    await expect(sendPromise).rejects.toThrow('interrupted');
    expect(interruptMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);

    // Ensure internal state was cleaned and no stale interrupt is called again.
    await client.cancel();
    expect(interruptMock).toHaveBeenCalledTimes(1);
  });
});
