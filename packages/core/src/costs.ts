/**
 * Cost tracking module for marktoflow.
 *
 * Provides token usage monitoring, API cost estimation, and cost limits.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export enum CostUnit {
  TOKENS = 'tokens',
  REQUESTS = 'requests',
  MINUTES = 'minutes',
  CREDITS = 'credits',
}

export enum CostAlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface ModelPricing {
  modelName: string;
  provider: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: string;
  effectiveDate?: Date | undefined;
  notes?: string | undefined;
}

export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { modelName: 'gpt-4o', provider: 'openai', inputPricePerMillion: 2.5, outputPricePerMillion: 10.0, currency: 'USD' },
  'gpt-4o-mini': { modelName: 'gpt-4o-mini', provider: 'openai', inputPricePerMillion: 0.15, outputPricePerMillion: 0.6, currency: 'USD' },
  'gpt-4-turbo': { modelName: 'gpt-4-turbo', provider: 'openai', inputPricePerMillion: 10.0, outputPricePerMillion: 30.0, currency: 'USD' },
  'gpt-3.5-turbo': { modelName: 'gpt-3.5-turbo', provider: 'openai', inputPricePerMillion: 0.5, outputPricePerMillion: 1.5, currency: 'USD' },
  'claude-3-5-sonnet': { modelName: 'claude-3-5-sonnet', provider: 'anthropic', inputPricePerMillion: 3.0, outputPricePerMillion: 15.0, currency: 'USD' },
  'claude-3-opus': { modelName: 'claude-3-opus', provider: 'anthropic', inputPricePerMillion: 15.0, outputPricePerMillion: 75.0, currency: 'USD' },
  'claude-3-sonnet': { modelName: 'claude-3-sonnet', provider: 'anthropic', inputPricePerMillion: 3.0, outputPricePerMillion: 15.0, currency: 'USD' },
  'claude-3-haiku': { modelName: 'claude-3-haiku', provider: 'anthropic', inputPricePerMillion: 0.25, outputPricePerMillion: 1.25, currency: 'USD' },
  'gemini-1.5-pro': { modelName: 'gemini-1.5-pro', provider: 'google', inputPricePerMillion: 3.5, outputPricePerMillion: 10.5, currency: 'USD' },
  'gemini-1.5-flash': { modelName: 'gemini-1.5-flash', provider: 'google', inputPricePerMillion: 0.075, outputPricePerMillion: 0.3, currency: 'USD' },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

export interface CostRecord {
  id: string;
  timestamp: Date;
  workflowId: string;
  runId: string;
  stepName?: string | undefined;
  agentName: string;
  modelName: string;
  tokenUsage: TokenUsage;
  estimatedCost: number;
  currency: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface CostSummary {
  startTime: Date;
  endTime: Date;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byWorkflow: Record<string, number>;
  byAgent: Record<string, number>;
  byModel: Record<string, number>;
  currency: string;
}

export interface CostLimit {
  name: string;
  maxCost: number;
  periodMs?: number | undefined; // undefined means lifetime
  scope?: 'global' | 'workflow' | 'agent' | 'model';
  scopeId?: string | undefined;
  alertThreshold?: number | undefined; // percentage
  actionOnLimit?: 'warn' | 'block' | 'notify';
}

export interface CostAlert {
  timestamp: Date;
  level: CostAlertLevel;
  limitName: string;
  currentCost: number;
  limitCost: number;
  percentage: number;
  message: string;
}

export interface CostAlertHandler {
  handleAlert(alert: CostAlert): void;
}

export class LoggingAlertHandler implements CostAlertHandler {
  constructor(private logFunc: (message: string) => void = console.log) {}

  handleAlert(alert: CostAlert): void {
    this.logFunc(`[${alert.level.toUpperCase()}] ${alert.message}`);
  }
}

export class CallbackAlertHandler implements CostAlertHandler {
  constructor(private callback: (alert: CostAlert) => void) {}

  handleAlert(alert: CostAlert): void {
    this.callback(alert);
  }
}

export class PricingRegistry {
  private pricing = new Map<string, ModelPricing>();

  constructor() {
    for (const p of Object.values(DEFAULT_PRICING)) {
      this.pricing.set(p.modelName, p);
    }
  }

  register(pricing: ModelPricing): void {
    this.pricing.set(pricing.modelName, pricing);
  }

  get(modelName: string): ModelPricing | undefined {
    if (this.pricing.has(modelName)) return this.pricing.get(modelName);
    for (const [key, value] of this.pricing.entries()) {
      if (modelName.startsWith(key)) return value;
    }
    return undefined;
  }

  listModels(): string[] {
    return Array.from(this.pricing.keys());
  }

  calculateCost(modelName: string, inputTokens: number, outputTokens: number): number | null {
    const pricing = this.get(modelName);
    if (!pricing) return null;
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
    return inputCost + outputCost;
  }
}

export class CostTracker {
  private records: CostRecord[] = [];
  private limits: CostLimit[] = [];

  constructor(
    public pricingRegistry: PricingRegistry = new PricingRegistry(),
    public alertHandlers: CostAlertHandler[] = []
  ) {}

  addAlertHandler(handler: CostAlertHandler): void {
    this.alertHandlers.push(handler);
  }

  addLimit(limit: CostLimit): void {
    this.limits.push(limit);
  }

  removeLimit(name: string): boolean {
    const index = this.limits.findIndex((limit) => limit.name === name);
    if (index === -1) return false;
    this.limits.splice(index, 1);
    return true;
  }

  recordUsage(params: {
    recordId?: string;
    workflowId: string;
    runId: string;
    agentName: string;
    modelName: string;
    tokenUsage: TokenUsage;
    stepName?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): CostRecord {
    const cost = this.pricingRegistry.calculateCost(
      params.modelName,
      params.tokenUsage.inputTokens,
      params.tokenUsage.outputTokens
    ) ?? 0;

    const record: CostRecord = {
      id: params.recordId ?? randomUUID(),
      timestamp: new Date(),
      workflowId: params.workflowId,
      runId: params.runId,
      stepName: params.stepName,
      agentName: params.agentName,
      modelName: params.modelName,
      tokenUsage: {
        inputTokens: params.tokenUsage.inputTokens,
        outputTokens: params.tokenUsage.outputTokens,
        cachedTokens: params.tokenUsage.cachedTokens ?? 0,
        reasoningTokens: params.tokenUsage.reasoningTokens ?? 0,
      },
      estimatedCost: cost,
      currency: 'USD',
      metadata: params.metadata ?? {},
    };

    this.records.push(record);
    this.checkLimits(record);
    return record;
  }

  private checkLimits(_record: CostRecord): void {
    for (const limit of this.limits) {
      const currentCost = this.calculateLimitUsage(limit);
      const percentage = limit.maxCost > 0 ? (currentCost / limit.maxCost) * 100 : 0;

      if (limit.alertThreshold !== undefined && percentage >= limit.alertThreshold) {
        const level = percentage >= 100 ? CostAlertLevel.CRITICAL : CostAlertLevel.WARNING;
        const alert: CostAlert = {
          timestamp: new Date(),
          level,
          limitName: limit.name,
          currentCost,
          limitCost: limit.maxCost,
          percentage,
          message: `Cost limit '${limit.name}' at ${percentage.toFixed(1)}%: $${currentCost.toFixed(4)} / $${limit.maxCost.toFixed(4)}`,
        };
        for (const handler of this.alertHandlers) {
          try {
            handler.handleAlert(alert);
          } catch {
            // ignore handler errors
          }
        }
      }
    }
  }

  private calculateLimitUsage(limit: CostLimit): number {
    const now = Date.now();
    const startTime = limit.periodMs ? now - limit.periodMs : 0;

    let total = 0;
    for (const record of this.records) {
      if (record.timestamp.getTime() < startTime) continue;
      if (limit.scope === 'workflow' && limit.scopeId && record.workflowId !== limit.scopeId) continue;
      if (limit.scope === 'agent' && limit.scopeId && record.agentName !== limit.scopeId) continue;
      if (limit.scope === 'model' && limit.scopeId && record.modelName !== limit.scopeId) continue;
      total += record.estimatedCost;
    }

    return total;
  }

  getRecords(filters: {
    workflowId?: string | undefined;
    runId?: string | undefined;
    agentName?: string | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
  } = {}): CostRecord[] {
    return this.records.filter((record) => {
      if (filters.workflowId && record.workflowId !== filters.workflowId) return false;
      if (filters.runId && record.runId !== filters.runId) return false;
      if (filters.agentName && record.agentName !== filters.agentName) return false;
      if (filters.startTime && record.timestamp < filters.startTime) return false;
      if (filters.endTime && record.timestamp > filters.endTime) return false;
      return true;
    });
  }

  getSummary(startTime?: Date, endTime?: Date): CostSummary {
    const start = startTime ?? new Date(0);
    const end = endTime ?? new Date();
    const records = this.getRecords({ startTime: start, endTime: end });

    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    const byWorkflow: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const record of records) {
      totalCost += record.estimatedCost;
      totalInput += record.tokenUsage.inputTokens;
      totalOutput += record.tokenUsage.outputTokens;
      byWorkflow[record.workflowId] = (byWorkflow[record.workflowId] ?? 0) + record.estimatedCost;
      byAgent[record.agentName] = (byAgent[record.agentName] ?? 0) + record.estimatedCost;
      byModel[record.modelName] = (byModel[record.modelName] ?? 0) + record.estimatedCost;
    }

    return {
      startTime: start,
      endTime: end,
      totalCost,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalRequests: records.length,
      byWorkflow,
      byAgent,
      byModel,
      currency: 'USD',
    };
  }

  getWorkflowCost(workflowId: string, runId?: string): number {
    const records = this.getRecords({ workflowId, runId });
    return records.reduce((sum, record) => sum + record.estimatedCost, 0);
  }

  clear(): void {
    this.records = [];
  }
}

export class CostStore {
  private db: Database.Database;
  private pricing: PricingRegistry;

  constructor(dbPath: string = '.marktoflow/state/costs.db') {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.init();
    this.pricing = new PricingRegistry();
  }

  getPricingRegistry(): PricingRegistry {
    return this.pricing;
  }

  calculateCost(modelName: string, inputTokens: number, outputTokens: number): number {
    return this.pricing.calculateCost(modelName, inputTokens, outputTokens) ?? 0;
  }

  record(params: {
    workflowId: string;
    runId: string;
    agentName: string;
    modelName: string;
    tokenUsage: TokenUsage;
    stepName?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): CostRecord {
    const cost = this.calculateCost(params.modelName, params.tokenUsage.inputTokens, params.tokenUsage.outputTokens);
    const record: CostRecord = {
      id: randomUUID(),
      timestamp: new Date(),
      workflowId: params.workflowId,
      runId: params.runId,
      stepName: params.stepName,
      agentName: params.agentName,
      modelName: params.modelName,
      tokenUsage: {
        inputTokens: params.tokenUsage.inputTokens,
        outputTokens: params.tokenUsage.outputTokens,
        cachedTokens: params.tokenUsage.cachedTokens ?? 0,
        reasoningTokens: params.tokenUsage.reasoningTokens ?? 0,
      },
      estimatedCost: cost,
      currency: 'USD',
      metadata: params.metadata ?? {},
    };

    this.save(record);
    return record;
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cost_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        step_name TEXT,
        agent_name TEXT NOT NULL,
        model_name TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cached_tokens INTEGER DEFAULT 0,
        reasoning_tokens INTEGER DEFAULT 0,
        estimated_cost REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cost_workflow_id ON cost_records(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_records(agent_name);
    `);
  }

  save(record: CostRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO cost_records
      (id, timestamp, workflow_id, run_id, step_name, agent_name, model_name,
       input_tokens, output_tokens, cached_tokens, reasoning_tokens,
       estimated_cost, currency, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.timestamp.toISOString(),
      record.workflowId,
      record.runId,
      record.stepName ?? null,
      record.agentName,
      record.modelName,
      record.tokenUsage.inputTokens,
      record.tokenUsage.outputTokens,
      record.tokenUsage.cachedTokens ?? 0,
      record.tokenUsage.reasoningTokens ?? 0,
      record.estimatedCost,
      record.currency,
      record.metadata ? JSON.stringify(record.metadata) : null
    );
  }

  get(recordId: string): CostRecord | null {
    const row = this.db.prepare('SELECT * FROM cost_records WHERE id = ?').get(recordId) as any;
    return row ? this.rowToRecord(row) : null;
  }

  query(filters: {
    workflowId?: string | undefined;
    runId?: string | undefined;
    agentName?: string | undefined;
    modelName?: string | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    limit?: number | undefined;
  } = {}): CostRecord[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.workflowId) { conditions.push('workflow_id = ?'); params.push(filters.workflowId); }
    if (filters.runId) { conditions.push('run_id = ?'); params.push(filters.runId); }
    if (filters.agentName) { conditions.push('agent_name = ?'); params.push(filters.agentName); }
    if (filters.modelName) { conditions.push('model_name = ?'); params.push(filters.modelName); }
    if (filters.startTime) { conditions.push('timestamp >= ?'); params.push(filters.startTime.toISOString()); }
    if (filters.endTime) { conditions.push('timestamp <= ?'); params.push(filters.endTime.toISOString()); }

    let sql = 'SELECT * FROM cost_records';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY timestamp DESC';
    if (filters.limit) {
      sql += ` LIMIT ${filters.limit}`;
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((row) => this.rowToRecord(row));
  }

  getSummary(startTime?: Date, endTime?: Date): CostSummary {
    const conditions: string[] = [];
    const params: any[] = [];
    if (startTime) { conditions.push('timestamp >= ?'); params.push(startTime.toISOString()); }
    if (endTime) { conditions.push('timestamp <= ?'); params.push(endTime.toISOString()); }
    const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

    const totals = this.db.prepare(`
      SELECT
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COUNT(*) as total_requests,
        MIN(timestamp) as min_time,
        MAX(timestamp) as max_time
      FROM cost_records
      ${whereClause}
    `).get(...params) as any;

    const byWorkflowRows = this.db.prepare(`
      SELECT workflow_id, SUM(estimated_cost) as cost
      FROM cost_records
      ${whereClause}
      GROUP BY workflow_id
    `).all(...params) as any[];
    const byAgentRows = this.db.prepare(`
      SELECT agent_name, SUM(estimated_cost) as cost
      FROM cost_records
      ${whereClause}
      GROUP BY agent_name
    `).all(...params) as any[];
    const byModelRows = this.db.prepare(`
      SELECT model_name, SUM(estimated_cost) as cost
      FROM cost_records
      ${whereClause}
      GROUP BY model_name
    `).all(...params) as any[];

    const byWorkflow: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const row of byWorkflowRows) byWorkflow[row.workflow_id] = row.cost;
    for (const row of byAgentRows) byAgent[row.agent_name] = row.cost;
    for (const row of byModelRows) byModel[row.model_name] = row.cost;

    return {
      startTime: totals.min_time ? new Date(totals.min_time) : (startTime ?? new Date(0)),
      endTime: totals.max_time ? new Date(totals.max_time) : (endTime ?? new Date()),
      totalCost: totals.total_cost,
      totalInputTokens: totals.total_input,
      totalOutputTokens: totals.total_output,
      totalRequests: totals.total_requests,
      byWorkflow,
      byAgent,
      byModel,
      currency: 'USD',
    };
  }

  deleteBefore(before: Date): number {
    const res = this.db.prepare('DELETE FROM cost_records WHERE timestamp < ?').run(before.toISOString());
    return res.changes ?? 0;
  }

  private rowToRecord(row: any): CostRecord {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      workflowId: row.workflow_id,
      runId: row.run_id,
      stepName: row.step_name ?? undefined,
      agentName: row.agent_name,
      modelName: row.model_name,
      tokenUsage: {
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cachedTokens: row.cached_tokens ?? 0,
        reasoningTokens: row.reasoning_tokens ?? 0,
      },
      estimatedCost: row.estimated_cost,
      currency: row.currency ?? 'USD',
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
    };
  }
}

export class PersistentCostTracker extends CostTracker {
  constructor(public store: CostStore, pricingRegistry?: PricingRegistry, alertHandlers?: CostAlertHandler[]) {
    super(pricingRegistry ?? new PricingRegistry(), alertHandlers ?? []);
  }

  recordUsage(params: {
    recordId?: string;
    workflowId: string;
    runId: string;
    agentName: string;
    modelName: string;
    tokenUsage: TokenUsage;
    stepName?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): CostRecord {
    const record = super.recordUsage(params);
    this.store.save(record);
    return record;
  }

  getSummary(startTime?: Date, endTime?: Date): CostSummary {
    return this.store.getSummary(startTime, endTime);
  }
}

export class WorkflowCostEstimator {
  constructor(public pricingRegistry: PricingRegistry = new PricingRegistry()) {}

  estimateStepCost(modelName: string, inputTokens: number, outputTokens: number): number | null {
    return this.pricingRegistry.calculateCost(modelName, inputTokens, outputTokens);
  }

  estimateWorkflowCost(
    modelName: string,
    stepCount: number,
    avgInputTokensPerStep: number = 1000,
    avgOutputTokensPerStep: number = 500
  ): number | null {
    const stepCost = this.estimateStepCost(modelName, avgInputTokensPerStep, avgOutputTokensPerStep);
    return stepCost !== null ? stepCost * stepCount : null;
  }

  compareModels(models: string[], inputTokens: number, outputTokens: number): Record<string, number | null> {
    const result: Record<string, number | null> = {};
    for (const model of models) {
      result[model] = this.pricingRegistry.calculateCost(model, inputTokens, outputTokens);
    }
    return result;
  }
}
