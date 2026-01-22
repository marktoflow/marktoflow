"""Workflow template library for aiworkflow framework.

This module provides:
- Template discovery from directories and registries
- Template instantiation with variable substitution
- Built-in templates for common workflow patterns
- Template validation and customization
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

import yaml


class TemplateCategory(str, Enum):
    """Categories for workflow templates."""

    CODE_QUALITY = "code_quality"
    DEPLOYMENT = "deployment"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    SECURITY = "security"
    MONITORING = "monitoring"
    DATA = "data"
    INTEGRATION = "integration"
    GENERAL = "general"


@dataclass
class TemplateVariable:
    """A variable that can be customized in a template."""

    name: str
    description: str
    type: str = "string"  # string, integer, boolean, array, object
    required: bool = False
    default: Any = None
    example: Any = None
    pattern: str | None = None  # Regex pattern for validation

    def validate(self, value: Any) -> tuple[bool, str | None]:
        """Validate a value against this variable definition.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if value is None:
            if self.required and self.default is None:
                return False, f"Variable '{self.name}' is required"
            return True, None

        # Type validation
        type_checks = {
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int),
            "boolean": lambda v: isinstance(v, bool),
            "array": lambda v: isinstance(v, list),
            "object": lambda v: isinstance(v, dict),
        }

        if self.type in type_checks:
            if not type_checks[self.type](value):
                return False, f"Variable '{self.name}' must be of type {self.type}"

        # Pattern validation for strings
        if self.pattern and isinstance(value, str):
            if not re.match(self.pattern, value):
                return False, f"Variable '{self.name}' must match pattern {self.pattern}"

        return True, None

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "type": self.type,
            "required": self.required,
            "default": self.default,
            "example": self.example,
            "pattern": self.pattern,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TemplateVariable:
        """Deserialize from dictionary."""
        return cls(
            name=data["name"],
            description=data.get("description", ""),
            type=data.get("type", "string"),
            required=data.get("required", False),
            default=data.get("default"),
            example=data.get("example"),
            pattern=data.get("pattern"),
        )


@dataclass
class TemplateMetadata:
    """Metadata about a workflow template."""

    id: str
    name: str
    description: str
    category: TemplateCategory
    version: str = "1.0.0"
    author: str = ""
    tags: list[str] = field(default_factory=list)
    license: str = "MIT"
    homepage: str = ""
    variables: list[TemplateVariable] = field(default_factory=list)
    requirements: dict[str, Any] = field(default_factory=dict)
    examples: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "version": self.version,
            "author": self.author,
            "tags": self.tags,
            "license": self.license,
            "homepage": self.homepage,
            "variables": [v.to_dict() for v in self.variables],
            "requirements": self.requirements,
            "examples": self.examples,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TemplateMetadata:
        """Deserialize from dictionary."""
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            category=TemplateCategory(data.get("category", "general")),
            version=data.get("version", "1.0.0"),
            author=data.get("author", ""),
            tags=data.get("tags", []),
            license=data.get("license", "MIT"),
            homepage=data.get("homepage", ""),
            variables=[TemplateVariable.from_dict(v) for v in data.get("variables", [])],
            requirements=data.get("requirements", {}),
            examples=data.get("examples", []),
        )


