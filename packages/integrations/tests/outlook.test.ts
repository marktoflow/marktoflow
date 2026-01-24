import { describe, it, expect, vi } from 'vitest';
import { OutlookInitializer, OutlookActions, OutlookTrigger } from '../src/index.js';

describe('Outlook Integration', () => {
  it('should throw if token missing', async () => {
    const config = { sdk: '@microsoft/microsoft-graph-client', auth: {} };
    await expect(OutlookInitializer.initialize({}, config as any)).rejects.toThrow('auth.token');
  });

  it('should initialize client with token', async () => {
    const config = { sdk: '@microsoft/microsoft-graph-client', auth: { token: 'test-token' } };
    const result = await OutlookInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect(typeof (result as any).client.api).toBe('function');
    expect((result as any).actions).toBeInstanceOf(OutlookActions);
  });

  it('should return both client and actions', async () => {
    const config = { sdk: '@microsoft/microsoft-graph-client', auth: { token: 'test-token' } };
    const result = await OutlookInitializer.initialize({}, config as any);
    expect((result as any).client).toBeDefined();
    expect((result as any).actions).toBeDefined();
  });
});

describe('OutlookActions', () => {
  it('should have all required email methods', () => {
    const mockClient = {
      api: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      top: vi.fn().mockReturnThis(),
      orderby: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      search: vi.fn().mockReturnThis(),
      query: vi.fn().mockReturnThis(),
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const actions = new OutlookActions(mockClient as any);

    // Email methods
    expect(typeof actions.getEmails).toBe('function');
    expect(typeof actions.getEmail).toBe('function');
    expect(typeof actions.sendEmail).toBe('function');
    expect(typeof actions.createDraft).toBe('function');
    expect(typeof actions.reply).toBe('function');
    expect(typeof actions.forward).toBe('function');
    expect(typeof actions.markAsRead).toBe('function');
    expect(typeof actions.markAsUnread).toBe('function');
    expect(typeof actions.moveToFolder).toBe('function');
    expect(typeof actions.delete).toBe('function');
    expect(typeof actions.listFolders).toBe('function');
  });

  it('should have all required calendar methods', () => {
    const mockClient = {
      api: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      top: vi.fn().mockReturnThis(),
      orderby: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      query: vi.fn().mockReturnThis(),
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const actions = new OutlookActions(mockClient as any);

    // Calendar methods
    expect(typeof actions.getEvents).toBe('function');
    expect(typeof actions.getEvent).toBe('function');
    expect(typeof actions.createEvent).toBe('function');
    expect(typeof actions.updateEvent).toBe('function');
    expect(typeof actions.deleteEvent).toBe('function');
    expect(typeof actions.acceptEvent).toBe('function');
    expect(typeof actions.declineEvent).toBe('function');
    expect(typeof actions.tentativelyAcceptEvent).toBe('function');
  });
});

describe('OutlookTrigger', () => {
  it('should validate notification structure', () => {
    const validNotification = {
      value: [
        {
          subscriptionId: 'sub-123',
          subscriptionExpirationDateTime: new Date().toISOString(),
          changeType: 'created',
          resource: 'me/messages/msg-123',
          resourceData: {
            '@odata.type': '#Microsoft.Graph.Message',
            '@odata.id': 'me/messages/msg-123',
            '@odata.etag': 'W/"test"',
            id: 'msg-123',
          },
          clientState: 'secret',
          tenantId: 'tenant-123',
        },
      ],
    };

    expect(OutlookTrigger.validateNotification(validNotification)).toBe(true);
    expect(OutlookTrigger.validateNotification(null)).toBe(false);
    expect(OutlookTrigger.validateNotification({})).toBe(false);
    expect(OutlookTrigger.validateNotification({ value: 'not-array' })).toBe(false);
    expect(OutlookTrigger.validateNotification({ value: [{}] })).toBe(false);
  });

  it('should detect validation requests', () => {
    expect(OutlookTrigger.isValidationRequest({ validationToken: 'token-123' })).toBe(true);
    expect(OutlookTrigger.isValidationRequest({})).toBe(false);
    expect(OutlookTrigger.isValidationRequest({ validationToken: 123 })).toBe(false);
  });

  it('should create trigger with config', () => {
    const trigger = new OutlookTrigger({
      token: 'test-token',
      notificationUrl: 'https://example.com/webhook',
      triggers: [],
    });

    expect(trigger).toBeInstanceOf(OutlookTrigger);
    expect(trigger.isSubscriptionActive()).toBe(false);
    expect(trigger.getSubscription()).toBeUndefined();
  });

  it('should track subscription state', () => {
    const trigger = new OutlookTrigger({
      token: 'test-token',
      notificationUrl: 'https://example.com/webhook',
      clientState: 'my-secret',
      triggers: [],
    });

    // No subscription initially
    expect(trigger.getSubscription()).toBeUndefined();
    expect(trigger.isSubscriptionActive()).toBe(false);
  });
});
