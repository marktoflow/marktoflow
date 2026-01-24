import { describe, it, expect } from 'vitest';
import { TriggerManager } from '../src/trigger-manager.js';
import { TriggerType } from '../src/models.js';
import { WebhookReceiver } from '../src/webhook.js';


describe('Webhook triggers', () => {
  it('handles graph validation token', async () => {
    const receiver = new WebhookReceiver({ host: '127.0.0.1', port: 0 });
    const manager = new TriggerManager(receiver);
    manager.register({
      id: 'graph',
      type: TriggerType.WEBHOOK,
      config: { path: '/graph', provider: 'graph' },
      handler: async () => undefined,
    });

    // Simulate handler invocation directly via receiver
    const event = {
      id: '1',
      path: '/graph',
      method: 'GET',
      headers: {},
      body: '',
      query: { validationToken: 'token123' },
      receivedAt: new Date(),
    } as any;

    const response = await (receiver as any).handlers.get('/graph')(event);
    expect(response.status).toBe(200);
    expect(response.body).toBe('token123');
  });

  it('handles slack url verification', async () => {
    const receiver = new WebhookReceiver({ host: '127.0.0.1', port: 0 });
    const manager = new TriggerManager(receiver);
    manager.register({
      id: 'slack',
      type: TriggerType.WEBHOOK,
      config: { path: '/slack', provider: 'slack', secret: 'secret' },
      handler: async () => undefined,
    });

    const payload = JSON.stringify({ type: 'url_verification', challenge: 'abc' });
    const event = {
      id: '1',
      path: '/slack',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      query: {},
      receivedAt: new Date(),
    } as any;

    const response = await (receiver as any).handlers.get('/slack')(event);
    expect(response.status).toBe(200);
    expect(response.body).toBe('abc');
  });
});
