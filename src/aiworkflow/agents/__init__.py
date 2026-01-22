"""
Agent adapters for aiworkflow framework.
"""

from aiworkflow.agents.base import AgentAdapter, AgentRegistry, register_agent

# Import adapters to register them
from aiworkflow.agents.claude import ClaudeCodeAdapter
from aiworkflow.agents.opencode import OpenCodeAdapter

__all__ = [
    "AgentAdapter",
    "AgentRegistry",
    "register_agent",
    "ClaudeCodeAdapter",
    "OpenCodeAdapter",
]
