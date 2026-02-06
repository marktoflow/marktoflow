import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { IntegrationRequestError } from '../../src/reliability/errors.js';

// ============================================================================
// Mock SDK for testing
// ============================================================================

function createMockSDK() {
  return {
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ok: true, ts: '1234.5678' }),
      update: vi.fn().mockResolvedValue({ ok: true }),
    },
    users: {
      list: vi.fn().mockResolvedValue({ ok: true, members: [] }),
    },
    auth: {
      test: vi.fn().mockResolvedValue({ ok: true, user_id: 'U123' }),
    },
    flatMethod: vi.fn().mockResolvedValue({ result: 'ok' }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('wrapIntegration', () => {
  let mockSDK: ReturnType<typeof createMockSDK>;

  beforeEach(() => {
    mockSDK = createMockSDK();
  });

  it('should proxy nested method calls transparently', async () => {
    const wrapped = wrapIntegration('test', mockSDK);
    const result = await wrapped.chat.postMessage({ channel: '#test', text: 'hello' });
    expect(result).toEqual({ ok: true, ts: '1234.5678' });
    expect(mockSDK.chat.postMessage).toHaveBeenCalledWith({ channel: '#test', text: 'hello' });
  });

  it('should proxy flat method calls', async () => {
    const wrapped = wrapIntegration('test', mockSDK);
    const result = await wrapped.flatMethod({ key: 'value' });
    expect(result).toEqual({ result: 'ok' });
  });

  it('should validate inputs when schema is provided', async () => {
    const wrapped = wrapIntegration('test', mockSDK, {
      inputSchemas: {
        'chat.postMessage': z.object({
          channel: z.string().min(1),
          text: z.string().min(1),
        }),
      },
    });

    // Valid inputs should pass
    await wrapped.chat.postMessage({ channel: '#test', text: 'hello' });
    expect(mockSDK.chat.postMessage).toHaveBeenCalled();

    // Invalid inputs should throw IntegrationRequestError
    await expect(
      wrapped.chat.postMessage({ channel: '', text: '' })
    ).rejects.toThrow(IntegrationRequestError);
  });

  it('should throw IntegrationRequestError with validation details', async () => {
    const wrapped = wrapIntegration('slack', mockSDK, {
      inputSchemas: {
        'chat.postMessage': z.object({
          channel: z.string().min(1, 'channel is required'),
        }),
      },
    });

    try {
      await wrapped.chat.postMessage({ channel: '' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationRequestError);
      const ie = error as IntegrationRequestError;
      expect(ie.service).toBe('slack');
      expect(ie.action).toBe('chat.postMessage');
      expect(ie.retryable).toBe(false);
      expect(ie.message).toContain('Input validation failed');
      expect(ie.message).toContain('channel is required');
    }
  });

  it('should retry on retryable errors', async () => {
    const failThenSucceed = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce({ ok: true });

    const sdk = { doSomething: failThenSucceed };
    const wrapped = wrapIntegration('test', sdk, {
      maxRetries: 2,
      initialRetryDelay: 10,
      maxRetryDelay: 50,
    });

    const result = await wrapped.doSomething({});
    expect(result).toEqual({ ok: true });
    expect(failThenSucceed).toHaveBeenCalledTimes(2);
  });

  it('should not retry non-retryable errors', async () => {
    const fail = vi.fn().mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 })
    );

    const sdk = { doSomething: fail };
    const wrapped = wrapIntegration('test', sdk, {
      maxRetries: 3,
      initialRetryDelay: 10,
    });

    await expect(wrapped.doSomething({})).rejects.toThrow(IntegrationRequestError);
    expect(fail).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exhausted', async () => {
    const alwaysFail = vi.fn().mockRejectedValue(
      Object.assign(new Error('server error'), { status: 500 })
    );

    const sdk = { doSomething: alwaysFail };
    const wrapped = wrapIntegration('test', sdk, {
      maxRetries: 2,
      initialRetryDelay: 10,
      maxRetryDelay: 20,
    });

    await expect(wrapped.doSomething({})).rejects.toThrow(IntegrationRequestError);
    expect(alwaysFail).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should timeout long-running calls', async () => {
    const slowMethod = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const sdk = { slow: slowMethod };
    const wrapped = wrapIntegration('test', sdk, {
      timeout: 50,
      maxRetries: 0,
    });

    await expect(wrapped.slow({})).rejects.toThrow(IntegrationRequestError);
    await expect(wrapped.slow({})).rejects.toThrow(/timed out/);
  });

  it('should normalize errors to IntegrationRequestError', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('something went wrong'));

    const sdk = { doSomething: fail };
    const wrapped = wrapIntegration('myservice', sdk, {
      maxRetries: 0,
    });

    try {
      await wrapped.doSomething({});
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationRequestError);
      const ie = error as IntegrationRequestError;
      expect(ie.service).toBe('myservice');
      expect(ie.action).toBe('doSomething');
    }
  });

  it('should preserve non-function properties', () => {
    const sdk = {
      version: '1.0.0',
      config: { baseUrl: 'https://api.example.com' },
      doSomething: vi.fn(),
    };
    const wrapped = wrapIntegration('test', sdk);
    expect(wrapped.version).toBe('1.0.0');
    expect(wrapped.config).toEqual({ baseUrl: 'https://api.example.com' });
  });

  it('should support custom retryOn status codes', async () => {
    const fail403 = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('forbidden'), { status: 403 }))
      .mockResolvedValueOnce({ ok: true });

    const sdk = { doSomething: fail403 };
    const wrapped = wrapIntegration('test', sdk, {
      retryOn: [403, 429, 500],
      maxRetries: 1,
      initialRetryDelay: 10,
    });

    const result = await wrapped.doSomething({});
    expect(result).toEqual({ ok: true });
    expect(fail403).toHaveBeenCalledTimes(2);
  });
});

describe('IntegrationRequestError', () => {
  it('should serialize to JSON', () => {
    const error = new IntegrationRequestError({
      service: 'slack',
      action: 'chat.postMessage',
      statusCode: 429,
      message: 'rate limited',
      retryable: true,
      retryAfter: 30,
    });

    const json = error.toJSON();
    expect(json.service).toBe('slack');
    expect(json.action).toBe('chat.postMessage');
    expect(json.statusCode).toBe(429);
    expect(json.retryable).toBe(true);
    expect(json.retryAfter).toBe(30);
  });
});
