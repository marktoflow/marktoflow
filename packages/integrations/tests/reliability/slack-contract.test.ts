/**
 * Contract tests for Slack integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Input validation schemas work as expected
 * 3. Response handling is correct
 * 4. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { wrapIntegration } from '../../src/reliability/wrapper.js';
import { slackSchemas } from '../../src/reliability/schemas/slack.js';
import { WebClient } from '@slack/web-api';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // chat.postMessage
  http.post('https://slack.com/api/chat.postMessage', async ({ request }) => {
    // Slack SDK may send JSON or form-encoded data
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // Parse form data
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    // Validate required fields
    if (!body.channel || !body.text) {
      return HttpResponse.json({
        ok: false,
        error: 'missing_required_field',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      channel: body.channel,
      ts: '1234567890.123456',
      message: {
        text: body.text,
        user: 'U123456',
        ts: '1234567890.123456',
      },
    });
  }),

  // chat.update
  http.post('https://slack.com/api/chat.update', async ({ request }) => {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    if (!body.channel || !body.ts || !body.text) {
      return HttpResponse.json({
        ok: false,
        error: 'missing_required_field',
      }, { status: 400 });
    }

    return HttpResponse.json({
      ok: true,
      channel: body.channel,
      ts: body.ts,
      text: body.text,
    });
  }),

  // users.list (Slack uses POST for all methods)
  http.post('https://slack.com/api/users.list', () => {
    return HttpResponse.json({
      ok: true,
      members: [
        { id: 'U123', name: 'user1' },
        { id: 'U456', name: 'user2' },
      ],
    });
  }),

  // auth.test
  http.post('https://slack.com/api/auth.test', () => {
    return HttpResponse.json({
      ok: true,
      url: 'https://test.slack.com/',
      team: 'Test Team',
      user: 'testuser',
      team_id: 'T123',
      user_id: 'U123',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Slack Contract Tests', () => {
  it('should post a message successfully', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    const result = await wrapped.chat.postMessage({
      channel: '#general',
      text: 'Hello, world!',
    });

    expect(result.ok).toBe(true);
    expect(result.ts).toBe('1234567890.123456');
    expect(result.message?.text).toBe('Hello, world!');
  });

  it('should reject invalid inputs (missing channel)', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    await expect(
      wrapped.chat.postMessage({
        channel: '',
        text: 'Hello',
      })
    ).rejects.toThrow(/channel/);
  });

  it('should reject invalid inputs (missing text)', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    await expect(
      wrapped.chat.postMessage({
        channel: '#general',
        text: '',
      })
    ).rejects.toThrow(/text/);
  });

  it('should update a message successfully', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    const result = await wrapped.chat.update({
      channel: '#general',
      ts: '1234567890.123456',
      text: 'Updated text',
    });

    expect(result.ok).toBe(true);
    expect(result.text).toBe('Updated text');
  });

  it('should list users successfully', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    const result = await wrapped.users.list({});

    expect(result.ok).toBe(true);
    expect(result.members).toHaveLength(2);
    expect(result.members?.[0]?.name).toBe('user1');
  });

  it('should test auth successfully', async () => {
    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
    });

    const result = await wrapped.auth.test({});

    expect(result.ok).toBe(true);
    expect(result.user).toBe('testuser');
    expect(result.team_id).toBe('T123');
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://slack.com/api/chat.postMessage', async ({ request }) => {
        const contentType = request.headers.get('content-type') || '';
        // Parse body to check fields (for consistency)
        if (contentType.includes('application/json')) {
          await request.json();
        } else {
          await request.text();
        }

        return HttpResponse.json({
          ok: false,
          error: 'channel_not_found',
        }, { status: 404 });
      })
    );

    const client = new WebClient('xoxb-test-token');
    const wrapped = wrapIntegration('slack', client, {
      inputSchemas: slackSchemas,
      maxRetries: 0,
      timeout: 1000, // Add short timeout
    });

    await expect(
      wrapped.chat.postMessage({
        channel: '#nonexistent',
        text: 'Hello',
      })
    ).rejects.toThrow();
  }, 10000); // Increase test timeout to 10s
});