class WorkflowTemplate:
    """A workflow template that can be instantiated with variables."""

    def __init__(
        self,
        metadata: TemplateMetadata,
        content: str,
        source: str = "builtin",
        path: Path | None = None,
    ):
        """Initialize a workflow template.

        Args:
            metadata: Template metadata
            content: Template content (markdown with placeholders)
            source: Source of the template (builtin, file, registry)
            path: Path to the template file (if from file)
        """
        self.metadata = metadata
        self.content = content
        self.source = source
        self.path = path
        self.created_at = datetime.now()

    @property
    def id(self) -> str:
        """Get template ID."""
        return self.metadata.id

    @property
    def name(self) -> str:
        """Get template name."""
        return self.metadata.name

    @property
    def category(self) -> TemplateCategory:
        """Get template category."""
        return self.metadata.category

    @property
    def variables(self) -> list[TemplateVariable]:
        """Get template variables."""
        return self.metadata.variables

    def validate_variables(self, values: dict[str, Any]) -> tuple[bool, list[str]]:
        """Validate variable values against template definitions.

        Args:
            values: Dictionary of variable values

        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []
        for var in self.variables:
            value = values.get(var.name)
            is_valid, error = var.validate(value)
            if not is_valid and error:
                errors.append(error)

        return len(errors) == 0, errors

    def render(self, variables: dict[str, Any] | None = None) -> str:
        """Render the template with variable substitution.

        Args:
            variables: Dictionary of variable values

        Returns:
            Rendered workflow content
        """
        values = variables or {}

        # Apply defaults for missing variables
        for var in self.metadata.variables:
            if var.name not in values and var.default is not None:
                values[var.name] = var.default

        # Simple placeholder substitution: {{ variable_name }}
        result = self.content
        for name, value in values.items():
            # Handle different value types
            if isinstance(value, (list, dict)):
                str_value = yaml.dump(value, default_flow_style=True).strip()
            elif isinstance(value, bool):
                str_value = str(value).lower()
            else:
                str_value = str(value)

            # Replace placeholders
            result = re.sub(
                r"\{\{\s*template\." + re.escape(name) + r"\s*\}\}",
                str_value,
                result,
            )

        return result

    def instantiate(
        self,
        output_path: Path,
        variables: dict[str, Any] | None = None,
        workflow_id: str | None = None,
    ) -> Path:
        """Instantiate the template to a file.

        Args:
            output_path: Path to write the workflow file
            variables: Dictionary of variable values
            workflow_id: Custom workflow ID (optional)

        Returns:
            Path to the created workflow file
        """
        # Validate variables
        is_valid, errors = self.validate_variables(variables or {})
        if not is_valid:
            raise ValueError(f"Invalid variables: {'; '.join(errors)}")

        # Render content
        content = self.render(variables)

        # Update workflow ID if provided
        if workflow_id:
            content = re.sub(
                r'(id:\s*")[^"]*(")',
                f"\\1{workflow_id}\\2",
                content,
            )
            content = re.sub(
                r"(id:\s*)'[^']*(')",
                f"\\1'{workflow_id}\\2",
                content,
            )
            content = re.sub(
                r"(id:\s*)(\S+)",
                f"\\g<1>{workflow_id}",
                content,
            )

        # Write to file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content)

        return output_path

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "metadata": self.metadata.to_dict(),
            "content": self.content,
            "source": self.source,
            "path": str(self.path) if self.path else None,
        }

    @classmethod
    def from_file(cls, path: Path) -> WorkflowTemplate:
        """Load a template from a file.

        Args:
            path: Path to the template file

        Returns:
            WorkflowTemplate instance
        """
        content = path.read_text()

        # Parse YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                template_meta = frontmatter.get("template", {})

                # Build metadata from frontmatter
                metadata = TemplateMetadata(
                    id=template_meta.get("id", path.stem),
                    name=template_meta.get("name", path.stem),
                    description=template_meta.get("description", ""),
                    category=TemplateCategory(template_meta.get("category", "general")),
                    version=template_meta.get("version", "1.0.0"),
                    author=template_meta.get("author", ""),
                    tags=template_meta.get("tags", []),
                    variables=[
                        TemplateVariable.from_dict(v) for v in template_meta.get("variables", [])
                    ],
                    requirements=template_meta.get("requirements", {}),
                )

                return cls(
                    metadata=metadata,
                    content=content,
                    source="file",
                    path=path,
                )

        # Fallback for files without template metadata
        metadata = TemplateMetadata(
            id=path.stem,
            name=path.stem,
            description="",
            category=TemplateCategory.GENERAL,
        )

        return cls(
            metadata=metadata,
            content=content,
            source="file",
            path=path,
        )


class TemplateRegistry:
    """Registry for discovering and managing workflow templates."""

    def __init__(
        self,
        template_dirs: list[Path] | None = None,
        load_builtins: bool = True,
    ):
        """Initialize the template registry.

        Args:
            template_dirs: Directories to search for templates
            load_builtins: Whether to load built-in templates
        """
        self._templates: dict[str, WorkflowTemplate] = {}
        self._template_dirs = template_dirs or []

        if load_builtins:
            self._load_builtins()

    def _load_builtins(self) -> None:
        """Load built-in templates."""
        for template in BUILTIN_TEMPLATES:
            self._templates[template.id] = template

    def register(self, template: WorkflowTemplate) -> None:
        """Register a template.

        Args:
            template: Template to register
        """
        self._templates[template.id] = template

    def unregister(self, template_id: str) -> bool:
        """Unregister a template.

        Args:
            template_id: ID of template to remove

        Returns:
            True if template was removed
        """
        if template_id in self._templates:
            del self._templates[template_id]
            return True
        return False

    def get(self, template_id: str) -> WorkflowTemplate | None:
        """Get a template by ID.

        Args:
            template_id: Template ID

        Returns:
            Template if found, None otherwise
        """
        return self._templates.get(template_id)

    def list(
        self,
        category: TemplateCategory | None = None,
        tags: list[str] | None = None,
    ) -> list[WorkflowTemplate]:
        """List templates, optionally filtered.

        Args:
            category: Filter by category
            tags: Filter by tags (any match)

        Returns:
            List of matching templates
        """
        templates = list(self._templates.values())

        if category:
            templates = [t for t in templates if t.category == category]

        if tags:
            templates = [t for t in templates if any(tag in t.metadata.tags for tag in tags)]

        return sorted(templates, key=lambda t: t.name)

    def search(self, query: str) -> list[WorkflowTemplate]:
        """Search templates by name, description, or tags.

        Args:
            query: Search query

        Returns:
            List of matching templates
        """
        query_lower = query.lower()
        results = []

        for template in self._templates.values():
            # Search in name
            if query_lower in template.name.lower():
                results.append(template)
                continue

            # Search in description
            if query_lower in template.metadata.description.lower():
                results.append(template)
                continue

            # Search in tags
            if any(query_lower in tag.lower() for tag in template.metadata.tags):
                results.append(template)
                continue

        return sorted(results, key=lambda t: t.name)

    def discover(self) -> list[str]:
        """Discover templates from configured directories.

        Returns:
            List of discovered template IDs
        """
        discovered = []

        for template_dir in self._template_dirs:
            if not template_dir.exists():
                continue

            # Find template files
            for path in template_dir.glob("*.md"):
                try:
                    template = WorkflowTemplate.from_file(path)
                    if template.id not in self._templates:
                        self._templates[template.id] = template
                        discovered.append(template.id)
                except Exception:
                    pass  # Skip invalid templates

            # Find template directories (with template.md inside)
            for subdir in template_dir.iterdir():
                if subdir.is_dir():
                    template_file = subdir / "template.md"
                    if template_file.exists():
                        try:
                            template = WorkflowTemplate.from_file(template_file)
                            if template.id not in self._templates:
                                self._templates[template.id] = template
                                discovered.append(template.id)
                        except Exception:
                            pass

        return discovered

    def categories(self) -> list[TemplateCategory]:
        """Get list of categories with templates.

        Returns:
            List of categories that have at least one template
        """
        cats = set()
        for template in self._templates.values():
            cats.add(template.category)
        return sorted(cats, key=lambda c: c.value)

    def count(self) -> int:
        """Get total number of registered templates."""
        return len(self._templates)


# =============================================================================
# Built-in Templates
# =============================================================================

# PR Review Template
PR_REVIEW_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="pr-review",
        name="Pull Request Review",
        description="Automated code review for pull requests",
        category=TemplateCategory.CODE_QUALITY,
        version="1.0.0",
        author="aiworkflow",
        tags=["code-review", "github", "pull-request", "quality"],
        variables=[
            TemplateVariable(
                name="repo",
                description="Repository in owner/repo format",
                type="string",
                required=True,
                example="owner/repo",
                pattern=r"^[\w-]+/[\w-]+$",
            ),
            TemplateVariable(
                name="focus_areas",
                description="Areas to focus review on",
                type="array",
                default=["security", "performance", "maintainability"],
            ),
            TemplateVariable(
                name="auto_approve",
                description="Auto-approve PRs with no critical issues",
                type="boolean",
                default=True,
            ),
        ],
        requirements={
            "tools": ["github"],
            "features": ["tool_calling", "file_reading"],
        },
        examples=[
            {
                "name": "Basic PR review",
                "variables": {"repo": "myorg/myapp"},
            },
            {
                "name": "Security-focused review",
                "variables": {
                    "repo": "myorg/myapp",
                    "focus_areas": ["security", "secrets"],
                },
            },
        ],
    ),
    content="""---
