"""
Ollama Adapter for aiworkflow framework.

Provides integration with local Ollama instance.
"""

from __future__ import annotations

import asyncio
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


@register_agent("ollama")
class OllamaAdapter(AgentAdapter):
    """
    Adapter for Ollama (local LLMs).

    Configuration:
        api_base_url: str  # Default: "http://localhost:11434"
        model: str  # Default: "llama3"
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the Ollama adapter.

        Args:
            config: Agent configuration
        """
        super().__init__(config)
        self._base_url = config.api_base_url or "http://localhost:11434"
        self._model = config.model or "llama3"
        self._timeout = float(config.timeout)
        self._max_retries = max(1, config.max_retries)
        self._retry_delay = float(config.extra.get("ollama_retry_delay", 0.5))
        self._default_options = dict(config.extra.get("ollama_options", {}))
        self._system_prompt = config.extra.get("ollama_system_prompt")
        self._keep_alive = config.extra.get("ollama_keep_alive")
        self._json_mode = bool(config.extra.get("ollama_json_mode", False))
        self._client: Any = None

        self._capabilities = AgentCapabilities(
            name="ollama",
            version="0.1.0",
            provider="ollama",
            tool_calling="supported",  # Via prompting
            reasoning="model_dependent",
            streaming=False,  # Not implemented yet
            code_execution=False,
            file_creation=False,
            mcp_native=False,
            mcp_via_bridge=False,
            extended_reasoning=False,
            multi_turn=True,
            context_window=4096,  # Model dependent
            web_search=False,
        )

    @property
    def name(self) -> str:
        """Get the agent name."""
        return "ollama"

    @property
    def capabilities(self) -> AgentCapabilities:
        """Get agent capabilities."""
        return self._capabilities

    async def initialize(self) -> None:
        """Initialize the HTTP client."""
        if self._initialized:
            return

        try:
            import httpx

            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
            )
            
            # Check connection
            try:
                response = await self._client.get("/api/tags")
                if response.status_code != 200:
                    # Don't fail hard if we can't reach it yet, might start later
                    pass
            except Exception:
                pass
                
            self._initialized = True
        except ImportError:
            raise ImportError(
                "httpx not installed. Install with: pip install aiworkflow"
            )

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._client:
            await self._client.aclose()

    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a workflow step using Ollama.

        Args:
            step: Workflow step to execute
            context: Execution context

        Returns:
            Step execution result
        """
        started_at = datetime.now()

        try:
            if not self._initialized:
                await self.initialize()

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
        """Check if Ollama supports a feature."""
        return self._capabilities.supports_feature(feature)

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Analyze content using Ollama.

        Args:
            prompt: Analysis prompt
            context: Execution context
            output_schema: Optional JSON schema for structured output

        Returns:
            Analysis result (dict if schema provided, str otherwise)
        """
        if output_schema:
            prompt += "\n\nRespond with valid JSON matching this schema:\n" + json.dumps(
                output_schema, indent=2
            )
            # Some models support "json" format mode
            # We will use text generation for now as it is safer across models

        response_format = "json" if output_schema and self._json_mode else None
        response_text = await self._chat_completion(prompt, response_format=response_format)

        if output_schema:
            try:
                return json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON
                import re
                json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(json_match.group())
                    except json.JSONDecodeError:
                        pass
        
        return response_text

    async def generate(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ) -> str:
        """
        Generate text content using Ollama.

        Args:
            prompt: Generation prompt
            context: Execution context
            **kwargs: Additional parameters

        Returns:
            Generated text
        """
        options = self._build_options(kwargs)
        keep_alive = kwargs.get("keep_alive")
        return await self._chat_completion(
            prompt,
            options=options,
            keep_alive=keep_alive,
            response_format=kwargs.get("format"),
        )

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool through Ollama via prompting.
        """
        prompt = f"""Execute the {tool_name} tool with operation '{operation}'.

Parameters:
{json.dumps(params, indent=2)}

Return the result of executing this tool operation.
"""
        return await self._chat_completion(prompt)

    async def _chat_completion(
        self,
        prompt: str,
        *,
        options: dict[str, Any] | None = None,
        keep_alive: str | int | None = None,
        response_format: str | None = None,
    ) -> str:
        """Helper to call Ollama chat API."""
        if not self._client:
            await self.initialize()

        if options is None and self._default_options:
            options = dict(self._default_options)
        if keep_alive is None:
            keep_alive = self._keep_alive

        payload = {
            "model": self._model,
            "messages": self._build_messages(prompt),
            "stream": False,
        }

        if options:
            payload["options"] = options
        if keep_alive is not None:
            payload["keep_alive"] = keep_alive
        if response_format:
            payload["format"] = response_format

        try:
            data = await self._post_json("/api/chat", payload)
            return data.get("message", {}).get("content", "")
        except Exception as e:
            if response_format:
                payload.pop("format", None)
                try:
                    data = await self._post_json("/api/chat", payload)
                    return data.get("message", {}).get("content", "")
                except Exception:
                    pass
            # Fallback to generate API if chat fails or for older models
            try:
                gen_payload = {
                    "model": self._model,
                    "prompt": prompt,
                    "stream": False,
                }
                if options:
                    gen_payload["options"] = options
                if keep_alive is not None:
                    gen_payload["keep_alive"] = keep_alive
                data = await self._post_json("/api/generate", gen_payload)
                return data.get("response", "")
            except Exception as e2:
                raise RuntimeError(
                    f"Ollama API call failed: {e}. Fallback also failed: {e2}"
                )

    async def _post_json(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Post JSON with simple retries for transient failures."""
        last_error: Exception | None = None

        for attempt in range(1, self._max_retries + 1):
            try:
                status_code = None
                response = await self._client.post(endpoint, json=payload)
                status_code = response.status_code
                if status_code >= 500:
                    response.raise_for_status()
                if status_code >= 400:
                    response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                if status_code is not None and 400 <= status_code < 500:
                    break
                if attempt >= self._max_retries:
                    break
                await asyncio.sleep(self._retry_delay * attempt)

        raise RuntimeError(f"Ollama request failed after retries: {last_error}")

    def _build_messages(self, prompt: str) -> list[dict[str, str]]:
        """Build chat messages with optional system prompt."""
        messages = []
        if self._system_prompt:
            messages.append({"role": "system", "content": str(self._system_prompt)})
        messages.append({"role": "user", "content": prompt})
        return messages

    def _build_options(self, kwargs: dict[str, Any]) -> dict[str, Any] | None:
        """Build Ollama options from defaults and provided kwargs."""
        options = dict(self._default_options)
        provided = kwargs.get("options")
        if isinstance(provided, dict):
            options.update(provided)

        for key in (
            "temperature",
            "top_p",
            "top_k",
            "num_ctx",
            "num_predict",
            "repeat_penalty",
            "presence_penalty",
            "frequency_penalty",
            "seed",
        ):
            if key in kwargs:
                options[key] = kwargs[key]

        return options or None

    def _build_analysis_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build analysis prompt."""
        if "prompt_template" in step.inputs:
            return context.resolve_template(str(step.inputs["prompt_template"]))

        parts = []
        if "context" in step.inputs:
            parts.append(context.resolve_template(str(step.inputs["context"])))
            
        if "categories" in step.inputs:
            parts.append("\nCategories:")
            for name, desc in step.inputs["categories"].items():
                parts.append(f"- {name}: {desc}")

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
        return "\n".join(parts)
