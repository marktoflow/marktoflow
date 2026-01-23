"""
Claude Code Adapter for marktoflow framework.

Provides integration with Claude Code CLI and future SDK support.

Claude Code is Anthropic's official CLI tool that brings Claude's capabilities
to the terminal with file-based context, tool use, and interactive workflows.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from marktoflow.agents.base import AgentAdapter, AgentConfig, register_agent
from marktoflow.core.models import (
    AgentCapabilities,
    ExecutionContext,
    StepResult,
    StepStatus,
    WorkflowStep,
)
from marktoflow.tools.mcp_bridge import MCPBridge


@register_agent("claude-code")
class ClaudeCodeAdapter(AgentAdapter):
    """
    Adapter for Claude Code CLI / SDK.

    Supports execution modes:
    1. CLI Mode: Uses `claude` CLI subprocess (current implementation)
    2. SDK Mode: claude-agent-sdk-python

    Features:
    - File-based context (works in project directories)
    - MCP server integration (native support)
    - Tool calling (built-in tools + custom tools)
    - Streaming support
    - Extended thinking mode
    - Multi-turn conversations

    Configuration:
        extra:
            claude_code_mode: "cli" | "sdk"  # Default: "cli"
            claude_code_cli_path: str  # Default: "claude" (searches PATH)
            claude_code_model: str  # Model to use (sonnet, opus, haiku)
            claude_code_timeout: int  # Timeout in seconds
            working_directory: str  # Working directory for file context
            # SDK mode options (claude-agent-sdk)
            claude_code_sdk_system_prompt: str | None
            claude_code_sdk_max_turns: int | None
            claude_code_sdk_allowed_tools: list[str] | None
            claude_code_sdk_disallowed_tools: list[str] | None
            claude_code_sdk_permission_mode: str | None
            claude_code_sdk_setting_sources: list[str] | None
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the Claude Code adapter.

        Args:
            config: Agent configuration
        """
        super().__init__(config)

        # Configuration
        self._mode = config.extra.get("claude_code_mode", "cli")
        self._cli_path = config.extra.get("claude_code_cli_path", "claude")
        self._model = config.extra.get("claude_code_model", "sonnet")  # sonnet, opus, haiku
        self._timeout = config.extra.get("claude_code_timeout", 300)
        self._working_dir = config.extra.get("working_directory", str(Path.cwd()))

        # Runtime state
        self._mcp_bridge: MCPBridge | None = None
        self._sdk_query: Any = None
        self._sdk_options: Any = None
        self._sdk_types: dict[str, Any] = {}

        self._capabilities = AgentCapabilities(
            name="claude-code",
            version="0.1.0",
            provider="anthropic",
            tool_calling="native",  # Claude has native tool calling
            reasoning="advanced",  # Claude supports extended thinking
            streaming=True,
            code_execution=True,
            file_creation=True,
            mcp_native=True,  # Claude Code has native MCP support
            mcp_via_bridge=False,  # Not needed, native support
            extended_reasoning=True,  # Extended thinking mode
            multi_turn=True,
            context_window=200000,  # Claude 3.5 Sonnet
            web_search=False,  # Not built-in, but can be added via MCP
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
        """Initialize the Claude Code adapter."""
        if self._initialized:
            return

        if self._mode == "sdk":
            try:
                from claude_agent_sdk import (
                    AssistantMessage,
                    ClaudeAgentOptions,
                    TextBlock,
                    query,
                )
            except ImportError as exc:
                raise ImportError(
                    "claude-agent-sdk not installed. Install with: pip install claude-agent-sdk"
                ) from exc

            self._sdk_query = query
            self._sdk_types = {
                "AssistantMessage": AssistantMessage,
                "TextBlock": TextBlock,
            }

            options = self._build_sdk_options(ClaudeAgentOptions)
            self._sdk_options = options
        else:
            # Detect and validate Claude Code installation
            if not shutil.which(self._cli_path):
                raise RuntimeError(
                    f"Claude Code CLI not found at '{self._cli_path}'. "
                    "Install from: https://github.com/anthropics/claude-code"
                )

        # Initialize MCP bridge if configured (though Claude has native MCP)
        mcp_config = self.config.extra.get("mcp_servers", {})
        if mcp_config:
            self._mcp_bridge = MCPBridge(mcp_config)
            await self._mcp_bridge.initialize()

        self._initialized = True

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._mcp_bridge:
            await self._mcp_bridge.cleanup()

    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a workflow step using Claude Code.

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
        """Check if Claude Code supports a feature."""
        return self._capabilities.supports_feature(feature)

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Analyze content using Claude Code.

        Args:
            prompt: Analysis prompt
            context: Execution context
            output_schema: Optional JSON schema for structured output

        Returns:
            Analysis result (dict if schema provided, str otherwise)
        """
        if not self._initialized:
            await self.initialize()

        # Add JSON schema instruction if provided
        if output_schema:
            prompt += "\n\nRespond with valid JSON matching this schema:\n" + json.dumps(
                output_schema, indent=2
            )

        if self._mode == "sdk":
            result = await self._execute_via_sdk(prompt)
        else:
            result = await self._execute_via_cli(prompt)

        # Parse JSON if schema was provided
        if output_schema and isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code block
                import re

                json_match = re.search(r"```json\s*(\{.*?\})\s*```", result, re.DOTALL)
                if not json_match:
                    json_match = re.search(r"\{.*\}", result, re.DOTALL)
                if json_match:
                    try:
                        return json.loads(
                            json_match.group(1) if json_match.lastindex else json_match.group()
                        )
                    except json.JSONDecodeError:
                        pass

        return result

    async def generate(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ) -> str:
        """
        Generate text content using Claude Code.

        Args:
            prompt: Generation prompt
            context: Execution context
            **kwargs: Additional parameters

        Returns:
            Generated text
        """
        if not self._initialized:
            await self.initialize()

        if self._mode == "sdk":
            return await self._execute_via_sdk(prompt)

        return await self._execute_via_cli(prompt)

    async def generate_stream(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ):
        """
        Generate text content using Claude Code with streaming.

        SDK mode yields text blocks incrementally. CLI mode yields the full response once.
        """
        if not self._initialized:
            await self.initialize()

        if self._mode == "sdk":
            async for chunk in self._execute_via_sdk_stream(prompt):
                yield chunk
        else:
            result = await self._execute_via_cli(prompt)
            yield result

    async def _execute_via_cli(self, prompt: str) -> str:
        """
        Execute prompt using Claude Code CLI.

        Uses non-interactive mode with -p flag.
        """
        cmd = [self._cli_path, "-p", prompt]

        # Add model selection if specified
        if self._model and self._model != "sonnet":
            cmd.extend(["--model", self._model])

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=self._working_dir,  # Use working directory for file context
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self._timeout,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise RuntimeError(f"Claude Code CLI timed out after {self._timeout}s")

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            stdout_msg = stdout.decode() if stdout else ""
            raise RuntimeError(
                f"Claude Code CLI failed (exit code {process.returncode})\n"
                f"STDOUT: {stdout_msg}\n"
                f"STDERR: {error_msg}"
            )

        return stdout.decode().strip()

    def _build_sdk_options(self, options_cls: Any) -> Any:
        options: dict[str, Any] = {}
        system_prompt = self.config.extra.get("claude_code_sdk_system_prompt")
        if system_prompt:
            options["system_prompt"] = system_prompt

        max_turns = self.config.extra.get("claude_code_sdk_max_turns")
        if isinstance(max_turns, int):
            options["max_turns"] = max_turns

        allowed_tools = self.config.extra.get("claude_code_sdk_allowed_tools")
        if isinstance(allowed_tools, list):
            options["allowed_tools"] = allowed_tools

        disallowed_tools = self.config.extra.get("claude_code_sdk_disallowed_tools")
        if isinstance(disallowed_tools, list):
            options["disallowed_tools"] = disallowed_tools

        permission_mode = self.config.extra.get("claude_code_sdk_permission_mode")
        if isinstance(permission_mode, str):
            options["permission_mode"] = permission_mode

        setting_sources = self.config.extra.get("claude_code_sdk_setting_sources")
        if isinstance(setting_sources, list):
            options["setting_sources"] = setting_sources

        options["cwd"] = self._working_dir

        cli_path = self.config.extra.get("claude_code_cli_path")
        if isinstance(cli_path, str) and cli_path:
            options["cli_path"] = cli_path

        return options_cls(**options) if options else options_cls()

    async def _execute_via_sdk(self, prompt: str) -> str:
        if not self._sdk_query:
            raise RuntimeError("Claude SDK not initialized")

        text_parts: list[str] = []
        async for message in self._sdk_query(prompt=prompt, options=self._sdk_options):
            text_parts.extend(self._extract_text_blocks(message))

        return "".join(text_parts).strip()

    async def _execute_via_sdk_stream(self, prompt: str):
        if not self._sdk_query:
            raise RuntimeError("Claude SDK not initialized")

        async for message in self._sdk_query(prompt=prompt, options=self._sdk_options):
            for chunk in self._extract_text_blocks(message):
                if chunk:
                    yield chunk

    def _extract_text_blocks(self, message: Any) -> list[str]:
        assistant_cls = self._sdk_types.get("AssistantMessage")
        text_cls = self._sdk_types.get("TextBlock")

        if assistant_cls and isinstance(message, assistant_cls):
            content = getattr(message, "content", [])
            chunks = []
            for block in content:
                if text_cls and isinstance(block, text_cls):
                    chunks.append(getattr(block, "text", ""))
                elif isinstance(block, dict) and isinstance(block.get("text"), str):
                    chunks.append(block["text"])
            return [c for c in chunks if c]

        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, list):
                chunks = []
                for block in content:
                    if isinstance(block, dict) and isinstance(block.get("text"), str):
                        chunks.append(block["text"])
                return [c for c in chunks if c]

        text = getattr(message, "text", None)
        if isinstance(text, str):
            return [text]

        return []

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool through Claude Code.

        Claude Code has built-in tools and can use MCP tools natively.
        We delegate tool execution to Claude Code rather than calling tools directly.

        Args:
            tool_name: Name of the tool
            operation: Operation to perform
            params: Tool parameters
            context: Execution context

        Returns:
            Tool execution result
        """
        if not self._initialized:
            await self.initialize()

        # If we have MCP bridge, try to use it
        if self._mcp_bridge:
            full_tool_name = f"{tool_name}.{operation}"
            if full_tool_name in self._mcp_bridge.list_tools():
                return await self._mcp_bridge.call_tool(full_tool_name, params)

        # Otherwise, ask Claude Code to execute the tool
        prompt = f"""Execute the {tool_name} tool with operation '{operation}'.

Parameters:
{json.dumps(params, indent=2)}

Return the result of executing this tool operation."""

        return await self.generate(prompt, context)

    def _build_analysis_prompt(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> str:
        """Build analysis prompt for Claude Code."""
        parts = []

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
