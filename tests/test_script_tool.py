"""
Tests for ScriptTool - executable script tools.
"""

import asyncio
import json
import os
import stat
import tempfile
from pathlib import Path

import pytest

from aiworkflow.tools.script import (
    ScriptTool,
    ScriptToolLoader,
    ScriptOperation,
    ScriptToolConfig,
    create_script_tool,
)
from aiworkflow.tools.registry import ToolDefinition, ToolImplementation, ToolType


class TestScriptOperation:
    """Tests for ScriptOperation."""

    def test_create_operation(self):
        """Test creating a script operation."""
        op = ScriptOperation(
            name="run",
            script_path=Path("/tmp/script.py"),
            description="Test operation",
            parameters={"input": {"type": "string", "required": True}},
            timeout=60,
        )

        assert op.name == "run"
        assert op.script_path == Path("/tmp/script.py")
        assert op.description == "Test operation"
        assert op.timeout == 60

    def test_to_schema(self):
        """Test converting operation to JSON Schema."""
        op = ScriptOperation(
            name="process",
            script_path=Path("/tmp/script.py"),
            description="Process data",
            parameters={
                "input": {"type": "string", "required": True},
                "format": {"type": "string", "required": False},
            },
        )

        schema = op.to_schema()

        assert schema["description"] == "Process data"
        assert "parameters" in schema
        assert schema["parameters"]["type"] == "object"
        assert "input" in schema["parameters"]["properties"]
        assert "input" in schema["parameters"]["required"]
        assert "format" not in schema["parameters"]["required"]


class TestScriptToolConfig:
    """Tests for ScriptToolConfig."""

    def test_from_dict(self):
        """Test creating config from dictionary."""
        data = {
            "name": "my-tool",
            "script": "my_tool.py",
            "description": "My tool description",
            "timeout": 120,
            "env": {"API_KEY": "secret"},
        }

        config = ScriptToolConfig.from_dict(data)

        assert config.name == "my-tool"
        assert config.script == "my_tool.py"
        assert config.description == "My tool description"
        assert config.timeout == 120
        assert config.env == {"API_KEY": "secret"}

    def test_from_dict_defaults(self):
        """Test config with default values."""
        data = {
            "name": "minimal",
            "script": "minimal.sh",
        }

        config = ScriptToolConfig.from_dict(data)

        assert config.name == "minimal"
        assert config.description == ""
        assert config.timeout == 300
        assert config.env == {}


class TestScriptTool:
    """Tests for ScriptTool."""

    @pytest.fixture
    def temp_script_dir(self):
        """Create a temporary directory with test scripts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create a simple Python script
            script_path = tmpdir / "echo.py"
            script_path.write_text("""#!/usr/bin/env python3
import argparse
import json
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--message", required=True)
parser.add_argument("--uppercase", action="store_true")
args = parser.parse_args()

result = args.message
if args.uppercase:
    result = result.upper()

print(json.dumps({"result": result}))
""")
            os.chmod(script_path, stat.S_IRWXU)

            # Create a bash script
            bash_script = tmpdir / "greet.sh"
            bash_script.write_text("""#!/usr/bin/env bash
name=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --name=*) name="${1#*=}"; shift ;;
        *) shift ;;
    esac
done
echo "{\\"greeting\\": \\"Hello, $name!\\"}"
""")
            os.chmod(bash_script, stat.S_IRWXU)

            # Create a script with companion YAML
            multi_op_script = tmpdir / "calculator.py"
            multi_op_script.write_text("""#!/usr/bin/env python3
import argparse
import json
import sys

parser = argparse.ArgumentParser()
parser.add_argument("operation", choices=["add", "multiply"])
parser.add_argument("--a", type=int, required=True)
parser.add_argument("--b", type=int, required=True)
args = parser.parse_args()

if args.operation == "add":
    result = args.a + args.b
elif args.operation == "multiply":
    result = args.a * args.b
else:
    result = 0

print(json.dumps({"result": result}))
""")
            os.chmod(multi_op_script, stat.S_IRWXU)

            # Create companion YAML
            yaml_path = tmpdir / "calculator.yaml"
            yaml_path.write_text("""
description: "Calculator tool"
operations:
  add:
    description: "Add two numbers"
    parameters:
      a:
        type: integer
        required: true
      b:
        type: integer
        required: true
  multiply:
    description: "Multiply two numbers"
    parameters:
      a:
        type: integer
        required: true
      b:
        type: integer
        required: true
