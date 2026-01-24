import { describe, it, expect, vi } from 'vitest';
import { GmailInitializer, GmailActions, GmailTrigger } from '../src/index.js';

describe('Gmail Integration', () => {
  it('should throw if required auth fields missing', async () => {
    const config = { sdk: 'googleapis', auth: {} };
    await expect(GmailInitializer.initialize({}, config as any)).rejects.toThrow('auth.client_id');
  });

  it('should initialize gmail client with oauth config', async () => {
    const config = {
      sdk: 'googleapis',
      auth: {
        client_id: 'id',
        client_secret: 'secret',
        redirect_uri: 'http://localhost',
        refresh_token: 'refresh',
      },
    };

    const result = await GmailInitializer.initialize({}, config as any);
    expect(result).toBeTruthy();
    expect(typeof (result as any).client).toBe('object');
    expect((result as any).actions).toBeInstanceOf(GmailActions);
  });

  it('should return client with users property', async () => {
    const config = {
      sdk: 'googleapis',
      auth: {
        client_id: 'id',
        client_secret: 'secret',
        redirect_uri: 'http://localhost',
      },
    };

    const result = await GmailInitializer.initialize({}, config as any);
    expect(typeof (result as any).client.users).toBe('object');
  });
});

describe('GmailActions', () => {
  it('should have all required methods', () => {
    const mockGmail = {
      users: {
        messages: { list: vi.fn(), get: vi.fn(), send: vi.fn(), modify: vi.fn(), trash: vi.fn(), delete: vi.fn() },
        drafts: { create: vi.fn() },
        labels: { list: vi.fn() },
        history: { list: vi.fn() },
        watch: vi.fn(),
        stop: vi.fn(),
      },
    };

    const actions = new GmailActions(mockGmail as any);

    expect(typeof actions.getEmails).toBe('function');
    expect(typeof actions.getEmail).toBe('function');
    expect(typeof actions.sendEmail).toBe('function');
    expect(typeof actions.createDraft).toBe('function');
    expect(typeof actions.markAsRead).toBe('function');
    expect(typeof actions.markAsUnread).toBe('function');
    expect(typeof actions.addLabels).toBe('function');
    expect(typeof actions.removeLabels).toBe('function');
    expect(typeof actions.trash).toBe('function');
    expect(typeof actions.delete).toBe('function');
    expect(typeof actions.listLabels).toBe('function');
  });
});

describe('GmailTrigger', () => {
  it('should validate Pub/Sub message structure', () => {
    const validMessage = {
      message: {
        data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com', historyId: '123' })).toString('base64'),
        messageId: 'msg-123',
        publishTime: new Date().toISOString(),
      },
      subscription: 'projects/test/subscriptions/gmail-push',
    };

    expect(GmailTrigger.validatePubSubRequest(validMessage)).toBe(true);
    expect(GmailTrigger.validatePubSubRequest(null)).toBe(false);
    expect(GmailTrigger.validatePubSubRequest({})).toBe(false);
    expect(GmailTrigger.validatePubSubRequest({ message: {} })).toBe(false);
  });

  it('should create trigger with config', () => {
    const trigger = new GmailTrigger({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost',
      topicName: 'projects/test/topics/gmail',
      triggers: [],
    });

    expect(trigger).toBeInstanceOf(GmailTrigger);
    expect(trigger.isWatchActive()).toBe(false);
  });
});
