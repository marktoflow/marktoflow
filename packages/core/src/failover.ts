/**
 * Failover and agent health tracking.
 */

export enum FailoverReason {
  INITIALIZATION_FAILED = 'initialization_failed',
  HEALTH_CHECK_FAILED = 'health_check_failed',
  STEP_EXECUTION_FAILED = 'step_execution_failed',
  TIMEOUT = 'timeout',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
}

export interface AgentHealth {
  agentName: string;
  isHealthy: boolean;
  lastCheck: Date;
  error?: string | undefined;
  latencyMs?: number | undefined;
  consecutiveFailures: number;
}

export interface FailoverConfig {
  fallbackAgents: string[];
  maxFailoverAttempts: number;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  failoverOnStepFailure: boolean;
  failoverOnTimeout: boolean;
  retryPrimaryAfterMs: number;
}

export interface FailoverEvent {
  timestamp: Date;
  fromAgent: string;
  toAgent: string;
  reason: FailoverReason;
  stepIndex?: number | undefined;
  error?: string | undefined;
}

export class AgentHealthTracker {
  private health: Map<string, AgentHealth> = new Map();

  get(agentName: string): AgentHealth | undefined {
    return this.health.get(agentName);
  }

  markHealthy(agentName: string, latencyMs?: number): AgentHealth {
    const current = this.health.get(agentName);
    const next: AgentHealth = {
      agentName,
      isHealthy: true,
      lastCheck: new Date(),
      latencyMs,
      consecutiveFailures: 0,
    };
    this.health.set(agentName, next);
    return next;
  }

  markUnhealthy(agentName: string, error?: string): AgentHealth {
    const current = this.health.get(agentName);
    const failures = (current?.consecutiveFailures ?? 0) + 1;
    const next: AgentHealth = {
      agentName,
      isHealthy: false,
      lastCheck: new Date(),
      error,
      consecutiveFailures: failures,
    };
    this.health.set(agentName, next);
    return next;
  }
}

export const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  fallbackAgents: [],
  maxFailoverAttempts: 2,
  healthCheckIntervalMs: 60_000,
  healthCheckTimeoutMs: 10_000,
  failoverOnStepFailure: true,
  failoverOnTimeout: true,
  retryPrimaryAfterMs: 300_000,
};
