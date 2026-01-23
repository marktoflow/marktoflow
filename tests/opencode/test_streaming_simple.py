#!/usr/bin/env python3
"""Simple streaming test"""
import asyncio
import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from aiworkflow.agents.opencode import OpenCodeAdapter
from aiworkflow.agents.base import AgentConfig
from aiworkflow.core.models import ExecutionContext, Workflow, WorkflowMetadata


async def test():
    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "server",
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)
    if not await adapter._check_server_available():
        pytest.skip("OpenCode server not running on localhost:4096")
    await adapter.initialize()

    print(f"✓ Initialized, session: {adapter._session_id}")
    print(f"✓ Mode: {adapter._active_mode}")

    context = ExecutionContext(
        run_id="test",
        workflow=Workflow(
            metadata=WorkflowMetadata(id="t", name="t", description="t", version="1.0.0"),
            steps=[],
        ),
        agent_name="opencode",
        agent_capabilities=adapter.capabilities,
    )

    print("\nTesting streaming:")
    print("-" * 40)

    try:
        chunks = []
        async for chunk in adapter.generate_stream("Say 'OK'", context):
            chunks.append(chunk)
            print(f"Chunk {len(chunks)}: {repr(chunk[:50])}")

        print("-" * 40)
        print(f"\n✓ Got {len(chunks)} chunks")
        print(f"✓ Total: {sum(len(c) for c in chunks)} chars")

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

    await adapter.cleanup()


if __name__ == "__main__":
    asyncio.run(test())