workflow:
  id: pr-review
  name: "Pull Request Review"
  version: "1.0.0"
  description: "Automated code review for pull requests"

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - github
  features:
    - tool_calling: required
    - file_reading: required

inputs:
  pr_number:
    type: integer
    required: true
    description: "Pull request number to review"
  repo:
    type: string
    default: "{{ template.repo }}"
    description: "Repository in owner/repo format"
  focus_areas:
    type: array
    default: {{ template.focus_areas }}
    description: "Areas to focus review on"
---

# Pull Request Review

Automated code review workflow for pull requests.

## Step 1: Fetch PR Details

```yaml
action: github.get_pull_request
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
output_variable: pr_details
```

## Step 2: Get Changed Files

```yaml
action: github.list_pr_files
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
output_variable: changed_files
```

## Step 3: Analyze Code Changes

```yaml
action: agent.analyze
inputs:
  task: "code_review"
  files: "{{ changed_files }}"
  focus_areas: "{{ inputs.focus_areas }}"
  instructions: |
    Review the code changes focusing on:
    - Security vulnerabilities
    - Performance issues
    - Code quality and maintainability
    - Error handling
    Provide severity ratings and suggested fixes.
output_variable: analysis
```

## Step 4: Post Review

```yaml
action: github.create_review
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
  body: "{{ analysis.summary }}"
  event: "{{ 'APPROVE' if analysis.approved else 'REQUEST_CHANGES' }}"
output_variable: review_posted
```
""",
    source="builtin",
)

# CI/CD Deployment Template
DEPLOYMENT_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="deployment",
        name="Application Deployment",
        description="Deploy application to target environment",
        category=TemplateCategory.DEPLOYMENT,
        version="1.0.0",
        author="aiworkflow",
        tags=["deploy", "ci-cd", "release"],
        variables=[
            TemplateVariable(
                name="environment",
                description="Target deployment environment",
                type="string",
                required=True,
                example="production",
            ),
            TemplateVariable(
                name="version",
                description="Version to deploy",
                type="string",
                required=True,
                example="1.2.3",
            ),
            TemplateVariable(
                name="rollback_on_failure",
                description="Automatically rollback on deployment failure",
                type="boolean",
                default=True,
            ),
            TemplateVariable(
                name="notify_channel",
                description="Slack channel for notifications",
                type="string",
                default="#deployments",
            ),
        ],
        requirements={
            "tools": ["docker", "kubernetes", "slack"],
            "features": ["tool_calling"],
        },
    ),
    content="""---
