"""
Workflow Parser for marktoflow framework.

Parses markdown workflow files with YAML frontmatter into Workflow objects.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from marktoflow.core.models import (
    AgentCompatibility,
    AgentHints,
    ErrorConfig,
    ErrorHandling,
    InputParameter,
    TriggerConfig,
    Workflow,
    WorkflowMetadata,
    WorkflowStep,
)


class WorkflowParseError(Exception):
    """Error during workflow parsing."""

    pass


class WorkflowParser:
    """
    Parser for markdown workflow files with YAML frontmatter.

    Workflow format:
    - YAML frontmatter (between --- markers)
    - Markdown content with step definitions
    - Steps defined in code blocks with action configurations
    """

    # Pattern to match YAML frontmatter
    FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)

    # Pattern to match step headers (## Step N: Title or ### Step N.M: Title)
    STEP_HEADER_PATTERN = re.compile(
        r"^#{2,4}\s+(?:Step\s+)?(\d+(?:\.\d+)?)[.:]\s*(.+)$", re.MULTILINE
    )

    # Pattern to match YAML code blocks
    YAML_BLOCK_PATTERN = re.compile(r"```ya?ml\s*\n(.*?)```", re.DOTALL)

    def __init__(self) -> None:
        """Initialize the parser."""
        self._step_counter = 0

    def parse_file(self, path: str | Path) -> Workflow:
        """
        Parse a workflow file from disk.

        Args:
            path: Path to the workflow markdown file

        Returns:
            Parsed Workflow object

        Raises:
            WorkflowParseError: If parsing fails
            FileNotFoundError: If file doesn't exist
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Workflow file not found: {path}")

        content = path.read_text(encoding="utf-8")
        workflow = self.parse_content(content)
        workflow.source_path = str(path)
        return workflow

    def parse_content(self, content: str) -> Workflow:
        """
        Parse workflow from markdown content string.

        Args:
            content: Markdown content with YAML frontmatter

        Returns:
            Parsed Workflow object

        Raises:
            WorkflowParseError: If parsing fails
        """
        self._step_counter = 0

        # Extract frontmatter and body
        frontmatter, body = self._split_frontmatter(content)

        # Parse metadata from frontmatter
        metadata = self._parse_metadata(frontmatter)

        # Parse triggers from frontmatter or body
        triggers = self._parse_triggers(frontmatter, body)

        # Parse input parameters
        inputs = self._parse_inputs(frontmatter, body)

        # Parse workflow steps from body
        steps = self._parse_steps(body)

        return Workflow(
            metadata=metadata,
            triggers=triggers,
            inputs=inputs,
            steps=steps,
            raw_content=content,
        )

    def _split_frontmatter(self, content: str) -> tuple[dict[str, Any], str]:
        """Split content into frontmatter dict and body string."""
        match = self.FRONTMATTER_PATTERN.match(content)

        if not match:
            # No frontmatter found
            return {}, content

        frontmatter_yaml = match.group(1)
        body = content[match.end() :]

        try:
            frontmatter = yaml.safe_load(frontmatter_yaml) or {}
        except yaml.YAMLError as e:
            raise WorkflowParseError(f"Invalid YAML frontmatter: {e}") from e

        return frontmatter, body

    def _parse_metadata(self, frontmatter: dict[str, Any]) -> WorkflowMetadata:
        """Parse workflow metadata from frontmatter."""
        workflow_data = frontmatter.get("workflow", {})
        compat_data = frontmatter.get("compatibility", {})
        req_data = frontmatter.get("requirements", {})
        exec_data = frontmatter.get("execution", {})

        # Parse agent compatibility
        agent_compat = []
        for agent_item in compat_data.get("agents", []):
            if isinstance(agent_item, dict):
                for agent_name, status in agent_item.items():
                    agent_compat.append(
                        AgentCompatibility(
                            agent_name=agent_name,
                            status=status if isinstance(status, str) else "supported",
                        )
                    )
            elif isinstance(agent_item, str):
                agent_compat.append(AgentCompatibility(agent_name=agent_item, status="supported"))

        # Parse required features
        features = {}
        for feature_item in req_data.get("features", []):
            if isinstance(feature_item, dict):
                features.update(feature_item)
            elif isinstance(feature_item, str):
                features[feature_item] = "required"

        # Parse timeout
        timeout = exec_data.get("timeout", "300s")
        if isinstance(timeout, str):
            timeout = self._parse_duration(timeout)

        # Parse error handling
        error_handling_str = exec_data.get("error_handling", "continue")
        try:
            error_handling = ErrorHandling(error_handling_str)
        except ValueError:
            error_handling = ErrorHandling.CONTINUE

        return WorkflowMetadata(
            id=workflow_data.get("id", "unnamed"),
            name=workflow_data.get("name", "Unnamed Workflow"),
            version=workflow_data.get("version", "1.0.0"),
            description=workflow_data.get("description", ""),
            author=workflow_data.get("author", ""),
            min_version=compat_data.get("min_version", "1.0.0"),
            agent_compatibility=agent_compat,
            required_tools=req_data.get("tools", []),
            required_permissions=req_data.get("permissions", []),
            required_features=features,
            timeout_seconds=timeout,
            max_retries=exec_data.get("max_retries", 3),
            error_handling=error_handling,
            risk_level=frontmatter.get("risk_level", "low"),
            estimated_duration=frontmatter.get("estimated_duration", ""),
        )

    def _parse_triggers(self, frontmatter: dict[str, Any], body: str) -> list[TriggerConfig]:
        """Parse trigger configurations."""
        triggers = []

        # Check frontmatter for triggers
        trigger_data = frontmatter.get("triggers", [])

        # Also check for trigger block in body
        trigger_blocks = self._extract_yaml_blocks(body, "Trigger")
        for block in trigger_blocks:
            if isinstance(block.get("triggers"), list):
                trigger_data.extend(block["triggers"])

        for trigger in trigger_data:
            if isinstance(trigger, dict):
                triggers.append(
                    TriggerConfig(
                        type=trigger.get("type", "manual"),
                        enabled=trigger.get("enabled", True),
                        config=trigger,
                    )
                )

        # Always include manual trigger if none specified
        if not triggers:
            triggers.append(TriggerConfig(type="manual", enabled=True))

        return triggers

    def _parse_inputs(self, frontmatter: dict[str, Any], body: str) -> list[InputParameter]:
        """Parse input parameter definitions."""
        inputs = []

        # Check frontmatter
        input_data = frontmatter.get("inputs", {})

        # Also check for input block in body
        input_blocks = self._extract_yaml_blocks(body, "Input")
        for block in input_blocks:
            if isinstance(block.get("inputs"), dict):
                input_data.update(block["inputs"])

        for name, config in input_data.items():
            if isinstance(config, dict):
                inputs.append(
                    InputParameter(
                        name=name,
                        type=config.get("type", "string"),
                        default=config.get("default"),
                        description=config.get("description", ""),
                        required=config.get("required", False),
                        validation=config.get("validation", {}),
                    )
                )
            else:
                # Simple value as default
                inputs.append(
                    InputParameter(
                        name=name,
                        type="string",
                        default=config,
                    )
                )

        return inputs

    def _parse_steps(self, body: str) -> list[WorkflowStep]:
        """Parse workflow steps from markdown body."""
        steps = []

        # Find all step sections
        step_matches = list(self.STEP_HEADER_PATTERN.finditer(body))

        for i, match in enumerate(step_matches):
            step_num = match.group(1)
            step_title = match.group(2).strip()

            # Get content between this header and the next (or end)
            start = match.end()
            end = step_matches[i + 1].start() if i + 1 < len(step_matches) else len(body)
            step_content = body[start:end]

            # Parse YAML blocks within this step
            yaml_blocks = self.YAML_BLOCK_PATTERN.findall(step_content)

            for block_yaml in yaml_blocks:
                try:
                    block_data = yaml.safe_load(block_yaml)
                    if block_data and isinstance(block_data, dict):
                        step = self._parse_step_block(
                            step_num, step_title, block_data, step_content
                        )
                        if step:
                            steps.append(step)
                except yaml.YAMLError:
                    continue  # Skip invalid YAML blocks

        # If no steps found from headers, try to find action blocks anywhere
        if not steps:
            yaml_blocks = self.YAML_BLOCK_PATTERN.findall(body)
            for block_yaml in yaml_blocks:
                try:
                    block_data = yaml.safe_load(block_yaml)
                    if block_data and isinstance(block_data, dict) and "action" in block_data:
                        self._step_counter += 1
                        step = self._parse_step_block(
                            str(self._step_counter), f"Step {self._step_counter}", block_data, ""
                        )
                        if step:
                            steps.append(step)
                except yaml.YAMLError:
                    continue

        return steps

    def _parse_step_block(
        self, step_num: str, step_title: str, block_data: dict[str, Any], context: str
    ) -> WorkflowStep | None:
        """Parse a single step from a YAML block."""
        action = block_data.get("action")
        if not action:
            return None

        # Generate step ID
        self._step_counter += 1
        step_id = f"step_{step_num.replace('.', '_')}"

        # Parse error handling
        error_config = ErrorConfig()
        if "on_error" in block_data:
            error_data = block_data["on_error"]
            if isinstance(error_data, list):
                # Multiple error handlers
                for handler in error_data:
                    if isinstance(handler, dict):
                        if "error_code" in handler and handler["error_code"] == "default":
                            error_config.on_error = ErrorHandling.CONTINUE
                            error_config.notify_channel = handler.get("notify")
            elif isinstance(error_data, dict):
                error_config.on_error = ErrorHandling(error_data.get("action", "stop"))

        if "fallback" in block_data:
            fallback = block_data["fallback"]
            error_config.fallback_action = fallback.get("on_failure")

        # Parse agent hints
        agent_hints = []
        if "agent_hints" in block_data:
            hints_data = block_data["agent_hints"]
            for agent_name, hints in hints_data.items():
                agent_hints.append(
                    AgentHints(
                        agent_name=agent_name, hints=hints if isinstance(hints, dict) else {}
                    )
                )

        # Parse conditions
        conditions = block_data.get("conditions", [])
        if isinstance(conditions, str):
            conditions = [conditions]

        return WorkflowStep(
            id=step_id,
            name=step_title,
            action=action,
            inputs=block_data.get("inputs", {}),
            output_variable=block_data.get("output_variable"),
            conditions=conditions,
            error_handling=error_config,
            agent_hints=agent_hints,
            description=context[:200] if context else "",
        )

    def _extract_yaml_blocks(self, body: str, section_hint: str) -> list[dict[str, Any]]:
        """Extract YAML blocks that appear to be related to a section."""
        blocks = []

        # Find the section
        pattern = re.compile(rf"^#+\s+.*{section_hint}.*$", re.MULTILINE | re.IGNORECASE)

        matches = list(pattern.finditer(body))
        for i, match in enumerate(matches):
            start = match.end()
            # Find next section or use a reasonable chunk
            next_section = re.search(r"^#{1,4}\s+", body[start:], re.MULTILINE)
            end = start + next_section.start() if next_section else min(start + 2000, len(body))

            section_content = body[start:end]
            yaml_matches = self.YAML_BLOCK_PATTERN.findall(section_content)

            for yaml_content in yaml_matches:
                try:
                    data = yaml.safe_load(yaml_content)
                    if data:
                        blocks.append(data)
                except yaml.YAMLError:
                    continue

        return blocks

    def _parse_duration(self, duration: str) -> int:
        """Parse duration string (e.g., '300s', '5m', '1h') to seconds."""
        duration = duration.strip().lower()

        if duration.endswith("s"):
            return int(duration[:-1])
        elif duration.endswith("m"):
            return int(duration[:-1]) * 60
        elif duration.endswith("h"):
            return int(duration[:-1]) * 3600
        elif duration.endswith("d"):
            return int(duration[:-1]) * 86400
        else:
            try:
                return int(duration)
            except ValueError:
                return 300  # Default 5 minutes

    def validate(self, workflow: Workflow) -> list[str]:
        """
        Validate a parsed workflow.

        Args:
            workflow: Workflow to validate

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        # Check required metadata
        if not workflow.metadata.id:
            errors.append("Workflow must have an ID")

        if not workflow.metadata.name:
            errors.append("Workflow must have a name")

        # Check steps
        if not workflow.steps:
            errors.append("Workflow must have at least one step")

        # Check for duplicate step IDs
        step_ids = set()
        for step in workflow.steps:
            if step.id in step_ids:
                errors.append(f"Duplicate step ID: {step.id}")
            step_ids.add(step.id)

        # Check output variable references
        defined_vars = {"inputs"}
        for step in workflow.steps:
            # Check that referenced variables exist
            for ref in self._extract_variable_refs(step.inputs):
                if ref.split(".")[0] not in defined_vars:
                    errors.append(f"Step '{step.id}' references undefined variable: {ref}")

            # Add output variable to defined set
            if step.output_variable:
                defined_vars.add(step.output_variable)

        return errors

    def _extract_variable_refs(self, obj: Any, refs: set[str] | None = None) -> set[str]:
        """Extract variable references from an object (recursively)."""
        if refs is None:
            refs = set()

        if isinstance(obj, str):
            # Find {variable} patterns
            for match in re.finditer(r"\{([a-zA-Z_][a-zA-Z0-9_.]*)\}", obj):
                refs.add(match.group(1))
        elif isinstance(obj, dict):
            for value in obj.values():
                self._extract_variable_refs(value, refs)
        elif isinstance(obj, list):
            for item in obj:
                self._extract_variable_refs(item, refs)

        return refs
