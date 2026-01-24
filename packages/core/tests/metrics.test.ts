import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../src/metrics.js';

describe('MetricsCollector', () => {
  it('should collect metrics', async () => {
    const collector = new MetricsCollector();
    
    collector.workflowStarted('wf-1');
    collector.stepCompleted('wf-1', 'step-1', 'completed', 100);
    collector.workflowCompleted('wf-1', 'completed', 500);

    const metrics = await collector.getMetrics();
    expect(metrics).toContain('marktoflow_workflows_total');
    expect(metrics).toContain('marktoflow_workflow_duration_seconds');
    expect(metrics).toContain('workflow_id="wf-1"');
  });
});
