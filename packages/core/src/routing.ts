/**
 * Agent selection and routing module.
 *
 * Provides agent selection based on:
 * - Capability requirements
 * - Cost optimization
 * - Quality/performance metrics
 * - Load balancing
 * - Budget constraints
 */

export enum SelectionStrategy {
  CAPABILITY_MATCH = 'capability_match',
  LOWEST_COST = 'lowest_cost',
  HIGHEST_QUALITY = 'highest_quality',
  BALANCED = 'balanced',
  ROUND_ROBIN = 'round_robin',
  RANDOM = 'random',
  PRIORITY = 'priority',
  LEAST_LOADED = 'least_loaded',
}

export enum RoutingDecision {
  USE_PRIMARY = 'use_primary',
  USE_FALLBACK = 'use_fallback',
  SWITCH_AGENT = 'switch_agent',
  REJECT = 'reject',
  QUEUE = 'queue',
}

export interface AgentScore {
  agentName: string;
  capabilityScore: number;
  costScore: number;
  qualityScore: number;
  availabilityScore: number;
  loadScore: number;
  totalScore?: number;
  weightedScore?: (weights: Record<string, number>) => number;
}

export interface AgentProfile {
  name: string;
  provider: string;
  model?: string | undefined;
  capabilities: Set<string>;
  costPer1kTokens: number;
  costPerRequest: number;
  accuracyScore: number;
  reliabilityScore: number;
  speedScore: number;
  maxTokens: number;
  maxRequestsPerMinute: number;
  priority: number;
  tags: string[];
  enabled: boolean;
}

export interface RoutingContext {
  workflowId?: string | undefined;
  stepIndex?: number | undefined;
  stepName?: string | undefined;
  requiredCapabilities?: Set<string>;
  preferredAgents?: string[];
  excludedAgents?: string[];
  maxCost?: number | undefined;
  maxLatencyMs?: number | undefined;
  currentAgent?: string | undefined;
  budgetRemaining?: number | undefined;
  metadata?: Record<string, unknown>;
}

export interface RoutingResult {
  decision: RoutingDecision;
  selectedAgent?: string | undefined;
  fallbackAgents: string[];
  reason: string;
  scores: Record<string, AgentScore>;
  estimatedCost?: number | undefined;
}

export interface BudgetConfig {
  totalBudget: number;
  periodMs?: number | undefined;
  perWorkflowLimit?: number | undefined;
  perStepLimit?: number | undefined;
  onExceed?: 'reject' | 'switch_agent' | 'queue';
  alertThresholds?: number[];
}

export interface LoadInfo {
  agentName: string;
  currentRequests: number;
  requestsPerMinute: number;
  queueDepth: number;
  lastUpdated: Date;
  loadFactor?: number;
}

const defaultWeights = {
  capability: 0.3,
  cost: 0.2,
  quality: 0.25,
  availability: 0.15,
  load: 0.1,
};

export class AgentSelector {
  private profiles = new Map<string, AgentProfile>();
  private loadInfo = new Map<string, LoadInfo>();
  private roundRobinIndex = 0;

  constructor(
    profiles: AgentProfile[] = [],
    public strategy: SelectionStrategy = SelectionStrategy.BALANCED,
    public weights: Record<string, number> = defaultWeights
  ) {
    for (const profile of profiles) {
      this.registerAgent(profile);
    }
  }

  registerAgent(profile: AgentProfile): void {
    this.profiles.set(profile.name, profile);
    this.loadInfo.set(profile.name, {
      agentName: profile.name,
      currentRequests: 0,
      requestsPerMinute: 0,
      queueDepth: 0,
      lastUpdated: new Date(),
    });
  }

  unregisterAgent(name: string): boolean {
    const had = this.profiles.delete(name);
    this.loadInfo.delete(name);
    return had;
  }

  getProfile(name: string): AgentProfile | undefined {
    return this.profiles.get(name);
  }

  listAgents(): string[] {
    return Array.from(this.profiles.keys());
  }

  listProfiles(): AgentProfile[] {
    return Array.from(this.profiles.values());
  }

  updateLoad(agentName: string, load: LoadInfo): void {
    this.loadInfo.set(agentName, load);
  }

  getLoad(agentName: string): LoadInfo | undefined {
    return this.loadInfo.get(agentName);
  }

  private capabilityScore(profile: AgentProfile, required: Set<string>): number {
    if (!required || required.size === 0) return 1;
    for (const cap of required) {
      if (!profile.capabilities.has(cap)) return 0;
    }
    const extra = Array.from(profile.capabilities).filter((c) => !required.has(c)).length;
    return Math.min(1, 1 + extra * 0.05);
  }

