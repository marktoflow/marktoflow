/**
 * Contract tests for Twilio integration
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
import { twilioSchemas } from '../../src/reliability/schemas/twilio.js';
import twilio from 'twilio';
import { TwilioClientWrapper } from '../../src/services/twilio.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Send SMS
  http.post('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json', async ({ request }) => {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    // Parse form data
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }

    if (!body.To || !body.From || !body.Body) {
      return HttpResponse.json({
        code: 21602,
        message: 'To, From, and Body are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      sid: 'SMtest123',
      account_sid: 'ACtest123',
      to: body.To,
      from: body.From,
      body: body.Body,
      status: 'queued',
      direction: 'outbound-api',
      date_created: '2024-01-01T00:00:00Z',
      date_sent: null,
      price: null,
      price_unit: 'USD',
    });
  }),

  // Get message
  http.get('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages/:messageSid.json', ({ params }) => {
    return HttpResponse.json({
      sid: params.messageSid,
      account_sid: 'ACtest123',
      to: '+1234567890',
      from: '+0987654321',
      body: 'Test message',
      status: 'delivered',
      direction: 'outbound-api',
      date_created: '2024-01-01T00:00:00Z',
      date_sent: '2024-01-01T00:00:01Z',
      price: '-0.0075',
      price_unit: 'USD',
    });
  }),

  // List messages
  http.get('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json', () => {
    return HttpResponse.json({
      messages: [
        {
          sid: 'SMtest1',
          to: '+1234567890',
          from: '+0987654321',
          body: 'Message 1',
          status: 'delivered',
        },
        {
          sid: 'SMtest2',
          to: '+1234567890',
          from: '+0987654321',
          body: 'Message 2',
          status: 'sent',
        },
      ],
      page: 0,
      page_size: 50,
    });
  }),

  // Delete message
  http.delete('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages/:messageSid.json', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Make call
  http.post('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Calls.json', async ({ request }) => {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    // Parse form data
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }

    if (!body.To || !body.From || !body.Url) {
      return HttpResponse.json({
        code: 21602,
        message: 'To, From, and Url are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      sid: 'CAtest123',
      account_sid: 'ACtest123',
      to: body.To,
      from: body.From,
      status: 'queued',
      direction: 'outbound-api',
      date_created: '2024-01-01T00:00:00Z',
    });
  }),

  // Get call
  http.get('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Calls/:callSid.json', ({ params }) => {
    return HttpResponse.json({
      sid: params.callSid,
      account_sid: 'ACtest123',
      to: '+1234567890',
      from: '+0987654321',
      status: 'completed',
      direction: 'outbound-api',
      duration: '45',
      date_created: '2024-01-01T00:00:00Z',
    });
  }),

  // Send verification
  http.post('https://verify.twilio.com/v2/Services/:serviceSid/Verifications', async ({ request, params }) => {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }

    if (!body.To || !body.Channel) {
      return HttpResponse.json({
        code: 60200,
        message: 'To and Channel are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      sid: 'VEtest123',
      service_sid: params.serviceSid,
      to: body.To,
      channel: body.Channel,
      status: 'pending',
      valid: false,
      date_created: '2024-01-01T00:00:00Z',
    });
  }),

  // Check verification
  http.post('https://verify.twilio.com/v2/Services/:serviceSid/VerificationCheck', async ({ request, params }) => {
    const contentType = request.headers.get('content-type') || '';
    let body: any;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }

    if (!body.To || !body.Code) {
      return HttpResponse.json({
        code: 60200,
        message: 'To and Code are required',
      }, { status: 400 });
    }

    return HttpResponse.json({
      sid: 'VEtest123',
      service_sid: params.serviceSid,
      to: body.To,
      channel: 'sms',
      status: 'approved',
      valid: true,
      date_created: '2024-01-01T00:00:00Z',
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ============================================================================
// Contract Tests
// ============================================================================

describe('Twilio Contract Tests', () => {
  it('should send SMS successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const message = await wrapped.sendSMS({
      to: '+1234567890',
      from: '+0987654321',
      body: 'Hello, world!',
    });

    expect(message.sid).toBe('SMtest123');
    expect(message.body).toBe('Hello, world!');
    expect(message.status).toBe('queued');
  });

  it('should reject invalid inputs (missing to)', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    await expect(
      wrapped.sendSMS({
        to: '',
        from: '+0987654321',
        body: 'Hello',
      })
    ).rejects.toThrow(/to/);
  });

  it('should reject invalid inputs (missing from)', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    await expect(
      wrapped.sendSMS({
        to: '+1234567890',
        from: '',
        body: 'Hello',
      })
    ).rejects.toThrow(/from/);
  });

  it('should reject invalid inputs (missing body)', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    await expect(
      wrapped.sendSMS({
        to: '+1234567890',
        from: '+0987654321',
        body: '',
      })
    ).rejects.toThrow(/body/);
  });

  it('should get message successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const message = await wrapped.getMessage('SMtest123');

    expect(message.sid).toBe('SMtest123');
    expect(message.status).toBe('delivered');
  });

  it('should list messages successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const messages = await wrapped.listMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0].sid).toBe('SMtest1');
    expect(messages[1].status).toBe('sent');
  });

  it('should make call successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const call = await wrapped.makeCall({
      to: '+1234567890',
      from: '+0987654321',
      url: 'https://example.com/twiml',
    });

    expect(call.sid).toBe('CAtest123');
    expect(call.status).toBe('queued');
  });

  it('should send verification successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const verification = await wrapped.sendVerification('VStest123', '+1234567890', 'sms');

    expect(verification.status).toBe('pending');
    expect(verification.channel).toBe('sms');
  });

  it('should check verification successfully', async () => {
    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
    });

    const result = await wrapped.checkVerification('VStest123', '+1234567890', '123456');

    expect(result.status).toBe('approved');
    expect(result.valid).toBe(true);
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json', () => {
        return HttpResponse.json({
          code: 20003,
          message: 'Authentication Error',
        }, { status: 401 });
      })
    );

    const client = twilio('ACtest123', 'test-auth-token');
    const wrapper = new TwilioClientWrapper(client);
    const wrapped = wrapIntegration('twilio', wrapper, {
      inputSchemas: twilioSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.sendSMS({
        to: '+1234567890',
        from: '+0987654321',
        body: 'Hello',
      })
    ).rejects.toThrow();
  });
});
