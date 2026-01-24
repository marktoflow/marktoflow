import { describe, it, expect } from 'vitest';
import { verifySlackSignature } from '../src/webhook.js';
import { createHmac } from 'node:crypto';


describe('verifySlackSignature', () => {
  it('validates slack signature', () => {
    const secret = 'secret';
    const timestamp = '1234567890';
    const payload = 'hello';
    const base = `v0:${timestamp}:${payload}`;
    const sig = 'v0=' + createHmac('sha256', secret).update(base).digest('hex');

    expect(verifySlackSignature(payload, sig, timestamp, secret)).toBe(true);
  });
});
