/**
 * Real integration tests for the Gemini CLI adapter using the OAuth credentials
 * stored by the locally installed gemini-cli binary (~/.gemini/oauth_creds.json).
 *
 * These tests make live HTTP calls to Google's Cloud Code Assist endpoint.
 * They are skipped automatically when credentials are absent so CI stays green.
 *
 * Run manually:
 *   pnpm test:integration -t "Gemini Real"
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { GeminiCliClient } from '../src/index.js';

// ============================================================================
// Credential loading
// ============================================================================

interface GeminiCliCreds {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

function loadCreds(): GeminiCliCreds | null {
  const credsPath = join(homedir(), '.gemini', 'oauth_creds.json');
  if (!existsSync(credsPath)) return null;
  try {
    const creds = JSON.parse(readFileSync(credsPath, 'utf8')) as GeminiCliCreds;
    if (!creds.refresh_token) return null;
    return creds;
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Sleep for `ms` milliseconds */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry a function up to `attempts` times, waiting `delayMs` between retries,
 * but only on 429 rate-limit errors from the Gemini API.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 30000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < attempts - 1 && err instanceof Error && err.message.includes('429')) {
        await sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

// ============================================================================
// Test suite
// ============================================================================

const creds = loadCreds();
const SKIP = !creds;

describe.skipIf(SKIP)('Gemini Real Integration (OAuth)', () => {
  let client: GeminiCliClient;

  beforeAll(() => {
    // Pass projectId: '' so the client lazily discovers it via discoverProject()
    // on the first request — this exercises the actual auto-discovery code path
    // rather than duplicating the loadCodeAssist logic here.
    client = new GeminiCliClient({
      auth: {
        mode: 'oauth',
        refreshToken: creds!.refresh_token,
        accessToken: creds!.access_token,
        expiresAt: creds!.expiry_date,
        projectId: '',
      },
      model: 'gemini-2.5-flash',
    });
  });

  it('should generate a response via OAuth (generate())', async () => {
    const response = await withRetry(() => client.generate('Say exactly: hello marktoflow'));
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  }, 90000);

  it('should complete a chat turn (chat())', async () => {
    const result = await withRetry(() =>
      client.chat({
        messages: [
          { role: 'user', parts: [{ text: 'What is 2 + 2? Answer with just the number.' }] },
        ],
      })
    );
    expect(result.content).toContain('4');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.done).toBe(true);
  }, 90000);

  it('should respect a system instruction', async () => {
    const result = await withRetry(() =>
      client.chat({
        messages: [{ role: 'user', parts: [{ text: 'What is your name?' }] }],
        systemInstruction: 'Your name is Markto. Always introduce yourself as Markto.',
      })
    );
    expect(result.content.toLowerCase()).toContain('markto');
  }, 90000);

  it('should stream a response (chatStream())', async () => {
    const chunks: string[] = [];
    await withRetry(async () => {
      chunks.length = 0;
      for await (const chunk of client.chatStream({
        messages: [{ role: 'user', parts: [{ text: 'Count from 1 to 3, one number per line.' }] }],
      })) {
        chunks.push(chunk);
      }
    });
    const full = chunks.join('');
    expect(full).toMatch(/1/);
    expect(full).toMatch(/2/);
    expect(full).toMatch(/3/);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  }, 90000);

  it('should return usage metadata', async () => {
    const result = await withRetry(() =>
      client.chat({
        messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      })
    );
    expect(result.usage).toBeDefined();
    expect(result.usage?.totalTokens).toBeGreaterThan(0);
  }, 90000);

  it('should return static model list without an extra HTTP call', async () => {
    const models = await client.listModels();
    expect(models.map((m) => m.name)).toContain('gemini-2.5-flash');
    expect(models.map((m) => m.name)).toContain('gemini-2.5-pro');
  });

  it('should work via the OpenAI-compatible chatCompletions interface', async () => {
    const result = await withRetry(() =>
      client.chatCompletions.create({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "ok" and nothing else.' },
        ],
      })
    );
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].message.role).toBe('assistant');
    expect(result.choices[0].message.content.toLowerCase()).toContain('ok');
  }, 90000);

  it('should use a different model (gemini-2.0-flash) when specified', async () => {
    const result = await withRetry(() =>
      client.chat({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', parts: [{ text: 'Say exactly: ok' }] }],
      })
    );
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.content.length).toBeGreaterThan(0);
  }, 90000);

  it('should handle a multi-turn conversation', async () => {
    const result = await withRetry(() =>
      client.chat({
        messages: [
          { role: 'user', parts: [{ text: 'My name is Alice.' }] },
          { role: 'model', parts: [{ text: 'Nice to meet you, Alice!' }] },
          { role: 'user', parts: [{ text: 'What is my name?' }] },
        ],
      })
    );
    expect(result.content.toLowerCase()).toContain('alice');
  }, 90000);
});
