"""
OpenCode Adapter for aiworkflow framework.

Provides integration with OpenCode supporting multiple LLM backends.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from aiworkflow.agents.base import AgentAdapter, AgentConfig, register_agent
from aiworkflow.core.models import (
    AgentCapabilities,
    ExecutionContext,
    StepResult,
    StepStatus,
    WorkflowStep,
)
from aiworkflow.tools.mcp_bridge import MCPBridge


@register_agent("opencode")
class OpenCodeAdapter(AgentAdapter):
    """
    Adapter for OpenCode.

    Features:
    - Multi-model support (OpenAI, Anthropic, Ollama, etc.)
    - MCP support via native integration or bridge
    - Function calling
    - Self-hosted deployment option
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the OpenCode adapter.

        Args:
            config: Agent configuration
        """
        super().__init__(config)
        self._client: Any = None
        self._mcp_bridge: MCPBridge | None = None
        self._capabilities = AgentCapabilities(
            name="opencode",
            version="0.1.0",
            provider="open_source",
            tool_calling="supported",
            reasoning="basic",  # Depends on model
            streaming=True,
            code_execution=True,
            file_creation=True,
            mcp_native=True,  # OpenCode supports MCP natively
            mcp_via_bridge=True,
            extended_reasoning=False,  # Model dependent
            multi_turn=True,
            context_window=100000,  # Varies by model
            web_search=False,
        )

        # Determine provider from model name
        self._provider = self._detect_provider()

    def _detect_provider(self) -> str:
        """Detect the LLM provider from model name."""
        model = self.config.model or ""

        if model.startswith("gpt") or model.startswith("o1"):
            return "openai"
        elif model.startswith("claude"):
            return "anthropic"
        elif "/" in model:  # ollama format: "ollama/llama3"
            return model.split("/")[0]
        else:
            return "openai"  # Default

    @property
    def name(self) -> str:
        """Get the agent name."""
        return "opencode"

    @property
    def capabilities(self) -> AgentCapabilities:
        """Get agent capabilities."""
        return self._capabilities

    async def initialize(self) -> None:
        """Initialize the LLM client."""
        if self._provider == "openai":
            try:
                import openai

                self._client = openai.AsyncOpenAI(
                    api_key=self.config.api_key,
                    base_url=self.config.api_base_url,
                )
            except ImportError:
                raise ImportError(
                    "openai package not installed. Install with: pip install aiworkflow[openai]"
                )
        elif self._provider == "anthropic":
            try:
                import anthropic

                self._client = anthropic.AsyncAnthropic(
                    api_key=self.config.api_key,
                )
            except ImportError:
                raise ImportError(
                    "anthropic package not installed. Install with: pip install aiworkflow[claude]"
                )
        elif self._provider == "ollama":
            try:
                import openai

                # Ollama is OpenAI-compatible
                self._client = openai.AsyncOpenAI(
                    api_key="ollama",  # Ollama doesn't need a real key
                    base_url=self.config.api_base_url or "http://localhost:11434/v1",
                )
            except ImportError:
                raise ImportError("openai package not installed. Install with: pip install openai")

        # Initialize MCP bridge for tool access
        mcp_config = self.config.extra.get("mcp_servers", {})
        if mcp_config:
            self._mcp_bridge = MCPBridge(mcp_config)
            await self._mcp_bridge.initialize()

        self._initialized = True

    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a workflow step.

        Args:
            step: Workflow step to execute
            context: Execution context

        Returns:
            Step execution result
        """
        started_at = datetime.now()

        try:
            if step.action.startswith("agent."):
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
        """Check if OpenCode supports a feature."""
        return self._capabilities.supports_feature(feature)

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Analyze content using the configured LLM.
        """
        if not self._initialized:
            await self.initialize()

        if self._provider in ("openai", "ollama"):
            return await self._openai_analyze(prompt, output_schema)
        elif self._provider == "anthropic":
            return await self._anthropic_analyze(prompt, output_schema)
        else:
            raise ValueError(f"Unsupported provider: {self._provider}")

    async def _openai_analyze(
        self,
        prompt: str,
        output_schema: dict[str, Any] | None,
    ) -> Any:
        """Analyze using OpenAI-compatible API."""
        model = self.config.model or "gpt-4"
        if self._provider == "ollama" and "/" in model:
            model = model.split("/", 1)[1]  # Remove "ollama/" prefix

        messages = [{"role": "user", "content": prompt}]

        if output_schema:
            # Use JSON mode
            messages[0]["content"] += (
                "\n\nRespond with valid JSON matching this schema:\n" + json.dumps(output_schema)
            )
            response = await self._client.chat.completions.create(
                model=model,
                messages=messages,
                response_format={"type": "json_object"},
            )
        else:
            response = await self._client.chat.completions.create(
                model=model,
                messages=messages,
            )

        content = response.choices[0].message.content

        if output_schema and content:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass

        return content

    async def _anthropic_analyze(
        self,
        prompt: str,
        output_schema: dict[str, Any] | None,
    ) -> Any:
        """Analyze using Anthropic API."""
        model = self.config.model or "claude-3-5-sonnet-20241022"

        messages = [{"role": "user", "content": prompt}]

        if output_schema:
            messages[0]["content"] += (
                "\n\nRespond with valid JSON matching this schema:\n" + json.dumps(output_schema)
            )

        response = await self._client.messages.create(
            model=model,
            max_tokens=4096,
            messages=messages,
        )

        content = response.content[0].text

        if output_schema:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
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
        """Generate text content."""
        if not self._initialized:
            await self.initialize()

        if self._provider in ("openai", "ollama"):
            model = self.config.model or "gpt-4"
            if self._provider == "ollama" and "/" in model:
                model = model.split("/", 1)[1]

            response = await self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=kwargs.get("max_tokens", 2048),
            )
            return response.choices[0].message.content or ""

        elif self._provider == "anthropic":
            response = await self._client.messages.create(
                model=self.config.model or "claude-3-5-sonnet-20241022",
                max_tokens=kwargs.get("max_tokens", 2048),
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text

        raise ValueError(f"Unsupported provider: {self._provider}")

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool using function calling.
        """
        if not self._initialized:
            await self.initialize()

        # If we have MCP bridge, try to use it
        if self._mcp_bridge:
            full_tool_name = f"{tool_name}.{operation}"
            if full_tool_name in self._mcp_bridge.list_tools():
                return await self._mcp_bridge.call_tool(full_tool_name, params)

        # Otherwise, use function calling
        return await self._function_call_tool(tool_name, operation, params)

    async def _function_call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """Execute tool via LLM function calling."""
        if self._provider in ("openai", "ollama"):
            model = self.config.model or "gpt-4"
            if self._provider == "ollama" and "/" in model:
                model = model.split("/", 1)[1]

            # Define the function
            functions = [
                {
                    "name": f"{tool_name}_{operation}",
                    "description": f"Execute {tool_name} {operation}",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            k: {"type": "string", "description": str(v)} for k, v in params.items()
                        },
                    },
                }
            ]

            prompt = f"""Execute the {tool_name} tool with operation '{operation}'.
Parameters: {json.dumps(params, indent=2)}

Analyze what this operation should do and return the expected result."""

            response = await self._client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
            )

            return response.choices[0].message.content

        # For Anthropic, similar approach
        return await self.generate(
            prompt=f"Execute {tool_name}.{operation} with params: {json.dumps(params)}",
            context=ExecutionContext(
                run_id="",
                workflow=None,  # type: ignore
                agent_name=self.name,
                agent_capabilities=self._capabilities,
            ),
        )

    def _build_analysis_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build analysis prompt for OpenCode."""
        parts = []

        # OpenCode prefers simpler, more structured prompts
        if "prompt_template" in step.inputs:
            return context.resolve_template(str(step.inputs["prompt_template"]))

        if "context" in step.inputs:
            parts.append(context.resolve_template(str(step.inputs["context"])))

        if "categories" in step.inputs:
            parts.append("\nCategories:")
            for name, desc in step.inputs["categories"].items():
                parts.append(f"- {name}: {desc}")

        parts.append("\nProvide a clear, structured response.")

        return "\n".join(parts)

    def _build_generation_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build generation prompt."""
        parts = []

        if "context" in step.inputs:
            parts.append(context.resolve_template(str(step.inputs["context"])))

        if "tone" in step.inputs:
            parts.append(f"\nUse this tone: {step.inputs['tone']}")

        if "requirements" in step.inputs:
            parts.append("\nRequirements:")
            for req in step.inputs["requirements"]:
                parts.append(f"- {req}")

        return "\n".join(parts)

    def _build_report_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build report generation prompt."""
        parts = ["Generate an execution report.\n"]

        if "include" in step.inputs:
            parts.append("Include:")
            for section in step.inputs["include"]:
                parts.append(f"- {section}")

        parts.append("\nFormat as markdown.")

        return "\n".join(parts)
