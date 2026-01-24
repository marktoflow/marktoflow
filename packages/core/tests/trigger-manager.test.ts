import { describe, it, expect } from 'vitest';
import { TriggerManager } from '../src/trigger-manager.js';
import { TriggerType } from '../src/models.js';


describe('TriggerManager', () => {
  it('registers triggers', () => {
    const manager = new TriggerManager();
    manager.register({
      id: 't1',
      type: TriggerType.SCHEDULE,
      config: { schedule: '* * * * *' },
      handler: async () => undefined,
    });

    expect(manager.list().length).toBe(1);
    expect(manager.list()[0].id).toBe('t1');
  });
});
