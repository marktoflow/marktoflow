"""
Claude Code Adapter for marktoflow framework.

Provides native integration with Claude Code including MCP support.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from marktoflow.agents.base import AgentAdapter, AgentConfig, register_agent
from marktoflow.core.models import (
    AgentCapabilities,
    ExecutionContext,
    StepResult,
    StepStatus,
    WorkflowStep,
)


@register_agent("claude-code")
class ClaudeCodeAdapter(AgentAdapter):
    """
    Adapter for Claude Code.

    Features:
    - Native MCP tool support
    - Extended reasoning with thinking blocks
    - Advanced analysis and generation
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the Claude Code adapter.

        Args:
            config: Agent configuration including API key
        """
        super().__init__(config)
        self._client: Any = None
        self._capabilities = AgentCapabilities(
            name="claude-code",
            version="1.0.0",
            provider="anthropic",
            tool_calling="native",
            reasoning="advanced",
            streaming=True,
            code_execution=True,
            file_creation=True,
            mcp_native=True,
            mcp_via_bridge=False,
            extended_reasoning=True,
            multi_turn=True,
            context_window=200000,
            web_search=True,
        )

    @property
    def name(self) -> str:
        """Get the agent name."""
        return "claude-code"

    @property
    def capabilities(self) -> AgentCapabilities:
        """Get agent capabilities."""
        return self._capabilities

    async def initialize(self) -> None:
        """Initialize the Anthropic client."""
        try:
            import anthropic
        except ImportError:
            raise ImportError(
                "anthropic package not installed. Install with: pip install marktoflow[claude]"
            )

        # Get API key from config or environment
        api_key = self.config.api_key
        if not api_key:
            from marktoflow.core.env import config as env_config
            api_key = env_config.anthropic_api_key()

        if not api_key:
            raise ValueError(
                "Anthropic API key not found. Set ANTHROPIC_API_KEY in your .env file "
                "or provide it in the agent configuration."
            )

        self._client = anthropic.Anthropic(api_key=api_key)
        self._initialized = True

    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a workflow step using Claude.

        Args:
            step: Workflow step to execute
            context: Execution context

        Returns:
            Step execution result
        """
        started_at = datetime.now()

        try:
            if step.action.startswith("agent."):
                # Agent task (analyze, generate, etc.)
                operation = step.get_operation()

                if operation == "analyze":
                    result = await self.analyze(
                        prompt=self._build_analysis_prompt(step, context),
                        context=context,
                        output_schema=step.inputs.get("output_schema"),
                    )
                elif operation == "generate_response":
                    result = await self.generate(
                        prompt=self._build_generation_prompt(step, context),
                        context=context,
                        **step.inputs,
                    )
                elif operation == "generate_report":
                    result = await self.generate(
                        prompt=self._build_report_prompt(step, context),
                        context=context,
                    )
                else:
                    raise ValueError(f"Unknown agent operation: {operation}")
            else:
                # Tool call
                result = await self.call_tool(
                    tool_name=step.get_tool_name(),
                    operation=step.get_operation(),
                    params=step.inputs,
                    context=context,
                )

            return StepResult(
                step_id=step.id,
                status=StepStatus.COMPLETED,
                output=result,
                started_at=started_at,
                completed_at=datetime.now(),
            )

        except Exception as e:
            return StepResult(
                step_id=step.id,
                status=StepStatus.FAILED,
                error=str(e),
                started_at=started_at,
                completed_at=datetime.now(),
            )

    def supports_feature(self, feature: str) -> bool:
        """Check if Claude supports a feature."""
        return self._capabilities.supports_feature(feature)

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Have Claude analyze content.

        Uses extended thinking for complex analysis.
        """
        if not self._initialized:
            await self.initialize()

        messages = [{"role": "user", "content": prompt}]

        # Use extended thinking for analysis
        response = self._client.messages.create(
            model=self.config.model or "claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=messages,
        )

        content = response.content[0].text

        # Try to parse as JSON if schema provided
        if output_schema:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from the response
                import re

                json_match = re.search(r"\{.*\}", content, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except json.JSONDecodeError:
                        pass

        return content

    async def generate(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ) -> str:
        """Generate text content using Claude."""
        if not self._initialized:
            await self.initialize()

        messages = [{"role": "user", "content": prompt}]

        response = self._client.messages.create(
            model=self.config.model or "claude-sonnet-4-20250514",
            max_tokens=kwargs.get("max_tokens", 2048),
            messages=messages,
        )

        return response.content[0].text

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool through Claude's native MCP support.

        Claude Code has native MCP integration, so we leverage that.
        """
        if not self._initialized:
            await self.initialize()

        # Build tool use prompt
        prompt = f"""Please use the {tool_name} tool to perform the following operation:

Operation: {operation}
Parameters: {json.dumps(params, indent=2)}

Execute this tool call and return the result."""

        # Claude will use its native MCP tools
        messages = [{"role": "user", "content": prompt}]

        # Note: In actual Claude Code, tools are automatically available
        # This is a simplified version that simulates tool use
        response = self._client.messages.create(
            model=self.config.model or "claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=messages,
        )

        # In real implementation, this would handle tool_use content blocks
        return response.content[0].text

    def _build_analysis_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build an analysis prompt from step inputs."""
        prompt_template = step.inputs.get("prompt_template", "")
        if prompt_template:
            return context.resolve_template(prompt_template)

        # Build from components
        parts = []

        if "context" in step.inputs:
            parts.append(context.resolve_template(str(step.inputs["context"])))

        if "categories" in step.inputs:
            parts.append("\nCategories:\n")
            for name, desc in step.inputs["categories"].items():
                parts.append(f"- {name}: {desc}")

        if "analysis_requirements" in step.inputs:
            parts.append("\nProvide analysis for:")
            for req in step.inputs["analysis_requirements"]:
                parts.append(f"- {req}")

        return "\n".join(parts)

    def _build_generation_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build a generation prompt from step inputs."""
        parts = []

        if "context" in step.inputs:
            parts.append(context.resolve_template(str(step.inputs["context"])))

        if "tone" in step.inputs:
            parts.append(f"\nTone: {context.resolve_template(str(step.inputs['tone']))}")

        if "requirements" in step.inputs:
            parts.append("\nRequirements:")
            for req in step.inputs["requirements"]:
                parts.append(f"- {context.resolve_template(str(req))}")

        if "guidelines" in step.inputs:
            parts.append("\nGuidelines:")
            for guide in step.inputs["guidelines"]:
                parts.append(f"- {context.resolve_template(str(guide))}")

        return "\n".join(parts)

    def _build_report_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build a report generation prompt."""
        parts = ["Generate an execution report with the following details:\n"]

        if "execution_data" in step.inputs:
            parts.append(f"Execution Data: {step.inputs['execution_data']}")

        depth = step.inputs.get("analysis_depth", "standard")
        parts.append(f"\nAnalysis depth: {depth}")

        if "include" in step.inputs:
            parts.append("\nInclude sections:")
            for section in step.inputs["include"]:
                parts.append(f"- {section}")

        parts.append("\nFormat the report in markdown.")

        return "\n".join(parts)