""")

            yield tmpdir

    def test_create_script_tool(self, temp_script_dir):
        """Test creating a script tool."""
        tool = create_script_tool(
            name="echo",
            script_path=temp_script_dir / "echo.py",
            description="Echo tool",
        )

        assert tool.name == "echo"
        assert tool.definition.description == "Echo tool"

    @pytest.mark.asyncio
    async def test_execute_python_script(self, temp_script_dir):
        """Test executing a Python script tool."""
        tool = create_script_tool(
            name="echo",
            script_path=temp_script_dir / "echo.py",
        )

        await tool.initialize()

        result = await tool.execute("run", {"message": "hello world"})

        assert result == {"result": "hello world"}

    @pytest.mark.asyncio
    async def test_execute_with_boolean_param(self, temp_script_dir):
        """Test executing with boolean parameter."""
        tool = create_script_tool(
            name="echo",
            script_path=temp_script_dir / "echo.py",
        )

        await tool.initialize()

        result = await tool.execute("run", {"message": "hello", "uppercase": True})

        assert result == {"result": "HELLO"}

    @pytest.mark.asyncio
    async def test_execute_bash_script(self, temp_script_dir):
        """Test executing a bash script tool."""
        tool = create_script_tool(
            name="greet",
            script_path=temp_script_dir / "greet.sh",
        )

        await tool.initialize()

        result = await tool.execute("run", {"name": "World"})

        assert result == {"greeting": "Hello, World!"}

    @pytest.mark.asyncio
    async def test_multi_operation_script(self, temp_script_dir):
        """Test script with multiple operations from YAML."""
        tool = create_script_tool(
            name="calculator",
            script_path=temp_script_dir / "calculator.py",
        )

        await tool.initialize()

        # Check operations were loaded
        operations = tool.list_operations()
        assert "add" in operations
        assert "multiply" in operations

        # Test add operation
        result = await tool.execute("add", {"a": 5, "b": 3})
        assert result == {"result": 8}

        # Test multiply operation
        result = await tool.execute("multiply", {"a": 4, "b": 7})
        assert result == {"result": 28}

    @pytest.mark.asyncio
    async def test_execute_unknown_operation(self, temp_script_dir):
        """Test executing unknown operation raises error."""
        tool = create_script_tool(
            name="echo",
            script_path=temp_script_dir / "echo.py",
        )

        await tool.initialize()

        with pytest.raises(ValueError, match="Unknown operation"):
            await tool.execute("unknown_op", {})

    @pytest.mark.asyncio
    async def test_script_not_found(self):
        """Test error when script doesn't exist."""
        tool = create_script_tool(
            name="missing",
            script_path="/nonexistent/script.py",
        )

        with pytest.raises(FileNotFoundError):
            await tool.initialize()


class TestScriptToolLoader:
    """Tests for ScriptToolLoader."""

    @pytest.fixture
    def temp_tools_dir(self):
        """Create a temporary tools directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create some executable scripts
            script1 = tmpdir / "tool1.py"
            script1.write_text('#!/usr/bin/env python3\nprint("{}")')
            os.chmod(script1, stat.S_IRWXU)

            script2 = tmpdir / "tool2.sh"
            script2.write_text('#!/bin/bash\necho "{}"')
            os.chmod(script2, stat.S_IRWXU)

            # Create a non-executable file (should be skipped based on extension on Windows)
            readme = tmpdir / "README.md"
            readme.write_text("# README")

            # Create tools.yaml manifest
            manifest = tmpdir / "tools.yaml"
            manifest.write_text("""
tools:
  - name: tool1
    script: tool1.py
    description: "First tool"
  - name: tool2
    script: tool2.sh
    description: "Second tool"
""")

            yield tmpdir

    def test_discover_scripts(self, temp_tools_dir):
        """Test discovering executable scripts."""
        loader = ScriptToolLoader(temp_tools_dir)

        scripts = loader.discover_scripts()

        assert "tool1" in scripts
        assert "tool2" in scripts
        assert len(scripts) == 2

    def test_load_manifest(self, temp_tools_dir):
        """Test loading tools.yaml manifest."""
        loader = ScriptToolLoader(temp_tools_dir)

        manifest = loader.load_manifest()

        assert "tool1" in manifest
        assert manifest["tool1"].description == "First tool"
        assert "tool2" in manifest
        assert manifest["tool2"].description == "Second tool"

    def test_load_tools(self, temp_tools_dir):
        """Test loading all tools."""
        loader = ScriptToolLoader(temp_tools_dir)

        tools = loader.load_tools()

        assert "tool1" in tools
        assert "tool2" in tools
        assert isinstance(tools["tool1"], ScriptTool)
        assert tools["tool1"].definition.description == "First tool"

    def test_get_tool(self, temp_tools_dir):
        """Test getting a specific tool."""
        loader = ScriptToolLoader(temp_tools_dir)

        tool = loader.get_tool("tool1")

        assert tool is not None
        assert tool.name == "tool1"

    def test_get_nonexistent_tool(self, temp_tools_dir):
        """Test getting a tool that doesn't exist."""
        loader = ScriptToolLoader(temp_tools_dir)

        tool = loader.get_tool("nonexistent")

        assert tool is None

    def test_empty_directory(self):
        """Test with empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            loader = ScriptToolLoader(Path(tmpdir))

            scripts = loader.discover_scripts()

            assert len(scripts) == 0

    def test_nonexistent_directory(self):
        """Test with nonexistent directory."""
        loader = ScriptToolLoader(Path("/nonexistent/path"))

        scripts = loader.discover_scripts()

        assert len(scripts) == 0