workflow:
  id: deployment
  name: "Application Deployment"
  version: "1.0.0"
  description: "Deploy application to target environment"

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - docker
    - kubernetes
  features:
    - tool_calling: required

inputs:
  environment:
    type: string
    default: "{{ template.environment }}"
    description: "Target environment"
  version:
    type: string
    default: "{{ template.version }}"
    description: "Version to deploy"
  rollback_on_failure:
    type: boolean
    default: {{ template.rollback_on_failure }}
---

# Application Deployment

Deploy application to {{ template.environment }}.

## Step 1: Pre-deployment Checks

```yaml
action: agent.analyze
inputs:
  task: "deployment_readiness"
  environment: "{{ inputs.environment }}"
  version: "{{ inputs.version }}"
output_variable: readiness
```

## Step 2: Build Container

```yaml
action: docker.build
inputs:
  tag: "app:{{ inputs.version }}"
  context: "."
output_variable: build_result
condition: "readiness.ready"
```

## Step 3: Push to Registry

```yaml
action: docker.push
inputs:
  image: "app:{{ inputs.version }}"
  registry: "registry.example.com"
output_variable: push_result
```

## Step 4: Deploy to Kubernetes

```yaml
action: kubernetes.apply
inputs:
  manifest: "k8s/deployment.yaml"
  namespace: "{{ inputs.environment }}"
  image: "registry.example.com/app:{{ inputs.version }}"
output_variable: deploy_result
on_error:
  action: rollback
  condition: "{{ template.rollback_on_failure }}"
```

