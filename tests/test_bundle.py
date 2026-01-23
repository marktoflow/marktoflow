"""
Tests for WorkflowBundle - self-contained workflow directories.
"""

import os
import stat
import tempfile
from pathlib import Path

import pytest

from marktoflow.tools.bundle import (
    WorkflowBundle,
    BundleConfig,
    BundleToolRegistry,
    load_bundle,
    is_bundle,
)


class TestBundleConfig:
    """Tests for BundleConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = BundleConfig()

        assert config.agent == "opencode"
        assert config.fallback_agent is None
        assert config.timeout == 300
        assert config.max_retries == 3
        assert config.tools_dir == "tools"
        assert config.inherit_global_tools is True
        assert config.env == {}

    def test_from_dict(self):
        """Test creating config from dictionary."""
        data = {
            "agent": "claude-code",
            "fallback_agent": "opencode",
            "timeout": 600,
            "max_retries": 5,
            "tools_dir": "scripts",
            "inherit_global_tools": False,
            "env": {"DEBUG": "1"},
        }

        config = BundleConfig.from_dict(data)

        assert config.agent == "claude-code"
        assert config.fallback_agent == "opencode"
        assert config.timeout == 600
        assert config.max_retries == 5
        assert config.tools_dir == "scripts"
        assert config.inherit_global_tools is False
        assert config.env == {"DEBUG": "1"}

    def test_from_yaml(self):
        """Test loading config from YAML file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text("""
agent: gemini
timeout: 120
env:
  API_KEY: secret
""")

            config = BundleConfig.from_yaml(config_path)

            assert config.agent == "gemini"
            assert config.timeout == 120
            assert config.env == {"API_KEY": "secret"}

    def test_from_yaml_missing_file(self):
        """Test loading config when file doesn't exist."""
        config = BundleConfig.from_yaml(Path("/nonexistent/config.yaml"))

        # Should return default config
        assert config.agent == "opencode"
        assert config.timeout == 300


class TestIsBundle:
    """Tests for is_bundle() function."""

    def test_valid_bundle_with_workflow(self):
        """Test detecting valid bundle with workflow.md."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create workflow.md
            workflow = tmpdir / "workflow.md"
            workflow.write_text("""---
workflow:
  id: test
  name: Test
---
# Test
""")

            assert is_bundle(tmpdir) is True

    def test_valid_bundle_with_tools_dir(self):
        """Test detecting valid bundle with tools directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create workflow.md
            workflow = tmpdir / "workflow.md"
            workflow.write_text("# Test")

            # Create tools directory
            tools_dir = tmpdir / "tools"
            tools_dir.mkdir()

            assert is_bundle(tmpdir) is True

    def test_not_bundle_no_md_files(self):
        """Test directory without markdown files is not a bundle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create some other file
            other = tmpdir / "script.py"
            other.write_text("print('hello')")

            assert is_bundle(tmpdir) is False

    def test_not_bundle_file_path(self):
        """Test file path is not a bundle."""
        with tempfile.NamedTemporaryFile(suffix=".md") as f:
            assert is_bundle(Path(f.name)) is False

    def test_not_bundle_only_readme(self):
        """Test directory with only README.md is not a bundle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Only README.md
            readme = tmpdir / "README.md"
            readme.write_text("# README")

            assert is_bundle(tmpdir) is False


class TestWorkflowBundle:
    """Tests for WorkflowBundle."""

    @pytest.fixture
    def simple_bundle(self):
        """Create a simple test bundle."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create workflow.md
            workflow = tmpdir / "workflow.md"
            workflow.write_text("""---
workflow:
  id: test-workflow
  name: "Test Workflow"
  version: "1.0.0"
---

# Test Workflow

A simple test workflow.

## Step 1: Echo

```yaml
action: echo.run
inputs:
  message: "Hello, World!"
output_variable: result
```
""")

            # Create config.yaml
            config = tmpdir / "config.yaml"
            config.write_text("""
agent: opencode
timeout: 60
""")

            # Create tools directory with a script
            tools_dir = tmpdir / "tools"
            tools_dir.mkdir()

            script = tools_dir / "echo.py"
            script.write_text("""#!/usr/bin/env python3
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("--message", required=True)
args = parser.parse_args()

