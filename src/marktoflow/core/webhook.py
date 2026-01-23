"""
Webhook receiver for marktoflow framework.

Provides HTTP server for receiving external triggers and routing
them to appropriate workflows.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Awaitable
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

logger = logging.getLogger(__name__)


class WebhookStatus(Enum):
    """Status of a webhook endpoint."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


@dataclass
class WebhookEndpoint:
    """Configuration for a webhook endpoint."""

    id: str
    path: str
    workflow_id: str
    secret: str | None = None
    allowed_methods: list[str] = field(default_factory=lambda: ["POST"])
    enabled: bool = True
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    last_triggered: datetime | None = None
    trigger_count: int = 0


@dataclass
class WebhookEvent:
    """An incoming webhook event."""

    endpoint_id: str
    method: str
    path: str
    headers: dict[str, str]
    query_params: dict[str, list[str]]
    body: bytes
    received_at: datetime = field(default_factory=datetime.now)
    source_ip: str | None = None

    def get_json(self) -> dict[str, Any] | None:
        """Parse body as JSON."""
        try:
            return json.loads(self.body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def get_header(self, name: str, default: str | None = None) -> str | None:
        """Get header value (case-insensitive)."""
        for key, value in self.headers.items():
            if key.lower() == name.lower():
                return value
        return default


class WebhookHandler(BaseHTTPRequestHandler):
    """HTTP request handler for webhooks."""

    # Reference to the receiver (set by WebhookReceiver)
    receiver: "WebhookReceiver" = None  # type: ignore

    def log_message(self, format: str, *args) -> None:
        """Override to use our logger."""
        logger.debug(f"Webhook request: {format % args}")

    def _send_response(self, status: int, body: dict[str, Any]) -> None:
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))

    def _get_headers(self) -> dict[str, str]:
        """Get request headers as dict."""
        return {key: value for key, value in self.headers.items()}

    def _get_body(self) -> bytes:
        """Read request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(content_length) if content_length > 0 else b""

    def _handle_request(self, method: str) -> None:
        """Handle incoming webhook request."""
        if self.receiver is None:
            self._send_response(500, {"error": "Server not configured"})
            return

        # Parse URL
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = parse_qs(parsed.query)

        # Find matching endpoint
        endpoint = self.receiver.get_endpoint_by_path(path)
        if endpoint is None:
            self._send_response(404, {"error": "Endpoint not found"})
            return

        # Check if endpoint is enabled
        if not endpoint.enabled:
            self._send_response(503, {"error": "Endpoint is disabled"})
            return

        # Check method
        if method not in endpoint.allowed_methods:
            self._send_response(405, {"error": f"Method {method} not allowed"})
            return

        # Read body
        body = self._get_body()
        headers = self._get_headers()

        # Verify signature if secret is configured
        if endpoint.secret:
            if not self._verify_signature(endpoint.secret, body, headers):
                self._send_response(401, {"error": "Invalid signature"})
                return

        # Create event
        event = WebhookEvent(
            endpoint_id=endpoint.id,
            method=method,
            path=path,
            headers=headers,
            query_params=query_params,
            body=body,
            source_ip=self.client_address[0] if self.client_address else None,
        )

        # Process event
        try:
            result = self.receiver.process_event(event)
            self._send_response(
                200,
                {
                    "status": "accepted",
                    "event_id": event.endpoint_id,
                    "result": result,
                },
            )
        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            self._send_response(500, {"error": str(e)})

    def _verify_signature(
        self,
        secret: str,
        body: bytes,
        headers: dict[str, str],
    ) -> bool:
        """
        Verify webhook signature.

        Supports multiple signature formats:
        - X-Hub-Signature-256 (GitHub style)
        - X-Signature (generic HMAC-SHA256)
        """
        # Try GitHub-style signature
        github_sig = headers.get("X-Hub-Signature-256")
        if github_sig:
            expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            return hmac.compare_digest(github_sig, expected)

        # Try generic signature
        generic_sig = headers.get("X-Signature")
        if generic_sig:
            expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            return hmac.compare_digest(generic_sig, expected)

        # No signature provided
        return False

    def do_POST(self) -> None:
        """Handle POST request."""
        self._handle_request("POST")

    def do_GET(self) -> None:
        """Handle GET request."""
        self._handle_request("GET")

    def do_PUT(self) -> None:
        """Handle PUT request."""
        self._handle_request("PUT")

    def do_DELETE(self) -> None:
        """Handle DELETE request."""
        self._handle_request("DELETE")


class WebhookReceiver:
    """
    HTTP server for receiving webhook events.

    Routes incoming webhooks to appropriate workflow triggers.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8080,
        config_path: str | Path | None = None,
    ) -> None:
        """
        Initialize the webhook receiver.

        Args:
            host: Host to bind to
            port: Port to listen on
            config_path: Path to webhook configuration file
        """
        self.host = host
        self.port = port
        self.config_path = Path(config_path) if config_path else None
        self._endpoints: dict[str, WebhookEndpoint] = {}
        self._path_to_id: dict[str, str] = {}
        self._handlers: dict[str, Callable[[WebhookEvent], Any]] = {}
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._running = False

        if self.config_path and self.config_path.exists():
            self.load_config()

    def load_config(self) -> int:
        """
        Load webhook configuration from file.

        Returns:
            Number of endpoints loaded
        """
        if not self.config_path or not self.config_path.exists():
            return 0

        import yaml

        config = yaml.safe_load(self.config_path.read_text())
        endpoints = config.get("webhooks", [])

        for ep_config in endpoints:
            endpoint = WebhookEndpoint(
                id=ep_config["id"],
                path=ep_config["path"],
                workflow_id=ep_config["workflow_id"],
                secret=ep_config.get("secret"),
                allowed_methods=ep_config.get("methods", ["POST"]),
                enabled=ep_config.get("enabled", True),
                description=ep_config.get("description", ""),
            )
            self.register_endpoint(endpoint)

        return len(endpoints)

    def register_endpoint(self, endpoint: WebhookEndpoint) -> None:
        """Register a webhook endpoint."""
        self._endpoints[endpoint.id] = endpoint
        self._path_to_id[endpoint.path] = endpoint.id
        logger.info(f"Registered webhook endpoint: {endpoint.path} -> {endpoint.workflow_id}")

    def unregister_endpoint(self, endpoint_id: str) -> bool:
        """Unregister a webhook endpoint."""
        if endpoint_id in self._endpoints:
            endpoint = self._endpoints.pop(endpoint_id)
            del self._path_to_id[endpoint.path]
            return True
        return False

    def get_endpoint(self, endpoint_id: str) -> WebhookEndpoint | None:
        """Get endpoint by ID."""
        return self._endpoints.get(endpoint_id)

    def get_endpoint_by_path(self, path: str) -> WebhookEndpoint | None:
        """Get endpoint by path."""
        endpoint_id = self._path_to_id.get(path)
        return self._endpoints.get(endpoint_id) if endpoint_id else None

    def list_endpoints(self) -> list[WebhookEndpoint]:
        """List all registered endpoints."""
        return list(self._endpoints.values())

    def set_handler(
        self,
        endpoint_id: str,
        handler: Callable[[WebhookEvent], Any],
    ) -> None:
        """
        Set a handler for an endpoint.

        Args:
            endpoint_id: Endpoint to handle
            handler: Function to call with webhook events
        """
        self._handlers[endpoint_id] = handler

    def process_event(self, event: WebhookEvent) -> dict[str, Any]:
        """
        Process an incoming webhook event.

        Args:
            event: Webhook event to process

        Returns:
            Processing result
        """
        endpoint = self._endpoints.get(event.endpoint_id)
        if not endpoint:
            raise ValueError(f"Unknown endpoint: {event.endpoint_id}")

        # Update endpoint stats
        endpoint.last_triggered = datetime.now()
        endpoint.trigger_count += 1

        # Call handler if registered
        handler = self._handlers.get(event.endpoint_id)
        if handler:
            result = handler(event)
            return {"handler_result": result}

        # Default: return event info
        return {
            "workflow_id": endpoint.workflow_id,
            "payload": event.get_json(),
            "queued": True,
        }

    def start(self, blocking: bool = True) -> None:
        """
        Start the webhook server.

        Args:
            blocking: If True, block until server stops
        """
        # Create handler class with receiver reference
        handler_class = type(
            "BoundWebhookHandler",
            (WebhookHandler,),
            {"receiver": self},
        )

        self._server = HTTPServer((self.host, self.port), handler_class)
        self._running = True

        logger.info(f"Webhook receiver starting on {self.host}:{self.port}")

        if blocking:
            try:
                self._server.serve_forever()
            except KeyboardInterrupt:
                self.stop()
        else:
            self._thread = threading.Thread(target=self._server.serve_forever)
            self._thread.daemon = True
            self._thread.start()

    def stop(self) -> None:
        """Stop the webhook server."""
        if self._server:
            self._server.shutdown()
            self._running = False
            logger.info("Webhook receiver stopped")

    @property
    def is_running(self) -> bool:
        """Check if server is running."""
        return self._running

    def generate_signature(self, secret: str, payload: bytes) -> str:
        """
        Generate a signature for testing/verification.

        Args:
            secret: Webhook secret
            payload: Request body

        Returns:
            HMAC-SHA256 signature
        """
        return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


