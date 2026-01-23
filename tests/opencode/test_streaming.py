#!/usr/bin/env python3
"""
Test streaming support for OpenCode adapter.

Tests the _execute_via_server_stream method to ensure streaming works correctly.
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from marktoflow.agents.opencode import OpenCodeAdapter
from marktoflow.agents.base import AgentConfig
from marktoflow.core.models import ExecutionContext, Workflow, WorkflowMetadata


async def test_streaming_simple():
    """Test basic streaming functionality."""
    print("\n" + "=" * 60)
    print("Test 1: Simple Streaming")
    print("=" * 60)

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "server",
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized in {adapter._active_mode} mode")
        print(f"  Session ID: {adapter._session_id}")

        context = ExecutionContext(
            run_id="test-streaming-simple",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="test",
                    name="test",
                    description="test",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        print("\nStreaming response for: 'Write hello world in Python'")
        print("-" * 60)

        chunks = []
        async for chunk in adapter.generate_stream(
            prompt="Write a hello world function in Python. Keep it simple.",
            context=context,
        ):
            chunks.append(chunk)
            print(chunk, end="", flush=True)

        print()
        print("-" * 60)
        print(f"✓ Received {len(chunks)} chunk(s)")
        print(f"  Total length: {sum(len(c) for c in chunks)} characters")

        return len(chunks) > 0

    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_streaming_vs_regular():
    """Compare streaming vs regular generation."""
    print("\n" + "=" * 60)
    print("Test 2: Streaming vs Regular Generation")
    print("=" * 60)

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "server",
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()

        context = ExecutionContext(
            run_id="test-comparison",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="test",
                    name="test",
                    description="test",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        prompt = "Count from 1 to 5."

        # Test regular generation
        print("\n1. Regular generation:")
        print("-" * 60)
        regular_result = await adapter.generate(prompt, context)
        print(regular_result)
        print("-" * 60)

        # Test streaming generation
        print("\n2. Streaming generation:")
        print("-" * 60)
        streaming_result = ""
        async for chunk in adapter.generate_stream(prompt, context):
            streaming_result += chunk
            print(chunk, end="", flush=True)
        print()
        print("-" * 60)

        print(f"\n✓ Regular result length: {len(regular_result)}")
        print(f"✓ Streaming result length: {len(streaming_result)}")

        return True

    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_streaming_cli_fallback():
    """Test that CLI mode falls back gracefully."""
    print("\n" + "=" * 60)
    print("Test 3: CLI Mode Fallback (No Streaming)")
    print("=" * 60)

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "cli",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized in {adapter._active_mode} mode")

        context = ExecutionContext(
            run_id="test-cli-fallback",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="test",
                    name="test",
                    description="test",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        print("\nCLI mode streaming (should return full response):")
        print("-" * 60)

        chunks = []
        async for chunk in adapter.generate_stream(
            prompt="Say 'OK'",
            context=context,
        ):
            chunks.append(chunk)
            print(chunk, end="", flush=True)

        print()
        print("-" * 60)
        print(f"✓ Received {len(chunks)} chunk(s) (expected 1 in CLI mode)")

        return len(chunks) == 1  # CLI should return one chunk

    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def main():
    """Run streaming tests."""
    print("OpenCode Streaming Tests")
    print("=" * 60)
    print("Prerequisites:")
    print("  - OpenCode CLI installed")
    print("  - OpenCode configured")
    print("  - For server tests: opencode serve --port 4096")
    print()

    results = {}

    # Test 1: Simple streaming
    results["simple_streaming"] = await test_streaming_simple()

    # Test 2: Streaming vs regular
    results["streaming_vs_regular"] = await test_streaming_vs_regular()

    # Test 3: CLI fallback
    results["cli_fallback"] = await test_streaming_cli_fallback()

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    for name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{name:25s}: {status}")

    all_passed = all(results.values())
    print("=" * 60)

    if all_passed:
        print("✓ All streaming tests passed!")
    else:
        print("✗ Some streaming tests failed")

    print("=" * 60)

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