  private costScore(profile: AgentProfile, all: AgentProfile[]): number {
    if (all.length === 0) return 1;
    const costs = all.map((p) => p.costPer1kTokens);
    const min = Math.min(...costs);
    const max = Math.max(...costs);
    if (max === min) return 1;
    const normalized = (profile.costPer1kTokens - min) / (max - min);
    return 1 - normalized;
  }

  private availabilityScore(profile: AgentProfile): number {
    if (!profile.enabled) return 0;
    const load = this.loadInfo.get(profile.name);
    if (load && load.requestsPerMinute >= profile.maxRequestsPerMinute) {
      return 0.1;
    }
    return 1;
  }

  private loadScore(profile: AgentProfile): number {
    const load = this.loadInfo.get(profile.name);
    if (!load) return 1;
    const loadFactor = load.currentRequests === 0 ? 0 : Math.min(1, load.currentRequests / 10);
    return 1 - loadFactor;
  }

  scoreAgent(profile: AgentProfile, context: RoutingContext): AgentScore {
    const eligible = this.listProfiles().filter((p) => p.enabled);
    const required = context.requiredCapabilities ?? new Set<string>();
    const score: AgentScore = {
      agentName: profile.name,
      capabilityScore: this.capabilityScore(profile, required),
      costScore: this.costScore(profile, eligible),
      qualityScore: (profile.accuracyScore + profile.reliabilityScore + profile.speedScore) / 3,
      availabilityScore: this.availabilityScore(profile),
      loadScore: this.loadScore(profile),
    };
    score.weightedScore = (weights: Record<string, number>) =>
      score.capabilityScore * (weights.capability ?? defaultWeights.capability) +
      score.costScore * (weights.cost ?? defaultWeights.cost) +
      score.qualityScore * (weights.quality ?? defaultWeights.quality) +
      score.availabilityScore * (weights.availability ?? defaultWeights.availability) +
      score.loadScore * (weights.load ?? defaultWeights.load);
    score.totalScore = score.weightedScore(this.weights);
    return score;
  }

  select(context: RoutingContext): RoutingResult {
    const eligible = this.getEligible(context);
    if (eligible.length === 0) {
      return { decision: RoutingDecision.REJECT, fallbackAgents: [], reason: 'No eligible agents', scores: {} };
    }

    const scores: Record<string, AgentScore> = {};
    for (const profile of eligible) {
      scores[profile.name] = this.scoreAgent(profile, context);
    }

    const selected = this.selectByStrategy(eligible, scores);
    if (!selected) {
      return { decision: RoutingDecision.REJECT, fallbackAgents: [], reason: 'No agent matched selection', scores };
    }

    const fallbacks = this.buildFallbacks(eligible, selected, scores);
    return {
      decision: RoutingDecision.USE_PRIMARY,
      selectedAgent: selected.name,
      fallbackAgents: fallbacks.map((p) => p.name),
      reason: `Selected by ${this.strategy} strategy`,
      scores,
      estimatedCost: selected.costPer1kTokens,
    };
  }

  private getEligible(context: RoutingContext): AgentProfile[] {
    const preferred = new Set(context.preferredAgents ?? []);
    const excluded = new Set(context.excludedAgents ?? []);
    const required = context.requiredCapabilities ?? new Set<string>();
    const maxCost = context.maxCost;

    const eligible = this.listProfiles().filter((profile) => {
      if (!profile.enabled) return false;
      if (excluded.has(profile.name)) return false;
      for (const cap of required) {
        if (!profile.capabilities.has(cap)) return false;
      }
      if (maxCost !== undefined && profile.costPer1kTokens > maxCost) return false;
      return true;
    });

    if (preferred.size > 0) {
      eligible.sort((a, b) => {
        const ap = preferred.has(a.name) ? 0 : 1;
        const bp = preferred.has(b.name) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return b.priority - a.priority;
      });
    }

    return eligible;
  }

