/**
 * Contract tests for Calendly integration
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
import { calendlySchemas } from '../../src/reliability/schemas/calendly.js';
import { CalendlyClient } from '../../src/services/calendly.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const BASE_URL = 'https://api.calendly.com';

const server = setupServer(
  // Get current user
  http.get(`${BASE_URL}/users/me`, () => {
    return HttpResponse.json({
      resource: {
        uri: 'https://api.calendly.com/users/USER123',
        name: 'Test User',
        slug: 'testuser',
        email: 'test@example.com',
        scheduling_url: 'https://calendly.com/testuser',
        timezone: 'America/New_York',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    });
  }),

  // List events
  http.get(`${BASE_URL}/scheduled_events`, ({ request }) => {
    const url = new URL(request.url);
    const user = url.searchParams.get('user');

    if (!user) {
      return HttpResponse.json({
        message: 'user is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      collection: [
        {
          uri: 'https://api.calendly.com/scheduled_events/EVENT123',
          name: '30 Minute Meeting',
          status: 'active',
          start_time: '2024-01-15T10:00:00Z',
          end_time: '2024-01-15T10:30:00Z',
          event_type: 'https://api.calendly.com/event_types/TYPE123',
          location: { type: 'physical', location: 'Office' },
          invitees_counter: { total: 1, active: 1, limit: 1 },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          event_memberships: [{ user: user }],
          event_guests: [],
        },
      ],
      pagination: { count: 1 },
    });
  }),

  // Get event
  http.get(`${BASE_URL}/scheduled_events/:eventUuid`, ({ params }) => {
    return HttpResponse.json({
      resource: {
        uri: `https://api.calendly.com/scheduled_events/${params.eventUuid}`,
        name: '30 Minute Meeting',
        status: 'active',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T10:30:00Z',
        event_type: 'https://api.calendly.com/event_types/TYPE123',
        location: { type: 'zoom', location: 'https://zoom.us/j/123' },
        invitees_counter: { total: 1, active: 1, limit: 1 },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        event_memberships: [],
        event_guests: [],
      },
    });
  }),

  // Cancel event
  http.post(`${BASE_URL}/scheduled_events/:eventUuid/cancellation`, async ({ request, params }) => {
    return HttpResponse.json({
      resource: {
        uri: `https://api.calendly.com/scheduled_events/${params.eventUuid}`,
        name: '30 Minute Meeting',
        status: 'canceled',
        start_time: '2024-01-15T10:00:00Z',
        end_time: '2024-01-15T10:30:00Z',
        event_type: 'https://api.calendly.com/event_types/TYPE123',
        location: { type: 'zoom' },
        invitees_counter: { total: 1, active: 0, limit: 1 },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        event_memberships: [],
        event_guests: [],
      },
    });
  }),

  // List event types
  http.get(`${BASE_URL}/event_types`, ({ request }) => {
    const url = new URL(request.url);
    const user = url.searchParams.get('user');

    if (!user) {
      return HttpResponse.json({
        message: 'user is required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      collection: [
        {
          uri: 'https://api.calendly.com/event_types/TYPE123',
          name: '30 Minute Meeting',
          active: true,
          slug: '30min',
          scheduling_url: 'https://calendly.com/testuser/30min',
          duration: 30,
          kind: 'solo',
          pooling_type: 'round_robin',
          type: 'StandardEventType',
          color: '#0069ff',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          internal_note: '',
          description_plain: 'A 30 minute meeting',
          description_html: '<p>A 30 minute meeting</p>',
        },
      ],
      pagination: { count: 1 },
    });
  }),

  // Get event type
  http.get(`${BASE_URL}/event_types/:eventTypeUuid`, ({ params }) => {
    return HttpResponse.json({
      resource: {
        uri: `https://api.calendly.com/event_types/${params.eventTypeUuid}`,
        name: '30 Minute Meeting',
        active: true,
        slug: '30min',
        scheduling_url: 'https://calendly.com/testuser/30min',
        duration: 30,
        kind: 'solo',
        pooling_type: 'round_robin',
        type: 'StandardEventType',
        color: '#0069ff',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        internal_note: '',
        description_plain: 'A 30 minute meeting',
        description_html: '<p>A 30 minute meeting</p>',
      },
    });
  }),

  // List invitees
  http.get(`${BASE_URL}/scheduled_events/:eventUuid/invitees`, ({ params }) => {
    return HttpResponse.json({
      collection: [
        {
          uri: `https://api.calendly.com/scheduled_events/${params.eventUuid}/invitees/INV123`,
          email: 'invitee@example.com',
          name: 'Invitee Name',
          status: 'active',
          timezone: 'America/New_York',
          event: `https://api.calendly.com/scheduled_events/${params.eventUuid}`,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          cancel_url: 'https://calendly.com/cancellations/INV123',
          reschedule_url: 'https://calendly.com/reschedulings/INV123',
        },
      ],
      pagination: { count: 1 },
    });
  }),

  // Create scheduling link
  http.post(`${BASE_URL}/scheduling_links`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.max_event_count || !body.owner || !body.owner_type) {
      return HttpResponse.json({
        message: 'max_event_count, owner, and owner_type are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      resource: {
        booking_url: 'https://calendly.com/s/UNIQUE_LINK_123',
        owner: body.owner,
        owner_type: body.owner_type,
      },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Calendly Contract Tests', () => {
  it('should get current user successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.getCurrentUser();

    expect(result.resource.name).toBe('Test User');
    expect(result.resource.email).toBe('test@example.com');
  });

  it('should list events successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.listEvents('https://api.calendly.com/users/USER123');

    expect(result.collection).toHaveLength(1);
    expect(result.collection[0].name).toBe('30 Minute Meeting');
  });

  it('should reject invalid list events (missing user)', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    await expect(
      wrapped.listEvents('')
    ).rejects.toThrow();
  });

  it('should get an event successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.getEvent('EVENT123');

    expect(result.resource.name).toBe('30 Minute Meeting');
    expect(result.resource.status).toBe('active');
  });

  it('should cancel an event successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.cancelEvent('EVENT123', 'Schedule conflict');

    expect(result.resource.status).toBe('canceled');
  });

  it('should list event types successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.listEventTypes('https://api.calendly.com/users/USER123');

    expect(result.collection).toHaveLength(1);
    expect(result.collection[0].name).toBe('30 Minute Meeting');
  });

  it('should get an event type successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.getEventType('TYPE123');

    expect(result.resource.name).toBe('30 Minute Meeting');
    expect(result.resource.duration).toBe(30);
  });

  it('should list invitees successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.listInvitees('EVENT123');

    expect(result.collection).toHaveLength(1);
    expect(result.collection[0].email).toBe('invitee@example.com');
  });

  it('should create a scheduling link successfully', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    const result = await wrapped.createSchedulingLink(
      5,
      'https://api.calendly.com/event_types/TYPE123',
      'EventType'
    );

    expect(result.resource.booking_url).toContain('calendly.com/s/');
  });

  it('should reject invalid scheduling link (missing fields)', async () => {
    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
    });

    await expect(
      wrapped.createSchedulingLink(0, '', 'EventType')
    ).rejects.toThrow();
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/users/me`, () => {
        return HttpResponse.json({
          message: 'Unauthorized',
        }, { status: 401 });
      })
    );

    const client = new CalendlyClient('test-token');
    const wrapped = wrapIntegration('calendly', client, {
      inputSchemas: calendlySchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.getCurrentUser()
    ).rejects.toThrow();
  });
});
