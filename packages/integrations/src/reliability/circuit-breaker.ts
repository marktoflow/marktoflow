/**
 * Circuit Breaker for integration reliability.
 *
 * Prevents cascading failures by tracking error rates per service
 * and short-circuiting requests when a service is unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered (limited requests allowed)
 */

import { IntegrationRequestError } from './errors.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeout?: number;
  /** Number of successful requests in half-open to close circuit (default: 2) */
  successThreshold?: number;
  /** Time window in ms for counting failures (default: 60000) */
  failureWindow?: number;
  /** Called when circuit state changes */
  onStateChange?: (service: string, from: CircuitState, to: CircuitState) => void;
}

interface CircuitRecord {
  state: CircuitState;
  failures: number[];
  successes: number;
  lastFailureAt: number;
  openedAt: number;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'onStateChange'>> = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
  failureWindow: 60_000,
};

export class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitRecord>();
  private options: Required<Omit<CircuitBreakerOptions, 'onStateChange'>>;
  private onStateChange?: CircuitBreakerOptions['onStateChange'];

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? DEFAULT_OPTIONS.failureThreshold,
      resetTimeout: options.resetTimeout ?? DEFAULT_OPTIONS.resetTimeout,
      successThreshold: options.successThreshold ?? DEFAULT_OPTIONS.successThreshold,
      failureWindow: options.failureWindow ?? DEFAULT_OPTIONS.failureWindow,
    };
    this.onStateChange = options.onStateChange;
  }

  /**
   * Check if a request to the given service should be allowed.
   * Throws immediately if circuit is open.
   */
  allowRequest(service: string): void {
    const circuit = this.getCircuit(service);
    const now = Date.now();

    switch (circuit.state) {
      case 'closed':
        return; // Allow

      case 'open': {
        // Check if reset timeout has elapsed
        if (now - circuit.openedAt >= this.options.resetTimeout) {
          this.transition(service, circuit, 'half_open');
          return; // Allow probe request
        }
        throw new IntegrationRequestError({
          service,
          action: 'circuit_breaker',
          message: `Circuit breaker is open for ${service} — too many recent failures. Retry after ${Math.ceil((circuit.openedAt + this.options.resetTimeout - now) / 1000)}s`,
          retryable: true,
          retryAfter: Math.ceil((circuit.openedAt + this.options.resetTimeout - now) / 1000),
        });
      }

      case 'half_open':
        return; // Allow probe request
    }
  }

  /**
   * Record a successful request.
   */
  recordSuccess(service: string): void {
    const circuit = this.getCircuit(service);

    if (circuit.state === 'half_open') {
      circuit.successes++;
      if (circuit.successes >= this.options.successThreshold) {
        this.transition(service, circuit, 'closed');
      }
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(service: string): void {
    const circuit = this.getCircuit(service);
    const now = Date.now();

    if (circuit.state === 'half_open') {
      // Any failure in half-open reopens the circuit
      this.transition(service, circuit, 'open');
      return;
    }

    // Add failure timestamp and prune old ones
    circuit.failures.push(now);
    circuit.failures = circuit.failures.filter(
      (t) => now - t < this.options.failureWindow
    );
    circuit.lastFailureAt = now;

    if (circuit.failures.length >= this.options.failureThreshold) {
      this.transition(service, circuit, 'open');
    }
  }

  /**
   * Get current state of a service's circuit.
   */
  getState(service: string): CircuitState {
    return this.getCircuit(service).state;
  }

  /**
   * Get stats for all circuits.
   */
  getStats(): Record<string, { state: CircuitState; recentFailures: number }> {
    const stats: Record<string, { state: CircuitState; recentFailures: number }> = {};
    const now = Date.now();

    for (const [service, circuit] of this.circuits) {
      const recentFailures = circuit.failures.filter(
        (t) => now - t < this.options.failureWindow
      ).length;
      stats[service] = { state: circuit.state, recentFailures };
    }

    return stats;
  }

  /**
   * Reset a specific service's circuit to closed.
   */
  reset(service: string): void {
    this.circuits.delete(service);
  }

  /**
   * Reset all circuits.
   */
  resetAll(): void {
    this.circuits.clear();
  }

  private getCircuit(service: string): CircuitRecord {
    let circuit = this.circuits.get(service);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: [],
        successes: 0,
        lastFailureAt: 0,
        openedAt: 0,
      };
      this.circuits.set(service, circuit);
    }
    return circuit;
  }

  private transition(service: string, circuit: CircuitRecord, to: CircuitState): void {
    const from = circuit.state;
    circuit.state = to;

    if (to === 'open') {
      circuit.openedAt = Date.now();
      circuit.successes = 0;
    } else if (to === 'closed') {
      circuit.failures = [];
      circuit.successes = 0;
    } else if (to === 'half_open') {
      circuit.successes = 0;
    }

    this.onStateChange?.(service, from, to);
  }
}

/** Global circuit breaker registry shared across all integrations */
let _globalRegistry: CircuitBreakerRegistry | undefined;

export function getCircuitBreakerRegistry(options?: CircuitBreakerOptions): CircuitBreakerRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new CircuitBreakerRegistry(options);
  }
  return _globalRegistry;
}

export function resetCircuitBreakerRegistry(): void {
  _globalRegistry?.resetAll();
  _globalRegistry = undefined;
}
