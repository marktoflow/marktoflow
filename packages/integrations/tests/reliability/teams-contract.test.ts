/**
 * Contract tests for Microsoft Teams integration
 *
 * These tests validate that:
 * 1. The SDK makes correct HTTP requests
 * 2. Response handling is correct
 * 3. The integration behaves correctly without hitting real APIs
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { Client } from '@microsoft/microsoft-graph-client';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // List joined teams
  http.get('https://graph.microsoft.com/v1.0/me/joinedTeams', () => {
    return HttpResponse.json({
      value: [
        { id: 'team1', displayName: 'Engineering Team', visibility: 'private' },
        { id: 'team2', displayName: 'Marketing Team', visibility: 'public' },
      ],
    });
  }),

  // List channels
  http.get('https://graph.microsoft.com/v1.0/teams/:teamId/channels', () => {
    return HttpResponse.json({
      value: [
        { id: 'channel1', displayName: 'General' },
        { id: 'channel2', displayName: 'Development' },
      ],
    });
  }),

  // Send message
  http.post('https://graph.microsoft.com/v1.0/teams/:teamId/channels/:channelId/messages', () => {
    return HttpResponse.json({
      id: 'msg123',
      body: { content: '<p>Hello team!</p>', contentType: 'html' },
    });
  }),

  // Create meeting
  http.post('https://graph.microsoft.com/v1.0/me/onlineMeetings', () => {
    return HttpResponse.json({
      id: 'meeting123',
      subject: 'Team Standup',
      joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/meeting123',
    });
  }),

  // Error handler
  http.get('https://graph.microsoft.com/v1.0/teams/nonexistent', () => {
    return HttpResponse.json({
      error: { code: 'NotFound', message: 'Not found' },
    }, { status: 404 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Teams Contract Tests', () => {
  it('should list teams successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/me/joinedTeams').get();

    expect(result.value).toHaveLength(2);
    expect(result.value[0].displayName).toBe('Engineering Team');
  });

  it('should list channels successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/teams/team1/channels').get();

    expect(result.value).toHaveLength(2);
    expect(result.value[0].displayName).toBe('General');
  });

  it('should send message successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/teams/team1/channels/channel1/messages').post({
      body: { contentType: 'html', content: '<p>Hello team!</p>' },
    });

    expect(result.id).toBe('msg123');
    expect(result.body.content).toBe('<p>Hello team!</p>');
  });

  it('should create meeting successfully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    const result = await client.api('/me/onlineMeetings').post({
      subject: 'Team Standup',
      startDateTime: '2024-01-25T10:00:00Z',
      endDateTime: '2024-01-25T10:30:00Z',
    });

    expect(result.id).toBe('meeting123');
    expect(result.joinWebUrl).toContain('teams.microsoft.com');
  });

  it('should handle API errors gracefully', async () => {
    const client = Client.init({
      authProvider: (done) => done(null, 'test-token'),
    });

    await expect(
      client.api('/teams/nonexistent').get()
    ).rejects.toThrow();
  });
});
