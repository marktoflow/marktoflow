"""
OpenAPI Tool implementation for aiworkflow framework.

Enables using REST APIs described by OpenAPI specifications.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from aiworkflow.tools.registry import (
    Tool,
    ToolDefinition,
    ToolImplementation,
)


class OpenAPITool(Tool):
    """
    Tool implementation that uses OpenAPI specifications.

    Parses OpenAPI specs and makes REST API calls.
    """

    def __init__(
        self,
        definition: ToolDefinition,
        implementation: ToolImplementation,
    ) -> None:
        """
        Initialize the OpenAPI tool.

        Args:
            definition: Tool definition
            implementation: OpenAPI implementation details
        """
        super().__init__(definition, implementation)
        self._spec: dict[str, Any] = {}
        self._operations: dict[str, dict[str, Any]] = {}
        self._base_url: str = ""

    async def initialize(self) -> None:
        """Load and parse the OpenAPI specification."""
        spec_path = self.implementation.spec_path
        spec_url = self.implementation.spec_url

        if spec_path:
            path = Path(spec_path)
            if path.exists():
                content = path.read_text(encoding="utf-8")
                self._spec = yaml.safe_load(content)
        elif spec_url:
            # Fetch from URL
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(spec_url)
                response.raise_for_status()
                self._spec = yaml.safe_load(response.text)

        if self._spec:
            self._parse_spec()

        self._initialized = True

    def _parse_spec(self) -> None:
        """Parse OpenAPI spec and extract operations."""
        # Get base URL
        servers = self._spec.get("servers", [])
        if servers:
            self._base_url = servers[0].get("url", "")

        # Parse paths into operations
        paths = self._spec.get("paths", {})
        for path, methods in paths.items():
            for method, details in methods.items():
                if method in ("get", "post", "put", "patch", "delete"):
                    operation_id = details.get("operationId", f"{method}_{path}")
                    operation_id = self._normalize_operation_id(operation_id)

                    self._operations[operation_id] = {
                        "path": path,
                        "method": method.upper(),
                        "summary": details.get("summary", ""),
                        "description": details.get("description", ""),
                        "parameters": details.get("parameters", []),
                        "request_body": details.get("requestBody", {}),
                        "responses": details.get("responses", {}),
                    }

    def _normalize_operation_id(self, operation_id: str) -> str:
        """Normalize operation ID to a consistent format."""
        # Convert camelCase to snake_case
        import re

        result = re.sub(r"(?<!^)(?=[A-Z])", "_", operation_id).lower()
        # Remove any non-alphanumeric characters except underscores
        result = re.sub(r"[^a-z0-9_]", "_", result)
        # Remove duplicate underscores
        result = re.sub(r"_+", "_", result)
        return result.strip("_")

    async def execute(
        self,
        operation: str,
        params: dict[str, Any],
    ) -> Any:
        """
        Execute an OpenAPI operation.

        Args:
            operation: Operation ID
            params: Operation parameters

        Returns:
            API response data
        """
        if operation not in self._operations:
            raise ValueError(f"Unknown operation: {operation}")

        op = self._operations[operation]
        url = self._base_url + op["path"]
        method = op["method"]

        # Build request
        path_params = {}
        query_params = {}
        body = None
        headers = {}

        # Process parameters
        for param_def in op["parameters"]:
            name = param_def.get("name")
            location = param_def.get("in")

            if name in params:
                if location == "path":
                    path_params[name] = params[name]
                elif location == "query":
                    query_params[name] = params[name]
                elif location == "header":
                    headers[name] = params[name]

        # Handle request body
        if op.get("request_body") and "body" in params:
            body = params["body"]

        # Substitute path parameters
        for key, value in path_params.items():
            url = url.replace(f"{{{key}}}", str(value))

        # Add authentication
        if self.definition.authentication:
            auth = self.definition.authentication
            if auth.type == "bearer_token" and auth.token_env:
                import os

                token = os.environ.get(auth.token_env, "")
                if token:
                    headers["Authorization"] = f"Bearer {token}"

        # Make request
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                params=query_params,
                json=body,
                headers=headers,
            )
            response.raise_for_status()

            if response.headers.get("content-type", "").startswith("application/json"):
                return response.json()
            return response.text

    def list_operations(self) -> list[str]:
        """List available operations."""
        return list(self._operations.keys())

    def get_operation_schema(self, operation: str) -> dict[str, Any]:
        """Get schema for an operation."""
        if operation not in self._operations:
            return {}

        op = self._operations[operation]

        # Build parameter schema
        properties = {}
        required = []

        for param in op["parameters"]:
            name = param.get("name")
            schema = param.get("schema", {"type": "string"})
            properties[name] = {
                "type": schema.get("type", "string"),
                "description": param.get("description", ""),
            }
            if param.get("required"):
                required.append(name)

        # Add body if present
        if op.get("request_body"):
            content = op["request_body"].get("content", {})
            json_content = content.get("application/json", {})
            body_schema = json_content.get("schema", {})
            properties["body"] = body_schema
            if op["request_body"].get("required"):
                required.append("body")

        return {
            "description": op.get("description") or op.get("summary", ""),
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        }
