"""Tests for workflow template library."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

import pytest

from marktoflow.core.templates import (
    BUILTIN_TEMPLATES,
    DATA_PIPELINE_TEMPLATE,
    DEPLOYMENT_TEMPLATE,
    DOCUMENTATION_TEMPLATE,
    INCIDENT_RESPONSE_TEMPLATE,
    PR_REVIEW_TEMPLATE,
    SECURITY_SCAN_TEMPLATE,
    TEST_AUTOMATION_TEMPLATE,
    TemplateCategory,
    TemplateMetadata,
    TemplateRegistry,
    TemplateVariable,
    WorkflowTemplate,
    create_template_registry,
)


# =============================================================================
# TemplateVariable Tests
# =============================================================================


class TestTemplateVariable:
    """Tests for TemplateVariable."""

    def test_create_variable(self):
        """Test creating a template variable."""
        var = TemplateVariable(
            name="repo",
            description="Repository name",
            type="string",
            required=True,
            example="owner/repo",
        )

        assert var.name == "repo"
        assert var.description == "Repository name"
        assert var.type == "string"
        assert var.required is True
        assert var.example == "owner/repo"
        assert var.default is None
        assert var.pattern is None

    def test_variable_defaults(self):
        """Test default values for variables."""
        var = TemplateVariable(name="test", description="Test var")

        assert var.type == "string"
        assert var.required is False
        assert var.default is None

    def test_validate_required_missing(self):
        """Test validation of required variable with missing value."""
        var = TemplateVariable(
            name="required_var",
            description="Required",
            required=True,
        )

        is_valid, error = var.validate(None)
        assert is_valid is False
        assert "required" in error.lower()

    def test_validate_required_with_default(self):
        """Test required variable with default value."""
        var = TemplateVariable(
            name="with_default",
            description="Has default",
            required=True,
            default="default_value",
        )

        is_valid, error = var.validate(None)
        assert is_valid is True
        assert error is None

    def test_validate_string_type(self):
        """Test string type validation."""
        var = TemplateVariable(name="text", description="Text", type="string")

        is_valid, _ = var.validate("hello")
        assert is_valid is True

        is_valid, error = var.validate(123)
        assert is_valid is False
        assert "string" in error

    def test_validate_integer_type(self):
        """Test integer type validation."""
        var = TemplateVariable(name="count", description="Count", type="integer")

        is_valid, _ = var.validate(42)
        assert is_valid is True

        is_valid, error = var.validate("42")
        assert is_valid is False
        assert "integer" in error

    def test_validate_boolean_type(self):
        """Test boolean type validation."""
        var = TemplateVariable(name="flag", description="Flag", type="boolean")

        is_valid, _ = var.validate(True)
        assert is_valid is True

        is_valid, error = var.validate("true")
        assert is_valid is False
        assert "boolean" in error

    def test_validate_array_type(self):
        """Test array type validation."""
        var = TemplateVariable(name="items", description="Items", type="array")

        is_valid, _ = var.validate([1, 2, 3])
        assert is_valid is True

        is_valid, error = var.validate("not an array")
        assert is_valid is False
        assert "array" in error

    def test_validate_object_type(self):
        """Test object type validation."""
        var = TemplateVariable(name="config", description="Config", type="object")

        is_valid, _ = var.validate({"key": "value"})
        assert is_valid is True

        is_valid, error = var.validate("not an object")
        assert is_valid is False
        assert "object" in error

    def test_validate_pattern(self):
        """Test pattern validation."""
        var = TemplateVariable(
            name="repo",
            description="Repo",
            type="string",
            pattern=r"^[\w-]+/[\w-]+$",
        )

        is_valid, _ = var.validate("owner/repo")
        assert is_valid is True

        is_valid, error = var.validate("invalid")
        assert is_valid is False
        assert "pattern" in error.lower()

    def test_to_dict(self):
        """Test serializing variable to dictionary."""
        var = TemplateVariable(
            name="test",
            description="Test var",
            type="string",
            required=True,
            default="default",
            example="example",
            pattern=".*",
        )

        data = var.to_dict()

        assert data["name"] == "test"
        assert data["description"] == "Test var"
        assert data["type"] == "string"
        assert data["required"] is True
        assert data["default"] == "default"
        assert data["example"] == "example"
        assert data["pattern"] == ".*"

    def test_from_dict(self):
        """Test deserializing variable from dictionary."""
        data = {
            "name": "restored",
            "description": "Restored var",
            "type": "integer",
            "required": True,
            "default": 10,
        }

        var = TemplateVariable.from_dict(data)

        assert var.name == "restored"
        assert var.description == "Restored var"
        assert var.type == "integer"
        assert var.required is True
        assert var.default == 10


# =============================================================================
# TemplateMetadata Tests
# =============================================================================


class TestTemplateMetadata:
    """Tests for TemplateMetadata."""

    def test_create_metadata(self):
        """Test creating template metadata."""
        meta = TemplateMetadata(
            id="test-template",
            name="Test Template",
            description="A test template",
            category=TemplateCategory.TESTING,
            version="1.0.0",
            author="Test Author",
            tags=["test", "example"],
        )

        assert meta.id == "test-template"
        assert meta.name == "Test Template"
        assert meta.description == "A test template"
        assert meta.category == TemplateCategory.TESTING
        assert meta.version == "1.0.0"
        assert meta.author == "Test Author"
        assert meta.tags == ["test", "example"]

    def test_metadata_defaults(self):
        """Test default values for metadata."""
        meta = TemplateMetadata(
            id="minimal",
            name="Minimal",
            description="",
            category=TemplateCategory.GENERAL,
        )

        assert meta.version == "1.0.0"
        assert meta.author == ""
        assert meta.tags == []
        assert meta.license == "MIT"
        assert meta.homepage == ""
        assert meta.variables == []
        assert meta.requirements == {}
        assert meta.examples == []

    def test_metadata_with_variables(self):
        """Test metadata with variables."""
        var = TemplateVariable(name="test", description="Test")
        meta = TemplateMetadata(
            id="with-vars",
            name="With Vars",
            description="Has variables",
            category=TemplateCategory.GENERAL,
            variables=[var],
        )

        assert len(meta.variables) == 1
        assert meta.variables[0].name == "test"

    def test_to_dict(self):
        """Test serializing metadata to dictionary."""
        meta = TemplateMetadata(
            id="serialized",
            name="Serialized",
            description="Test",
            category=TemplateCategory.DEPLOYMENT,
            author="Author",
        )

        data = meta.to_dict()

        assert data["id"] == "serialized"
        assert data["name"] == "Serialized"
        assert data["category"] == "deployment"
        assert data["author"] == "Author"

    def test_from_dict(self):
        """Test deserializing metadata from dictionary."""
        data = {
            "id": "restored",
            "name": "Restored",
            "description": "Restored template",
            "category": "security",
            "tags": ["security", "scan"],
        }

        meta = TemplateMetadata.from_dict(data)

        assert meta.id == "restored"
        assert meta.name == "Restored"
        assert meta.category == TemplateCategory.SECURITY
        assert meta.tags == ["security", "scan"]


# =============================================================================
# WorkflowTemplate Tests
# =============================================================================


class TestWorkflowTemplate:
    """Tests for WorkflowTemplate."""

    def test_create_template(self):
        """Test creating a workflow template."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="Test template",
            category=TemplateCategory.GENERAL,
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="# Test Workflow\n\nContent here.",
            source="test",
        )

        assert template.id == "test"
        assert template.name == "Test"
        assert template.category == TemplateCategory.GENERAL
        assert "Test Workflow" in template.content
        assert template.source == "test"
        assert template.path is None

    def test_template_with_path(self):
        """Test template with file path."""
        meta = TemplateMetadata(
            id="file-template",
            name="File Template",
            description="",
            category=TemplateCategory.GENERAL,
        )
        path = Path("/some/path/template.md")
        template = WorkflowTemplate(
            metadata=meta,
            content="content",
            source="file",
            path=path,
        )

        assert template.path == path
        assert template.source == "file"

    def test_validate_variables_success(self):
        """Test successful variable validation."""
        var = TemplateVariable(
            name="repo",
            description="Repo",
            type="string",
            required=True,
        )
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[var],
        )
        template = WorkflowTemplate(metadata=meta, content="")

        is_valid, errors = template.validate_variables({"repo": "owner/repo"})

        assert is_valid is True
        assert errors == []

    def test_validate_variables_missing_required(self):
        """Test validation with missing required variable."""
        var = TemplateVariable(
            name="required",
            description="Required",
            required=True,
        )
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[var],
        )
        template = WorkflowTemplate(metadata=meta, content="")

        is_valid, errors = template.validate_variables({})

        assert is_valid is False
        assert len(errors) == 1
        assert "required" in errors[0].lower()

    def test_render_simple(self):
        """Test simple template rendering."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[
                TemplateVariable(name="name", description="Name"),
            ],
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="Hello, {{ template.name }}!",
        )

        result = template.render({"name": "World"})

        assert result == "Hello, World!"

    def test_render_with_defaults(self):
        """Test rendering with default values."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[
                TemplateVariable(
                    name="greeting",
                    description="Greeting",
                    default="Hello",
                ),
            ],
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="{{ template.greeting }}, World!",
        )

        result = template.render({})  # No variables provided

        assert result == "Hello, World!"

    def test_render_boolean(self):
        """Test rendering boolean values."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[
                TemplateVariable(name="flag", description="Flag", type="boolean"),
            ],
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="Flag is: {{ template.flag }}",
        )

        result = template.render({"flag": True})

        assert result == "Flag is: true"

    def test_render_array(self):
        """Test rendering array values."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[
                TemplateVariable(name="items", description="Items", type="array"),
            ],
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="Items: {{ template.items }}",
        )

        result = template.render({"items": ["a", "b", "c"]})

        assert "a" in result
        assert "b" in result
        assert "c" in result

    def test_instantiate_to_file(self):
        """Test instantiating template to a file."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[
                TemplateVariable(name="name", description="Name"),
            ],
        )
        template = WorkflowTemplate(
            metadata=meta,
            content="# Workflow for {{ template.name }}",
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "workflow.md"
            result = template.instantiate(output_path, {"name": "MyApp"})

            assert result == output_path
            assert output_path.exists()
            content = output_path.read_text()
            assert "Workflow for MyApp" in content

    def test_instantiate_validation_error(self):
        """Test instantiate fails on validation error."""
        var = TemplateVariable(
            name="required",
            description="Required",
            required=True,
        )
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="",
            category=TemplateCategory.GENERAL,
            variables=[var],
        )
        template = WorkflowTemplate(metadata=meta, content="")

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "workflow.md"

            with pytest.raises(ValueError, match="Invalid variables"):
                template.instantiate(output_path, {})

    def test_to_dict(self):
        """Test serializing template to dictionary."""
        meta = TemplateMetadata(
            id="test",
            name="Test",
            description="Test desc",
            category=TemplateCategory.GENERAL,
        )
        template = WorkflowTemplate(metadata=meta, content="content")

        data = template.to_dict()

        assert data["metadata"]["id"] == "test"
        assert data["content"] == "content"
        assert data["source"] == "builtin"

    def test_from_file(self):
        """Test loading template from file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            template_file = Path(tmpdir) / "test-template.md"
            template_file.write_text("""---
template:
  id: file-template
  name: File Template
  description: Loaded from file
  category: testing
  version: "2.0.0"
  tags:
    - test
  variables:
    - name: param1
      description: First param
      type: string
      required: true
---

# File Template Workflow

Content with {{ template.param1 }}.
""")

            template = WorkflowTemplate.from_file(template_file)

            assert template.id == "file-template"
            assert template.name == "File Template"
            assert template.category == TemplateCategory.TESTING
            assert template.metadata.version == "2.0.0"
            assert len(template.variables) == 1
            assert template.variables[0].name == "param1"
            assert template.source == "file"
            assert template.path == template_file

    def test_from_file_without_metadata(self):
        """Test loading template without template metadata."""
        with tempfile.TemporaryDirectory() as tmpdir:
            template_file = Path(tmpdir) / "simple.md"
            template_file.write_text("# Simple Workflow\n\nJust content.")

            template = WorkflowTemplate.from_file(template_file)

            assert template.id == "simple"
            assert template.name == "simple"
            assert template.category == TemplateCategory.GENERAL


