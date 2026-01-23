"""
CLI for marktoflow framework.
"""

from typing import Any

__all__ = ["app"]


def __getattr__(name: str) -> Any:
    if name == "app":
        from marktoflow.cli.main import app

        return app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