## Step 5: Verify Deployment

```yaml
action: kubernetes.wait_ready
inputs:
  deployment: "app"
  namespace: "{{ inputs.environment }}"
  timeout: 300
output_variable: health_check
```

## Step 6: Notify Team

```yaml
action: slack.post_message
inputs:
  channel: "{{ template.notify_channel }}"
  message: "Deployed v{{ inputs.version }} to {{ inputs.environment }}"
```
""",
    source="builtin",
)

# Test Automation Template
TEST_AUTOMATION_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="test-automation",
        name="Test Automation",
        description="Run automated tests and report results",
        category=TemplateCategory.TESTING,
        version="1.0.0",
        author="aiworkflow",
        tags=["testing", "qa", "automation", "ci"],
        variables=[
            TemplateVariable(
                name="test_type",
                description="Type of tests to run",
                type="string",
                default="all",
                example="unit",
            ),
            TemplateVariable(
                name="coverage_threshold",
                description="Minimum code coverage percentage",
                type="integer",
                default=80,
            ),
            TemplateVariable(
                name="fail_fast",
                description="Stop on first test failure",
                type="boolean",
                default=False,
            ),
            TemplateVariable(
                name="report_format",
                description="Test report format",
                type="string",
                default="html",
            ),
        ],
        requirements={
            "tools": ["pytest", "coverage"],
            "features": ["tool_calling"],
        },
    ),
    content="""---
workflow:
  id: test-automation
  name: "Test Automation"
  version: "1.0.0"
  description: "Run automated tests and report results"

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - pytest
  features:
    - tool_calling: required

inputs:
  test_type:
    type: string
    default: "{{ template.test_type }}"
    description: "Type of tests (unit, integration, e2e, all)"
  coverage_threshold:
    type: integer
    default: {{ template.coverage_threshold }}
    description: "Minimum coverage percentage"
  fail_fast:
    type: boolean
    default: {{ template.fail_fast }}
---

# Test Automation

Run automated tests with coverage reporting.

## Step 1: Setup Test Environment

```yaml
action: shell.run
inputs:
  command: "pip install -r requirements-test.txt"
output_variable: setup_result
```

## Step 2: Run Tests

```yaml
action: pytest.run
inputs:
  test_type: "{{ inputs.test_type }}"
  coverage: true
  fail_fast: "{{ inputs.fail_fast }}"
  args:
    - "--cov=src"
    - "--cov-report={{ template.report_format }}"
output_variable: test_results
```

## Step 3: Check Coverage

```yaml
action: coverage.check
inputs:
  threshold: "{{ inputs.coverage_threshold }}"
  report: "{{ test_results.coverage_report }}"
output_variable: coverage_check
```

## Step 4: Generate Report

```yaml
action: agent.generate
inputs:
  task: "test_report"
  data:
    results: "{{ test_results }}"
    coverage: "{{ coverage_check }}"
  template: |
    ## Test Results
    
    **Total Tests:** {{ results.total }}
    **Passed:** {{ results.passed }}
    **Failed:** {{ results.failed }}
    **Skipped:** {{ results.skipped }}
    
    **Coverage:** {{ coverage.percentage }}%
    **Threshold:** {{ template.coverage_threshold }}%
    **Status:** {{ "PASS" if coverage.met else "FAIL" }}
output_variable: report
```

## Step 5: Fail if Below Threshold