# =============================================================================
# TemplateRegistry Tests
# =============================================================================


class TestTemplateRegistry:
    """Tests for TemplateRegistry."""

    def test_create_registry(self):
        """Test creating a template registry."""
        registry = TemplateRegistry(load_builtins=False)

        assert registry.count() == 0

    def test_create_with_builtins(self):
        """Test registry loads built-in templates by default."""
        registry = TemplateRegistry()

        assert registry.count() > 0
        assert registry.count() == len(BUILTIN_TEMPLATES)

    def test_register_template(self):
        """Test registering a template."""
        registry = TemplateRegistry(load_builtins=False)
        meta = TemplateMetadata(
            id="custom",
            name="Custom",
            description="Custom template",
            category=TemplateCategory.GENERAL,
        )
        template = WorkflowTemplate(metadata=meta, content="content")

        registry.register(template)

        assert registry.count() == 1
        assert registry.get("custom") is not None

    def test_unregister_template(self):
        """Test unregistering a template."""
        registry = TemplateRegistry(load_builtins=False)
        meta = TemplateMetadata(
            id="to-remove",
            name="To Remove",
            description="",
            category=TemplateCategory.GENERAL,
        )
        template = WorkflowTemplate(metadata=meta, content="")
        registry.register(template)

        result = registry.unregister("to-remove")

        assert result is True
        assert registry.get("to-remove") is None
        assert registry.count() == 0

    def test_unregister_nonexistent(self):
        """Test unregistering nonexistent template."""
        registry = TemplateRegistry(load_builtins=False)

        result = registry.unregister("nonexistent")

        assert result is False

    def test_get_template(self):
        """Test getting a template by ID."""
        registry = TemplateRegistry()

        template = registry.get("pr-review")

        assert template is not None
        assert template.id == "pr-review"

    def test_get_nonexistent(self):
        """Test getting nonexistent template."""
        registry = TemplateRegistry()

        template = registry.get("nonexistent")

        assert template is None

    def test_list_all(self):
        """Test listing all templates."""
        registry = TemplateRegistry()

        templates = registry.list()

        assert len(templates) == len(BUILTIN_TEMPLATES)

    def test_list_by_category(self):
        """Test listing templates by category."""
        registry = TemplateRegistry()

        templates = registry.list(category=TemplateCategory.CODE_QUALITY)

        assert len(templates) >= 1
        for t in templates:
            assert t.category == TemplateCategory.CODE_QUALITY

    def test_list_by_tags(self):
        """Test listing templates by tags."""
        registry = TemplateRegistry()

        templates = registry.list(tags=["security"])

        assert len(templates) >= 1
        for t in templates:
            assert any("security" in tag.lower() for tag in t.metadata.tags)

    def test_search_by_name(self):
        """Test searching templates by name."""
        registry = TemplateRegistry()

        results = registry.search("review")

        assert len(results) >= 1
        assert any("review" in r.name.lower() for r in results)

    def test_search_by_description(self):
        """Test searching templates by description."""
        registry = TemplateRegistry()

        results = registry.search("automated")

        assert len(results) >= 1

    def test_search_by_tag(self):
        """Test searching templates by tag."""
        registry = TemplateRegistry()

        results = registry.search("deploy")

        assert len(results) >= 1

    def test_search_no_results(self):
        """Test search with no results."""
        registry = TemplateRegistry()

        results = registry.search("xyznonexistent123")

        assert len(results) == 0

    def test_categories(self):
        """Test getting categories with templates."""
        registry = TemplateRegistry()

        categories = registry.categories()

        assert len(categories) > 0
        assert all(isinstance(c, TemplateCategory) for c in categories)

    def test_discover_from_directory(self):
        """Test discovering templates from directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a template file
            template_file = Path(tmpdir) / "discovered.md"
            template_file.write_text("""---
