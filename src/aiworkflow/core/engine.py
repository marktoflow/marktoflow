"""
Workflow Engine for aiworkflow framework.

Orchestrates workflow execution across different AI agents.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from aiworkflow.core.models import (
    ExecutionContext,
    StepResult,
    StepStatus,
    Workflow,
    WorkflowResult,
    WorkflowStatus,
)

if TYPE_CHECKING:
    from aiworkflow.agents.base import AgentAdapter
    from aiworkflow.tools.registry import ToolRegistry


class WorkflowExecutionError(Exception):
    """Error during workflow execution."""

    pass


class WorkflowEngine:
    """
    Orchestrates workflow execution.

    The engine:
    1. Loads and validates workflows
    2. Selects appropriate agent adapter
    3. Executes steps in order
    4. Manages state and error handling
    5. Produces execution results
    """

    def __init__(
        self,
        agent_adapter: AgentAdapter | None = None,
        tool_registry: ToolRegistry | None = None,
        config: dict[str, Any] | None = None,
    ) -> None:
        """
        Initialize the workflow engine.

        Args:
            agent_adapter: Agent adapter for execution
            tool_registry: Registry of available tools
            config: Engine configuration
        """
        self.agent_adapter = agent_adapter
        self.tool_registry = tool_registry
        self.config = config or {}
        self._running = False

    async def execute(
        self,
        workflow: Workflow,
        inputs: dict[str, Any] | None = None,
        agent_name: str | None = None,
    ) -> WorkflowResult:
        """
        Execute a workflow.

        Args:
            workflow: Workflow to execute
            inputs: Input parameters for the workflow
            agent_name: Optional agent override

        Returns:
            WorkflowResult with execution details

        Raises:
            WorkflowExecutionError: If execution fails catastrophically
        """
        run_id = self._generate_run_id(workflow.metadata.id)
        started_at = datetime.now()

        # Create execution context
        context = self._create_context(workflow, run_id, inputs or {})

        # Validate workflow can run
        validation_errors = self._validate_execution(workflow, context)
        if validation_errors:
            return WorkflowResult(
                run_id=run_id,
                workflow_id=workflow.metadata.id,
                agent_name=context.agent_name,
                status=WorkflowStatus.FAILED,
                error=f"Validation failed: {'; '.join(validation_errors)}",
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
                context.current_step_index = i

                # Check conditions
                if not self._evaluate_conditions(step.conditions, context):
                    step_results.append(
                        StepResult(
                            step_id=step.id,
                            status=StepStatus.SKIPPED,
                            started_at=datetime.now(),
                            completed_at=datetime.now(),
                        )
                    )
                    continue

                # Execute step
                step_result = await self._execute_step(step, context)
                step_results.append(step_result)

                # Store output variable
                if step.output_variable and step_result.output is not None:
                    context.set_variable(step.output_variable, step_result.output)

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

    async def _execute_step(
        self,
        step: Any,  # WorkflowStep
        context: ExecutionContext,
    ) -> StepResult:
        """Execute a single workflow step."""
        started_at = datetime.now()

        try:
            # Resolve template variables in inputs
            resolved_inputs = self._resolve_inputs(step.inputs, context)

            # Check if this is an agent task or tool call
            if step.action.startswith("agent."):
                # Agent-specific task (analyze, generate, etc.)
                result = await self._execute_agent_task(step, resolved_inputs, context)
            else:
                # Tool call
                result = await self._execute_tool_call(step, resolved_inputs, context)

            return StepResult(
                step_id=step.id,
                status=StepStatus.COMPLETED,
                output=result,
                started_at=started_at,
                completed_at=datetime.now(),
            )

        except Exception as e:
            # Handle retries
            retries = 0
            max_retries = step.error_handling.max_retries

            while retries < max_retries:
                retries += 1
                try:
                    resolved_inputs = self._resolve_inputs(step.inputs, context)

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
                        retries=retries,
                    )
                except Exception:
                    continue

            return StepResult(
                step_id=step.id,
                status=StepStatus.FAILED,
                error=str(e),
                started_at=started_at,
                completed_at=datetime.now(),
                retries=retries,
            )

    async def _execute_agent_task(
        self,
        step: Any,  # WorkflowStep
        inputs: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """Execute an agent-specific task."""
        if self.agent_adapter is None:
            raise WorkflowExecutionError("No agent adapter configured")

        # Get agent-specific hints
        hints = step.get_hints_for_agent(context.agent_name)

        # Merge hints with inputs
        task_inputs = {**inputs, **hints}

        # Execute through agent adapter
        return await self.agent_adapter.execute_step(step, context)

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
        from aiworkflow.core.models import AgentCapabilities

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
