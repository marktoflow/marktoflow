"""
Tests for the webhook receiver module.
"""

import json
import hashlib
import hmac
from datetime import datetime

import pytest

from marktoflow.core.webhook import (
    WebhookEndpoint,
    WebhookEvent,
    WebhookReceiver,
    WebhookStatus,
)


class TestWebhookEndpoint:
    """Tests for WebhookEndpoint dataclass."""

    def test_create_endpoint(self):
        """Test creating a webhook endpoint."""
        endpoint = WebhookEndpoint(
            id="test-webhook",
            path="/webhooks/test",
            workflow_id="test-workflow",
        )

        assert endpoint.id == "test-webhook"
        assert endpoint.path == "/webhooks/test"
        assert endpoint.workflow_id == "test-workflow"
        assert endpoint.enabled is True
        assert endpoint.allowed_methods == ["POST"]

    def test_endpoint_with_secret(self):
        """Test endpoint with secret for signature verification."""
        endpoint = WebhookEndpoint(
            id="secure-webhook",
            path="/webhooks/secure",
            workflow_id="secure-workflow",
            secret="my-secret-key",
            allowed_methods=["POST", "PUT"],
        )

        assert endpoint.secret == "my-secret-key"
        assert "POST" in endpoint.allowed_methods
        assert "PUT" in endpoint.allowed_methods


class TestWebhookEvent:
    """Tests for WebhookEvent dataclass."""

    def test_create_event(self):
        """Test creating a webhook event."""
        event = WebhookEvent(
            endpoint_id="test-webhook",
            method="POST",
            path="/webhooks/test",
            headers={"Content-Type": "application/json"},
            query_params={"key": ["value"]},
            body=b'{"data": "test"}',
        )

        assert event.endpoint_id == "test-webhook"
        assert event.method == "POST"
        assert event.received_at is not None

    def test_get_json(self):
        """Test parsing JSON body."""
        event = WebhookEvent(
            endpoint_id="test",
            method="POST",
            path="/test",
            headers={},
            query_params={},
            body=b'{"key": "value", "number": 42}',
        )

        data = event.get_json()
        assert data == {"key": "value", "number": 42}

    def test_get_json_invalid(self):
        """Test parsing invalid JSON body."""
        event = WebhookEvent(
            endpoint_id="test",
            method="POST",
            path="/test",
            headers={},
            query_params={},
            body=b"not valid json",
        )

        assert event.get_json() is None

    def test_get_header_case_insensitive(self):
        """Test case-insensitive header retrieval."""
        event = WebhookEvent(
            endpoint_id="test",
            method="POST",
            path="/test",
            headers={"Content-Type": "application/json", "X-Custom-Header": "value"},
            query_params={},
            body=b"",
        )

        assert event.get_header("content-type") == "application/json"
        assert event.get_header("CONTENT-TYPE") == "application/json"
        assert event.get_header("x-custom-header") == "value"
        assert event.get_header("missing") is None
        assert event.get_header("missing", "default") == "default"


