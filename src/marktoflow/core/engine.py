"""
Workflow Engine for marktoflow framework.

Orchestrates workflow execution across different AI agents.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any

from marktoflow.core.models import (
    ExecutionContext,
    StepResult,
    StepStatus,
    Workflow,
    WorkflowResult,
    WorkflowStatus,
)
from marktoflow.core.state import (
    ExecutionRecord,
    ExecutionStatus,
    StateStore,
    StepCheckpoint,
)
from marktoflow.core.logging import ExecutionLog, ExecutionLogger

if TYPE_CHECKING:
    from marktoflow.agents.base import AgentAdapter, AgentConfig
    from marktoflow.tools.registry import ToolRegistry


class WorkflowExecutionError(Exception):
    """Error during workflow execution."""

    pass


class FailoverReason(Enum):
    """Reason for agent failover."""

    INITIALIZATION_FAILED = "initialization_failed"
    HEALTH_CHECK_FAILED = "health_check_failed"
    STEP_EXECUTION_FAILED = "step_execution_failed"
    TIMEOUT = "timeout"
    CIRCUIT_BREAKER_OPEN = "circuit_breaker_open"


@dataclass
class AgentHealth:
    """Health status of an agent."""

    agent_name: str
    is_healthy: bool
    last_check: datetime
    error: str | None = None
    latency_ms: float | None = None
    consecutive_failures: int = 0


@dataclass
class FailoverConfig:
    """
    Configuration for agent failover behavior.

    Attributes:
        fallback_agents: Ordered list of fallback agent names
        max_failover_attempts: Maximum failovers before giving up
        health_check_interval: Seconds between health checks
        health_check_timeout: Timeout for health check in seconds
        failover_on_step_failure: Whether to failover on step failure
        failover_on_timeout: Whether to failover on timeout
        retry_primary_after: Seconds before retrying primary agent
    """

    fallback_agents: list[str] = field(default_factory=list)
    max_failover_attempts: int = 2
    health_check_interval: float = 60.0
    health_check_timeout: float = 10.0
    failover_on_step_failure: bool = True
    failover_on_timeout: bool = True
    retry_primary_after: float = 300.0  # 5 minutes


@dataclass
class FailoverEvent:
    """Record of a failover event."""

    timestamp: datetime
    from_agent: str
    to_agent: str
    reason: FailoverReason
    step_index: int | None = None
    error: str | None = None


class RetryPolicy:
    """
    Configures retry behavior with exponential backoff.

    Attributes:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay between retries in seconds
        exponential_base: Multiplier for exponential backoff
        jitter: Add randomness to delay (0.0-1.0)
    """

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: float = 0.1,
    ) -> None:
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    def get_delay(self, attempt: int) -> float:
        """
        Calculate delay for a given retry attempt.

        Args:
            attempt: Current attempt number (1-based)

        Returns:
            Delay in seconds before next retry
        """
        import random

        # Exponential backoff
        delay = self.base_delay * (self.exponential_base ** (attempt - 1))

        # Add jitter
        if self.jitter > 0:
            jitter_range = delay * self.jitter
            delay += random.uniform(-jitter_range, jitter_range)

        # Cap at max delay
        return min(delay, self.max_delay)


class CircuitBreaker:
    """
    Circuit breaker pattern for protecting against cascading failures.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failure threshold exceeded, requests fail immediately
    - HALF_OPEN: Testing if service recovered
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
    ) -> None:
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Failures before opening circuit
            recovery_timeout: Seconds to wait before half-open
            half_open_max_calls: Calls to test in half-open state
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time: datetime | None = None
        self._half_open_calls = 0

    @property
    def state(self) -> str:
        """Get current circuit state."""
        if self._state == self.OPEN:
            # Check if recovery timeout has passed
            if self._last_failure_time:
                elapsed = (datetime.now() - self._last_failure_time).total_seconds()
                if elapsed >= self.recovery_timeout:
                    self._state = self.HALF_OPEN
                    self._half_open_calls = 0
        return self._state

    def can_execute(self) -> bool:
        """Check if execution is allowed."""
        state = self.state
        if state == self.CLOSED:
            return True
        if state == self.HALF_OPEN:
            return self._half_open_calls < self.half_open_max_calls
        return False  # OPEN

    def record_success(self) -> None:
        """Record a successful execution."""
        if self._state == self.HALF_OPEN:
            self._half_open_calls += 1
            if self._half_open_calls >= self.half_open_max_calls:
                # Recovery successful, close circuit
                self._state = self.CLOSED
                self._failure_count = 0
        elif self._state == self.CLOSED:
            # Reset failure count on success
            self._failure_count = 0

    def record_failure(self) -> None:
        """Record a failed execution."""
        self._failure_count += 1
        self._last_failure_time = datetime.now()

        if self._state == self.HALF_OPEN:
            # Failed during recovery, reopen circuit
            self._state = self.OPEN
        elif self._failure_count >= self.failure_threshold:
            # Threshold exceeded, open circuit
            self._state = self.OPEN

    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        self._state = self.CLOSED
        self._failure_count = 0
        self._last_failure_time = None
        self._half_open_calls = 0


