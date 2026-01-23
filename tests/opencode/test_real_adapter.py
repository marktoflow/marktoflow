#!/usr/bin/env python3
"""
Test script to verify the marktoflow framework works with a real adapter.

This creates an OpenCode adapter configured to use a local provider (no API key needed)
and runs the test workflow.
"""

import asyncio
from pathlib import Path

from marktoflow.agents.base import AgentConfig
from marktoflow.agents.opencode import OpenCodeAdapter
from marktoflow.core.engine import WorkflowEngine
from marktoflow.core.parser import WorkflowParser


async def test_with_real_adapter():
    """Test the workflow execution with a real OpenCode adapter."""
    print("=" * 70)
    print("Testing marktoflow Framework with Real OpenCode Adapter")
    print("=" * 70)
    print()

    # 1. Parse the workflow
    print("Step 1: Parsing workflow...")
    workflow_path = Path(".marktoflow/workflows/test-simple.md")

    if not workflow_path.exists():
        print(f"ERROR: Workflow file not found: {workflow_path}")
        return False

    parser = WorkflowParser()
    workflow = parser.parse_file(workflow_path)

    print(f"  ✓ Workflow parsed: {workflow.metadata.name}")
    print(f"  ✓ Version: {workflow.metadata.version}")
    print(f"  ✓ Steps: {len(workflow.steps)}")
    print()

    # 2. Validate workflow
    print("Step 2: Validating workflow...")
    errors = parser.validate(workflow)
    if errors:
        print("  ✗ Validation errors:")
        for error in errors:
            print(f"    - {error}")
        return False
    print("  ✓ Workflow is valid")
    print()

    # 3. Check for available models
    print("Step 3: Checking for available LLM providers...")

    # Check if we have OpenAI package
    try:
        import openai

        print("  ✓ OpenAI package available")
        has_openai = True
    except ImportError:
        print("  ✗ OpenAI package not installed")
        has_openai = False

    # Check if we have Anthropic package
    try:
        import anthropic

        print("  ✓ Anthropic package available")
        has_anthropic = True
    except ImportError:
        print("  ✗ Anthropic package not installed")
        has_anthropic = False

    if not has_openai and not has_anthropic:
        print()
        print("  ✗ ERROR: No LLM provider packages available")
        print("  Install with: pip install openai  OR  pip install anthropic")
        return False

    print()

    # 4. Create OpenCode adapter
    print("Step 4: Creating OpenCode adapter...")
    print("  Note: This requires an API key to make actual LLM calls")
    print("  Checking for API keys...")

    import os

    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if not openai_key and not anthropic_key:
        print()
        print("  ✗ ERROR: No API keys found")
        print("  Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable")
        print()
        print("  Example:")
        print("    export OPENAI_API_KEY='your-key-here'")
        print("    python test_real_adapter.py")
        return False

    # Choose provider based on available key
    if openai_key:
        print("  ✓ Found OPENAI_API_KEY")
        config = AgentConfig(
            name="opencode",
            model="gpt-3.5-turbo",  # Cheaper model for testing
            provider="openai",
            api_key=openai_key,
        )
        print(f"  ✓ Using model: gpt-3.5-turbo")
    else:
        print("  ✓ Found ANTHROPIC_API_KEY")
        config = AgentConfig(
            name="opencode",
            model="claude-3-haiku-20240307",  # Cheaper model for testing
            provider="anthropic",
            api_key=anthropic_key,
        )
        print(f"  ✓ Using model: claude-3-haiku-20240307")

    adapter = OpenCodeAdapter(config)
    print("  ✓ Adapter created")
    print()

    # 5. Create engine with the adapter
    print("Step 5: Creating workflow engine...")
    engine = WorkflowEngine(agent_adapter=adapter)
    print("  ✓ Engine created")
    print()

    # 6. Execute workflow
    print("Step 6: Executing workflow with REAL LLM calls...")
    print("-" * 70)
    result = await engine.execute(workflow)
    print("-" * 70)
    print()

    # 7. Check results
    print("Step 7: Checking results...")
    print(f"  Run ID: {result.run_id}")
    print(f"  Success: {result.success}")
    print(
        f"  Duration: {result.duration_seconds:.2f}s"
        if result.duration_seconds
        else "  Duration: N/A"
    )
    print(f"  Steps completed: {result.steps_succeeded}/{len(result.step_results)}")
    print()

    if not result.success:
        print(f"  ✗ Workflow failed: {result.error}")
        print()
        print("Step results:")
        for i, step_result in enumerate(result.step_results, 1):
            print(f"  Step {i}: {step_result.status.value}")
            if step_result.error:
                print(f"    Error: {step_result.error}")
        return False

    # 8. Verify outputs
    print("Step 8: Verifying final outputs...")
    print(f"  Final output keys: {list(result.final_output.keys())}")
    print()

    expected_vars = ["greeting", "sentiment", "summary"]
    for var in expected_vars:
        if var in result.final_output:
            value = result.final_output[var]
            print(f"  ✓ {var}:")
            print(f"    {value}")
            print()
        else:
            print(f"  ✗ Missing variable: {var}")
            return False

    print("=" * 70)
    print("✓ All tests passed! Real OpenCode adapter works correctly.")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = asyncio.run(test_with_real_adapter())
    exit(0 if success else 1)