```yaml
action: workflow.assert
inputs:
  condition: "{{ coverage_check.met }}"
  message: "Coverage {{ coverage_check.percentage }}% below threshold {{ inputs.coverage_threshold }}%"
```
""",
    source="builtin",
)

# Documentation Generation Template
DOCUMENTATION_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="documentation",
        name="Documentation Generation",
        description="Generate or update documentation from code",
        category=TemplateCategory.DOCUMENTATION,
        version="1.0.0",
        author="aiworkflow",
        tags=["docs", "documentation", "readme", "api-docs"],
        variables=[
            TemplateVariable(
                name="doc_type",
                description="Type of documentation to generate",
                type="string",
                default="api",
                example="readme",
            ),
            TemplateVariable(
                name="source_dir",
                description="Source code directory",
                type="string",
                default="src",
            ),
            TemplateVariable(
                name="output_dir",
                description="Documentation output directory",
                type="string",
                default="docs",
            ),
            TemplateVariable(
                name="include_examples",
                description="Include code examples in documentation",
                type="boolean",
                default=True,
            ),
        ],
        requirements={
            "features": ["file_reading", "file_writing"],
        },
    ),
    content="""---
workflow:
  id: documentation
  name: "Documentation Generation"
  version: "1.0.0"
  description: "Generate or update documentation from code"

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  features:
    - file_reading: required
    - file_writing: required

inputs:
  doc_type:
    type: string
    default: "{{ template.doc_type }}"
    description: "Type of documentation (api, readme, tutorial)"
  source_dir:
    type: string
    default: "{{ template.source_dir }}"
  output_dir:
    type: string
    default: "{{ template.output_dir }}"
---

# Documentation Generation

Generate documentation from source code.

## Step 1: Analyze Source Code

```yaml
action: agent.analyze
inputs:
  task: "code_analysis"
  directory: "{{ inputs.source_dir }}"
  extract:
    - functions
    - classes
    - modules
    - docstrings
output_variable: code_analysis
```

## Step 2: Generate Documentation

```yaml
action: agent.generate
inputs:
  task: "documentation"
  doc_type: "{{ inputs.doc_type }}"
  code_analysis: "{{ code_analysis }}"
  include_examples: {{ template.include_examples }}
  template: |
    # API Documentation
    
    {% for module in code_analysis.modules %}
    ## {{ module.name }}
    
    {{ module.docstring }}
    
    {% for func in module.functions %}
    ### {{ func.name }}
    
    {{ func.docstring }}
    
    **Parameters:**
    {% for param in func.parameters %}
    - `{{ param.name }}` ({{ param.type }}): {{ param.description }}
    {% endfor %}
    
    {% if include_examples and func.example %}
    **Example:**
    ```python
    {{ func.example }}
    ```
    {% endif %}
    {% endfor %}
    {% endfor %}
output_variable: documentation
```

## Step 3: Write Documentation Files

```yaml
action: file.write
inputs:
  path: "{{ inputs.output_dir }}/{{ inputs.doc_type }}.md"
  content: "{{ documentation }}"
output_variable: write_result
```

## Step 4: Update Table of Contents

```yaml
action: agent.generate
inputs:
  task: "toc"
  directory: "{{ inputs.output_dir }}"
output_variable: toc
```
""",
    source="builtin",
)

# Security Scan Template
SECURITY_SCAN_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="security-scan",
        name="Security Scan",
        description="Run security scans on codebase",
        category=TemplateCategory.SECURITY,
        version="1.0.0",
        author="aiworkflow",
        tags=["security", "vulnerability", "sast", "dependencies"],
        variables=[
            TemplateVariable(
                name="scan_types",
                description="Types of security scans to run",
                type="array",
                default=["sast", "dependencies", "secrets"],
            ),
            TemplateVariable(
                name="severity_threshold",
                description="Minimum severity to report",
                type="string",
                default="medium",
            ),
            TemplateVariable(
                name="fail_on_high",
                description="Fail workflow on high/critical findings",
                type="boolean",
                default=True,
            ),
        ],
        requirements={
            "tools": ["security-scanner"],
            "features": ["tool_calling"],
        },
    ),
    content="""---
workflow:
  id: security-scan
  name: "Security Scan"
  version: "1.0.0"
  description: "Run security scans on codebase"

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - security-scanner
  features:
    - tool_calling: required

