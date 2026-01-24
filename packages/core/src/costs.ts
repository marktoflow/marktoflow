/**
 * Cost tracking module for marktoflow.
 *
 * Provides token usage monitoring and cost estimation.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export interface ModelPricing {
  modelName: string;
  provider: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: string;
}

export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { modelName: 'gpt-4o', provider: 'openai', inputPricePerMillion: 2.5, outputPricePerMillion: 10.0, currency: 'USD' },
  'gpt-4o-mini': { modelName: 'gpt-4o-mini', provider: 'openai', inputPricePerMillion: 0.15, outputPricePerMillion: 0.6, currency: 'USD' },
  'claude-3-5-sonnet': { modelName: 'claude-3-5-sonnet', provider: 'anthropic', inputPricePerMillion: 3.0, outputPricePerMillion: 15.0, currency: 'USD' },
  'claude-3-haiku': { modelName: 'claude-3-haiku', provider: 'anthropic', inputPricePerMillion: 0.25, outputPricePerMillion: 1.25, currency: 'USD' },
  'gemini-1.5-pro': { modelName: 'gemini-1.5-pro', provider: 'google', inputPricePerMillion: 3.5, outputPricePerMillion: 10.5, currency: 'USD' },
  'gemini-1.5-flash': { modelName: 'gemini-1.5-flash', provider: 'google', inputPricePerMillion: 0.075, outputPricePerMillion: 0.3, currency: 'USD' },
};

export interface CostRecord {
  id: string;
  timestamp: Date;
  workflowId: string;
  runId: string;
  agentName: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  currency: string;
}

export class CostStore {
  private db: Database.Database;
  private pricing: Map<string, ModelPricing> = new Map();

  constructor(dbPath: string = '.marktoflow/state/costs.db') {
    const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.init();
    
    // Load defaults
    for (const p of Object.values(DEFAULT_PRICING)) {
      this.pricing.set(p.modelName, p);
    }
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cost_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        workflow_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        model_name TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        estimated_cost REAL NOT NULL,
        currency TEXT DEFAULT 'USD'
      );
      CREATE INDEX IF NOT EXISTS idx_cost_workflow_id ON cost_records(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_records(timestamp);
    `);
  }

  calculateCost(modelName: string, input: number, output: number): number {
    const pricing = this.pricing.get(modelName);
    if (!pricing) return 0;
    
    const inputCost = (input / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost = (output / 1_000_000) * pricing.outputPricePerMillion;
    return inputCost + outputCost;
  }

  recordUsage(params: {
    workflowId: string;
    runId: string;
    agentName: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }): CostRecord {
    const cost = this.calculateCost(params.modelName, params.inputTokens, params.outputTokens);
    
    const record: CostRecord = {
      id: randomUUID(),
      timestamp: new Date(),
      workflowId: params.workflowId,
      runId: params.runId,
      agentName: params.agentName,
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCost: cost,
      currency: 'USD'
    };

    const stmt = this.db.prepare(`
      INSERT INTO cost_records 
      (id, timestamp, workflow_id, run_id, agent_name, model_name, input_tokens, output_tokens, estimated_cost, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.timestamp.toISOString(),
      record.workflowId,
      record.runId,
      record.agentName,
      record.modelName,
      record.inputTokens,
      record.outputTokens,
      record.estimatedCost,
      record.currency
    );

    return record;
  }

  getSummary(workflowId?: string): { totalCost: number; totalTokens: number } {
    let sql = `SELECT SUM(estimated_cost) as cost, SUM(input_tokens + output_tokens) as tokens FROM cost_records`;
    const params: any[] = [];
    
    if (workflowId) {
      sql += ` WHERE workflow_id = ?`;
      params.push(workflowId);
    }
    
    const row = this.db.prepare(sql).get(...params) as { cost: number; tokens: number };
    return {
      totalCost: row.cost || 0,
      totalTokens: row.tokens || 0
    };
  }
}
