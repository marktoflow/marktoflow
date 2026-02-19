/**
 * Contract tests for SendGrid integration
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
import { sendgridSchemas } from '../../src/reliability/schemas/sendgrid.js';
import { SendGridClient } from '../../src/services/sendgrid.js';

// ============================================================================
// MSW Server Setup
// ============================================================================

const server = setupServer(
  // Send email
  http.post('https://api.sendgrid.com/v3/mail/send', async ({ request }) => {
    const body = await request.json() as any;

    // Validate required fields
    if (!body.personalizations || !body.personalizations[0]?.to) {
      return HttpResponse.json({
        errors: [
          {
            message: 'The to field is required',
            field: 'personalizations.0.to',
          },
        ],
      }, { status: 400 });
    }

    if (!body.from || !body.from.email) {
      return HttpResponse.json({
        errors: [
          {
            message: 'The from email is required',
            field: 'from.email',
          },
        ],
      }, { status: 400 });
    }

    if (!body.subject) {
      return HttpResponse.json({
        errors: [
          {
            message: 'The subject is required',
            field: 'subject',
          },
        ],
      }, { status: 400 });
    }

    // Successful response (SendGrid returns 202 Accepted with empty body)
    return new HttpResponse(null, {
      status: 202,
      headers: {
        'X-Message-Id': 'test-message-id-123',
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

describe('SendGrid Contract Tests', () => {
  it('should send an email successfully', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    const result = await wrapped.sendEmail({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Test Email',
      text: 'This is a test email',
    });

    // SendGrid returns an array with response data
    expect(result).toBeDefined();
    expect(result[0]).toBeDefined();
    expect(result[0].statusCode).toBe(202);
  });

  it('should send an email with HTML content', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    const result = await wrapped.sendEmail({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Test Email',
      html: '<h1>This is a test email</h1>',
    });

    expect(result).toBeDefined();
    expect(result[0].statusCode).toBe(202);
  });

  it('should send an email to multiple recipients', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    const result = await wrapped.sendEmail({
      to: ['recipient1@example.com', 'recipient2@example.com'],
      from: 'sender@example.com',
      subject: 'Test Email',
      text: 'This is a test email to multiple recipients',
    });

    expect(result).toBeDefined();
    expect(result[0].statusCode).toBe(202);
  });

  it('should send an email with CC and BCC', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    const result = await wrapped.sendEmail({
      to: 'recipient@example.com',
      from: 'sender@example.com',
      subject: 'Test Email',
      text: 'This is a test email',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    });

    expect(result).toBeDefined();
    expect(result[0].statusCode).toBe(202);
  });

  it('should reject missing subject', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    await expect(
      wrapped.sendEmail({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: '',
        text: 'Test',
      })
    ).rejects.toThrow(/subject/);
  });

  it('should reject missing body (no text, html, or templateId)', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    await expect(
      // Cast required: intentionally testing runtime guard when TS body fields are omitted
      wrapped.sendEmail({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
      } as any)
    ).rejects.toThrow(/text, html, or templateId/);
  });

  it('should reject empty sender email', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    await expect(
      wrapped.sendEmail({
        to: 'recipient@example.com',
        from: '',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow(/email/);
  });

  it('sendMultiple should reject a message missing body', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    await expect(
      // Cast required: intentionally testing runtime guard when TS body fields are omitted
      wrapped.sendMultiple([
        { to: 'a@example.com', from: 'sender@example.com', subject: 'Hi' } as any,
      ])
    ).rejects.toThrow(/text, html, or templateId/);
  });

  it('sendMultiple should pass when all messages have a body', async () => {
    const client = new SendGridClient('SG.test-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
    });

    const result = await wrapped.sendMultiple([
      { to: 'a@example.com', from: 'sender@example.com', subject: 'Hi', text: 'Hello A' },
      { to: 'b@example.com', from: 'sender@example.com', subject: 'Hi', html: '<p>Hello B</p>' },
    ]);

    expect(result).toBeDefined();
  });

  it('should handle API errors gracefully', async () => {
    // Override handler to return error
    server.use(
      http.post('https://api.sendgrid.com/v3/mail/send', () => {
        return HttpResponse.json({
          errors: [
            {
              message: 'Invalid API key',
              field: null,
              help: null,
            },
          ],
        }, { status: 401 });
      })
    );

    const client = new SendGridClient('SG.invalid-api-key');
    const wrapped = wrapIntegration('sendgrid', client, {
      inputSchemas: sendgridSchemas,
      maxRetries: 0,
    });

    await expect(
      wrapped.sendEmail({
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow();
  });
});
