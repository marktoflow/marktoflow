import { describe, it, expect } from 'vitest';
import { GmailInitializer } from '../src/index.js';


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

    const client = await GmailInitializer.initialize({}, config as any);
    expect(client).toBeTruthy();
    expect(typeof (client as any).users).toBe('object');
  });
});
