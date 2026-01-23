#!/usr/bin/env python3
"""
Test script for Claude Code adapter.

Tests CLI mode execution to verify the implementation works correctly.

Usage:
    python tests/claude-code/test_claude_code_adapter.py
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from marktoflow.agents.claude_code import ClaudeCodeAdapter
from marktoflow.agents.base import AgentConfig
from marktoflow.core.models import ExecutionContext, Workflow, WorkflowMetadata


async def test_cli_mode():
    """Test CLI mode execution."""
    print("\n" + "=" * 60)
    print("Testing Claude Code CLI Mode")
    print("=" * 60)

    config = AgentConfig(
        name="claude-code",
        provider="anthropic",
        extra={
            "claude_code_mode": "cli",
            "claude_code_model": "sonnet",
        },
    )

    adapter = ClaudeCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized successfully")
        print(f"  Name: {adapter.name}")
        print(f"  Provider: {adapter.capabilities.provider}")
        print(f"  Model: {config.extra.get('claude_code_model')}")

        # Test simple generation
        result = await adapter.generate(
            prompt="Write a Python function that adds two numbers. Keep it simple, just the code.",
            context=ExecutionContext(
                run_id="test-cli",
                workflow=Workflow(
                    metadata=WorkflowMetadata(
                        id="test",
                        name="test",
                        description="test",
                        version="1.0.0",
                    ),
                    steps=[],
                ),
                agent_name="claude-code",
                agent_capabilities=adapter.capabilities,
            ),
        )

        print(f"✓ Generation successful")
        print(f"\nResult:\n{result}\n")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_json_generation():
    """Test JSON generation with schema."""
    print("\n" + "=" * 60)
    print("Testing JSON Generation")
    print("=" * 60)

    config = AgentConfig(
        name="claude-code",
        provider="anthropic",
        extra={
            "claude_code_mode": "cli",
            "claude_code_model": "sonnet",
        },
    )

    adapter = ClaudeCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized successfully")

        schema = {
            "type": "object",
            "properties": {
                "function_name": {"type": "string"},
                "parameters": {"type": "array", "items": {"type": "string"}},
                "returns": {"type": "string"},
            },
        }

        result = await adapter.analyze(
            prompt="Analyze this function signature: def multiply(a, b): return a * b",
            context=ExecutionContext(
                run_id="test-json",
                workflow=Workflow(
                    metadata=WorkflowMetadata(
                        id="test",
                        name="test",
                        description="test",
                        version="1.0.0",
                    ),
                    steps=[],
                ),
                agent_name="claude-code",
                agent_capabilities=adapter.capabilities,
            ),
            output_schema=schema,
        )

        print(f"✓ JSON generation successful")
        print(f"\nResult:\n{result}\n")
        print(f"Type: {type(result)}")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def test_capabilities():
    """Test capability reporting."""
    print("\n" + "=" * 60)
    print("Testing Capabilities")
    print("=" * 60)

    config = AgentConfig(
        name="claude-code",
        provider="anthropic",
        extra={
            "claude_code_mode": "cli",
        },
    )

    adapter = ClaudeCodeAdapter(config)

    try:
        await adapter.initialize()
        caps = adapter.capabilities

        print(f"✓ Capabilities:")
        print(f"  Name: {caps.name}")
        print(f"  Provider: {caps.provider}")
        print(f"  Tool Calling: {caps.tool_calling}")
        print(f"  Reasoning: {caps.reasoning}")
        print(f"  Streaming: {caps.streaming}")
        print(f"  Code Execution: {caps.code_execution}")
        print(f"  MCP Native: {caps.mcp_native}")
        print(f"  Extended Reasoning: {caps.extended_reasoning}")
        print(f"  Context Window: {caps.context_window}")

        print(f"\n✓ Feature Support:")
        print(f"  Supports tool_calling: {adapter.supports_feature('tool_calling')}")
        print(f"  Supports mcp: {adapter.supports_feature('mcp_native')}")
        print(f"  Supports extended_reasoning: {adapter.supports_feature('extended_reasoning')}")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return False
    finally:
        await adapter.cleanup()


async def main():
    """Run tests."""
    print("Claude Code Adapter Test Suite")
    print()
    print("Prerequisites:")
    print("  - Claude Code CLI installed (claude --version)")
    print("  - Anthropic API key set (export ANTHROPIC_API_KEY=...)")
    print()

    results = {}

    # Test 1: CLI mode
    results["cli_mode"] = await test_cli_mode()

    # Test 2: JSON generation
    results["json_generation"] = await test_json_generation()

    # Test 3: Capabilities
    results["capabilities"] = await test_capabilities()

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
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed")

    print("=" * 60)

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