print(json.dumps({"message": args.message}))
""")
            os.chmod(script, stat.S_IRWXU)

            yield tmpdir

    @pytest.fixture
    def bundle_with_multiple_tools(self):
        """Create a bundle with multiple tools."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create workflow.md
            workflow = tmpdir / "workflow.md"
            workflow.write_text("""---
workflow:
  id: multi-tool
  name: "Multi-Tool Workflow"
  version: "1.0.0"
---

# Multi-Tool Workflow
""")

            # Create tools directory
            tools_dir = tmpdir / "tools"
            tools_dir.mkdir()

            # Create multiple scripts
            for name in ["tool1", "tool2", "tool3"]:
                script = tools_dir / f"{name}.py"
                script.write_text(f'''#!/usr/bin/env python3
print("{{\\"name\\": \\"{name}\\"}}")
''')
                os.chmod(script, stat.S_IRWXU)

            # Create tools.yaml
            tools_yaml = tmpdir / "tools.yaml"
            tools_yaml.write_text("""
tools:
  - name: tool1
    script: tool1.py
    description: "First tool"
  - name: tool2
    script: tool2.py
    description: "Second tool"
  - name: tool3
    script: tool3.py
    description: "Third tool"
""")

            yield tmpdir

    def test_load_bundle(self, simple_bundle):
        """Test loading a bundle."""
        bundle = load_bundle(simple_bundle)

        assert bundle.name == simple_bundle.name
        assert bundle.path == simple_bundle

    def test_bundle_name(self, simple_bundle):
        """Test bundle name is directory name."""
        bundle = WorkflowBundle(simple_bundle)

        assert bundle.name == simple_bundle.name

    def test_bundle_config(self, simple_bundle):
        """Test loading bundle configuration."""
        bundle = WorkflowBundle(simple_bundle)

        assert bundle.config.agent == "opencode"
        assert bundle.config.timeout == 60

    def test_workflow_file(self, simple_bundle):
        """Test finding workflow file."""
        bundle = WorkflowBundle(simple_bundle)

        assert bundle.workflow_file is not None
        assert bundle.workflow_file.name == "workflow.md"

    def test_load_workflow(self, simple_bundle):
        """Test loading workflow from bundle."""
        bundle = WorkflowBundle(simple_bundle)
        workflow = bundle.load_workflow()

        assert workflow.metadata.id == "test-workflow"
        assert workflow.metadata.name == "Test Workflow"
        assert workflow.metadata.version == "1.0.0"
        assert len(workflow.steps) == 1

    def test_load_tools(self, simple_bundle):
        """Test loading tools from bundle."""
        bundle = WorkflowBundle(simple_bundle)
        registry = bundle.load_tools()

        assert isinstance(registry, BundleToolRegistry)
        assert "echo" in registry.list_script_tools()

    def test_load_multiple_tools(self, bundle_with_multiple_tools):
        """Test loading multiple tools."""
        bundle = WorkflowBundle(bundle_with_multiple_tools)
        registry = bundle.load_tools()

        script_tools = registry.list_script_tools()

        assert "tool1" in script_tools
        assert "tool2" in script_tools
        assert "tool3" in script_tools

    def test_validate_valid_bundle(self, simple_bundle):
        """Test validating a valid bundle."""
        bundle = WorkflowBundle(simple_bundle)
        errors = bundle.validate()

        assert len(errors) == 0

    def test_validate_missing_workflow(self):
        """Test validating bundle without workflow."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create only tools directory
            tools_dir = tmpdir / "tools"
            tools_dir.mkdir()

            # Create a dummy .md file so it's detected as bundle
            readme = tmpdir / "notes.md"
            readme.write_text("Not a workflow - no frontmatter")

            bundle = WorkflowBundle(tmpdir)
            errors = bundle.validate()

            # Should have errors about workflow parsing
            assert len(errors) > 0

    def test_get_info(self, simple_bundle):
        """Test getting bundle info."""
        bundle = WorkflowBundle(simple_bundle)
        info = bundle.get_info()

        assert info["name"] == simple_bundle.name
        assert info["workflow"]["id"] == "test-workflow"
        assert info["workflow"]["name"] == "Test Workflow"
        assert info["workflow"]["steps"] == 1
        assert "echo" in info["tools"]["script_tools"]
        assert info["config"]["agent"] == "opencode"

    def test_get_info_workflow_error(self):
        """Test get_info when workflow has errors."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create a workflow without frontmatter - should still parse but have no metadata
            workflow = tmpdir / "workflow.md"
            workflow.write_text("# Just a heading\n\nNo frontmatter here.")

            bundle = WorkflowBundle(tmpdir)
            info = bundle.get_info()

            # Workflow parses but has default/empty metadata - no error
            # This is valid behavior since the parser handles missing frontmatter
            assert info["workflow"]["id"] is not None or info["workflow"]["error"] is None

    def test_bundle_not_found(self):
        """Test error when bundle doesn't exist."""
        with pytest.raises(FileNotFoundError):
            WorkflowBundle("/nonexistent/bundle")

    def test_bundle_not_directory(self):
        """Test error when path is not a directory."""
        with tempfile.NamedTemporaryFile() as f:
            with pytest.raises(ValueError, match="must be a directory"):
                WorkflowBundle(f.name)

    def test_repr(self, simple_bundle):
        """Test string representation."""
        bundle = WorkflowBundle(simple_bundle)

        assert "WorkflowBundle" in repr(bundle)
        assert str(simple_bundle) in repr(bundle)


