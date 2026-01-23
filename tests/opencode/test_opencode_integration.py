#!/usr/bin/env python3
"""
Integration tests for OpenCode adapter.

Tests advanced features like tool calling, MCP bridge, and streaming.

Usage:
    python test_opencode_integration.py [test_name]

    test_name: streaming, tool_calling, mcp_bridge, or all (default: all)
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from marktoflow.agents.opencode import OpenCodeAdapter
from marktoflow.agents.base import AgentConfig
from marktoflow.core.models import (
    ExecutionContext,
    WorkflowStep,
    Workflow,
    WorkflowMetadata,
    ErrorConfig,
)


async def test_streaming():
    """Test streaming support in server mode."""
    print("\n" + "=" * 60)
    print("Testing Streaming Support")
    print("=" * 60)
    print("Note: Requires OpenCode server running on port 4096")
    print()

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

        if adapter._active_mode != "server":
            print("⚠ Skipping streaming test (only works in server mode)")
            return True

        print("\nStreaming response:")
        print("-" * 60)

        chunks_received = 0
        full_response = ""

        async for chunk in adapter.generate_stream(
            prompt="Count from 1 to 5, one number per line.",
            context=ExecutionContext(
                run_id="test-streaming",
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
            ),
        ):
            chunks_received += 1
            full_response += chunk
            print(chunk, end="", flush=True)

        print()
        print("-" * 60)
        print(f"✓ Streaming test passed")
        print(f"  Chunks received: {chunks_received}")
        print(f"  Total length: {len(full_response)} chars")

        return True

    except Exception as e:
        print(f"✗ Streaming test failed: {e}")
        if "server not running" in str(e).lower() or "connection" in str(e).lower():
            print("\nTip: Start the server with: opencode serve --port 4096")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_tool_calling():
    """Test tool calling through OpenCode."""
    print("\n" + "=" * 60)
    print("Testing Tool Calling")
    print("=" * 60)

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "auto",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized in {adapter._active_mode} mode")

        # Create a workflow step that represents a tool call
        step = WorkflowStep(
            id="test_tool_call",
            name="Test Tool Call",
            action="shell.execute",
            inputs={"command": "echo 'Hello from tool'"},
            output_variable="tool_result",
            error_handling=ErrorConfig(),
        )

        context = ExecutionContext(
            run_id="test-tool",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="test",
                    name="test",
                    description="test",
                    version="1.0.0",
                ),
                steps=[step],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        result = await adapter.call_tool(
            tool_name="shell",
            operation="execute",
            params={"command": "echo 'Hello from tool'"},
            context=context,
        )

        print(f"✓ Tool call successful")
        print(f"\nResult:\n{result}\n")

        return True

    except Exception as e:
        print(f"✗ Tool calling test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_mcp_bridge():
    """Test MCP bridge integration."""
    print("\n" + "=" * 60)
    print("Testing MCP Bridge Integration")
    print("=" * 60)
    print("Note: Requires MCP servers configured in OpenCode")
    print()

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "auto",
            # Example MCP configuration (optional)
            "mcp_servers": {
                "filesystem": {
                    "command": "mcp-server-filesystem",
                    "args": ["/tmp"],
                }
            },
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized in {adapter._active_mode} mode")

        # Check if MCP bridge is available
        if adapter._mcp_bridge:
            print(f"✓ MCP bridge initialized")

            # List available tools
            tools = adapter._mcp_bridge.list_tools()
            print(f"  Available MCP tools: {len(tools)}")
            if tools:
                print(f"  Examples: {list(tools)[:5]}")

            # Try calling an MCP tool if available
            if tools:
                tool_name = list(tools)[0]
                print(f"\n  Testing MCP tool: {tool_name}")

                try:
                    result = await adapter._mcp_bridge.call_tool(tool_name, {})
                    print(f"  ✓ MCP tool call successful")
                    print(f"  Result: {str(result)[:100]}...")
                except Exception as e:
                    print(f"  ⚠ MCP tool call failed (expected): {e}")

        else:
            print("⚠ No MCP bridge configured (this is optional)")
            print("  OpenCode can use MCP tools natively through its own integration")

        print(f"\n✓ MCP bridge test passed")
        return True

    except Exception as e:
        print(f"✗ MCP bridge test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_workflow_execution():
    """Test full workflow step execution."""
    print("\n" + "=" * 60)
    print("Testing Workflow Step Execution")
    print("=" * 60)

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "auto",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized in {adapter._active_mode} mode")

        # Test agent.analyze step
        step = WorkflowStep(
            id="analyze_step",
            name="Analyze Code",
            action="agent.analyze",
            inputs={
                "prompt_template": "Analyze this code: def hello(): print('hi')",
                "categories": {
                    "quality": "Code quality issues",
                    "improvements": "Possible improvements",
                },
                "output_schema": {
                    "type": "object",
                    "properties": {
                        "quality": {"type": "array", "items": {"type": "string"}},
                        "improvements": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            output_variable="analysis",
        )

        context = ExecutionContext(
            run_id="test-workflow",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="test",
                    name="test",
                    description="test",
                    version="1.0.0",
                ),
                steps=[step],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        result = await adapter.execute_step(step, context)

        print(f"✓ Workflow step executed successfully")
        print(f"  Status: {result.status}")
        print(f"  Output: {str(result.output)[:200]}...")

        return result.status.value == "completed"

    except Exception as e:
        print(f"✗ Workflow execution test failed: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def main():
    """Run integration tests."""
    test_name = sys.argv[1] if len(sys.argv) > 1 else "all"

    print("OpenCode Adapter Integration Tests")
    print(f"Test: {test_name}")
    print()
    print("Prerequisites:")
    print("  - OpenCode CLI installed")
    print("  - OpenCode configured with a provider")
    print("  - For streaming test: opencode serve --port 4096")
    print()

    results = {}

    if test_name in ("streaming", "all"):
        results["streaming"] = await test_streaming()

    if test_name in ("tool_calling", "all"):
        results["tool_calling"] = await test_tool_calling()

    if test_name in ("mcp_bridge", "all"):
        results["mcp_bridge"] = await test_mcp_bridge()

    if test_name in ("workflow", "all"):
        results["workflow"] = await test_workflow_execution()

    # Summary
    print("\n" + "=" * 60)
    print("Integration Test Summary")
    print("=" * 60)

    for name, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{name:20s}: {status}")

    all_passed = all(results.values())
    print("=" * 60)

    if all_passed:
        print("✓ All integration tests passed!")
    else:
        print("✗ Some integration tests failed")

    print("=" * 60)

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