class AsyncWebhookReceiver:
    """
    Async HTTP server for receiving webhook events.

    Uses asyncio for non-blocking operation.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 8080,
    ) -> None:
        """
        Initialize the async webhook receiver.

        Args:
            host: Host to bind to
            port: Port to listen on
        """
        self.host = host
        self.port = port
        self._endpoints: dict[str, WebhookEndpoint] = {}
        self._path_to_id: dict[str, str] = {}
        self._handlers: dict[str, Callable[[WebhookEvent], Awaitable[Any]]] = {}
        self._server: asyncio.Server | None = None
        self._running = False

    def register_endpoint(self, endpoint: WebhookEndpoint) -> None:
        """Register a webhook endpoint."""
        self._endpoints[endpoint.id] = endpoint
        self._path_to_id[endpoint.path] = endpoint.id

    def set_handler(
        self,
        endpoint_id: str,
        handler: Callable[[WebhookEvent], Awaitable[Any]],
    ) -> None:
        """Set an async handler for an endpoint."""
        self._handlers[endpoint_id] = handler

    async def start(self) -> None:
        """Start the async webhook server."""
        try:
            # Try to use aiohttp if available
            from aiohttp import web

            app = web.Application()
            app.router.add_route("*", "/{path:.*}", self._handle_aiohttp)

            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, self.host, self.port)
            await site.start()

            self._running = True
            logger.info(f"Async webhook receiver started on {self.host}:{self.port}")

            # Keep running
            while self._running:
                await asyncio.sleep(1)

        except ImportError:
            logger.warning("aiohttp not available, using basic asyncio server")
            # Fallback to basic implementation
            self._server = await asyncio.start_server(
                self._handle_connection,
                self.host,
                self.port,
            )
            self._running = True

            async with self._server:
                await self._server.serve_forever()

    async def _handle_aiohttp(self, request: Any) -> Any:
        """Handle request using aiohttp."""
        from aiohttp import web

        path = "/" + request.match_info.get("path", "")
        endpoint = self._endpoints.get(self._path_to_id.get(path, ""))

        if not endpoint:
            return web.json_response({"error": "Not found"}, status=404)

        body = await request.read()
        headers = dict(request.headers)

        event = WebhookEvent(
            endpoint_id=endpoint.id,
            method=request.method,
            path=path,
            headers=headers,
            query_params=dict(request.query),
            body=body,
        )

        handler = self._handlers.get(endpoint.id)
        if handler:
            result = await handler(event)
            return web.json_response({"status": "ok", "result": result})

        return web.json_response({"status": "accepted"})

    async def _handle_connection(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle raw TCP connection (basic fallback)."""
        # Basic HTTP parsing - in production use aiohttp
        data = await reader.read(4096)

        # Parse first line
        lines = data.decode().split("\r\n")
        if not lines:
            writer.close()
            return

        first_line = lines[0].split()
        if len(first_line) < 2:
            writer.close()
            return

        method, path = first_line[0], first_line[1]

        # Send basic response
        response = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"status": "accepted"}'
        writer.write(response.encode())
        await writer.drain()
        writer.close()

    def stop(self) -> None:
        """Stop the async webhook server."""
        self._running = False
        if self._server:
            self._server.close()