  private selectByStrategy(eligible: AgentProfile[], scores: Record<string, AgentScore>): AgentProfile | null {
    if (eligible.length === 0) return null;
    switch (this.strategy) {
      case SelectionStrategy.CAPABILITY_MATCH:
        return eligible.reduce((best, current) =>
          scores[current.name].capabilityScore > scores[best.name].capabilityScore ? current : best
        );
      case SelectionStrategy.LOWEST_COST:
        return eligible.reduce((best, current) =>
          current.costPer1kTokens < best.costPer1kTokens ? current : best
        );
      case SelectionStrategy.HIGHEST_QUALITY:
        return eligible.reduce((best, current) =>
          current.accuracyScore + current.reliabilityScore + current.speedScore >
          best.accuracyScore + best.reliabilityScore + best.speedScore
            ? current
            : best
        );
      case SelectionStrategy.BALANCED:
        return eligible.reduce((best, current) =>
          (scores[current.name].weightedScore?.(this.weights) ?? 0) >
          (scores[best.name].weightedScore?.(this.weights) ?? 0)
            ? current
            : best
        );
      case SelectionStrategy.ROUND_ROBIN: {
        const index = this.roundRobinIndex % eligible.length;
        this.roundRobinIndex += 1;
        return eligible[index];
      }
      case SelectionStrategy.RANDOM:
        return eligible[Math.floor(Math.random() * eligible.length)];
      case SelectionStrategy.PRIORITY:
        return eligible.reduce((best, current) => (current.priority > best.priority ? current : best));
      case SelectionStrategy.LEAST_LOADED:
        return eligible.reduce((best, current) =>
          scores[current.name].loadScore > scores[best.name].loadScore ? current : best
        );
      default:
        return eligible[0];
    }
  }

  private buildFallbacks(
    eligible: AgentProfile[],
    selected: AgentProfile,
    scores: Record<string, AgentScore>
  ): AgentProfile[] {
    const others = eligible.filter((p) => p.name !== selected.name);
    others.sort(
      (a, b) =>
        (scores[b.name].weightedScore?.(this.weights) ?? 0) - (scores[a.name].weightedScore?.(this.weights) ?? 0)
    );
    return others.slice(0, 3);
  }
}

export class BudgetTracker {
  private spent = 0;
  private workflowSpent = new Map<string, number>();
  private periodStart = Date.now();
  private alertCallbacks: Array<(percent: number, spent: number) => void> = [];

  constructor(public config: BudgetConfig) {
    this.config.alertThresholds = this.config.alertThresholds ?? [0.5, 0.8, 0.95];
  }

  get remaining(): number {
    this.checkPeriodReset();
    return this.config.totalBudget - this.spent;
  }

  canAfford(cost: number): boolean {
    this.checkPeriodReset();
    return this.spent + cost <= this.config.totalBudget;
  }

  recordCost(cost: number, workflowId?: string): boolean {
    this.checkPeriodReset();
    if (this.spent + cost > this.config.totalBudget) return false;
    if (workflowId && this.config.perWorkflowLimit !== undefined) {
      const current = this.workflowSpent.get(workflowId) ?? 0;
      if (current + cost > this.config.perWorkflowLimit) return false;
    }

    const prev = this.spent;
    this.spent += cost;
    if (workflowId) {
      this.workflowSpent.set(workflowId, (this.workflowSpent.get(workflowId) ?? 0) + cost);
    }
    this.checkAlerts(prev);
    return true;
  }

  addAlertCallback(cb: (percent: number, spent: number) => void): void {
    this.alertCallbacks.push(cb);
  }

  reset(): void {
    this.spent = 0;
    this.workflowSpent.clear();
    this.periodStart = Date.now();
  }

  private checkPeriodReset(): void {
    if (!this.config.periodMs) return;
    if (Date.now() - this.periodStart > this.config.periodMs) {
      this.reset();
    }
  }

  private checkAlerts(prevSpent: number): void {
    if (!this.alertCallbacks.length) return;
    const total = this.config.totalBudget;
    if (total === 0) return;
    const prevPct = prevSpent / total;
    const currPct = this.spent / total;
    for (const threshold of this.config.alertThresholds ?? []) {
      if (prevPct < threshold && currPct >= threshold) {
        for (const cb of this.alertCallbacks) {
          try {
            cb(currPct * 100, this.spent);
          } catch {
            // ignore
          }
        }
      }
    }
  }
}

export class AgentRouter {
  private history: Array<{ timestamp: Date; result: RoutingResult }> = [];

  constructor(public selector: AgentSelector, public budget?: BudgetTracker) {}