template:
  id: discovered
  name: Discovered Template
  description: Found in directory
  category: general
---

# Discovered Workflow
""")

            registry = TemplateRegistry(
                template_dirs=[Path(tmpdir)],
                load_builtins=False,
            )
            discovered = registry.discover()

            assert "discovered" in discovered
            assert registry.get("discovered") is not None

    def test_discover_package_template(self):
        """Test discovering template from package directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a package-style template
            pkg_dir = Path(tmpdir) / "my-template"
            pkg_dir.mkdir()
            template_file = pkg_dir / "template.md"
            template_file.write_text("""---
template:
  id: package-template
  name: Package Template
  description: In package directory
  category: general
---

# Package Template
""")

            registry = TemplateRegistry(
                template_dirs=[Path(tmpdir)],
                load_builtins=False,
            )
            discovered = registry.discover()

            assert "package-template" in discovered


# =============================================================================
# Built-in Templates Tests
# =============================================================================


class TestBuiltinTemplates:
    """Tests for built-in templates."""

    def test_all_builtins_exist(self):
        """Test all expected built-in templates exist."""
        expected_ids = [
            "pr-review",
            "deployment",
            "test-automation",
            "documentation",
            "security-scan",
            "incident-response",
            "data-pipeline",
        ]

        for template_id in expected_ids:
            template = next((t for t in BUILTIN_TEMPLATES if t.id == template_id), None)
            assert template is not None, f"Missing template: {template_id}"

    def test_pr_review_template(self):
        """Test PR review template structure."""
        assert PR_REVIEW_TEMPLATE.id == "pr-review"
        assert PR_REVIEW_TEMPLATE.category == TemplateCategory.CODE_QUALITY
        assert len(PR_REVIEW_TEMPLATE.variables) >= 1

        # Check for repo variable
        repo_var = next((v for v in PR_REVIEW_TEMPLATE.variables if v.name == "repo"), None)
        assert repo_var is not None
        assert repo_var.required is True

    def test_deployment_template(self):
        """Test deployment template structure."""
        assert DEPLOYMENT_TEMPLATE.id == "deployment"
        assert DEPLOYMENT_TEMPLATE.category == TemplateCategory.DEPLOYMENT
        assert len(DEPLOYMENT_TEMPLATE.variables) >= 2

    def test_test_automation_template(self):
        """Test test automation template structure."""
        assert TEST_AUTOMATION_TEMPLATE.id == "test-automation"
        assert TEST_AUTOMATION_TEMPLATE.category == TemplateCategory.TESTING

        # Check coverage threshold variable
        coverage_var = next(
            (v for v in TEST_AUTOMATION_TEMPLATE.variables if v.name == "coverage_threshold"),
            None,
        )
        assert coverage_var is not None
        assert coverage_var.type == "integer"
        assert coverage_var.default == 80

    def test_documentation_template(self):
        """Test documentation template structure."""
        assert DOCUMENTATION_TEMPLATE.id == "documentation"
        assert DOCUMENTATION_TEMPLATE.category == TemplateCategory.DOCUMENTATION

    def test_security_scan_template(self):
        """Test security scan template structure."""
        assert SECURITY_SCAN_TEMPLATE.id == "security-scan"
        assert SECURITY_SCAN_TEMPLATE.category == TemplateCategory.SECURITY
        assert "security" in SECURITY_SCAN_TEMPLATE.metadata.tags

    def test_incident_response_template(self):
        """Test incident response template structure."""
        assert INCIDENT_RESPONSE_TEMPLATE.id == "incident-response"
        assert INCIDENT_RESPONSE_TEMPLATE.category == TemplateCategory.MONITORING

    def test_data_pipeline_template(self):
        """Test data pipeline template structure."""
        assert DATA_PIPELINE_TEMPLATE.id == "data-pipeline"
        assert DATA_PIPELINE_TEMPLATE.category == TemplateCategory.DATA

    def test_all_templates_renderable(self):
        """Test all built-in templates can be rendered."""
        for template in BUILTIN_TEMPLATES:
            # Provide minimum required variables
            variables = {}
            for var in template.variables:
                if var.required and var.default is None:
                    # Provide a placeholder value based on type
                    if var.type == "string":
                        variables[var.name] = "test_value"
                    elif var.type == "integer":
                        variables[var.name] = 1
                    elif var.type == "boolean":
                        variables[var.name] = True
                    elif var.type == "array":
                        variables[var.name] = []
                    elif var.type == "object":
                        variables[var.name] = {}

            # Should not raise
            result = template.render(variables)
            assert isinstance(result, str)
            assert len(result) > 0


