import { describe, it, expect } from 'vitest';
import {
  AgentSelector,
  AgentRouter,
  BudgetTracker,
  SelectionStrategy,
  RoutingDecision,
  type AgentProfile,
} from '../src/routing.js';

const profiles: AgentProfile[] = [
  {
    name: 'cheap',
    provider: 'test',
    model: 'm1',
    capabilities: new Set(['tool_calling']),
    costPer1kTokens: 0.001,
    costPerRequest: 0,
    accuracyScore: 0.7,
    reliabilityScore: 0.8,
    speedScore: 0.9,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 1,
    tags: [],
    enabled: true,
  },
  {
    name: 'quality',
    provider: 'test',
    model: 'm2',
    capabilities: new Set(['tool_calling', 'analysis']),
    costPer1kTokens: 0.01,
    costPerRequest: 0,
    accuracyScore: 0.95,
    reliabilityScore: 0.95,
    speedScore: 0.85,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 2,
    tags: [],
    enabled: true,
  },
];

describe('AgentSelector', () => {
  it('selects lowest cost', () => {
    const selector = new AgentSelector(profiles, SelectionStrategy.LOWEST_COST);
    const result = selector.select({});
    expect(result.selectedAgent).toBe('cheap');
  });

  it('selects highest quality', () => {
    const selector = new AgentSelector(profiles, SelectionStrategy.HIGHEST_QUALITY);
    const result = selector.select({});
    expect(result.selectedAgent).toBe('quality');
  });
});

describe('AgentRouter', () => {
  it('uses fallback when budget is exceeded', () => {
    const selector = new AgentSelector(profiles, SelectionStrategy.HIGHEST_QUALITY);
    const budget = new BudgetTracker({ totalBudget: 0.002 });
    const router = new AgentRouter(selector, budget);

    const result = router.route({});
    expect(result.decision).toBe(RoutingDecision.USE_FALLBACK);
    expect(result.selectedAgent).toBe('cheap');
  });
});
