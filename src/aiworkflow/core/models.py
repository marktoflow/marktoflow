"""
Data models for aiworkflow framework.

These models represent workflows, steps, execution context, and results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class StepStatus(str, Enum):
    """Status of a workflow step execution."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStatus(str, Enum):
    """Status of a workflow execution."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ErrorHandling(str, Enum):
    """Error handling strategy for workflows."""

    CONTINUE = "continue"
    STOP = "stop"
    ROLLBACK = "rollback"


class ToolType(str, Enum):
    """Type of tool implementation."""

    MCP = "mcp"
    OPENAPI = "openapi"
    CUSTOM = "custom"


@dataclass
class ErrorConfig:
    """Error handling configuration for a step."""

    on_error: ErrorHandling = ErrorHandling.STOP
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    fallback_action: str | None = None
    notify_channel: str | None = None


@dataclass
class AgentHints:
    """Agent-specific hints for step execution."""

    agent_name: str
    hints: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowStep:
    """
    Represents a single step in a workflow.

    A step can be:
    - A tool action (e.g., jira.create_issue)
    - An agent analysis task (e.g., agent.analyze)
    - A control flow statement (condition, loop)
    """

    id: str
    name: str
    action: str  # e.g., "jira.create_issue", "agent.analyze"
    inputs: dict[str, Any] = field(default_factory=dict)
    output_variable: str | None = None
    conditions: list[str] = field(default_factory=list)
    error_handling: ErrorConfig = field(default_factory=ErrorConfig)
    agent_hints: list[AgentHints] = field(default_factory=list)
    description: str = ""

    def get_tool_name(self) -> str:
        """Extract tool name from action (e.g., 'jira' from 'jira.create_issue')."""
        if "." in self.action:
            return self.action.split(".")[0]
        return self.action

    def get_operation(self) -> str:
        """Extract operation from action (e.g., 'create_issue' from 'jira.create_issue')."""
        if "." in self.action:
            return self.action.split(".", 1)[1]
        return self.action

    def get_hints_for_agent(self, agent_name: str) -> dict[str, Any]:
        """Get agent-specific hints for this step."""
        for hint in self.agent_hints:
            if hint.agent_name == agent_name:
                return hint.hints
        return {}


@dataclass
class TriggerConfig:
    """Configuration for workflow triggers."""

    type: str  # "schedule", "webhook", "manual", "event"
    enabled: bool = True
    config: dict[str, Any] = field(default_factory=dict)


@dataclass
class InputParameter:
    """Definition of a workflow input parameter."""

    name: str
    type: str  # "string", "integer", "float", "boolean", "object", "array"
    default: Any = None
    description: str = ""
    required: bool = False
    validation: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentCompatibility:
    """Agent compatibility information for a workflow."""

    agent_name: str
    status: str  # "recommended", "supported", "partial", "experimental"
    notes: str = ""


@dataclass
class WorkflowMetadata:
    """Metadata for a workflow from YAML frontmatter."""

    id: str
    name: str
    version: str = "1.0.0"
    description: str = ""
    author: str = ""

    # Compatibility
    min_version: str = "1.0.0"
    agent_compatibility: list[AgentCompatibility] = field(default_factory=list)

    # Requirements
    required_tools: list[str] = field(default_factory=list)
    required_permissions: list[str] = field(default_factory=list)
    required_features: dict[str, str] = field(
        default_factory=dict
    )  # feature: required/recommended/optional

    # Execution settings
    timeout_seconds: int = 300
    max_retries: int = 3
    error_handling: ErrorHandling = ErrorHandling.CONTINUE

    # Risk and estimates
    risk_level: str = "low"  # low, medium, high
    estimated_duration: str = ""


@dataclass
class Workflow:
    """
    Complete workflow definition parsed from markdown file.

    Contains metadata, triggers, inputs, and steps.
    """

    metadata: WorkflowMetadata
    triggers: list[TriggerConfig] = field(default_factory=list)
    inputs: list[InputParameter] = field(default_factory=list)
    steps: list[WorkflowStep] = field(default_factory=list)
    raw_content: str = ""
    source_path: str = ""

    def get_required_tools(self) -> set[str]:
        """Get all tools required by this workflow."""
        tools = set(self.metadata.required_tools)
        for step in self.steps:
            tool_name = step.get_tool_name()
            if tool_name and tool_name != "agent":
                tools.add(tool_name)
        return tools

    def get_agent_compatibility(self, agent_name: str) -> AgentCompatibility | None:
        """Get compatibility info for a specific agent."""
        for compat in self.metadata.agent_compatibility:
            if compat.agent_name == agent_name:
                return compat
        return None

    def is_compatible_with(self, agent_name: str) -> bool:
        """Check if workflow is compatible with an agent."""
        compat = self.get_agent_compatibility(agent_name)
        if compat is None:
            return True  # Assume compatible if not specified
        return compat.status in ("recommended", "supported", "partial")


@dataclass
class ToolConfig:
    """Configuration for a tool."""

    name: str
    type: ToolType
    priority: int = 1
    config_path: str = ""
    spec_path: str = ""
    adapter_path: str = ""
    agent_compatibility: dict[str, str] = field(default_factory=dict)
    authentication: dict[str, Any] = field(default_factory=dict)
    rate_limits: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentCapabilities:
    """Capabilities of an AI agent."""

    name: str
    version: str
    provider: str

    # Core features
    tool_calling: str  # "native", "supported", "limited"
    reasoning: str  # "advanced", "basic"
    streaming: bool = True
    code_execution: bool = True
    file_creation: bool = True

    # MCP support
    mcp_native: bool = False
    mcp_via_bridge: bool = False

    # Advanced features
    extended_reasoning: bool = False
    multi_turn: bool = True
    context_window: int = 100000
    web_search: bool = False

    # Model info (for agents with multiple model support)
    supported_models: list[dict[str, Any]] = field(default_factory=list)

    def supports_feature(self, feature: str) -> bool:
        """Check if agent supports a specific feature."""
        feature_map = {
            "tool_calling": self.tool_calling in ("native", "supported"),
            "reasoning": True,
            "advanced_reasoning": self.reasoning == "advanced",
            "streaming": self.streaming,
            "code_execution": self.code_execution,
            "file_creation": self.file_creation,
            "mcp": self.mcp_native or self.mcp_via_bridge,
            "mcp_native": self.mcp_native,
            "extended_reasoning": self.extended_reasoning,
            "multi_turn": self.multi_turn,
            "web_search": self.web_search,
        }
        return feature_map.get(feature, False)


@dataclass
class ExecutionContext:
    """
    Context passed through workflow execution.

    Contains variables, configuration, and execution state.
    """

    run_id: str
    workflow: Workflow
    agent_name: str
    agent_capabilities: AgentCapabilities

    # Variables accumulated during execution
    variables: dict[str, Any] = field(default_factory=dict)

    # Input parameters provided at runtime
    inputs: dict[str, Any] = field(default_factory=dict)

    # Execution tracking
    current_step_index: int = 0
    started_at: datetime | None = None

    # Configuration
    config: dict[str, Any] = field(default_factory=dict)

    def get_variable(self, name: str, default: Any = None) -> Any:
        """Get a variable from the context."""
        return self.variables.get(name, default)

    def set_variable(self, name: str, value: Any) -> None:
        """Set a variable in the context."""
        self.variables[name] = value

    def resolve_template(self, template: str) -> str:
        """Resolve template variables in a string."""
        # Simple template resolution - can be enhanced with Jinja2
        result = template
        for key, value in self.variables.items():
            result = result.replace(f"{{{key}}}", str(value))
        for key, value in self.inputs.items():
            result = result.replace(f"{{inputs.{key}}}", str(value))
        return result


@dataclass
class StepResult:
    """Result of executing a single workflow step."""

    step_id: str
    status: StepStatus
    output: Any = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    retries: int = 0
    metadata: dict[str, Any] | None = None

    @property
    def duration_seconds(self) -> float | None:
        """Calculate execution duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def success(self) -> bool:
        """Check if step completed successfully."""
        return self.status == StepStatus.COMPLETED


@dataclass
class WorkflowResult:
    """Result of executing a complete workflow."""

    run_id: str
    workflow_id: str
    agent_name: str
    status: WorkflowStatus
    step_results: list[StepResult] = field(default_factory=list)
    final_output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def duration_seconds(self) -> float | None:
        """Calculate total execution duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def success(self) -> bool:
        """Check if workflow completed successfully."""
        return self.status == WorkflowStatus.COMPLETED

    @property
    def steps_succeeded(self) -> int:
        """Count of successfully completed steps."""
        return sum(1 for r in self.step_results if r.success)

    @property
    def steps_failed(self) -> int:
        """Count of failed steps."""
        return sum(1 for r in self.step_results if r.status == StepStatus.FAILED)
