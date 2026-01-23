#!/usr/bin/env python3
"""
Test script for OpenCode adapter.

Tests both CLI and Server modes to verify the implementation works correctly.

Usage:
    python test_opencode_adapter.py [mode]

    mode: cli, server, or auto (default: auto)
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from marktoflow.agents.opencode import OpenCodeAdapter
from marktoflow.agents.base import AgentConfig
from marktoflow.core.models import ExecutionContext, WorkflowStep, Workflow, WorkflowMetadata


async def test_cli_mode():
    """Test CLI mode execution."""
    print("\n" + "=" * 60)
    print("Testing CLI Mode")
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
        print(f"✓ Initialized successfully (mode: {adapter._active_mode})")

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
                agent_name="opencode",
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


async def test_server_mode():
    """Test Server mode execution."""
    print("\n" + "=" * 60)
    print("Testing Server Mode")
    print("=" * 60)
    print("Note: This requires 'opencode serve' to be running")
    print("      or opencode_server_autostart: true")
    print()

    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": "server",
            "opencode_server_url": "http://localhost:4096",
            "opencode_server_autostart": False,  # Set to True to auto-start
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()
        print(f"✓ Initialized successfully (mode: {adapter._active_mode})")
        print(f"  Session ID: {adapter._session_id}")

        # Test simple generation
        result = await adapter.generate(
            prompt="Write a Python function that multiplies two numbers. Keep it simple, just the code.",
            context=ExecutionContext(
                run_id="test-server",
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
        )

        print(f"✓ Generation successful")
        print(f"\nResult:\n{result}\n")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        if "server not running" in str(e).lower() or "connection" in str(e).lower():
            print("\nTip: Start the server with: opencode serve --port 4096")
            print("     Or enable auto-start in the config")
        return False
    finally:
        await adapter.cleanup()


async def test_auto_mode():
    """Test Auto mode execution (tries server, falls back to CLI)."""
    print("\n" + "=" * 60)
    print("Testing Auto Mode")
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
        print(f"✓ Initialized successfully (mode: {adapter._active_mode})")

        # Test simple generation
        result = await adapter.generate(
            prompt="Write a Python function that subtracts two numbers. Keep it simple, just the code.",
            context=ExecutionContext(
                run_id="test-auto",
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


async def main():
    """Run tests based on command line argument."""
    mode = sys.argv[1] if len(sys.argv) > 1 else "auto"

    print("OpenCode Adapter Test Suite")
    print(f"Mode: {mode}")
    print()
    print("Prerequisites:")
    print("  - OpenCode CLI installed (https://github.com/opencode-ai/opencode)")
    print("  - OpenCode configured with a provider (GitHub Copilot, local model, etc.)")
    print("    Run: opencode /connect")
    print()

    if mode == "cli":
        success = await test_cli_mode()
    elif mode == "server":
        success = await test_server_mode()
    elif mode == "auto":
        success = await test_auto_mode()
    elif mode == "all":
        print("Running all tests...")
        success = True
        success = await test_cli_mode() and success
        success = await test_server_mode() and success
        success = await test_auto_mode() and success
    else:
        print(f"Unknown mode: {mode}")
        print("Usage: python test_opencode_adapter.py [cli|server|auto|all]")
        sys.exit(1)

    print("\n" + "=" * 60)
    if success:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed")
    print("=" * 60)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
