/**
 * Contract tests for Mailchimp integration
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
import { mailchimpSchemas } from '../../src/reliability/schemas/mailchimp.js';
import { MailchimpClient } from '../../src/services/mailchimp.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Get lists
  http.get('https://us1.api.mailchimp.com/3.0/lists', () => {
    return HttpResponse.json({
      lists: [
        {
          id: 'list1',
          name: 'Test List 1',
          stats: {
            member_count: 100,
          },
        },
        {
          id: 'list2',
          name: 'Test List 2',
          stats: {
            member_count: 50,
          },
        },
      ],
      total_items: 2,
    });
  }),

  // Get list by ID
  http.get('https://us1.api.mailchimp.com/3.0/lists/:listId', ({ params }) => {
    return HttpResponse.json({
      id: params.listId,
      name: 'Test List',
      stats: {
        member_count: 100,
      },
    });
  }),

  // Get list members
  http.get('https://us1.api.mailchimp.com/3.0/lists/:listId/members', ({ params }) => {
    return HttpResponse.json({
      members: [
        {
          id: 'member1',
          email_address: 'user1@example.com',
          status: 'subscribed',
          merge_fields: {
            FNAME: 'John',
            LNAME: 'Doe',
          },
        },
        {
          id: 'member2',
          email_address: 'user2@example.com',
          status: 'subscribed',
          merge_fields: {
            FNAME: 'Jane',
            LNAME: 'Smith',
          },
        },
      ],
      list_id: params.listId,
      total_items: 2,
    });
  }),

  // Add member to list
  http.post('https://us1.api.mailchimp.com/3.0/lists/:listId/members', async ({ request, params }) => {
    const body = await request.json() as any;

    if (!body.email_address) {
      return HttpResponse.json({
        type: 'http://developer.mailchimp.com/documentation/mailchimp/guides/error-glossary/',
        title: 'Invalid Resource',
        status: 400,
        detail: 'The resource submitted could not be validated.',
        instance: '',
        errors: [
          {
            field: 'email_address',
            message: 'This value should not be blank.',
          },
        ],
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'new-member-123',
      email_address: body.email_address,
      status: body.status,
      merge_fields: body.merge_fields || {},
      list_id: params.listId,
    });
  }),

  // Update member
  http.patch('https://us1.api.mailchimp.com/3.0/lists/:listId/members/:subscriberHash', async ({ request, params }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      id: params.subscriberHash,
      email_address: body.email_address || 'updated@example.com',
      status: body.status || 'subscribed',
      merge_fields: body.merge_fields || {},
      list_id: params.listId,
    });
  }),

  // Delete member
  http.delete('https://us1.api.mailchimp.com/3.0/lists/:listId/members/:subscriberHash', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Get campaigns
  http.get('https://us1.api.mailchimp.com/3.0/campaigns', () => {
    return HttpResponse.json({
      campaigns: [
        {
          id: 'campaign1',
          type: 'regular',
          status: 'sent',
          settings: {
            subject_line: 'Test Campaign 1',
            title: 'Test Campaign 1',
          },
        },
        {
          id: 'campaign2',
          type: 'regular',
          status: 'draft',
          settings: {
            subject_line: 'Test Campaign 2',
            title: 'Test Campaign 2',
          },
        },
      ],
      total_items: 2,
    });
  }),

  // Create campaign
  http.post('https://us1.api.mailchimp.com/3.0/campaigns', async ({ request }) => {
    const body = await request.json() as any;

    if (!body.type || !body.recipients?.list_id || !body.settings?.subject_line) {
      return HttpResponse.json({
        type: 'http://developer.mailchimp.com/documentation/mailchimp/guides/error-glossary/',
        title: 'Invalid Resource',
        status: 400,
        detail: 'The resource submitted could not be validated.',
      }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'new-campaign-123',
      type: body.type,
      status: 'save',
      recipients: body.recipients,
      settings: body.settings,
    });
  }),

  // Send campaign
  http.post('https://us1.api.mailchimp.com/3.0/campaigns/:campaignId/actions/send', ({ params }) => {
    return new HttpResponse(null, { status: 204 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Mailchimp Contract Tests', () => {
  it('should get lists successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.getLists({ count: 10 });

    expect(result.lists).toHaveLength(2);
    expect(result.lists[0].name).toBe('Test List 1');
  });

  it('should get a list by ID successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.getList('list1');

    expect(result.id).toBe('list1');
    expect(result.name).toBe('Test List');
  });

  it('should update a member successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.updateMember('list1', 'subscriber-hash', {
      status: 'unsubscribed',
    });

    expect(result.id).toBe('subscriber-hash');
    expect(result.status).toBe('unsubscribed');
  });

  it('should get list members successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.getListMembers('list1', { count: 10 });

    expect(result.members).toHaveLength(2);
    expect(result.members[0].email_address).toBe('user1@example.com');
  });

  it('should add a member to list successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.addMember('list1', {
      email_address: 'newuser@example.com',
      status: 'subscribed',
      merge_fields: {
        FNAME: 'New',
        LNAME: 'User',
      },
    });

    expect(result.id).toBe('new-member-123');
    expect(result.email_address).toBe('newuser@example.com');
    expect(result.status).toBe('subscribed');
  });

  it('should delete a member successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.deleteMember('list1', 'subscriber-hash');

    expect(result).toBeDefined();
  });

  it('should reject empty email address', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    await expect(
      wrapped.addMember('list1', {
        email_address: '',
        status: 'subscribed',
      })
    ).rejects.toThrow();
  });

  it('should get campaigns successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.getCampaigns({ count: 10 });

    expect(result.campaigns).toHaveLength(2);
    expect(result.campaigns[0].settings.subject_line).toBe('Test Campaign 1');
  });

  it('should send a campaign successfully', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    const result = await wrapped.sendCampaign('campaign1');

    // SendGrid returns 204 No Content
    expect(result).toBeDefined();
  });

  it('should reject empty campaign ID', async () => {
    const client = new MailchimpClient('test-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
    });

    await expect(
      wrapped.sendCampaign('')
    ).rejects.toThrow();
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://us1.api.mailchimp.com/3.0/lists/:listId/members', () => {
        return HttpResponse.json({
          type: 'http://developer.mailchimp.com/documentation/mailchimp/guides/error-glossary/',
          title: 'Unauthorized',
          status: 401,
          detail: 'Your API key may be invalid.',
        }, { status: 401 });
      })
    );

    const client = new MailchimpClient('invalid-api-key', 'us1');
    const wrapped = wrapIntegration('mailchimp', client, {
      inputSchemas: mailchimpSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.addMember('list1', {
        email_address: 'test@example.com',
        status: 'subscribed',
      })
    ).rejects.toThrow();
  });
});