inputs:
  scan_types:
    type: array
    default: {{ template.scan_types }}
    description: "Security scan types"
  severity_threshold:
    type: string
    default: "{{ template.severity_threshold }}"
  fail_on_high:
    type: boolean
    default: {{ template.fail_on_high }}
---

# Security Scan

Comprehensive security scanning workflow.

## Step 1: SAST Scan

```yaml
action: security.sast_scan
inputs:
  directory: "."
  severity: "{{ inputs.severity_threshold }}"
output_variable: sast_results
condition: "'sast' in inputs.scan_types"
```

## Step 2: Dependency Scan

```yaml
action: security.dependency_scan
inputs:
  manifest_files:
    - "package.json"
    - "requirements.txt"
    - "go.mod"
output_variable: dep_results
condition: "'dependencies' in inputs.scan_types"
```

## Step 3: Secret Detection

```yaml
action: security.secret_scan
inputs:
  directory: "."
  patterns:
    - api_keys
    - passwords
    - tokens
    - certificates
output_variable: secret_results
condition: "'secrets' in inputs.scan_types"
```

## Step 4: Generate Report

```yaml
action: agent.generate
inputs:
  task: "security_report"
  data:
    sast: "{{ sast_results }}"
    dependencies: "{{ dep_results }}"
    secrets: "{{ secret_results }}"
output_variable: report
```

## Step 5: Check Thresholds

```yaml
action: workflow.assert
inputs:
  condition: "{{ not (report.has_critical and inputs.fail_on_high) }}"
  message: "Critical security issues found"
```
""",
    source="builtin",
)

# Incident Response Template
INCIDENT_RESPONSE_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="incident-response",
        name="Incident Response",
        description="Automated incident response and remediation",
        category=TemplateCategory.MONITORING,
        version="1.0.0",
        author="aiworkflow",
        tags=["incident", "monitoring", "alerting", "on-call"],
        variables=[
            TemplateVariable(
                name="severity_levels",
                description="Severity levels that trigger response",
                type="array",
                default=["critical", "high"],
            ),
            TemplateVariable(
                name="notification_channels",
                description="Channels to notify",
                type="array",
                default=["slack", "pagerduty"],
            ),
            TemplateVariable(
                name="auto_remediate",
                description="Attempt automatic remediation",
                type="boolean",
                default=False,
            ),
        ],
        requirements={
            "tools": ["monitoring", "slack", "pagerduty"],
            "features": ["tool_calling"],
        },
    ),
    content="""---
workflow:
  id: incident-response
  name: "Incident Response"
  version: "1.0.0"
  description: "Automated incident response"

triggers:
  - type: webhook
    path: /webhooks/alerts
    events:
      - alert.triggered

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

inputs:
  alert_id:
    type: string
    required: true
  severity:
    type: string
    required: true
  service:
    type: string
    required: true
---

# Incident Response

Automated incident response workflow.

## Step 1: Gather Context

```yaml
action: monitoring.get_alert
inputs:
  alert_id: "{{ inputs.alert_id }}"
output_variable: alert_details
```

## Step 2: Analyze Impact

```yaml
action: agent.analyze
inputs:
  task: "incident_analysis"
  alert: "{{ alert_details }}"
  service: "{{ inputs.service }}"
output_variable: analysis
```

## Step 3: Notify Team

```yaml
action: slack.post_message
inputs:
  channel: "#incidents"
  message: |
    :rotating_light: **Incident Alert**
    
    **Service:** {{ inputs.service }}
    **Severity:** {{ inputs.severity }}
    **Summary:** {{ analysis.summary }}
    
    **Potential Impact:** {{ analysis.impact }}
output_variable: notification
```

## Step 4: Create Ticket

```yaml
action: jira.create_issue
inputs:
  project: "OPS"
  type: "Incident"
  summary: "[{{ inputs.severity }}] {{ inputs.service }} - {{ alert_details.title }}"
  description: "{{ analysis.details }}"
  priority: "{{ inputs.severity }}"
output_variable: ticket
```

## Step 5: Auto-Remediate

