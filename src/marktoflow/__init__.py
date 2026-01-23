"""
marktoflow - Universal AI Workflow Automation Framework

Write once, run on any AI coding agent (Claude Code, OpenCode, Aider, etc.)
"""

__version__ = "0.1.0"
__author__ = "Scott"

from marktoflow.core.models import (
    Workflow,
    WorkflowStep,
    ExecutionContext,
    StepResult,
    WorkflowResult,
)
from marktoflow.core.parser import WorkflowParser
from marktoflow.core.engine import WorkflowEngine

__all__ = [
    "Workflow",
    "WorkflowStep",
    "ExecutionContext",
    "StepResult",
    "WorkflowResult",
    "WorkflowParser",
    "WorkflowEngine",
    "__version__",
]
