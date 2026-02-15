/**
 * Retry policy and circuit breaker for marktoflow workflow engine.
 *
 * Provides exponential backoff retry logic and circuit breaker pattern
 * for resilient step execution.
 */

// ============================================================================
// Retry Policy
// ============================================================================

export class RetryPolicy {
  constructor(
    public readonly maxRetries: number = 3,
    public readonly baseDelay: number = 1000,
    public readonly maxDelay: number = 30000,
    public readonly exponentialBase: number = 2,
    public readonly jitter: number = 0.1
  ) {}

  /**
   * Calculate delay for a given retry attempt.
   */
  getDelay(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(this.exponentialBase, attempt);
    const clampedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter
    const jitterAmount = clampedDelay * this.jitter * (Math.random() * 2 - 1);
    return Math.max(0, clampedDelay + jitterAmount);
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(
    public readonly failureThreshold: number = 5,
    public readonly recoveryTimeout: number = 30000,
    public readonly halfOpenMaxCalls: number = 3
  ) {}

  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN
    return this.halfOpenCalls < this.halfOpenMaxCalls;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenCalls = 0;
  }
}
