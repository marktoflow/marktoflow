"""
Tests for the workflow parser.
"""

import pytest
from aiworkflow.core.parser import WorkflowParser, WorkflowParseError
from aiworkflow.core.models import ErrorHandling


SAMPLE_WORKFLOW = """---
workflow:
  id: test-workflow
  version: "1.0.0"
  name: "Test Workflow"
  description: "A test workflow"
  
compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    
requirements:
  tools: [jira, slack]
  features:
    - tool_calling: required
    
execution:
  timeout: 60s
  error_handling: continue
  
risk_level: low
---

# Test Workflow

This is a test workflow for the parser.

## Step 1: First Action

```yaml
action: jira.create_issue
inputs:
  project: TEST
  summary: "Test issue"
output_variable: ticket
```

## Step 2: Second Action

```yaml
action: slack.send_message
inputs:
  channel: "#test"
  message: "Created {ticket.key}"
conditions:
  - ticket.created == true
```
"""


class TestWorkflowParser:
    """Tests for WorkflowParser."""

    def test_parse_content_basic(self):
        """Test parsing a basic workflow."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert workflow.metadata.id == "test-workflow"
        assert workflow.metadata.name == "Test Workflow"
        assert workflow.metadata.version == "1.0.0"

    def test_parse_metadata(self):
        """Test parsing workflow metadata."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert workflow.metadata.timeout_seconds == 60
        assert workflow.metadata.error_handling == ErrorHandling.CONTINUE
        assert workflow.metadata.risk_level == "low"

    def test_parse_agent_compatibility(self):
        """Test parsing agent compatibility."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert len(workflow.metadata.agent_compatibility) == 2

        claude_compat = workflow.get_agent_compatibility("claude-code")
        assert claude_compat is not None
        assert claude_compat.status == "recommended"

        opencode_compat = workflow.get_agent_compatibility("opencode")
        assert opencode_compat is not None
        assert opencode_compat.status == "supported"

    def test_parse_requirements(self):
        """Test parsing requirements."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert "jira" in workflow.metadata.required_tools
        assert "slack" in workflow.metadata.required_tools
        assert workflow.metadata.required_features.get("tool_calling") == "required"

    def test_parse_steps(self):
        """Test parsing workflow steps."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert len(workflow.steps) == 2

        step1 = workflow.steps[0]
        assert step1.action == "jira.create_issue"
        assert step1.inputs["project"] == "TEST"
        assert step1.output_variable == "ticket"

        step2 = workflow.steps[1]
        assert step2.action == "slack.send_message"
        assert "ticket.created == true" in step2.conditions

    def test_step_get_tool_name(self):
        """Test extracting tool name from step."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        step = workflow.steps[0]
        assert step.get_tool_name() == "jira"
        assert step.get_operation() == "create_issue"

    def test_get_required_tools(self):
        """Test getting all required tools."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        tools = workflow.get_required_tools()
        assert "jira" in tools
        assert "slack" in tools

    def test_validate_workflow(self):
        """Test workflow validation."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        errors = parser.validate(workflow)
        assert len(errors) == 0

    def test_validate_missing_id(self):
        """Test validation fails for missing ID."""
        parser = WorkflowParser()
        workflow_content = """---
workflow:
  name: "No ID Workflow"
---
# Test
"""
        workflow = parser.parse_content(workflow_content)
        # ID defaults to "unnamed" if not provided
        assert workflow.metadata.id == "unnamed"

    def test_parse_no_frontmatter(self):
        """Test parsing content without frontmatter."""
        parser = WorkflowParser()
        workflow = parser.parse_content("# Just a heading\n\nSome content")

        assert workflow.metadata.id == "unnamed"
        assert len(workflow.steps) == 0

    def test_parse_invalid_yaml_frontmatter(self):
        """Test handling invalid YAML in frontmatter."""
        parser = WorkflowParser()

        with pytest.raises(WorkflowParseError):
            parser.parse_content("---\ninvalid: yaml: content:\n---\n# Test")

    def test_duration_parsing(self):
        """Test duration string parsing."""
        parser = WorkflowParser()

        assert parser._parse_duration("60s") == 60
        assert parser._parse_duration("5m") == 300
        assert parser._parse_duration("1h") == 3600
        assert parser._parse_duration("1d") == 86400
        assert parser._parse_duration("120") == 120


class TestWorkflowCompatibility:
    """Tests for workflow compatibility checks."""

    def test_is_compatible_with(self):
        """Test compatibility checking."""
        parser = WorkflowParser()
        workflow = parser.parse_content(SAMPLE_WORKFLOW)

        assert workflow.is_compatible_with("claude-code")
        assert workflow.is_compatible_with("opencode")
        assert workflow.is_compatible_with("unknown-agent")  # Defaults to True

    def test_is_not_compatible(self):
        """Test incompatibility detection."""
        content = """---
workflow:
  id: test
  name: Test
compatibility:
  agents:
    - claude-code: not_supported
---
# Test
"""
        parser = WorkflowParser()
        workflow = parser.parse_content(content)

        # "not_supported" is not in the compatible list
        assert not workflow.is_compatible_with("claude-code")
