"""
OpenCode Adapter for marktoflow framework.

Provides integration with OpenCode CLI supporting multiple LLM backends
including GitHub Copilot, local models (Ollama, vLLM), and 75+ providers.

This adapter uses OpenCode CLI in non-interactive mode, delegating all
LLM backend configuration to the user's OpenCode config file.
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


@register_agent("opencode")
class OpenCodeAdapter(AgentAdapter):
    """
    Adapter for OpenCode CLI/Server.

    Supports two execution modes:
    1. CLI Mode: Uses `opencode run` subprocess (simple, no server needed)
    2. Server Mode: REST API to `opencode serve` (better performance, more features)
    3. Auto Mode: Try server first, fallback to CLI (default)

    Configuration:
        extra:
            opencode_mode: "auto" | "cli" | "server"  # Default: "auto"
            opencode_server_url: str  # Default: "http://localhost:4096"
            opencode_server_autostart: bool  # Default: false
            opencode_cli_path: str  # Default: "opencode" (searches PATH)

    Features:
    - Backend-agnostic (works with GitHub Copilot, local models, 75+ providers)
    - No API key required (uses user's OpenCode configuration)
    - MCP support via OpenCode's native MCP integration
    - Tool calling through OpenCode
    - Streaming support (server mode only)
    """

    def __init__(self, config: AgentConfig) -> None:
        """
        Initialize the OpenCode adapter.

        Args:
            config: Agent configuration
        """
        super().__init__(config)

        # Configuration
        self._mode = config.extra.get("opencode_mode", "auto")  # auto, cli, server
        self._server_url = config.extra.get("opencode_server_url", "http://localhost:4096")
        self._server_autostart = config.extra.get("opencode_server_autostart", False)
        self._cli_path = config.extra.get("opencode_cli_path", "opencode")

        # Runtime state
        self._http_client: Any = None
        self._server_process: subprocess.Popen | None = None
        self._active_mode: str | None = None  # Resolved mode after detection
        self._session_id: str | None = None
        self._mcp_bridge: MCPBridge | None = None

        self._capabilities = AgentCapabilities(
            name="opencode",
            version="0.1.0",
            provider="open_source",
            tool_calling="supported",
            reasoning="model_dependent",
            streaming=True,  # Server mode only
            code_execution=True,
            file_creation=True,
            mcp_native=True,
            mcp_via_bridge=True,
            extended_reasoning=False,
            multi_turn=True,
            context_window=100000,  # Model dependent
            web_search=False,
        )

    @property
    def name(self) -> str:
        """Get the agent name."""
        return "opencode"

    @property
    def capabilities(self) -> AgentCapabilities:
        """Get agent capabilities."""
        return self._capabilities

    async def initialize(self) -> None:
        """Initialize the OpenCode adapter."""
        if self._initialized:
            return

        # Detect and validate OpenCode installation
        if not shutil.which(self._cli_path):
            raise RuntimeError(
                f"OpenCode CLI not found at '{self._cli_path}'. "
                "Install from: https://github.com/opencode-ai/opencode"
            )

        # Determine active mode
        if self._mode == "cli":
            self._active_mode = "cli"
        elif self._mode == "server":
            await self._ensure_server_running()
            self._active_mode = "server"
        else:  # auto mode
            if await self._check_server_available():
                self._active_mode = "server"
            else:
                self._active_mode = "cli"

        # Initialize HTTP client for server mode
        if self._active_mode == "server":
            try:
                import httpx

                self._http_client = httpx.AsyncClient(
                    base_url=self._server_url,
                    timeout=300.0,  # 5 minute timeout for long operations
                )
                # Create a session
                response = await self._http_client.post("/session")
                response.raise_for_status()
                self._session_id = response.json()["id"]
            except ImportError:
                raise ImportError(
                    "httpx not installed. Install with: pip install marktoflow[opencode]"
                )
            except Exception as e:
                raise RuntimeError(f"Failed to connect to OpenCode server: {e}")

        # Initialize MCP bridge if configured
        mcp_config = self.config.extra.get("mcp_servers", {})
        if mcp_config:
            self._mcp_bridge = MCPBridge(mcp_config)
            await self._mcp_bridge.initialize()

        self._initialized = True

    async def _check_server_available(self) -> bool:
        """Check if OpenCode server is running."""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=2.0) as client:
                # Prefer health endpoint (JSON)
                response = await client.get(
                    f"{self._server_url}/global/health",
                    headers={"Accept": "application/json"},
                )
                if response.status_code == 200:
                    try:
                        data = response.json()
                        return bool(data.get("healthy", True))
                    except Exception:
                        return True

                # Some servers may require auth; treat as available
                if response.status_code in {401, 403}:
                    return True

                # Fallback: root endpoint (HTML)
                response = await client.get(f"{self._server_url}/")
                return response.status_code == 200
        except Exception:
            return False

    async def _ensure_server_running(self) -> None:
        """Ensure OpenCode server is running, optionally starting it."""
        if await self._check_server_available():
            return

        if not self._server_autostart:
            raise RuntimeError(
                f"OpenCode server not running at {self._server_url}. "
                f"Start with: opencode serve --port {self._server_url.split(':')[-1]}"
            )

        # Auto-start server
        port = self._server_url.split(":")[-1]
        self._server_process = subprocess.Popen(
            [self._cli_path, "serve", "--port", port, "--print-logs"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Wait for server to be ready
        for _ in range(30):  # Wait up to 30 seconds
            if await self._check_server_available():
                return
            await asyncio.sleep(1)

        raise RuntimeError("Failed to start OpenCode server")

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._http_client:
            await self._http_client.aclose()

        if self._server_process:
            self._server_process.terminate()
            try:
                self._server_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._server_process.kill()

        if self._mcp_bridge:
            await self._mcp_bridge.cleanup()

    async def execute_step(
        self,
        step: WorkflowStep,
        context: ExecutionContext,
    ) -> StepResult:
        """
        Execute a workflow step using OpenCode.

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
        """Check if OpenCode supports a feature."""
        return self._capabilities.supports_feature(feature)

    async def analyze(
        self,
        prompt: str,
        context: ExecutionContext,
        output_schema: dict[str, Any] | None = None,
    ) -> Any:
        """
        Analyze content using OpenCode.

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

        if self._active_mode == "server":
            result = await self._execute_via_server(prompt)
        else:
            result = await self._execute_via_cli(prompt, output_format="json" if output_schema else "text")

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
                        return json.loads(json_match.group(1) if json_match.lastindex else json_match.group())
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
        Generate text content using OpenCode.

        Args:
            prompt: Generation prompt
            context: Execution context
            **kwargs: Additional parameters (ignored, OpenCode uses its config)

        Returns:
            Generated text
        """
        if not self._initialized:
            await self.initialize()

        if self._active_mode == "server":
            return await self._execute_via_server(prompt)
        else:
            return await self._execute_via_cli(prompt)

    async def generate_stream(
        self,
        prompt: str,
        context: ExecutionContext,
        **kwargs: Any,
    ):
        """
        Generate text content using OpenCode with streaming.

        Only supported in server mode. Falls back to non-streaming in CLI mode.

        Args:
            prompt: Generation prompt
            context: Execution context
            **kwargs: Additional parameters

        Yields:
            Text chunks as they are generated
        """
        if not self._initialized:
            await self.initialize()

        if self._active_mode == "server":
            async for chunk in self._execute_via_server_stream(prompt):
                yield chunk
        else:
            # CLI mode doesn't support streaming, return full response
            result = await self._execute_via_cli(prompt)
            yield result

    async def _execute_via_cli(
        self,
        prompt: str,
        output_format: str = "text",
    ) -> str:
        """Execute prompt using OpenCode CLI."""
        cmd = [self._cli_path, "run", prompt]

        if output_format == "json":
            cmd.extend(["--format", "json"])

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode() if stderr else "Unknown error"
            stdout_msg = stdout.decode() if stdout else ""
            raise RuntimeError(
                f"OpenCode CLI failed (exit code {process.returncode})\n"
                f"STDOUT: {stdout_msg}\n"
                f"STDERR: {error_msg}"
            )

        output = stdout.decode().strip()
        if output.startswith("<output>") and output.endswith("</output>"):
            inner = output[len("<output>") : -len("</output>")].strip()
            return inner
        return output

    async def _execute_via_server(self, prompt: str) -> str:
        """Execute prompt using OpenCode server REST API."""
        if not self._http_client or not self._session_id:
            raise RuntimeError("Server mode not initialized")

        response = await self._http_client.post(
            f"/session/{self._session_id}/message",
            json={
                "parts": [{"type": "text", "text": prompt}],
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()

        data = response.json()

        # Extract text from response
        # Server returns message with parts
        if "parts" in data:
            return "".join(part.get("text", "") for part in data["parts"] if "text" in part)
        elif "text" in data:
            return data["text"]
        else:
            return str(data)

    async def _execute_via_server_stream(self, prompt: str):
        """Execute prompt using OpenCode server with streaming via SSE."""
        if not self._http_client or not self._session_id:
            raise RuntimeError("Server mode not initialized")

        # Send async message (doesn't wait for completion)
        response = await self._http_client.post(
            f"/session/{self._session_id}/prompt_async",
            json={
                "parts": [{"type": "text", "text": prompt}],
            },
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()

        async def iter_sse_events(event_response):
            event_name: str | None = None
            data_lines: list[str] = []
            async for line in event_response.aiter_lines():
                if line == "":
                    if data_lines:
                        yield event_name, "\n".join(data_lines)
                    event_name = None
                    data_lines = []
                    continue
                if line.startswith(":"):
                    continue
                if line.startswith("event:"):
                    event_name = line[len("event:") :].strip()
                    continue
                if line.startswith("data:"):
                    data_lines.append(line[len("data:") :].lstrip())
            if data_lines:
                yield event_name, "\n".join(data_lines)

        def extract_session_id(payload: Any) -> str | None:
            if not isinstance(payload, dict):
                return None
            properties = payload.get("properties")
            if isinstance(properties, dict):
                for key in ("sessionID", "sessionId", "session_id", "session"):
                    if key in properties and isinstance(properties[key], str):
                        return properties[key]
                part = properties.get("part")
                if isinstance(part, dict):
                    for key in ("sessionID", "sessionId", "session_id", "session"):
                        if key in part and isinstance(part[key], str):
                            return part[key]
                info = properties.get("info")
                if isinstance(info, dict):
                    for key in ("sessionID", "sessionId", "session_id", "session"):
                        if key in info and isinstance(info[key], str):
                            return info[key]
            for key in ("sessionID", "sessionId", "session_id", "session"):
                if key in payload and isinstance(payload[key], str):
                    return payload[key]
            data = payload.get("data")
            if isinstance(data, dict):
                for key in ("sessionID", "sessionId", "session_id", "session"):
                    if key in data and isinstance(data[key], str):
                        return data[key]
            return None

        def extract_text_parts(payload: Any) -> list[str]:
            if not isinstance(payload, dict):
                return []
            properties = payload.get("properties")
            if isinstance(properties, dict):
                parts = properties.get("parts")
                if isinstance(parts, list):
                    return [
                        p.get("text", "")
                        for p in parts
                        if isinstance(p, dict) and p.get("type") == "text"
                    ]
                part = properties.get("part")
                if isinstance(part, dict) and part.get("type") == "text":
                    return [part.get("text", "")]
            parts = payload.get("parts")
            if isinstance(parts, list):
                return [p.get("text", "") for p in parts if isinstance(p, dict) and p.get("type") == "text"]
            part = payload.get("part")
            if isinstance(part, dict) and part.get("type") == "text":
                return [part.get("text", "")]
            if "text" in payload and isinstance(payload["text"], str):
                return [payload["text"]]
            return []

        def extract_delta(payload: Any) -> str | None:
            if not isinstance(payload, dict):
                return None
            properties = payload.get("properties")
            if isinstance(properties, dict):
                part = properties.get("part")
                if isinstance(part, dict) and part.get("type") == "text":
                    delta = properties.get("delta")
                    if isinstance(delta, str):
                        return delta
            delta = payload.get("delta")
            if isinstance(delta, dict) and isinstance(delta.get("text"), str):
                return delta["text"]
            if isinstance(payload.get("text"), str) and payload.get("type") == "message.part.delta":
                return payload["text"]
            return None

        def is_complete_event(event_name: str | None, payload: Any) -> bool:
            if event_name in {"message.complete", "session.complete", "session.idle"}:
                return True
            if isinstance(payload, dict):
                if payload.get("type") in {"message.complete", "session.complete", "session.idle"}:
                    return True
                properties = payload.get("properties")
                if isinstance(properties, dict):
                    status = properties.get("status")
                    if isinstance(status, dict) and status.get("type") == "idle":
                        return True
                if payload.get("done") is True:
                    return True
            return False

        async def stream_from_endpoint(path: str):
            async with self._http_client.stream(
                "GET",
                path,
                headers={"Accept": "text/event-stream"},
            ) as event_response:
                event_response.raise_for_status()

                assembled = ""
                part_offsets: dict[str, int] = {}
                async for event_name, data_str in iter_sse_events(event_response):
                    if not data_str:
                        continue

                    try:
                        payload = json.loads(data_str)
                    except json.JSONDecodeError:
                        payload = {"text": data_str}

                    if self._session_id:
                        session_id = extract_session_id(payload)
                        if session_id and session_id != self._session_id:
                            continue

                    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
                        payload = payload["data"]

                    properties = payload.get("properties") if isinstance(payload, dict) else None
                    if isinstance(properties, dict):
                        part = properties.get("part")
                        if isinstance(part, dict) and part.get("type") == "text":
                            part_id = part.get("id")
                            delta = properties.get("delta")
                            if isinstance(part_id, str):
                                current_len = part_offsets.get(part_id, 0)
                                if isinstance(delta, str) and delta:
                                    part_offsets[part_id] = current_len + len(delta)
                                    assembled += delta
                                    yield delta
                                else:
                                    text = part.get("text")
                                    if isinstance(text, str) and len(text) > current_len:
                                        new_text = text[current_len:]
                                        part_offsets[part_id] = len(text)
                                        assembled += new_text
                                        if new_text:
                                            yield new_text

                        if is_complete_event(event_name, payload):
                            break
                        continue

                    delta = extract_delta(payload)
                    if delta:
                        assembled += delta
                        yield delta
                    else:
                        text_parts = extract_text_parts(payload)
                        if text_parts:
                            full_text = "".join(text_parts)
                            if full_text == assembled or full_text in assembled:
                                pass
                            elif full_text.startswith(assembled):
                                new_text = full_text[len(assembled) :]
                                if new_text:
                                    assembled = full_text
                                    yield new_text
                            else:
                                assembled += full_text
                                yield full_text

                    if is_complete_event(event_name, payload):
                        break

        # Connect to event stream to receive updates
        received = False
        for endpoint in ("/event", "/global/event"):
            try:
                async for chunk in stream_from_endpoint(endpoint):
                    received = True
                    yield chunk
                if received:
                    return
            except Exception:
                continue

        # Fallback: if streaming failed, return full response
        if not received:
            result = await self._execute_via_server(prompt)
            yield result

    async def call_tool(
        self,
        tool_name: str,
        operation: str,
        params: dict[str, Any],
        context: ExecutionContext,
    ) -> Any:
        """
        Call a tool through OpenCode.

        OpenCode handles tool execution through its native MCP integration
        and tool system. We delegate to OpenCode rather than calling tools directly.

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

        # Otherwise, ask OpenCode to execute the tool
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
