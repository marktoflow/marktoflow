"""
Main CLI entry point for aiworkflow.

Usage:
    aiworkflow init           Initialize a new project
    aiworkflow run            Run a workflow
    aiworkflow workflow       Workflow management commands
    aiworkflow agent          Agent management commands
    aiworkflow tools          Tool management commands
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

app = typer.Typer(
    name="aiworkflow",
    help="Universal AI Workflow Automation Framework",
    add_completion=False,
)

console = Console()

# Sub-command groups
workflow_app = typer.Typer(help="Workflow management commands")
agent_app = typer.Typer(help="Agent management commands")
tools_app = typer.Typer(help="Tool management commands")

app.add_typer(workflow_app, name="workflow")
app.add_typer(agent_app, name="agent")
app.add_typer(tools_app, name="tools")


@app.command()
def init(
    path: Optional[Path] = typer.Argument(
        None,
        help="Path to initialize the project in (defaults to current directory)",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Overwrite existing configuration",
    ),
) -> None:
    """Initialize a new aiworkflow project."""
    project_path = path or Path.cwd()
    aiworkflow_dir = project_path / ".aiworkflow"

    if aiworkflow_dir.exists() and not force:
        console.print("[yellow]Project already initialized. Use --force to reinitialize.[/yellow]")
        raise typer.Exit(1)

    # Create directory structure
    directories = [
        ".aiworkflow/agents",
        ".aiworkflow/workflows",
        ".aiworkflow/tools/mcp",
        ".aiworkflow/tools/openapi",
        ".aiworkflow/tools/custom",
        ".aiworkflow/triggers",
        ".aiworkflow/state/credentials",
        ".aiworkflow/state/execution-logs",
        ".aiworkflow/state/workflow-state",
        ".aiworkflow/plugins",
    ]

    for dir_path in directories:
        (project_path / dir_path).mkdir(parents=True, exist_ok=True)

    # Create default configuration
    config_path = project_path / "aiworkflow.yaml"
    if not config_path.exists() or force:
        config_content = """# aiworkflow configuration
version: "1.0"
framework: aiworkflow

agent:
  primary: opencode
  fallback: null
  selection_strategy: manual

runtime:
  mode: local
  python_version: "3.11"

logging:
  level: info
  destination: file
  format: markdown
  log_path: .aiworkflow/state/execution-logs/

tools:
  discovery: auto
  timeout: 30s
  registry_path: .aiworkflow/tools/registry.yaml

workflows:
  path: .aiworkflow/workflows/
  max_concurrent: 5
  default_timeout: 300s

features:
  mcp_bridge: enabled
  auto_healing: enabled
"""
        config_path.write_text(config_content)

    # Create capabilities file
    capabilities_path = project_path / ".aiworkflow/agents/capabilities.yaml"
    if not capabilities_path.exists() or force:
        capabilities_content = """# Agent Capability Matrix
agents:
  claude-code:
    version: "1.0.0"
    provider: anthropic
    capabilities:
      tool_calling: native
      reasoning: advanced
      mcp:
        native_support: true
        
  opencode:
    version: "0.1.0"
    provider: open_source
    capabilities:
      tool_calling: supported
      reasoning: basic
      mcp:
        native_support: true
"""
        capabilities_path.write_text(capabilities_content)

    # Create empty registry
    registry_path = project_path / ".aiworkflow/tools/registry.yaml"
    if not registry_path.exists() or force:
        registry_content = """# Tool Registry