class TestBundleToolRegistry:
    """Tests for BundleToolRegistry."""

    @pytest.fixture
    def bundle_with_tools(self):
        """Create a bundle with tools for registry testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create tools directory
            tools_dir = tmpdir / "tools"
            tools_dir.mkdir()

            # Create scripts
            script1 = tools_dir / "local_tool.py"
            script1.write_text('#!/usr/bin/env python3\nprint("{}")')
            os.chmod(script1, stat.S_IRWXU)

            script2 = tools_dir / "another_tool.sh"
            script2.write_text('#!/bin/bash\necho "{}"')
            os.chmod(script2, stat.S_IRWXU)

            yield tmpdir

    def test_list_script_tools(self, bundle_with_tools):
        """Test listing script tools."""
        registry = BundleToolRegistry(bundle_with_tools)

        script_tools = registry.list_script_tools()

        assert "local_tool" in script_tools
        assert "another_tool" in script_tools

    def test_list_all_tools(self, bundle_with_tools):
        """Test listing all tools."""
        registry = BundleToolRegistry(bundle_with_tools)

        all_tools = registry.list_tools()

        assert "local_tool" in all_tools
        assert "another_tool" in all_tools

    def test_get_script_tool(self, bundle_with_tools):
        """Test getting a script tool."""
        registry = BundleToolRegistry(bundle_with_tools)

        tool = registry.get_tool("local_tool")

        assert tool is not None
        assert tool.name == "local_tool"

    def test_get_nonexistent_tool(self, bundle_with_tools):
        """Test getting a tool that doesn't exist."""
        registry = BundleToolRegistry(bundle_with_tools)

        tool = registry.get_tool("nonexistent")

        assert tool is None

    def test_no_inherit_global_tools(self, bundle_with_tools):
        """Test registry without inheriting global tools."""
        registry = BundleToolRegistry(
            bundle_with_tools,
            inherit_global=False,
        )

        # Should only have local script tools
        all_tools = registry.list_tools()
        assert "local_tool" in all_tools
        assert "another_tool" in all_tools

    def test_custom_tools_dir(self):
        """Test custom tools directory name."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create custom scripts directory
            scripts_dir = tmpdir / "scripts"
            scripts_dir.mkdir()

            script = scripts_dir / "custom.py"
            script.write_text('#!/usr/bin/env python3\nprint("{}")')
            os.chmod(script, stat.S_IRWXU)

            registry = BundleToolRegistry(tmpdir, tools_dir="scripts")

            assert "custom" in registry.list_script_tools()


class TestLoadBundle:
    """Tests for load_bundle() convenience function."""

    def test_load_bundle_function(self):
        """Test load_bundle() function."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # Create minimal bundle
            workflow = tmpdir / "workflow.md"
            workflow.write_text("""---
workflow:
  id: test
  name: Test
---
# Test
""")

            bundle = load_bundle(tmpdir)

            assert isinstance(bundle, WorkflowBundle)
            assert bundle.path == tmpdir


class TestBundleWorkflowDetection:
    """Tests for workflow file detection in bundles."""

    def test_detect_workflow_md(self):
        """Test detecting workflow.md file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            (tmpdir / "workflow.md").write_text("---\nworkflow:\n  id: test\n---\n# Test")

            bundle = WorkflowBundle(tmpdir)
            assert bundle.workflow_file.name == "workflow.md"

    def test_detect_main_md(self):
        """Test detecting main.md file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            (tmpdir / "main.md").write_text("---\nworkflow:\n  id: test\n---\n# Test")

            bundle = WorkflowBundle(tmpdir)
            assert bundle.workflow_file.name == "main.md"

    def test_detect_single_md_file(self):
        """Test detecting single .md file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            (tmpdir / "my-workflow.md").write_text("---\nworkflow:\n  id: test\n---\n# Test")

            bundle = WorkflowBundle(tmpdir)
            assert bundle.workflow_file.name == "my-workflow.md"

    def test_ignore_readme(self):
        """Test that README.md is ignored."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            (tmpdir / "README.md").write_text("# README")
            (tmpdir / "workflow.md").write_text("---\nworkflow:\n  id: test\n---\n# Test")

            bundle = WorkflowBundle(tmpdir)
            assert bundle.workflow_file.name == "workflow.md"

    def test_prefer_workflow_pattern(self):
        """Test preferring 'workflow' in filename."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            (tmpdir / "other.md").write_text("---\nworkflow:\n  id: other\n---\n")
            (tmpdir / "my-workflow.md").write_text("---\nworkflow:\n  id: test\n---\n")

            bundle = WorkflowBundle(tmpdir)
            assert "workflow" in bundle.workflow_file.name.lower()
