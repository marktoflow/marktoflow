/**
 * Metrics collection for marktoflow framework.
 *
 * Provides Prometheus-compatible metrics.
 */

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

export class MetricsCollector {
  private registry: Registry;
  
  // Metrics
  private workflowsTotal: Counter;
  private runningWorkflows: Gauge;
  private workflowDuration: Histogram;
  private stepsTotal: Counter;
  private stepDuration: Histogram;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'marktoflow_' });

    this.workflowsTotal = new Counter({
      name: 'marktoflow_workflows_total',
      help: 'Total number of workflow executions',
      labelNames: ['workflow_id', 'status'],
      registers: [this.registry],
    });

    this.runningWorkflows = new Gauge({
      name: 'marktoflow_running_workflows',
      help: 'Number of currently running workflows',
      labelNames: ['workflow_id'],
      registers: [this.registry],
    });

    this.workflowDuration = new Histogram({
      name: 'marktoflow_workflow_duration_seconds',
      help: 'Workflow execution duration in seconds',
      labelNames: ['workflow_id', 'status'],
      registers: [this.registry],
    });

    this.stepsTotal = new Counter({
      name: 'marktoflow_steps_total',
      help: 'Total number of step executions',
      labelNames: ['workflow_id', 'step_id', 'status'],
      registers: [this.registry],
    });

    this.stepDuration = new Histogram({
      name: 'marktoflow_step_duration_seconds',
      help: 'Step execution duration in seconds',
      labelNames: ['workflow_id', 'step_id'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  workflowStarted(workflowId: string): void {
    this.runningWorkflows.inc({ workflow_id: workflowId });
  }

  workflowCompleted(workflowId: string, status: 'completed' | 'failed', durationMs: number): void {
    this.workflowsTotal.inc({ workflow_id: workflowId, status });
    this.runningWorkflows.dec({ workflow_id: workflowId });
    this.workflowDuration.observe({ workflow_id: workflowId, status }, durationMs / 1000);
  }

  stepCompleted(workflowId: string, stepId: string, status: 'completed' | 'failed' | 'skipped', durationMs: number): void {
    this.stepsTotal.inc({ workflow_id: workflowId, step_id: stepId, status });
    this.stepDuration.observe({ workflow_id: workflowId, step_id: stepId }, durationMs / 1000);
  }
}