class WorkflowEngine:
    """
    Orchestrates workflow execution.

    The engine:
    1. Loads and validates workflows
    2. Selects appropriate agent adapter
    3. Executes steps in order with retry logic
    4. Manages state persistence and logging
    5. Handles agent failover on failure
    6. Produces execution results
    """

    def __init__(
        self,
        agent_adapter: AgentAdapter | None = None,
        tool_registry: ToolRegistry | None = None,
        config: dict[str, Any] | None = None,
        state_store: StateStore | None = None,
        execution_logger: ExecutionLogger | None = None,
        retry_policy: RetryPolicy | None = None,
        circuit_breaker: CircuitBreaker | None = None,
        failover_config: FailoverConfig | None = None,
        fallback_adapters: list[AgentAdapter] | None = None,
    ) -> None:
        """
        Initialize the workflow engine.

        Args:
            agent_adapter: Primary agent adapter for execution
            tool_registry: Registry of available tools
            config: Engine configuration
            state_store: State persistence store
            execution_logger: Execution logger
            retry_policy: Retry configuration
            circuit_breaker: Circuit breaker for failure protection
            failover_config: Failover behavior configuration
            fallback_adapters: List of fallback agent adapters (in order of preference)
        """
        self.agent_adapter = agent_adapter
        self.tool_registry = tool_registry
        self.config = config or {}
        self.state_store = state_store
        self.execution_logger = execution_logger
        self.retry_policy = retry_policy or RetryPolicy()
        self.circuit_breaker = circuit_breaker
        self.failover_config = failover_config or FailoverConfig()
        self.fallback_adapters = fallback_adapters or []
        self._running = False

        # Failover state
        self._current_adapter: AgentAdapter | None = agent_adapter
        self._agent_health: dict[str, AgentHealth] = {}
        self._failover_events: list[FailoverEvent] = []
        self._failover_count = 0
        self._primary_failed_at: datetime | None = None

        # Per-agent circuit breakers
        self._agent_circuit_breakers: dict[str, CircuitBreaker] = {}

    def _get_agent_circuit_breaker(self, agent_name: str) -> CircuitBreaker:
        """Get or create circuit breaker for an agent."""
        if agent_name not in self._agent_circuit_breakers:
            self._agent_circuit_breakers[agent_name] = CircuitBreaker(
                failure_threshold=3,
                recovery_timeout=60.0,
                half_open_max_calls=1,
            )
        return self._agent_circuit_breakers[agent_name]

    async def check_agent_health(
        self,
        adapter: AgentAdapter,
        timeout: float | None = None,
    ) -> AgentHealth:
        """
        Check health of an agent adapter.

        Args:
            adapter: Agent adapter to check
            timeout: Health check timeout in seconds

        Returns:
            AgentHealth status
        """
        timeout = timeout or self.failover_config.health_check_timeout
        agent_name = adapter.name

        try:
            start = datetime.now()

            # Try to initialize if not already
            if not adapter._initialized:
                await asyncio.wait_for(
                    adapter.initialize(),
                    timeout=timeout,
                )

            latency_ms = (datetime.now() - start).total_seconds() * 1000

            health = AgentHealth(
                agent_name=agent_name,
                is_healthy=True,
                last_check=datetime.now(),
                latency_ms=latency_ms,
                consecutive_failures=0,
            )

        except asyncio.TimeoutError:
            health = AgentHealth(
                agent_name=agent_name,
                is_healthy=False,
                last_check=datetime.now(),
                error=f"Health check timed out after {timeout}s",
                consecutive_failures=self._agent_health.get(
                    agent_name, AgentHealth(agent_name, False, datetime.now())
                ).consecutive_failures
                + 1,
            )

        except Exception as e:
            health = AgentHealth(
                agent_name=agent_name,
                is_healthy=False,
                last_check=datetime.now(),
                error=str(e),
                consecutive_failures=self._agent_health.get(
                    agent_name, AgentHealth(agent_name, False, datetime.now())
                ).consecutive_failures
                + 1,
            )

        self._agent_health[agent_name] = health
        return health

    async def _select_healthy_adapter(
        self,
        exclude: list[str] | None = None,
    ) -> AgentAdapter | None:
        """
        Select a healthy agent adapter.

        Tries primary first, then fallbacks in order.

        Args:
            exclude: List of agent names to exclude

        Returns:
            Healthy adapter or None
        """
        exclude = exclude or []

        # Build list of adapters to try
        candidates: list[AgentAdapter] = []
        if self.agent_adapter and self.agent_adapter.name not in exclude:
            # Check if we should retry primary
            if self._primary_failed_at:
                elapsed = (datetime.now() - self._primary_failed_at).total_seconds()
                if elapsed >= self.failover_config.retry_primary_after:
                    candidates.append(self.agent_adapter)
                    self._primary_failed_at = None
            else:
                candidates.append(self.agent_adapter)

        for adapter in self.fallback_adapters:
            if adapter.name not in exclude:
                candidates.append(adapter)

        # Try each candidate
        for adapter in candidates:
            # Check circuit breaker first
            cb = self._get_agent_circuit_breaker(adapter.name)
            if not cb.can_execute():
                continue

            health = await self.check_agent_health(adapter)
            if health.is_healthy:
                return adapter

        return None

    async def _failover_to_next_agent(
        self,
        current_agent: str,
        reason: FailoverReason,
        step_index: int | None = None,
        error: str | None = None,
    ) -> AgentAdapter | None:
        """
        Failover to the next available agent.

        Args:
            current_agent: Name of the current (failing) agent
            reason: Reason for failover
            step_index: Current step index if applicable
            error: Error message if applicable

        Returns:
            New adapter or None if no fallback available
        """
        if self._failover_count >= self.failover_config.max_failover_attempts:
            return None

        # Mark primary as failed if this is the primary
        if self.agent_adapter and current_agent == self.agent_adapter.name:
            self._primary_failed_at = datetime.now()

        # Record circuit breaker failure
        cb = self._get_agent_circuit_breaker(current_agent)
        cb.record_failure()

        # Find next healthy adapter
        new_adapter = await self._select_healthy_adapter(exclude=[current_agent])

        if new_adapter:
            # Record failover event
            event = FailoverEvent(
                timestamp=datetime.now(),
                from_agent=current_agent,
                to_agent=new_adapter.name,
                reason=reason,
                step_index=step_index,
                error=error,
            )
            self._failover_events.append(event)
            self._failover_count += 1
            self._current_adapter = new_adapter

            return new_adapter

        return None

    def get_failover_history(self) -> list[FailoverEvent]:
        """Get list of failover events from current execution."""
        return self._failover_events.copy()

    def reset_failover_state(self) -> None:
        """Reset failover state for a new execution."""
        self._failover_count = 0
        self._failover_events = []
        self._current_adapter = self.agent_adapter

    async def execute(
        self,
        workflow: Workflow,
        inputs: dict[str, Any] | None = None,
        agent_name: str | None = None,
        resume_from: str | None = None,
    ) -> WorkflowResult:
        """
        Execute a workflow.

        Args:
            workflow: Workflow to execute
            inputs: Input parameters for the workflow
            agent_name: Optional agent override
            resume_from: Run ID to resume from (for recovery)

        Returns:
            WorkflowResult with execution details

        Raises:
            WorkflowExecutionError: If execution fails catastrophically
        """
        # Check circuit breaker
        if self.circuit_breaker and not self.circuit_breaker.can_execute():
            return WorkflowResult(
                run_id=resume_from or self._generate_run_id(workflow.metadata.id),
                workflow_id=workflow.metadata.id,
                agent_name=agent_name or "unknown",
                status=WorkflowStatus.FAILED,
                error="Circuit breaker is open - too many recent failures",
                started_at=datetime.now(),
                completed_at=datetime.now(),
            )

        # Determine run ID and start point
        if resume_from and self.state_store:
            run_id = resume_from
            start_step = self.state_store.get_resume_point(run_id)
        else:
            run_id = self._generate_run_id(workflow.metadata.id)
            start_step = 0

        started_at = datetime.now()

        # Create execution context
        context = self._create_context(workflow, run_id, inputs or {})

        # Start execution logging
        exec_log: ExecutionLog | None = None
        if self.execution_logger:
            exec_log = self.execution_logger.start_log(
                run_id=run_id,
                workflow_id=workflow.metadata.id,
                workflow_name=workflow.metadata.name,
                agent=context.agent_name,
                inputs=inputs,
            )

        # Create execution record in state store
        if self.state_store and not resume_from:
            exec_record = ExecutionRecord(
                run_id=run_id,
                workflow_id=workflow.metadata.id,
                workflow_path=str(workflow.source_path) if hasattr(workflow, "source_path") else "",
                status=ExecutionStatus.RUNNING,
                started_at=started_at,
                total_steps=len(workflow.steps),
                agent=context.agent_name,
                inputs=inputs,
            )
            self.state_store.create_execution(exec_record)

        # Validate workflow can run
        validation_errors = self._validate_execution(workflow, context)
        if validation_errors:
            error_msg = f"Validation failed: {'; '.join(validation_errors)}"
            self._finalize_execution(run_id, False, error_msg, exec_log, started_at)
            return WorkflowResult(
                run_id=run_id,
                workflow_id=workflow.metadata.id,
                agent_name=context.agent_name,
                status=WorkflowStatus.FAILED,
                error=error_msg,
                started_at=started_at,
                completed_at=datetime.now(),
            )

        # Execute workflow
        self._running = True
        step_results: list[StepResult] = []
        final_status = WorkflowStatus.COMPLETED
        error_message: str | None = None

        try:
            for i, step in enumerate(workflow.steps):
                # Skip steps before resume point
                if i < start_step:
                    continue

                context.current_step_index = i

                # Log step start
                if exec_log:
                    exec_log.step_started(step.name, i)

                # Check conditions
                if not self._evaluate_conditions(step.conditions, context):
                    if exec_log:
                        exec_log.step_skipped(step.name, i, "conditions_not_met")
                    step_results.append(
                        StepResult(
                            step_id=step.id,
                            status=StepStatus.SKIPPED,
                            started_at=datetime.now(),
                            completed_at=datetime.now(),
                        )
                    )
                    continue

                # Execute step with retry logic and failover
                step_result = await self._execute_step_with_failover(step, context, exec_log, i)
                step_results.append(step_result)

                # Save checkpoint
                if self.state_store:
                    checkpoint = StepCheckpoint(
                        run_id=run_id,
                        step_index=i,
                        step_name=step.name,
                        status=ExecutionStatus.COMPLETED
                        if step_result.success
                        else ExecutionStatus.FAILED,
                        started_at=step_result.started_at or datetime.now(),
                        completed_at=step_result.completed_at,
                        inputs=step.inputs,
                        outputs={"output": step_result.output} if step_result.output else None,
                        error=step_result.error,
                        retry_count=step_result.retries,
                    )
                    self.state_store.save_checkpoint(checkpoint)
                    exec_record = self.state_store.get_execution(run_id)
                    if exec_record:
                        exec_record.current_step = i
                        self.state_store.update_execution(exec_record)

                # Store output variable
                if step.output_variable and step_result.output is not None:
                    context.set_variable(step.output_variable, step_result.output)

                # Log step completion
                if exec_log and step_result.started_at and step_result.completed_at:
                    duration = (step_result.completed_at - step_result.started_at).total_seconds()
                    if step_result.success:
                        exec_log.step_completed(step.name, i, duration, step_result.output)
                    else:
                        exec_log.step_failed(
                            step.name, i, step_result.error or "Unknown error", duration
                        )

                # Handle step failure
                if not step_result.success:
                    if workflow.metadata.error_handling.value == "stop":
                        final_status = WorkflowStatus.FAILED
                        error_message = f"Step '{step.id}' failed: {step_result.error}"
                        break
                    elif workflow.metadata.error_handling.value == "rollback":
                        final_status = WorkflowStatus.FAILED
                        error_message = f"Step '{step.id}' failed, rollback triggered"
                        await self._rollback(step_results, context)
                        break
                    # else: continue to next step

        except Exception as e:
            final_status = WorkflowStatus.FAILED
            error_message = f"Unexpected error: {str(e)}"
        finally:
            self._running = False

        # Update circuit breaker
        if self.circuit_breaker:
            if final_status == WorkflowStatus.COMPLETED:
                self.circuit_breaker.record_success()
            else:
                self.circuit_breaker.record_failure()

        # Finalize execution
        success = final_status == WorkflowStatus.COMPLETED
        self._finalize_execution(
            run_id,
            success,
            error_message,
            exec_log,
            started_at,
            outputs=dict(context.variables) if success else None,
        )

        return WorkflowResult(
            run_id=run_id,
            workflow_id=workflow.metadata.id,
            agent_name=context.agent_name,
            status=final_status,
            step_results=step_results,
            final_output=dict(context.variables),
            error=error_message,
            started_at=started_at,
            completed_at=datetime.now(),
        )

    async def _execute_step_with_failover(
        self,
        step: Any,  # WorkflowStep
        context: ExecutionContext,
        exec_log: ExecutionLog | None = None,
        step_index: int = 0,
    ) -> StepResult:
        """
        Execute a step with retry and failover support.

        This method:
        1. Attempts execution with the current adapter
        2. On failure, retries with exponential backoff
        3. If retries exhausted and failover enabled, tries fallback agents
        4. Returns the result from whichever agent succeeded (or final failure)

        Args:
            step: Workflow step to execute
            context: Execution context
            exec_log: Optional execution log
            step_index: Current step index

        Returns:
            StepResult with execution outcome
        """
        started_at = datetime.now()
        agents_tried: list[str] = []
        last_error: str | None = None

        # Get the current adapter
        current_adapter = self._current_adapter

        while True:
            if current_adapter is None:
                # No adapter available
                return StepResult(
                    step_id=step.id,
                    status=StepStatus.FAILED,
                    error="No agent adapter available",
                    started_at=started_at,
                    completed_at=datetime.now(),
                    retries=0,
                    metadata={"agents_tried": agents_tried},
                )

            agent_name = current_adapter.name
            agents_tried.append(agent_name)

            # Update context with current agent
            context.agent_name = agent_name

            # Try execution with retry
            result = await self._execute_step_with_retry(step, context, exec_log)

            if result.success:
                # Record success in agent circuit breaker
                cb = self._get_agent_circuit_breaker(agent_name)
                cb.record_success()

                # Add metadata about which agent succeeded
                if result.metadata is None:
                    result.metadata = {}
                result.metadata["agent_used"] = agent_name
                result.metadata["agents_tried"] = agents_tried

                return result

            # Execution failed
            last_error = result.error

            # Check if we should try failover
            if not self.failover_config.failover_on_step_failure:
                # Failover disabled, return failure
                return result

            # Try failover
            if exec_log:
                exec_log.log_warning(
                    f"Step '{step.name}' failed with agent '{agent_name}', attempting failover",
                    step_name=step.name,
                    step_index=step_index,
                )

            new_adapter = await self._failover_to_next_agent(
                current_agent=agent_name,
                reason=FailoverReason.STEP_EXECUTION_FAILED,
                step_index=step_index,
                error=last_error,
            )

            if new_adapter is None:
                # No more fallback options
                if exec_log:
                    exec_log.log_error(
                        f"All agents exhausted for step '{step.name}'",
                        step_name=step.name,
                        step_index=step_index,
                    )
                result.metadata = result.metadata or {}
                result.metadata["agents_tried"] = agents_tried
                return result

            if exec_log:
                exec_log.log_info(
                    f"Failing over from '{agent_name}' to '{new_adapter.name}'",
                    step_name=step.name,
                    step_index=step_index,
                )

            current_adapter = new_adapter

    async def _execute_step_with_retry(
        self,
        step: Any,  # WorkflowStep
        context: ExecutionContext,
        exec_log: ExecutionLog | None = None,
    ) -> StepResult:
        """Execute a step with exponential backoff retry."""
        started_at = datetime.now()
        last_error: str | None = None
        max_retries = min(step.error_handling.max_retries, self.retry_policy.max_retries)

        for attempt in range(max_retries + 1):
            try:
                # Resolve template variables in inputs
                resolved_inputs = self._resolve_inputs(step.inputs, context)

                # Check if this is an agent task or tool call
                if step.action.startswith("agent."):
                    result = await self._execute_agent_task(step, resolved_inputs, context)
                else:
                    result = await self._execute_tool_call(step, resolved_inputs, context)

                return StepResult(
                    step_id=step.id,
                    status=StepStatus.COMPLETED,
                    output=result,
                    started_at=started_at,
                    completed_at=datetime.now(),
                    retries=attempt,
                )

            except Exception as e:
                last_error = str(e)

                if attempt < max_retries:
                    # Calculate delay and wait
                    delay = self.retry_policy.get_delay(attempt + 1)

                    if exec_log:
                        exec_log.step_retrying(
                            step.name,
                            context.current_step_index,
                            attempt + 1,
                            max_retries,
                            delay,
                        )

                    await asyncio.sleep(delay)

        # All retries exhausted
        return StepResult(
            step_id=step.id,
            status=StepStatus.FAILED,
            error=last_error,
            started_at=started_at,
            completed_at=datetime.now(),
            retries=max_retries,
        )

    def _finalize_execution(
        self,
        run_id: str,
        success: bool,
        error: str | None,
        exec_log: ExecutionLog | None,
        started_at: datetime,
        outputs: dict[str, Any] | None = None,
    ) -> None:
        """Finalize execution by updating state and saving logs."""
        # Update state store
        if self.state_store:
            exec_record = self.state_store.get_execution(run_id)
            if exec_record:
                exec_record.status = (
                    ExecutionStatus.COMPLETED if success else ExecutionStatus.FAILED
                )
                exec_record.completed_at = datetime.now()
                exec_record.outputs = outputs
                exec_record.error = error
                self.state_store.update_execution(exec_record)

        # Save execution log
        if self.execution_logger and exec_log:
            self.execution_logger.finish_log(
                run_id=run_id,
                success=success,
                outputs=outputs,
                error=error,
            )

    async def _execute_step(
        self,
        step: Any,  # WorkflowStep
        context: ExecutionContext,
    ) -> StepResult:
        """Execute a single workflow step (deprecated - use _execute_step_with_retry)."""
        return await self._execute_step_with_retry(step, context)

    async def _execute_agent_task(
        self,
        step: Any,  # WorkflowStep
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """Execute an agent-specific task.

        Returns the output value from the agent, not the StepResult.
        """
        if self.agent_adapter is None:
            raise WorkflowExecutionError("No agent adapter configured")

        # Get agent-specific hints
        hints = step.get_hints_for_agent(context.agent_name)

        # Merge hints with resolved inputs
        task_inputs = {**inputs, **hints}

        # Create a modified step with resolved inputs for the adapter
        from dataclasses import replace

        resolved_step = replace(step, inputs=task_inputs)

        # Execute through agent adapter
        result = await self.agent_adapter.execute_step(resolved_step, context)

        # If the adapter returns a StepResult, extract the output value
        # Otherwise return the result directly
        if isinstance(result, StepResult):
            if result.status == StepStatus.FAILED:
                raise WorkflowExecutionError(result.error or "Agent execution failed")
            return result.output
        return result

    async def _execute_tool_call(
        self,
        step: Any,  # WorkflowStep
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """Execute a tool call."""
        tool_name = step.get_tool_name()
        operation = step.get_operation()

        if self.tool_registry is None:
            raise WorkflowExecutionError("No tool registry configured")

        # Get compatible tool for current agent
        tool = self.tool_registry.get_tool(tool_name, context.agent_name)
        if tool is None:
            raise WorkflowExecutionError(f"Tool not found: {tool_name}")

        # Execute tool operation
        return await tool.execute(operation, inputs)

    def _create_context(
        self,
        workflow: Workflow,
        run_id: str,
        inputs: dict[str, Any],
    ) -> ExecutionContext:
        """Create execution context for a workflow run."""
        from marktoflow.core.models import AgentCapabilities

        # Get agent name and capabilities
        agent_name = self.config.get("agent", {}).get("primary", "opencode")

        # Create basic capabilities (would be loaded from config in production)
        capabilities = AgentCapabilities(
            name=agent_name,
            version="1.0.0",
            provider="unknown",
            tool_calling="supported",
            reasoning="basic",
        )

        return ExecutionContext(
            run_id=run_id,
            workflow=workflow,
            agent_name=agent_name,
            agent_capabilities=capabilities,
            inputs=inputs,
            started_at=datetime.now(),
            config=self.config,
        )

    def _validate_execution(
        self,
        workflow: Workflow,
        context: ExecutionContext,
    ) -> list[str]:
        """Validate that a workflow can be executed."""
        errors = []

        # Check required tools are available
        if self.tool_registry:
            for tool_name in workflow.get_required_tools():
                if not self.tool_registry.has_tool(tool_name, context.agent_name):
                    errors.append(f"Required tool not available: {tool_name}")

        # Check required inputs are provided
        for param in workflow.inputs:
            if param.required and param.name not in context.inputs:
                if param.default is None:
                    errors.append(f"Required input not provided: {param.name}")

        # Check agent compatibility
        if not workflow.is_compatible_with(context.agent_name):
            errors.append(f"Workflow not compatible with agent: {context.agent_name}")

        return errors

    def _evaluate_conditions(
        self,
        conditions: list[str],
        context: ExecutionContext,
    ) -> bool:
        """Evaluate step conditions."""
        if not conditions:
            return True

        # Simple condition evaluation
        # In production, this would use a proper expression evaluator
        for condition in conditions:
            # For now, just check if variables exist and are truthy
            try:
                resolved = context.resolve_template(condition)
                # Very basic evaluation - would need proper implementation
                if "==" in resolved:
                    left, right = resolved.split("==", 1)
                    if left.strip() != right.strip():
                        return False
                elif ">=" in resolved:
                    left, right = resolved.split(">=", 1)
                    try:
                        if float(left.strip()) < float(right.strip()):
                            return False
                    except ValueError:
                        return False
            except Exception:
                return False

        return True

    def _resolve_inputs(
        self,
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        """Resolve template variables in inputs."""
        resolved = {}

        for key, value in inputs.items():
            if isinstance(value, str):
                resolved[key] = context.resolve_template(value)
            elif isinstance(value, dict):
                resolved[key] = self._resolve_inputs(value, context)
            elif isinstance(value, list):
                resolved[key] = [
                    context.resolve_template(v) if isinstance(v, str) else v for v in value
                ]
            else:
                resolved[key] = value

        return resolved

    async def _rollback(
        self,
        step_results: list[StepResult],
        context: ExecutionContext,
    ) -> None:
        """Rollback completed steps (placeholder for future implementation)."""
        # This would implement rollback logic for steps that support it
        pass

    def _generate_run_id(self, workflow_id: str) -> str:
        """Generate a unique run ID."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        short_uuid = uuid.uuid4().hex[:8]
        return f"{workflow_id}-{timestamp}-{short_uuid}"

    def cancel(self) -> None:
        """Cancel the currently running workflow."""
        self._running = False