tools: []
"""
        registry_path.write_text(registry_content)

    # Create .gitignore for state
    gitignore_path = project_path / ".aiworkflow/state/.gitignore"
    gitignore_path.write_text("credentials/\n*.encrypted\n")

    console.print(
        Panel(
            "[green]Project initialized successfully![/green]\n\n"
            f"Created: {aiworkflow_dir}\n"
            f"Config: {config_path}\n\n"
            "Next steps:\n"
            "  1. Add workflows to .aiworkflow/workflows/\n"
            "  2. Configure tools in .aiworkflow/tools/\n"
            "  3. Run: aiworkflow workflow run <workflow.md>",
            title="aiworkflow",
        )
    )


@app.command()
def run(
    workflow: Path = typer.Argument(
        ...,
        help="Path to the workflow file",
    ),
    agent: Optional[str] = typer.Option(
        None,
        "--agent",
        "-a",
        help="Agent to use for execution (overrides config)",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Validate and show execution plan without running",
    ),
    input_param: Optional[list[str]] = typer.Option(
        None,
        "--input",
        "-i",
        help="Input parameters (format: key=value)",
    ),
) -> None:
    """Run a workflow."""
    import asyncio

    if not workflow.exists():
        console.print(f"[red]Workflow not found: {workflow}[/red]")
        raise typer.Exit(1)

    # Parse inputs
    inputs = {}
    if input_param:
        for param in input_param:
            if "=" in param:
                key, value = param.split("=", 1)
                inputs[key] = value

    # Load and parse workflow
    from aiworkflow.core.parser import WorkflowParser

    parser = WorkflowParser()
    try:
        wf = parser.parse_file(workflow)
    except Exception as e:
        console.print(f"[red]Failed to parse workflow: {e}[/red]")
        raise typer.Exit(1)

    # Validate
    errors = parser.validate(wf)
    if errors:
        console.print("[red]Validation errors:[/red]")
        for error in errors:
            console.print(f"  - {error}")
        raise typer.Exit(1)

    if dry_run:
        _show_execution_plan(wf)
        return

    # Run workflow
    from aiworkflow.core.engine import WorkflowEngine

    console.print(f"[cyan]Running workflow: {wf.metadata.name}[/cyan]")
    console.print(f"Agent: {agent or 'default'}")
    console.print()

    engine = WorkflowEngine(config={"agent": {"primary": agent or "opencode"}})

    with console.status("[cyan]Executing workflow...[/cyan]"):
        result = asyncio.run(engine.execute(wf, inputs=inputs))

    if result.success:
        console.print(
            Panel(
                f"[green]Workflow completed successfully![/green]\n\n"
                f"Run ID: {result.run_id}\n"
                f"Duration: {result.duration_seconds:.2f}s\n"
                f"Steps: {result.steps_succeeded}/{len(result.step_results)}",
                title="Success",
            )
        )
    else:
        console.print(
            Panel(
                f"[red]Workflow failed[/red]\n\n"
                f"Error: {result.error}\n"
                f"Steps completed: {result.steps_succeeded}/{len(result.step_results)}",
                title="Failed",
            )
        )
        raise typer.Exit(1)


def _show_execution_plan(wf) -> None:
    """Display workflow execution plan."""
    console.print(
        Panel(
            f"[cyan]{wf.metadata.name}[/cyan]\n"
            f"Version: {wf.metadata.version}\n"
            f"ID: {wf.metadata.id}",
            title="Workflow",
        )
    )

    # Show steps
    table = Table(title="Execution Steps")
    table.add_column("Step", style="cyan")
    table.add_column("Action", style="green")
    table.add_column("Output Variable")

    for step in wf.steps:
        table.add_row(
            step.name,
            step.action,
            step.output_variable or "-",
        )

    console.print(table)

    # Show required tools
    tools = wf.get_required_tools()
    if tools:
        console.print(f"\n[yellow]Required tools:[/yellow] {', '.join(tools)}")


# Workflow commands
@workflow_app.command("list")
def workflow_list() -> None:
    """List available workflows."""
    workflows_dir = Path(".aiworkflow/workflows")

    if not workflows_dir.exists():
        console.print("[yellow]No workflows directory found. Run 'aiworkflow init' first.[/yellow]")
        raise typer.Exit(1)

    workflows = list(workflows_dir.glob("*.md"))

    if not workflows:
        console.print("[yellow]No workflows found in .aiworkflow/workflows/[/yellow]")
        return

    from aiworkflow.core.parser import WorkflowParser

    parser = WorkflowParser()

    table = Table(title="Available Workflows")
    table.add_column("Name", style="cyan")
    table.add_column("ID")
    table.add_column("Version")
    table.add_column("File")

    for wf_path in workflows:
        try:
            wf = parser.parse_file(wf_path)
            table.add_row(
                wf.metadata.name,
                wf.metadata.id,
                wf.metadata.version,
                wf_path.name,
            )
        except Exception as e:
            table.add_row(
                f"[red]Error[/red]",
                "-",
                "-",
                f"{wf_path.name} ({e})",
            )

    console.print(table)


@workflow_app.command("validate")
def workflow_validate(
    workflow: Path = typer.Argument(..., help="Path to workflow file"),
) -> None:
    """Validate a workflow file."""
    from aiworkflow.core.parser import WorkflowParser

    parser = WorkflowParser()

    try:
        wf = parser.parse_file(workflow)
        errors = parser.validate(wf)

        if errors:
            console.print("[red]Validation failed:[/red]")
            for error in errors:
                console.print(f"  - {error}")
            raise typer.Exit(1)
        else:
            console.print(f"[green]Workflow '{wf.metadata.name}' is valid.[/green]")

    except Exception as e:
        console.print(f"[red]Failed to parse workflow: {e}[/red]")
        raise typer.Exit(1)


@workflow_app.command("show")
def workflow_show(
    workflow: Path = typer.Argument(..., help="Path to workflow file"),
) -> None:
    """Show workflow details."""
    from aiworkflow.core.parser import WorkflowParser

    parser = WorkflowParser()

    try:
        wf = parser.parse_file(workflow)
        _show_execution_plan(wf)
    except Exception as e:
        console.print(f"[red]Failed to parse workflow: {e}[/red]")
        raise typer.Exit(1)


# Agent commands
@agent_app.command("list")
def agent_list() -> None:
    """List available agents."""
    from aiworkflow.agents import AgentRegistry

    # Register built-in agents
    from aiworkflow.agents.claude import ClaudeCodeAdapter  # noqa: F401
    from aiworkflow.agents.opencode import OpenCodeAdapter  # noqa: F401

    agents = AgentRegistry.list_agents()

    table = Table(title="Available Agents")
    table.add_column("Name", style="cyan")
    table.add_column("Status")

    for agent_name in agents:
        table.add_row(agent_name, "[green]Registered[/green]")

    # Also show known agents that aren't registered
    known_agents = ["claude-code", "opencode", "aider", "codex", "gemini-cli"]
    for agent_name in known_agents:
        if agent_name not in agents:
            table.add_row(agent_name, "[yellow]Not installed[/yellow]")

    console.print(table)


@agent_app.command("info")
def agent_info(
    agent: str = typer.Argument(..., help="Agent name"),
) -> None:
    """Show agent information."""
    capabilities_path = Path(".aiworkflow/agents/capabilities.yaml")

    if not capabilities_path.exists():
        console.print("[yellow]No capabilities file found.[/yellow]")
        raise typer.Exit(1)

    import yaml

    caps = yaml.safe_load(capabilities_path.read_text())

    agent_info = caps.get("agents", {}).get(agent)
    if not agent_info:
        console.print(f"[red]Agent not found: {agent}[/red]")
        raise typer.Exit(1)

    console.print(
        Panel(
            f"[cyan]{agent}[/cyan]\n"
            f"Version: {agent_info.get('version', 'unknown')}\n"
            f"Provider: {agent_info.get('provider', 'unknown')}",
            title="Agent Info",
        )
    )

    # Show capabilities
    capabilities = agent_info.get("capabilities", {})
    table = Table(title="Capabilities")
    table.add_column("Feature")
    table.add_column("Value")

    for key, value in capabilities.items():
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                table.add_row(f"  {key}.{sub_key}", str(sub_value))
        else:
            table.add_row(key, str(value))

    console.print(table)


# Tools commands
@tools_app.command("list")
def tools_list() -> None:
    """List available tools."""
    from aiworkflow.tools.registry import ToolRegistry

    registry_path = Path(".aiworkflow/tools/registry.yaml")

    if not registry_path.exists():
        console.print("[yellow]No tool registry found. Run 'aiworkflow init' first.[/yellow]")
        return

    registry = ToolRegistry(registry_path)
    tools = registry.list_tools()

    if not tools:
        console.print("[yellow]No tools registered.[/yellow]")
        return

    table = Table(title="Registered Tools")
    table.add_column("Name", style="cyan")
    table.add_column("Category")
    table.add_column("Types")

    for tool_name in tools:
        definition = registry.get_definition(tool_name)
        if definition:
            types = [impl.type.value for impl in definition.implementations]
            table.add_row(
                tool_name,
                definition.category,
                ", ".join(types),
            )

    console.print(table)


@app.command()
def version() -> None:
    """Show version information."""
    from aiworkflow import __version__

    console.print(f"aiworkflow version {__version__}")


@app.callback()
def main() -> None:
    """Universal AI Workflow Automation Framework."""
    pass


if __name__ == "__main__":
    app()
