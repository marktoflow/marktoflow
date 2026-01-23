"""
Agent adapters for marktoflow framework.
"""

from marktoflow.agents.base import AgentAdapter, AgentRegistry, register_agent

# Import adapters to register them
from marktoflow.agents.claude import ClaudeCodeAdapter
from marktoflow.agents.ollama import OllamaAdapter
from marktoflow.agents.opencode import OpenCodeAdapter

__all__ = [
    "AgentAdapter",
    "AgentRegistry",
    "register_agent",
    "ClaudeCodeAdapter",
    "OllamaAdapter",
    "OpenCodeAdapter",
]