# =============================================================================
# TemplateCategory Tests
# =============================================================================


class TestTemplateCategory:
    """Tests for TemplateCategory enum."""

    def test_all_categories_exist(self):
        """Test all expected categories exist."""
        expected = [
            "CODE_QUALITY",
            "DEPLOYMENT",
            "TESTING",
            "DOCUMENTATION",
            "SECURITY",
            "MONITORING",
            "DATA",
            "INTEGRATION",
            "GENERAL",
        ]

        for name in expected:
            assert hasattr(TemplateCategory, name), f"Missing category: {name}"

    def test_category_values(self):
        """Test category string values."""
        assert TemplateCategory.CODE_QUALITY.value == "code_quality"
        assert TemplateCategory.DEPLOYMENT.value == "deployment"
        assert TemplateCategory.TESTING.value == "testing"
        assert TemplateCategory.GENERAL.value == "general"


# =============================================================================
# create_template_registry Tests
# =============================================================================


class TestCreateTemplateRegistry:
    """Tests for create_template_registry helper."""

    def test_create_without_project_root(self):
        """Test creating registry without project root."""
        registry = create_template_registry()

        assert isinstance(registry, TemplateRegistry)
        assert registry.count() == len(BUILTIN_TEMPLATES)

    def test_create_with_project_root(self):
        """Test creating registry with project root."""
        with tempfile.TemporaryDirectory() as tmpdir:
            registry = create_template_registry(project_root=Path(tmpdir))

            assert isinstance(registry, TemplateRegistry)

    def test_create_with_templates_directory(self):
        """Test creating registry finds .marktoflow/templates."""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            templates_dir = project_root / ".marktoflow" / "templates"
            templates_dir.mkdir(parents=True)

            # Create a test template
            template_file = templates_dir / "custom.md"
            template_file.write_text("""---
template:
  id: custom-template
  name: Custom Template
  description: Custom project template
  category: general
---

# Custom Workflow
""")

            registry = create_template_registry(project_root=project_root)
            discovered = registry.discover()

            assert "custom-template" in discovered

    def test_create_without_builtins(self):
        """Test creating registry without built-in templates."""
        registry = create_template_registry(load_builtins=False)

        assert registry.count() == 0
