import { describe, it, expect } from 'vitest';
import { SlackSocketTrigger } from '../src/services/slack-socket.js';


describe('SlackSocketTrigger', () => {
  it('constructs with config', () => {
    const trigger = new SlackSocketTrigger({
      appToken: 'xapp-test',
      botToken: 'xoxb-test',
      triggers: [],
    });

    expect(trigger).toBeTruthy();
  });
});
