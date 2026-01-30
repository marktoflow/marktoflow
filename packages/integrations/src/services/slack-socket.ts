import { App } from '@slack/bolt';
import { TriggerType } from '@marktoflow/core';

export interface SlackSocketTriggerConfig {
  appToken: string;
  botToken: string;
  triggers: Array<{
    id: string;
    event: 'message' | 'app_mention';
    handler: (payload: Record<string, unknown>) => Promise<void>;
  }>;
}

export class SlackSocketTrigger {
  private app?: App;
  private handlersRegistered = false;

  constructor(private config: SlackSocketTriggerConfig) {}

  async start(): Promise<void> {
    if (!this.app) {
      this.app = new App({
        token: this.config.botToken,
        appToken: this.config.appToken,
        socketMode: true,
      });
    }

    if (!this.handlersRegistered) {
      for (const trigger of this.config.triggers) {
        if (trigger.event === 'message') {
          this.app.message(async ({ message }) => {
            console.log('[SlackSocket] Received message event:', JSON.stringify(message, null, 2));
            await trigger.handler({ type: TriggerType.EVENT, event: 'message', message });
          });
        }
        if (trigger.event === 'app_mention') {
          this.app.event('app_mention', async ({ event }) => {
            console.log('[SlackSocket] Received app_mention event:', JSON.stringify(event, null, 2));
            await trigger.handler({
              type: TriggerType.EVENT,
              event: 'app_mention',
              payload: event,
            });
          });
        }
      }
      this.handlersRegistered = true;
    }

    await this.app.start();
  }

  async stop(): Promise<void> {
    if (!this.app) {
      return;
    }
    await this.app.stop();
  }
}