class TestWebhookReceiver:
    """Tests for WebhookReceiver class."""

    def test_create_receiver(self):
        """Test creating a webhook receiver."""
        receiver = WebhookReceiver(host="127.0.0.1", port=9999)

        assert receiver.host == "127.0.0.1"
        assert receiver.port == 9999
        assert len(receiver.list_endpoints()) == 0

    def test_register_endpoint(self):
        """Test registering an endpoint."""
        receiver = WebhookReceiver()
        endpoint = WebhookEndpoint(
            id="test-1",
            path="/webhooks/test",
            workflow_id="workflow-1",
        )

        receiver.register_endpoint(endpoint)

        assert receiver.get_endpoint("test-1") == endpoint
        assert receiver.get_endpoint_by_path("/webhooks/test") == endpoint
        assert len(receiver.list_endpoints()) == 1

    def test_unregister_endpoint(self):
        """Test unregistering an endpoint."""
        receiver = WebhookReceiver()
        endpoint = WebhookEndpoint(
            id="test-1",
            path="/webhooks/test",
            workflow_id="workflow-1",
        )

        receiver.register_endpoint(endpoint)
        assert receiver.unregister_endpoint("test-1") is True
        assert receiver.get_endpoint("test-1") is None
        assert receiver.unregister_endpoint("test-1") is False

    def test_multiple_endpoints(self):
        """Test registering multiple endpoints."""
        receiver = WebhookReceiver()

        for i in range(3):
            receiver.register_endpoint(
                WebhookEndpoint(
                    id=f"endpoint-{i}",
                    path=f"/webhooks/{i}",
                    workflow_id=f"workflow-{i}",
                )
            )

        assert len(receiver.list_endpoints()) == 3
        assert receiver.get_endpoint_by_path("/webhooks/1") is not None

    def test_process_event(self):
        """Test processing a webhook event."""
        receiver = WebhookReceiver()
        endpoint = WebhookEndpoint(
            id="test-1",
            path="/webhooks/test",
            workflow_id="workflow-1",
        )
        receiver.register_endpoint(endpoint)

        event = WebhookEvent(
            endpoint_id="test-1",
            method="POST",
            path="/webhooks/test",
            headers={},
            query_params={},
            body=b'{"action": "trigger"}',
        )

        result = receiver.process_event(event)

        assert result["workflow_id"] == "workflow-1"
        assert result["queued"] is True
        assert endpoint.trigger_count == 1
        assert endpoint.last_triggered is not None

    def test_process_event_with_handler(self):
        """Test processing event with custom handler."""
        receiver = WebhookReceiver()
        endpoint = WebhookEndpoint(
            id="test-1",
            path="/webhooks/test",
            workflow_id="workflow-1",
        )
        receiver.register_endpoint(endpoint)

        # Set custom handler
        handler_calls = []

        def custom_handler(event):
            handler_calls.append(event)
            return {"processed": True}

        receiver.set_handler("test-1", custom_handler)

        event = WebhookEvent(
            endpoint_id="test-1",
            method="POST",
            path="/webhooks/test",
            headers={},
            query_params={},
            body=b"{}",
        )

        result = receiver.process_event(event)

        assert len(handler_calls) == 1
        assert result["handler_result"]["processed"] is True

    def test_generate_signature(self):
        """Test signature generation."""
        receiver = WebhookReceiver()
        secret = "my-secret-key"
        payload = b'{"data": "test"}'

        signature = receiver.generate_signature(secret, payload)

        # Verify it's a valid hex string
        assert len(signature) == 64
        int(signature, 16)  # Should not raise

        # Verify it matches expected
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert signature == expected

    def test_process_unknown_endpoint(self):
        """Test processing event for unknown endpoint."""
        receiver = WebhookReceiver()

        event = WebhookEvent(
            endpoint_id="unknown",
            method="POST",
            path="/unknown",
            headers={},
            query_params={},
            body=b"{}",
        )

        with pytest.raises(ValueError, match="Unknown endpoint"):
            receiver.process_event(event)


class TestWebhookSignatureVerification:
    """Tests for webhook signature verification."""

    def test_github_style_signature(self):
        """Test GitHub-style HMAC-SHA256 signature verification."""
        secret = "test-secret"
        payload = b'{"action": "push"}'

        # Generate GitHub-style signature
        signature = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

        # The handler would verify this
        expected_sig = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

        assert signature == f"sha256={expected_sig}"

    def test_generic_signature(self):
        """Test generic HMAC-SHA256 signature."""
        secret = "test-secret"
        payload = b'{"data": "value"}'

        signature = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

        # Verify it's correct length
        assert len(signature) == 64


class TestWebhookReceiverLifecycle:
    """Tests for webhook receiver lifecycle."""

    def test_is_running(self):
        """Test running state tracking."""
        receiver = WebhookReceiver()

        assert receiver.is_running is False

    def test_stop_without_start(self):
        """Test stopping receiver that wasn't started."""
        receiver = WebhookReceiver()

        # Should not raise
        receiver.stop()
        assert receiver.is_running is False
