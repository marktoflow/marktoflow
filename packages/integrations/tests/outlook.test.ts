import { describe, it, expect } from 'vitest';
import { OutlookInitializer } from '../src/index.js';


describe('Outlook Integration', () => {
  it('should throw if token missing', async () => {
    const config = { sdk: '@microsoft/microsoft-graph-client', auth: {} };
    await expect(OutlookInitializer.initialize({}, config as any)).rejects.toThrow('auth.token');
  });

  it('should initialize client with token', async () => {
    const config = { sdk: '@microsoft/microsoft-graph-client', auth: { token: 'test-token' } };
    const client = await OutlookInitializer.initialize({}, config as any);
    expect(client).toBeTruthy();
    expect(typeof (client as any).api).toBe('function');
  });
});