```yaml
action: agent.execute
inputs:
  task: "remediation"
  playbook: "{{ analysis.recommended_playbook }}"
  dry_run: "{{ not template.auto_remediate }}"
output_variable: remediation
condition: "analysis.can_auto_remediate and 'auto_remediate' in inputs"
```
""",
    source="builtin",
)

# Data Pipeline Template
DATA_PIPELINE_TEMPLATE = WorkflowTemplate(
    metadata=TemplateMetadata(
        id="data-pipeline",
        name="Data Pipeline",
        description="ETL data pipeline workflow",
        category=TemplateCategory.DATA,
        version="1.0.0",
        author="aiworkflow",
        tags=["data", "etl", "pipeline", "analytics"],
        variables=[
            TemplateVariable(
                name="source_type",
                description="Data source type",
                type="string",
                required=True,
                example="postgres",
            ),
            TemplateVariable(
                name="destination_type",
                description="Data destination type",
                type="string",
                required=True,
                example="bigquery",
            ),
            TemplateVariable(
                name="batch_size",
                description="Records per batch",
                type="integer",
                default=10000,
            ),
            TemplateVariable(
                name="incremental",
                description="Use incremental loading",
                type="boolean",
                default=True,
            ),
        ],
        requirements={
            "tools": ["database", "data-warehouse"],
            "features": ["tool_calling"],
        },
    ),
    content="""---
workflow:
  id: data-pipeline
  name: "Data Pipeline"
  version: "1.0.0"
  description: "ETL data pipeline"

schedule:
  cron: "0 */6 * * *"  # Every 6 hours

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

inputs:
  source_type:
    type: string
    default: "{{ template.source_type }}"
  destination_type:
    type: string
    default: "{{ template.destination_type }}"
  batch_size:
    type: integer
    default: {{ template.batch_size }}
---

# Data Pipeline

Extract, transform, and load data.

## Step 1: Extract Data

```yaml
action: database.query
inputs:
  source: "{{ inputs.source_type }}"
  query: "SELECT * FROM source_table WHERE updated_at > '{{ last_run }}'"
  batch_size: "{{ inputs.batch_size }}"
output_variable: extracted_data
```

## Step 2: Transform Data

```yaml
action: agent.transform
inputs:
  task: "data_transformation"
  data: "{{ extracted_data }}"
  transformations:
    - name: "clean_nulls"
    - name: "normalize_dates"
    - name: "calculate_metrics"
output_variable: transformed_data
```

## Step 3: Validate Data

```yaml
action: data.validate
inputs:
  data: "{{ transformed_data }}"
  schema: "destination_schema.json"
output_variable: validation
```

## Step 4: Load Data

```yaml
action: database.upsert
inputs:
  destination: "{{ inputs.destination_type }}"
  table: "destination_table"
  data: "{{ transformed_data }}"
  key_columns: ["id"]
output_variable: load_result
condition: "validation.valid"
```

## Step 5: Record Metrics

```yaml
action: metrics.record
inputs:
  pipeline: "data-pipeline"
  records_processed: "{{ load_result.rows_affected }}"
  duration: "{{ workflow.duration }}"
```
""",
    source="builtin",
)

# List of all built-in templates
BUILTIN_TEMPLATES = [
    PR_REVIEW_TEMPLATE,
    DEPLOYMENT_TEMPLATE,
    TEST_AUTOMATION_TEMPLATE,
    DOCUMENTATION_TEMPLATE,
    SECURITY_SCAN_TEMPLATE,
    INCIDENT_RESPONSE_TEMPLATE,
    DATA_PIPELINE_TEMPLATE,
]


def create_template_registry(
    project_root: Path | None = None,
    load_builtins: bool = True,
) -> TemplateRegistry:
    """Create a template registry with default directories.

    Args:
        project_root: Project root directory
        load_builtins: Whether to load built-in templates

    Returns:
        Configured TemplateRegistry
    """
    template_dirs = []

    if project_root:
        # .aiworkflow/templates directory
        aiworkflow_templates = project_root / ".aiworkflow" / "templates"
        if aiworkflow_templates.exists():
            template_dirs.append(aiworkflow_templates)

    return TemplateRegistry(
        template_dirs=template_dirs,
        load_builtins=load_builtins,
    )
