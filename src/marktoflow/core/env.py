"""
Environment variable management for marktoflow.

Loads environment variables from .env files with support for multiple locations
and provides utilities for accessing configuration values.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


# Flag to track if environment has been loaded
_env_loaded = False


def find_env_files() -> list[Path]:
    """
    Find all .env files in standard locations.

    Searches in priority order (later files override earlier):
    1. User home directory (~/.marktoflow/.env)
    2. Project root (.env)
    3. Project .marktoflow directory (.marktoflow/.env)

    Returns:
        List of existing .env file paths in load order
    """
    env_files: list[Path] = []

    # 1. Home directory
    home_env = Path.home() / ".marktoflow" / ".env"
    if home_env.exists():
        env_files.append(home_env)

    # 2. Find project root (look for marktoflow.yaml or .marktoflow directory)
    cwd = Path.cwd()
    project_root = _find_project_root(cwd)

    if project_root:
        # Project root .env
        root_env = project_root / ".env"
        if root_env.exists():
            env_files.append(root_env)

        # .marktoflow/.env (highest priority)
        marktoflow_env = project_root / ".marktoflow" / ".env"
        if marktoflow_env.exists():
            env_files.append(marktoflow_env)
    else:
        # No project root found, check current directory
        cwd_env = cwd / ".env"
        if cwd_env.exists():
            env_files.append(cwd_env)

    return env_files


def _find_project_root(start_path: Path) -> Path | None:
    """
    Find the project root directory.

    Looks for marktoflow.yaml, .marktoflow/, pyproject.toml, or .git
    to identify the project root.

    Args:
        start_path: Directory to start searching from

    Returns:
        Project root path or None if not found
    """
    current = start_path.resolve()

    # Don't search beyond home directory or root
    home = Path.home()

    while current != current.parent:
        # Check for marktoflow markers
        if (current / "marktoflow.yaml").exists():
            return current
        if (current / ".marktoflow").is_dir():
            return current
        if (current / "pyproject.toml").exists():
            return current
        if (current / ".git").is_dir():
            return current

        # Don't go above home directory
        if current == home:
            break

        current = current.parent

    return None


def load_env(
    env_files: list[Path] | None = None,
    override: bool = False,
) -> dict[str, str]:
    """
    Load environment variables from .env files.

    Args:
        env_files: Specific .env files to load. If None, uses find_env_files()
        override: If True, override existing environment variables

    Returns:
        Dictionary of loaded environment variables
    """
    global _env_loaded

    try:
        from dotenv import dotenv_values
    except ImportError:
        # python-dotenv not installed, return empty
        return {}

    if env_files is None:
        env_files = find_env_files()

    loaded_vars: dict[str, str] = {}

    for env_file in env_files:
        if not env_file.exists():
            continue

        # Load values from file
        file_vars = dotenv_values(env_file)

        for key, value in file_vars.items():
            if value is None:
                continue

            loaded_vars[key] = value

            # Set in environment if not already set (or if override=True)
            if override or key not in os.environ:
                os.environ[key] = value

    _env_loaded = True
    return loaded_vars


def ensure_env_loaded() -> None:
    """
    Ensure environment variables have been loaded.

    This is idempotent - calling it multiple times has no effect
    after the first load.
    """
    global _env_loaded

    if not _env_loaded:
        load_env()


def get_env(
    key: str,
    default: str | None = None,
    required: bool = False,
) -> str | None:
    """
    Get an environment variable value.

    Args:
        key: Environment variable name
        default: Default value if not set
        required: If True, raise error when variable is not set

    Returns:
        Environment variable value or default

    Raises:
        EnvironmentError: If required=True and variable is not set
    """
    ensure_env_loaded()

    value = os.environ.get(key)

    if value is None:
        if required:
            raise EnvironmentError(
                f"Required environment variable '{key}' is not set. "
                f"Please set it in your .env file or environment."
            )
        return default

    return value


def get_env_bool(
    key: str,
    default: bool = False,
) -> bool:
    """
    Get an environment variable as a boolean.

    Truthy values: "true", "1", "yes", "on" (case-insensitive)
    Falsy values: "false", "0", "no", "off", "" (case-insensitive)

    Args:
        key: Environment variable name
        default: Default value if not set

    Returns:
        Boolean value
    """
    value = get_env(key)

    if value is None:
        return default

    return value.lower() in ("true", "1", "yes", "on")


def get_env_int(
    key: str,
    default: int = 0,
) -> int:
    """
    Get an environment variable as an integer.

    Args:
        key: Environment variable name
        default: Default value if not set or invalid

    Returns:
        Integer value
    """
    value = get_env(key)

    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        return default


def get_env_float(
    key: str,
    default: float = 0.0,
) -> float:
    """
    Get an environment variable as a float.

    Args:
        key: Environment variable name
        default: Default value if not set or invalid

    Returns:
        Float value
    """
    value = get_env(key)

    if value is None:
        return default

    try:
        return float(value)
    except ValueError:
        return default


def get_env_list(
    key: str,
    default: list[str] | None = None,
    separator: str = ",",
) -> list[str]:
    """
    Get an environment variable as a list.

    Args:
        key: Environment variable name
        default: Default value if not set
        separator: String separator (default: comma)

    Returns:
        List of string values
    """
    value = get_env(key)

    if value is None:
        return default or []

    return [item.strip() for item in value.split(separator) if item.strip()]


# API Keys and service configuration
class EnvConfig:
    """
    Centralized environment configuration.

    Provides typed access to all marktoflow environment variables.
    """

    # ==========================================================================
    # AI Provider API Keys
    # ==========================================================================

    @staticmethod
    def anthropic_api_key() -> str | None:
        """Get Anthropic API key for Claude."""
        return get_env("ANTHROPIC_API_KEY")

    @staticmethod
    def openai_api_key() -> str | None:
        """Get OpenAI API key."""
        return get_env("OPENAI_API_KEY")

    @staticmethod
    def google_api_key() -> str | None:
        """Get Google AI API key (for Gemini)."""
        return get_env("GOOGLE_API_KEY") or get_env("GEMINI_API_KEY")

    @staticmethod
    def cohere_api_key() -> str | None:
        """Get Cohere API key."""
        return get_env("COHERE_API_KEY")

    @staticmethod
    def mistral_api_key() -> str | None:
        """Get Mistral API key."""
        return get_env("MISTRAL_API_KEY")

    @staticmethod
    def groq_api_key() -> str | None:
        """Get Groq API key."""
        return get_env("GROQ_API_KEY")

    @staticmethod
    def together_api_key() -> str | None:
        """Get Together AI API key."""
        return get_env("TOGETHER_API_KEY")

    @staticmethod
    def fireworks_api_key() -> str | None:
        """Get Fireworks AI API key."""
        return get_env("FIREWORKS_API_KEY")

    @staticmethod
    def replicate_api_key() -> str | None:
        """Get Replicate API token."""
        return get_env("REPLICATE_API_TOKEN")

    @staticmethod
    def huggingface_api_key() -> str | None:
        """Get HuggingFace API token."""
        return get_env("HUGGINGFACE_API_KEY") or get_env("HF_TOKEN")

    # ==========================================================================
    # Local LLM Configuration
    # ==========================================================================

    @staticmethod
    def ollama_host() -> str:
        """Get Ollama API host."""
        return get_env("OLLAMA_HOST", "http://localhost:11434")

    @staticmethod
    def ollama_model() -> str:
        """Get default Ollama model."""
        return get_env("OLLAMA_MODEL", "llama3")

    @staticmethod
    def lmstudio_host() -> str:
        """Get LM Studio API host."""
        return get_env("LMSTUDIO_HOST", "http://localhost:1234")

    # ==========================================================================
    # Claude Code CLI Configuration
    # ==========================================================================

    @staticmethod
    def claude_code_mode() -> str:
        """Get Claude Code execution mode (cli, sdk)."""
        return get_env("CLAUDE_CODE_MODE", "cli")

    @staticmethod
    def claude_code_cli_path() -> str:
        """Get Claude Code CLI path."""
        return get_env("CLAUDE_CODE_CLI_PATH", "claude")

    @staticmethod
    def claude_code_model() -> str:
        """Get Claude Code model (sonnet, opus, haiku)."""
        return get_env("CLAUDE_CODE_MODEL", "sonnet")

    @staticmethod
    def claude_code_timeout() -> int:
        """Get Claude Code timeout in seconds."""
        return get_env_int("CLAUDE_CODE_TIMEOUT", 300)

    # ==========================================================================
    # OpenCode Configuration
    # ==========================================================================

    @staticmethod
    def opencode_server_url() -> str:
        """Get OpenCode server URL."""
        return get_env("OPENCODE_SERVER_URL", "http://localhost:4096")

    @staticmethod
    def opencode_mode() -> str:
        """Get OpenCode execution mode (auto, cli, server)."""
        return get_env("OPENCODE_MODE", "auto")

    # ==========================================================================
    # MCP Server Configuration
    # ==========================================================================

    @staticmethod
    def mcp_server_url() -> str | None:
        """Get MCP server URL."""
        return get_env("MCP_SERVER_URL")

    # ==========================================================================
    # External Service Integrations
    # ==========================================================================

    @staticmethod
    def github_token() -> str | None:
        """Get GitHub personal access token."""
        return get_env("GITHUB_TOKEN") or get_env("GH_TOKEN")

    @staticmethod
    def gitlab_token() -> str | None:
        """Get GitLab personal access token."""
        return get_env("GITLAB_TOKEN")

    @staticmethod
    def jira_api_token() -> str | None:
        """Get Jira API token."""
        return get_env("JIRA_API_TOKEN")

    @staticmethod
    def jira_base_url() -> str | None:
        """Get Jira base URL."""
        return get_env("JIRA_BASE_URL")

    @staticmethod
    def jira_email() -> str | None:
        """Get Jira email for authentication."""
        return get_env("JIRA_EMAIL")

    @staticmethod
    def slack_token() -> str | None:
        """Get Slack bot token."""
        return get_env("SLACK_TOKEN") or get_env("SLACK_BOT_TOKEN")

    @staticmethod
    def slack_webhook_url() -> str | None:
        """Get Slack webhook URL."""
        return get_env("SLACK_WEBHOOK_URL")

    @staticmethod
    def discord_webhook_url() -> str | None:
        """Get Discord webhook URL."""
        return get_env("DISCORD_WEBHOOK_URL")

    @staticmethod
    def linear_api_key() -> str | None:
        """Get Linear API key."""
        return get_env("LINEAR_API_KEY")

    @staticmethod
    def notion_api_key() -> str | None:
        """Get Notion API key."""
        return get_env("NOTION_API_KEY")

    # ==========================================================================
    # Database and Queue Configuration
    # ==========================================================================

    @staticmethod
    def redis_url() -> str:
        """Get Redis connection URL."""
        return get_env("REDIS_URL", "redis://localhost:6379")

    @staticmethod
    def rabbitmq_url() -> str:
        """Get RabbitMQ connection URL."""
        return get_env("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")

    @staticmethod
    def database_url() -> str | None:
        """Get database connection URL."""
        return get_env("DATABASE_URL")

    # ==========================================================================
    # Application Configuration
    # ==========================================================================

    @staticmethod
    def log_level() -> str:
        """Get log level."""
        return get_env("MARKTOFLOW_LOG_LEVEL", "INFO")

    @staticmethod
    def debug() -> bool:
        """Check if debug mode is enabled."""
        return get_env_bool("MARKTOFLOW_DEBUG", False)

    @staticmethod
    def metrics_port() -> int:
        """Get Prometheus metrics port."""
        return get_env_int("MARKTOFLOW_METRICS_PORT", 9090)

    @staticmethod
    def webhook_port() -> int:
        """Get webhook server port."""
        return get_env_int("MARKTOFLOW_WEBHOOK_PORT", 8080)

    @staticmethod
    def state_dir() -> str:
        """Get state directory path."""
        return get_env("MARKTOFLOW_STATE_DIR", ".marktoflow/state")

    @staticmethod
    def encryption_key() -> str | None:
        """Get encryption key for credentials."""
        return get_env("MARKTOFLOW_ENCRYPTION_KEY")

    @staticmethod
    def max_concurrent_workflows() -> int:
        """Get maximum concurrent workflows."""
        return get_env_int("MARKTOFLOW_MAX_CONCURRENT", 5)


# Convenience alias
config = EnvConfig
