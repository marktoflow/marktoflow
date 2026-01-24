import { describe, it, expect } from 'vitest';
import { AgentHealthTracker } from '../src/failover.js';


describe('AgentHealthTracker', () => {
  it('tracks health transitions', () => {
    const tracker = new AgentHealthTracker();
    const healthy = tracker.markHealthy('agent-1', 42);
    expect(healthy.isHealthy).toBe(true);

    const unhealthy = tracker.markUnhealthy('agent-1', 'error');
    expect(unhealthy.isHealthy).toBe(false);
    expect(unhealthy.consecutiveFailures).toBe(1);
  });
});
