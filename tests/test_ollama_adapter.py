"""
Tests for Ollama Adapter.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from aiworkflow.agents.ollama import OllamaAdapter
from aiworkflow.agents.base import AgentConfig
from aiworkflow.core.models import (
    ExecutionContext, 
    Workflow, 
    WorkflowMetadata,
    WorkflowStep,
)

@pytest.fixture
def mock_httpx_client():
    with patch("httpx.AsyncClient") as mock:
        client = AsyncMock()
        mock.return_value = client
        yield client

@pytest.fixture
def adapter():
    config = AgentConfig(
        name="ollama",
        provider="ollama",
        api_base_url="http://test-ollama:11434",
        model="test-model"
    )
    return OllamaAdapter(config)

@pytest.fixture
def context(adapter):
    return ExecutionContext(
        run_id="test-run",
        workflow=Workflow(
            metadata=WorkflowMetadata(
                id="test",
                name="test",
                description="test",
                version="1.0.0",
            ),
            steps=[],
        ),
        agent_name="ollama",
        agent_capabilities=adapter.capabilities,
    )

@pytest.mark.asyncio
async def test_initialize(adapter, mock_httpx_client):
    # Setup mock response for tags check
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_httpx_client.get.return_value = mock_response

    await adapter.initialize()

    assert adapter._initialized
    mock_httpx_client.get.assert_called_with("/api/tags")

@pytest.mark.asyncio
async def test_generate_chat_success(adapter, mock_httpx_client, context):
    await adapter.initialize()

    # Setup mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {
            "content": "Hello world"
        }
    }
    mock_httpx_client.post.return_value = mock_response

    result = await adapter.generate("Say hello", context)

    assert result == "Hello world"
    mock_httpx_client.post.assert_called_with(
        "/api/chat",
        json={
            "model": "test-model",
            "messages": [{"role": "user", "content": "Say hello"}],
            "stream": False,
        }
    )

@pytest.mark.asyncio
async def test_generate_fallback_success(adapter, mock_httpx_client, context):
    await adapter.initialize()

    # Setup mock response for chat failure
    chat_response = MagicMock()
    chat_response.status_code = 404
    chat_response.raise_for_status.side_effect = RuntimeError("not found")
    
    # Setup mock response for generate success
    gen_response = MagicMock()
    gen_response.status_code = 200
    gen_response.json.return_value = {
        "response": "Hello fallback"
    }

    # Configure side effects
    async def side_effect(url, **kwargs):
        if url == "/api/chat":
            return chat_response
        if url == "/api/generate":
            return gen_response
        return MagicMock(status_code=404)

    mock_httpx_client.post.side_effect = side_effect

    result = await adapter.generate("Say hello", context)

    assert result == "Hello fallback"
    
    # Verify calls
    assert mock_httpx_client.post.call_count == 2
    # Check that fallback was called correctly
    mock_httpx_client.post.assert_called_with(
        "/api/generate",
        json={
            "model": "test-model",
            "prompt": "Say hello",
            "stream": False,
        }
    )

@pytest.mark.asyncio
async def test_analyze_with_schema(adapter, mock_httpx_client, context):
    await adapter.initialize()

    # Setup mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {
            "content": '{"analysis": "good"}'
        }
    }
    mock_httpx_client.post.return_value = mock_response

    schema = {"type": "object", "properties": {"analysis": {"type": "string"}}}
    result = await adapter.analyze("Analyze this", context, output_schema=schema)

    assert result == {"analysis": "good"}

@pytest.mark.asyncio
async def test_execute_step_generate(adapter, mock_httpx_client, context):
    await adapter.initialize()

    # Setup mock
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"message": {"content": "Generated content"}}
    mock_httpx_client.post.return_value = mock_response

    step = WorkflowStep(
        id="step1",
        name="Generate response",
        action="agent.generate_response",
        inputs={"requirements": ["Be concise"]}
    )

    result = await adapter.execute_step(step, context)

    assert result.status == "completed"
    assert result.output == "Generated content"
