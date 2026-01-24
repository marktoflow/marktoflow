import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CostStore } from '../src/costs.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('CostStore', () => {
  const dbPath = join(tmpdir(), `marktoflow-costs-${Date.now()}.db`);

  beforeEach(() => {
    // 
  });

  afterEach(() => {
    try { unlinkSync(dbPath); } catch {}
  });

  it('should calculate cost', () => {
    const store = new CostStore(dbPath);
    const pricing = store.getPricingRegistry();
    // GPT-4o: Input $2.50/M, Output $10.00/M
    // 1M input = $2.50
    const cost = pricing.calculateCost('gpt-4o', 1_000_000, 0);
    expect(cost).toBe(2.5);
  });

  it('should record usage', () => {
    const store = new CostStore(dbPath);
    const record = store.record({
      workflowId: 'wf-1',
      runId: 'run-1',
      agentName: 'agent-1',
      modelName: 'gpt-4o',
      tokenUsage: {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      },
    });

    expect(record.estimatedCost).toBe(12.5); // 2.5 + 10.0

    const summary = store.getSummary();
    expect(summary.totalCost).toBe(12.5);
    expect(summary.totalInputTokens + summary.totalOutputTokens).toBe(2_000_000);
  });
});
