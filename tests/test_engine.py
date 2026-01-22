"""
Tests for the engine module - retry policy and circuit breaker.
"""

import asyncio
from datetime import datetime, timedelta

import pytest

from aiworkflow.core.engine import CircuitBreaker, RetryPolicy


class TestRetryPolicy:
    """Tests for RetryPolicy class."""

    def test_create_policy(self):
        """Test creating a retry policy."""
        policy = RetryPolicy()

        assert policy.max_retries == 3
        assert policy.base_delay == 1.0
        assert policy.max_delay == 60.0
        assert policy.exponential_base == 2.0

    def test_custom_policy(self):
        """Test creating a custom retry policy."""
        policy = RetryPolicy(
            max_retries=5,
            base_delay=0.5,
            max_delay=30.0,
            exponential_base=3.0,
        )

        assert policy.max_retries == 5
        assert policy.base_delay == 0.5
        assert policy.max_delay == 30.0
        assert policy.exponential_base == 3.0

    def test_get_delay_exponential(self):
        """Test exponential backoff delay calculation."""
        policy = RetryPolicy(base_delay=1.0, exponential_base=2.0, jitter=0.0)

        # First attempt: 1.0 * 2^0 = 1.0
        assert policy.get_delay(1) == 1.0

        # Second attempt: 1.0 * 2^1 = 2.0
        assert policy.get_delay(2) == 2.0

        # Third attempt: 1.0 * 2^2 = 4.0
        assert policy.get_delay(3) == 4.0

        # Fourth attempt: 1.0 * 2^3 = 8.0
        assert policy.get_delay(4) == 8.0

    def test_get_delay_max_cap(self):
        """Test that delay is capped at max_delay."""
        policy = RetryPolicy(
            base_delay=10.0,
            max_delay=20.0,
            exponential_base=2.0,
            jitter=0.0,
        )

        # Attempt 1: 10.0 * 2^0 = 10.0
        assert policy.get_delay(1) == 10.0

        # Attempt 2: 10.0 * 2^1 = 20.0 (at cap)
        assert policy.get_delay(2) == 20.0

        # Attempt 3: 10.0 * 2^2 = 40.0 -> capped to 20.0
        assert policy.get_delay(3) == 20.0

    def test_get_delay_with_jitter(self):
        """Test that jitter adds randomness to delay."""
        policy = RetryPolicy(
            base_delay=10.0,
            jitter=0.5,  # +/- 50%
        )

        # Get multiple delays and check they vary
        delays = [policy.get_delay(1) for _ in range(10)]

        # Should have some variation (not all same)
        assert len(set(delays)) > 1

        # All should be within jitter range (5.0 to 15.0)
        for delay in delays:
            assert 5.0 <= delay <= 15.0


class TestCircuitBreaker:
    """Tests for CircuitBreaker class."""

    def test_initial_state(self):
        """Test circuit breaker starts in closed state."""
        cb = CircuitBreaker()

        assert cb.state == CircuitBreaker.CLOSED
        assert cb.can_execute() is True

    def test_custom_thresholds(self):
        """Test custom failure threshold and timeout."""
        cb = CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=60.0,
            half_open_max_calls=5,
        )

        assert cb.failure_threshold == 3
        assert cb.recovery_timeout == 60.0
        assert cb.half_open_max_calls == 5

    def test_stays_closed_below_threshold(self):
        """Test circuit stays closed below failure threshold."""
        cb = CircuitBreaker(failure_threshold=3)

        # Record 2 failures (below threshold)
        cb.record_failure()
        cb.record_failure()

        assert cb.state == CircuitBreaker.CLOSED
        assert cb.can_execute() is True

    def test_opens_at_threshold(self):
        """Test circuit opens at failure threshold."""
        cb = CircuitBreaker(failure_threshold=3)

        # Record 3 failures
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()

        assert cb.state == CircuitBreaker.OPEN
        assert cb.can_execute() is False

    def test_success_resets_failure_count(self):
        """Test success resets the failure counter."""
        cb = CircuitBreaker(failure_threshold=3)

        # Record 2 failures
        cb.record_failure()
        cb.record_failure()

        # Record success (resets counter)
        cb.record_success()

        # Record 2 more failures (should still be closed)
        cb.record_failure()
        cb.record_failure()

        assert cb.state == CircuitBreaker.CLOSED

    def test_half_open_after_timeout(self):
        """Test circuit goes to half-open after recovery timeout."""
        cb = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=0.1,  # 100ms for fast test
        )

        # Open circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitBreaker.OPEN

        # Wait for recovery timeout
        import time

        time.sleep(0.15)

        # Should be half-open now
        assert cb.state == CircuitBreaker.HALF_OPEN
        assert cb.can_execute() is True

    def test_half_open_to_closed_on_success(self):
        """Test half-open circuit closes on successful calls."""
        cb = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=0.01,
            half_open_max_calls=2,
        )

        # Open circuit
        cb.record_failure()
        cb.record_failure()

        # Wait and transition to half-open
        import time

        time.sleep(0.02)
        assert cb.state == CircuitBreaker.HALF_OPEN

        # Record successful calls
        cb.record_success()
        cb.record_success()

        # Should be closed
        assert cb.state == CircuitBreaker.CLOSED

    def test_half_open_to_open_on_failure(self):
        """Test half-open circuit reopens on failure."""
        cb = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=0.01,
        )

        # Open circuit
        cb.record_failure()
        cb.record_failure()

        # Wait and transition to half-open
        import time

        time.sleep(0.02)
        assert cb.state == CircuitBreaker.HALF_OPEN

        # Record failure during half-open
        cb.record_failure()

        # Should be open again
        assert cb.state == CircuitBreaker.OPEN

    def test_half_open_limits_calls(self):
        """Test half-open state limits concurrent calls."""
        cb = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=0.01,
            half_open_max_calls=2,
        )

        # Open circuit
        cb.record_failure()
        cb.record_failure()

        # Wait and transition to half-open
        import time

        time.sleep(0.02)

        # Should allow up to half_open_max_calls
        assert cb.can_execute() is True
        cb._half_open_calls = 1
        assert cb.can_execute() is True
        cb._half_open_calls = 2
        assert cb.can_execute() is False

    def test_reset(self):
        """Test circuit breaker reset."""
        cb = CircuitBreaker(failure_threshold=2)

        # Open circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitBreaker.OPEN

        # Reset
        cb.reset()

        assert cb.state == CircuitBreaker.CLOSED
        assert cb._failure_count == 0
        assert cb.can_execute() is True


class TestCircuitBreakerIntegration:
    """Integration tests for circuit breaker with simulated operations."""

    def test_protects_against_cascading_failures(self):
        """Test circuit breaker prevents cascading failures."""
        cb = CircuitBreaker(failure_threshold=3)

        # Simulate multiple failures
        call_count = 0

        for i in range(10):
            if cb.can_execute():
                call_count += 1
                # Simulate failure
                cb.record_failure()

        # Should have stopped after threshold
        assert call_count == 3
        assert cb.state == CircuitBreaker.OPEN

    def test_allows_recovery_after_timeout(self):
        """Test system can recover after timeout."""
        cb = CircuitBreaker(
            failure_threshold=2,
            recovery_timeout=0.05,
            half_open_max_calls=1,
        )

        # Trip the circuit
        cb.record_failure()
        cb.record_failure()
        assert cb.can_execute() is False

        # Wait for recovery
        import time

        time.sleep(0.06)

        # Should allow one test call
        assert cb.can_execute() is True

        # Record success to close circuit
        cb.record_success()
        assert cb.state == CircuitBreaker.CLOSED