  route(context: RoutingContext): RoutingResult {
    if (this.budget && context.budgetRemaining === undefined) {
      context.budgetRemaining = this.budget.remaining;
    }
    let result = this.selector.select(context);
    if (result.decision === RoutingDecision.USE_PRIMARY && this.budget) {
      if (result.estimatedCost !== undefined && !this.budget.canAfford(result.estimatedCost)) {
        for (const fallback of result.fallbackAgents) {
          const profile = this.selector.getProfile(fallback);
          if (profile && this.budget.canAfford(profile.costPer1kTokens)) {
            result = {
              decision: RoutingDecision.USE_FALLBACK,
              selectedAgent: fallback,
              fallbackAgents: result.fallbackAgents.filter((a) => a !== fallback),
              reason: 'Primary exceeds budget, using fallback',
              scores: result.scores,
              estimatedCost: profile.costPer1kTokens,
            };
            break;
          }
        }
        if (result.decision === RoutingDecision.USE_PRIMARY) {
          result = { decision: RoutingDecision.REJECT, fallbackAgents: [], reason: 'No agents within budget', scores: result.scores };
        }
      }
    }
    this.history.push({ timestamp: new Date(), result });
    if (this.history.length > 1000) this.history = this.history.slice(-1000);
    return result;
  }

  recordStart(agentName: string): void {
    const load = this.selector.getLoad(agentName);
    if (load) {
      load.currentRequests += 1;
      load.lastUpdated = new Date();
    }
  }

  recordCompletion(agentName: string, cost: number, workflowId?: string): void {
    if (this.budget) {
      this.budget.recordCost(cost, workflowId);
    }
    const load = this.selector.getLoad(agentName);
    if (load) {
      load.currentRequests = Math.max(0, load.currentRequests - 1);
      load.lastUpdated = new Date();
    }
  }

  getRoutingStats(): Record<string, unknown> {
    if (!this.history.length) {
      return { totalDecisions: 0, byDecision: {}, byAgent: {} };
    }
    const byDecision: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    for (const entry of this.history) {
      byDecision[entry.result.decision] = (byDecision[entry.result.decision] ?? 0) + 1;
      if (entry.result.selectedAgent) {
        byAgent[entry.result.selectedAgent] = (byAgent[entry.result.selectedAgent] ?? 0) + 1;
      }
    }
    return {
      totalDecisions: this.history.length,
      byDecision,
      byAgent,
    };
  }
}

export const PREDEFINED_PROFILES: Record<string, AgentProfile> = {
  'claude-code': {
    name: 'claude-code',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    capabilities: new Set([
      'tool_calling',
      'mcp_native',
      'extended_reasoning',
      'streaming',
      'code_generation',
      'code_review',
      'analysis',
    ]),
    costPer1kTokens: 0.015,
    costPerRequest: 0,
    accuracyScore: 0.95,
    reliabilityScore: 0.95,
    speedScore: 0.85,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 10,
    tags: ['premium', 'coding'],
    enabled: true,
  },
  'opencode-gpt4o': {
    name: 'opencode-gpt4o',
    provider: 'openai',
    model: 'gpt-4o',
    capabilities: new Set(['tool_calling', 'streaming', 'code_generation', 'code_review', 'analysis', 'multi_model']),
    costPer1kTokens: 0.0125,
    costPerRequest: 0,
    accuracyScore: 0.9,
    reliabilityScore: 0.92,
    speedScore: 0.9,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 8,
    tags: ['standard', 'coding'],
    enabled: true,
  },
  'opencode-gpt4o-mini': {
    name: 'opencode-gpt4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    capabilities: new Set(['tool_calling', 'streaming', 'code_generation', 'analysis', 'multi_model']),
    costPer1kTokens: 0.00075,
    costPerRequest: 0,
    accuracyScore: 0.8,
    reliabilityScore: 0.9,
    speedScore: 0.95,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 5,
    tags: ['economy', 'fast'],
    enabled: true,
  },
  'opencode-claude': {
    name: 'opencode-claude',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    capabilities: new Set(['tool_calling', 'streaming', 'code_generation', 'code_review', 'analysis', 'multi_model']),
    costPer1kTokens: 0.015,
    costPerRequest: 0,
    accuracyScore: 0.92,
    reliabilityScore: 0.93,
    speedScore: 0.85,
    maxTokens: 100000,
    maxRequestsPerMinute: 60,
    priority: 9,
    tags: ['standard', 'coding'],
    enabled: true,
  },
};

export function createDefaultSelector(): AgentSelector {
  return new AgentSelector(Object.values(PREDEFINED_PROFILES), SelectionStrategy.BALANCED);
}

export function createCostOptimizedSelector(): AgentSelector {
  return new AgentSelector(Object.values(PREDEFINED_PROFILES), SelectionStrategy.LOWEST_COST);
}

export function createQualityOptimizedSelector(): AgentSelector {
  return new AgentSelector(Object.values(PREDEFINED_PROFILES), SelectionStrategy.HIGHEST_QUALITY);
}
