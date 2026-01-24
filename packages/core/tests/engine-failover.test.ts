import { describe, it, expect } from 'vitest';
import { WorkflowEngine } from '../src/engine.js';
import { createExecutionContext, type Workflow, StepStatus } from '../src/models.js';

const workflow: Workflow = {
  metadata: { id: 'wf1', name: 'Test' },
  tools: {},
  steps: [
    {
      id: 'step1',
      action: 'primary.do',
      inputs: {},
    },
  ],
};

describe('WorkflowEngine failover', () => {
  it('uses fallback tool when primary fails', async () => {
    const engine = new WorkflowEngine({
      failoverConfig: { fallbackAgents: ['fallback'], maxFailoverAttempts: 1 },
      maxRetries: 0,
    });

    const stepExecutor = async (step: any) => {
      if (step.action.startsWith('primary.')) {
        throw new Error('primary failed');
      }
      if (step.action.startsWith('fallback.')) {
        return { ok: true };
      }
      throw new Error('unexpected');
    };

    const result = await engine.execute(workflow, {}, { load: async () => ({}), has: () => true }, stepExecutor);
    expect(result.stepResults[0].status).toBe(StepStatus.COMPLETED);
    const history = engine.getFailoverHistory();
    expect(history.length).toBe(1);
    expect(history[0].toAgent).toBe('fallback');
  });
});
