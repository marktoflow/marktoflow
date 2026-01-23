"""
Main CLI entry point for marktoflow.

Usage:
    marktoflow init           Initialize a new project
    marktoflow run            Run a workflow
    marktoflow workflow       Workflow management commands
    marktoflow agent          Agent management commands
    marktoflow tools          Tool management commands
"""

from __future__ import annotations

import json as json_module
from pathlib import Path
from typing import Any, Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

app = typer.Typer(
    name="marktoflow",
    help="Universal AI Workflow Automation Framework",
    add_completion=False,
)

console = Console()


# Global state for verbose and JSON output modes
class OutputConfig:
    verbose: bool = False
    json_output: bool = False


output_config = OutputConfig()


def log_verbose(message: str) -> None:
    """Print message only in verbose mode."""
    if output_config.verbose and not output_config.json_output:
        console.print(f"[dim]{message}[/dim]")


def output_json(data: dict) -> None:
    """Output data as JSON."""
    console.print(json_module.dumps(data, indent=2, default=str))


def output_result(data: dict, table: Table | None = None, panel: Panel | None = None) -> None:
    """Output result in JSON or rich format based on config."""
    if output_config.json_output:
        output_json(data)
    elif panel:
        console.print(panel)
    elif table:
        console.print(table)


# Sub-command groups
workflow_app = typer.Typer(help="Workflow management commands")
agent_app = typer.Typer(help="Agent management commands")
tools_app = typer.Typer(help="Tool management commands")
schedule_app = typer.Typer(help="Scheduler management commands")
bundle_app = typer.Typer(help="Workflow bundle commands")
template_app = typer.Typer(help="Workflow template commands")

app.add_typer(workflow_app, name="workflow")
app.add_typer(agent_app, name="agent")
app.add_typer(tools_app, name="tools")
app.add_typer(schedule_app, name="schedule")
app.add_typer(bundle_app, name="bundle")
app.add_typer(template_app, name="template")


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
    """Initialize a new marktoflow project."""
    project_path = path or Path.cwd()
    marktoflow_dir = project_path / ".marktoflow"

    if marktoflow_dir.exists() and not force:
        console.print("[yellow]Project already initialized. Use --force to reinitialize.[/yellow]")
        raise typer.Exit(1)

    # Create directory structure
    directories = [
        ".marktoflow/agents",
        ".marktoflow/workflows",
        ".marktoflow/tools/mcp",
        ".marktoflow/tools/openapi",
        ".marktoflow/tools/custom",
        ".marktoflow/triggers",
        ".marktoflow/state/credentials",
        ".marktoflow/state/execution-logs",
        ".marktoflow/state/workflow-state",
        ".marktoflow/plugins",
    ]

    for dir_path in directories:
        (project_path / dir_path).mkdir(parents=True, exist_ok=True)

    # Create default configuration
    config_path = project_path / "marktoflow.yaml"
    if not config_path.exists() or force:
        config_content = """# marktoflow configuration
version: "1.0"
framework: marktoflow

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
  log_path: .marktoflow/state/execution-logs/

tools:
  discovery: auto
  timeout: 30s
  registry_path: .marktoflow/tools/registry.yaml

workflows:
  path: .marktoflow/workflows/
  max_concurrent: 5
  default_timeout: 300s

features:
  mcp_bridge: enabled
  auto_healing: enabled
"""
        config_path.write_text(config_content)

    # Create capabilities file
    capabilities_path = project_path / ".marktoflow/agents/capabilities.yaml"
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
    registry_path = project_path / ".marktoflow/tools/registry.yaml"
    if not registry_path.exists() or force:
        registry_content = """# Tool Registry
tools: []
"""
        registry_path.write_text(registry_content)

    # Create .gitignore for state
    gitignore_path = project_path / ".marktoflow/state/.gitignore"
    gitignore_path.write_text("credentials/\n*.encrypted\n")

    console.print(
        Panel(
            "[green]Project initialized successfully![/green]\n\n"
            f"Created: {marktoflow_dir}\n"
            f"Config: {config_path}\n\n"
            "Next steps:\n"
            "  1. Add workflows to .marktoflow/workflows/\n"
            "  2. Configure tools in .marktoflow/tools/\n"
            "  3. Run: marktoflow workflow run <workflow.md>",
            title="marktoflow",
        )
    )


@app.command()
def run(
    workflow: Path = typer.Argument(
        ...,
        help="Path to the workflow file or bundle directory",
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
    """Run a workflow or bundle."""
    import asyncio

    log_verbose(f"Loading workflow: {workflow}")

    if not workflow.exists():
        if output_config.json_output:
            output_json(
                {
                    "error": f"Workflow not found: {workflow}",
                    "suggestion": "Check the path and try again",
                }
            )
        else:
            console.print(f"[red]Workflow not found: {workflow}[/red]")
            console.print(
                "[dim]Tip: Use 'marktoflow workflow list' to see available workflows[/dim]"
            )
        raise typer.Exit(1)

    # Check if this is a bundle directory
    from marktoflow.tools.bundle import is_bundle

    if workflow.is_dir() and is_bundle(workflow):
        log_verbose("Detected bundle directory, delegating to bundle run")
        # Delegate to bundle run
        bundle_run(
            path=workflow,
            agent=agent,
            dry_run=dry_run,
            input_param=input_param,
        )
        return

    # Parse inputs
    inputs = {}
    if input_param:
        for param in input_param:
            if "=" in param:
                key, value = param.split("=", 1)
                inputs[key] = value
                log_verbose(f"Input: {key}={value}")

    # Load and parse workflow
    from marktoflow.core.parser import WorkflowParser

    parser = WorkflowParser()
    try:
        wf = parser.parse_file(workflow)
        log_verbose(f"Parsed workflow: {wf.metadata.name}")
    except Exception as e:
        if output_config.json_output:
            output_json(
                {"error": f"Failed to parse workflow: {e}", "suggestion": "Check workflow syntax"}
            )
        else:
            console.print(f"[red]Failed to parse workflow: {e}[/red]")
            console.print(
                "[dim]Tip: Use 'marktoflow workflow validate' to check for syntax errors[/dim]"
            )
        raise typer.Exit(1)

    # Validate
    errors = parser.validate(wf)
    if errors:
        if output_config.json_output:
            output_json({"error": "Validation failed", "errors": errors})
        else:
            console.print("[red]Validation errors:[/red]")
            for error in errors:
                console.print(f"  - {error}")
        raise typer.Exit(1)

    if dry_run:
        if output_config.json_output:
            output_json(
                {
                    "dry_run": True,
                    "workflow": {
                        "id": wf.metadata.id,
                        "name": wf.metadata.name,
                        "steps": len(wf.steps),
                    },
                    "required_tools": wf.get_required_tools(),
                }
            )
        else:
            _show_execution_plan(wf)
        return

    # Run workflow
    from marktoflow.core.engine import WorkflowEngine

    if not output_config.json_output:
        console.print(f"[cyan]Running workflow: {wf.metadata.name}[/cyan]")
        console.print(f"Agent: {agent or 'default'}")
        console.print()

    log_verbose("Initializing workflow engine")
    engine = WorkflowEngine(config={"agent": {"primary": agent or "opencode"}})

    if output_config.json_output:
        result = asyncio.run(engine.execute(wf, inputs=inputs))
    else:
        with console.status("[cyan]Executing workflow...[/cyan]"):
            result = asyncio.run(engine.execute(wf, inputs=inputs))

    if result.success:
        if output_config.json_output:
            output_json(
                {
                    "success": True,
                    "run_id": result.run_id,
                    "duration_seconds": result.duration_seconds,
                    "steps_succeeded": result.steps_succeeded,
                    "steps_total": len(result.step_results),
                }
            )
        else:
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
        if output_config.json_output:
            output_json(
                {
                    "success": False,
                    "error": result.error,
                    "run_id": result.run_id,
                    "steps_succeeded": result.steps_succeeded,
                    "steps_total": len(result.step_results),
                }
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
    workflows_dir = Path(".marktoflow/workflows")

    log_verbose(f"Searching for workflows in: {workflows_dir}")

    if not workflows_dir.exists():
        if output_config.json_output:
            output_json(
                {
                    "error": "No workflows directory found",
                    "suggestion": "Run 'marktoflow init' first",
                }
            )
        else:
            console.print(
                "[yellow]No workflows directory found. Run 'marktoflow init' first.[/yellow]"
            )
        raise typer.Exit(1)

    workflows = list(workflows_dir.glob("*.md"))
    log_verbose(f"Found {len(workflows)} workflow files")

    if not workflows:
        if output_config.json_output:
            output_json({"workflows": [], "count": 0})
        else:
            console.print("[yellow]No workflows found in .marktoflow/workflows/[/yellow]")
            console.print(
                "[dim]Tip: Use 'marktoflow workflow create' to create a new workflow[/dim]"
            )
        return

    from marktoflow.core.parser import WorkflowParser

    parser = WorkflowParser()

    workflow_data = []
    table = Table(title="Available Workflows")
    table.add_column("Name", style="cyan")
    table.add_column("ID")
    table.add_column("Version")
    table.add_column("File")

    for wf_path in workflows:
        try:
            wf = parser.parse_file(wf_path)
            workflow_data.append(
                {
                    "name": wf.metadata.name,
                    "id": wf.metadata.id,
                    "version": wf.metadata.version,
                    "file": wf_path.name,
                    "path": str(wf_path),
                }
            )
            table.add_row(
                wf.metadata.name,
                wf.metadata.id,
                wf.metadata.version,
                wf_path.name,
            )
        except Exception as e:
            workflow_data.append(
                {
                    "name": None,
                    "id": None,
                    "version": None,
                    "file": wf_path.name,
                    "path": str(wf_path),
                    "error": str(e),
                }
            )
            table.add_row(
                f"[red]Error[/red]",
                "-",
                "-",
                f"{wf_path.name} ({e})",
            )

    if output_config.json_output:
        output_json({"workflows": workflow_data, "count": len(workflow_data)})
    else:
        console.print(table)


@workflow_app.command("validate")
def workflow_validate(
    workflow: Path = typer.Argument(..., help="Path to workflow file"),
) -> None:
    """Validate a workflow file."""
    from marktoflow.core.parser import WorkflowParser

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
    from marktoflow.core.parser import WorkflowParser

    parser = WorkflowParser()

    try:
        wf = parser.parse_file(workflow)
        if output_config.json_output:
            output_json(
                {
                    "id": wf.metadata.id,
                    "name": wf.metadata.name,
                    "version": wf.metadata.version,
                    "steps": [
                        {
                            "name": step.name,
                            "action": step.action,
                            "output_variable": step.output_variable,
                        }
                        for step in wf.steps
                    ],
                    "required_tools": wf.get_required_tools(),
                }
            )
        else:
            _show_execution_plan(wf)
    except Exception as e:
        console.print(f"[red]Failed to parse workflow: {e}[/red]")
        raise typer.Exit(1)


@workflow_app.command("create")
def workflow_create(
    name: str = typer.Argument(..., help="Name of the workflow to create"),
    output_dir: Path = typer.Option(
        Path(".marktoflow/workflows"),
        "--output",
        "-o",
        help="Output directory for the workflow",
    ),
    bundle: bool = typer.Option(
        False,
        "--bundle",
        "-b",
        help="Create as a self-contained bundle directory",
    ),
    template: str = typer.Option(
        "basic",
        "--template",
        "-t",
        help="Template to use (basic, multi-step, with-tools)",
    ),
) -> None:
    """Create a new workflow from a template."""
    log_verbose(f"Creating workflow: {name}")
    log_verbose(f"Template: {template}")
    log_verbose(f"Bundle: {bundle}")

    # Generate workflow ID from name
    workflow_id = name.lower().replace(" ", "-").replace("_", "-")

    # Templates
    templates = {
        "basic": """---
workflow:
  id: {workflow_id}
  name: "{name}"
  version: "1.0.0"
  
compatibility:
  agents:
    - opencode: recommended
    - claude-code: supported
    
requirements:
  tools: []
  features:
    - tool_calling: required
    
execution:
  timeout: 300s
  error_handling: stop
---

# {name}

A brief description of what this workflow does.

## Step 1: First Step

```yaml
action: tool.operation
inputs:
  param: value
output_variable: result
```

Add more steps as needed.
""",
        "multi-step": """---
workflow:
  id: {workflow_id}
  name: "{name}"
  version: "1.0.0"
  
compatibility:
  agents:
    - opencode: recommended
    - claude-code: supported
    
requirements:
  tools: []
  features:
    - tool_calling: required
    
execution:
  timeout: 600s
  error_handling: continue
---

# {name}

A multi-step workflow that processes data through several stages.

## Step 1: Gather Data

```yaml
action: gather.data
inputs:
  source: input
output_variable: raw_data
```

## Step 2: Process Data

```yaml
action: process.transform
inputs:
  data: "{{raw_data}}"
output_variable: processed_data
conditions:
  - raw_data.success == true
```

## Step 3: Output Results

```yaml
action: output.results
inputs:
  data: "{{processed_data}}"
output_variable: final_result
```
""",
        "with-tools": """---
workflow:
  id: {workflow_id}
  name: "{name}"
  version: "1.0.0"
  
compatibility:
  agents:
    - opencode: recommended
    - claude-code: supported
    
requirements:
  tools:
    - slack
    - jira
  features:
    - tool_calling: required
    
execution:
  timeout: 300s
  error_handling: stop
---

# {name}

A workflow that uses external tools.

## Step 1: Get Issues

```yaml
action: jira.search
inputs:
  jql: "project = PROJ AND status = 'To Do'"
output_variable: issues
```

## Step 2: Notify Team

```yaml
action: slack.send_message
inputs:
  channel: "#team"
  message: "Found {{issues.total}} issues to work on"
output_variable: notification
conditions:
  - issues.total > 0
```
""",
    }

    if template not in templates:
        console.print(f"[red]Unknown template: {template}[/red]")
        console.print(f"Available templates: {', '.join(templates.keys())}")
        raise typer.Exit(1)

    # Generate content
    content = templates[template].format(workflow_id=workflow_id, name=name)

    if bundle:
        # Create bundle directory
        bundle_dir = output_dir / workflow_id
        bundle_dir.mkdir(parents=True, exist_ok=True)

        # Write workflow.md
        workflow_file = bundle_dir / "workflow.md"
        workflow_file.write_text(content)
        log_verbose(f"Created: {workflow_file}")

        # Create config.yaml
        config_content = f'''# Bundle configuration
name: "{name}"
version: "1.0.0"

agent: opencode
fallback_agent: null
timeout: 300

inherit_global_tools: true
'''
        config_file = bundle_dir / "config.yaml"
        config_file.write_text(config_content)
        log_verbose(f"Created: {config_file}")

        # Create tools directory
        tools_dir = bundle_dir / "tools"
        tools_dir.mkdir(exist_ok=True)
        log_verbose(f"Created: {tools_dir}")

        # Create tools.yaml
        tools_yaml = bundle_dir / "tools.yaml"
        tools_yaml.write_text("# Tool definitions\ntools: []\n")
        log_verbose(f"Created: {tools_yaml}")

        if output_config.json_output:
            output_json(
                {
                    "created": str(bundle_dir),
                    "type": "bundle",
                    "files": [
                        str(workflow_file),
                        str(config_file),
                        str(tools_yaml),
                    ],
                }
            )
        else:
            console.print(
                Panel(
                    f"[green]Bundle created successfully![/green]\n\n"
                    f"Location: {bundle_dir}\n"
                    f"Workflow: {workflow_file.name}\n\n"
                    "Next steps:\n"
                    f"  1. Edit {workflow_file}\n"
                    f"  2. Add tools to {tools_dir}/\n"
                    f"  3. Run: marktoflow bundle run {bundle_dir}",
                    title="New Bundle",
                )
            )
    else:
        # Create single workflow file
        output_dir.mkdir(parents=True, exist_ok=True)
        workflow_file = output_dir / f"{workflow_id}.md"
        workflow_file.write_text(content)

        if output_config.json_output:
            output_json(
                {
                    "created": str(workflow_file),
                    "type": "workflow",
                }
            )
        else:
            console.print(
                Panel(
                    f"[green]Workflow created successfully![/green]\n\n"
                    f"File: {workflow_file}\n\n"
                    "Next steps:\n"
                    f"  1. Edit {workflow_file}\n"
                    f"  2. Run: marktoflow run {workflow_file}",
                    title="New Workflow",
                )
            )


# Agent commands
@agent_app.command("list")
def agent_list() -> None:
    """List available agents."""
    from marktoflow.agents import AgentRegistry

    # Register built-in agents
    from marktoflow.agents.claude import ClaudeCodeAdapter  # noqa: F401
    from marktoflow.agents.opencode import OpenCodeAdapter  # noqa: F401

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
    capabilities_path = Path(".marktoflow/agents/capabilities.yaml")

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
    from marktoflow.tools.registry import ToolRegistry

    registry_path = Path(".marktoflow/tools/registry.yaml")

    if not registry_path.exists():
        console.print("[yellow]No tool registry found. Run 'marktoflow init' first.[/yellow]")
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


# Schedule commands
@schedule_app.command("list")
def schedule_list() -> None:
    """List scheduled workflows."""
    from marktoflow.core.scheduler import Scheduler

    scheduler = Scheduler()
    count = scheduler.load_schedules()

    if count == 0:
        console.print("[yellow]No scheduled workflows found.[/yellow]")
        console.print("Add schedule triggers to your workflows to enable scheduling.")
        return

    jobs = scheduler.list_jobs()

    table = Table(title="Scheduled Workflows")
    table.add_column("Job ID", style="cyan")
    table.add_column("Workflow")
    table.add_column("Schedule")
    table.add_column("Next Run")
    table.add_column("Status")

    for job in jobs:
        next_run = job.next_run.strftime("%Y-%m-%d %H:%M") if job.next_run else "-"
        status = "[green]Enabled[/green]" if job.enabled else "[red]Disabled[/red]"
        table.add_row(
            job.id,
            Path(job.workflow_path).name,
            job.schedule,
            next_run,
            status,
        )

    console.print(table)


@schedule_app.command("start")
def schedule_start(
    daemon: bool = typer.Option(
        False,
        "--daemon",
        "-d",
        help="Run scheduler in background (daemon mode)",
    ),
) -> None:
    """Start the scheduler."""
    import asyncio
    import signal

    from marktoflow.core.scheduler import Scheduler

    scheduler = Scheduler()
    count = scheduler.load_schedules()

    if count == 0:
        console.print("[yellow]No scheduled workflows found. Nothing to run.[/yellow]")
        raise typer.Exit(1)

    console.print(f"[cyan]Starting scheduler with {count} job(s)...[/cyan]")

    # Handle shutdown gracefully
    def signal_handler(sig, frame):
        console.print("\n[yellow]Shutting down scheduler...[/yellow]")
        scheduler.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Register callback for job completion
    def on_complete(job, result):
        if hasattr(result, "success") and result.success:
            console.print(f"[green]Job {job.id} completed successfully[/green]")
        else:
            console.print(f"[red]Job {job.id} failed[/red]")

    scheduler.on_job_complete(on_complete)

    # Run scheduler
    try:
        if daemon:
            console.print(
                "[yellow]Daemon mode not yet implemented. Running in foreground.[/yellow]"
            )

        console.print("[green]Scheduler running. Press Ctrl+C to stop.[/green]")
        asyncio.run(scheduler.start())
    except KeyboardInterrupt:
        pass

    console.print("[green]Scheduler stopped.[/green]")


@schedule_app.command("run")
def schedule_run_once() -> None:
    """Run any due scheduled jobs once and exit."""
    import asyncio

    from marktoflow.core.scheduler import Scheduler

    scheduler = Scheduler()
    count = scheduler.load_schedules()

    if count == 0:
        console.print("[yellow]No scheduled workflows found.[/yellow]")
        raise typer.Exit(1)

    console.print(f"[cyan]Checking {count} scheduled job(s)...[/cyan]")

    results = asyncio.run(scheduler.run_once())

    if not results:
        console.print("[yellow]No jobs were due to run.[/yellow]")
    else:
        for job_id, result in results.items():
            console.print(f"[green]Executed job: {job_id} at {result['time']}[/green]")


@schedule_app.command("info")
def schedule_info(
    job_id: str = typer.Argument(..., help="Job ID to show details for"),
) -> None:
    """Show details for a scheduled job."""
    from marktoflow.core.scheduler import Scheduler

    scheduler = Scheduler()
    scheduler.load_schedules()

    job = scheduler.get_job(job_id)

    if not job:
        console.print(f"[red]Job not found: {job_id}[/red]")
        raise typer.Exit(1)

    console.print(
        Panel(
            f"[cyan]Job ID:[/cyan] {job.id}\n"
            f"[cyan]Workflow:[/cyan] {job.workflow_path}\n"
            f"[cyan]Schedule:[/cyan] {job.schedule}\n"
            f"[cyan]Timezone:[/cyan] {job.timezone}\n"
            f"[cyan]Enabled:[/cyan] {job.enabled}\n"
            f"[cyan]Run Count:[/cyan] {job.run_count}\n"
            f"[cyan]Last Run:[/cyan] {job.last_run or 'Never'}\n"
            f"[cyan]Next Run:[/cyan] {job.next_run or 'N/A'}",
            title="Scheduled Job Details",
        )
    )


# Webhook commands
webhook_app = typer.Typer(help="Webhook receiver commands")
app.add_typer(webhook_app, name="webhook")


@webhook_app.command("list")
def webhook_list() -> None:
    """List configured webhook endpoints."""
    from marktoflow.core.webhook import WebhookReceiver

    config_path = Path(".marktoflow/triggers/webhooks.yaml")
    receiver = WebhookReceiver(config_path=config_path)

    endpoints = receiver.list_endpoints()

    if not endpoints:
        console.print("[yellow]No webhook endpoints configured.[/yellow]")
        console.print("Create .marktoflow/triggers/webhooks.yaml to configure webhooks.")
        return

    table = Table(title="Webhook Endpoints")
    table.add_column("ID", style="cyan")
    table.add_column("Path")
    table.add_column("Workflow")
    table.add_column("Methods")
    table.add_column("Status")

    for ep in endpoints:
        status = "[green]Enabled[/green]" if ep.enabled else "[red]Disabled[/red]"
        table.add_row(
            ep.id,
            ep.path,
            ep.workflow_id,
            ", ".join(ep.allowed_methods),
            status,
        )

    console.print(table)


@webhook_app.command("start")
def webhook_start(
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(8080, "--port", "-p", help="Port to listen on"),
) -> None:
    """Start the webhook receiver server."""
    from marktoflow.core.webhook import WebhookReceiver

    config_path = Path(".marktoflow/triggers/webhooks.yaml")
    receiver = WebhookReceiver(host=host, port=port, config_path=config_path)

    endpoint_count = len(receiver.list_endpoints())
    console.print(f"[cyan]Starting webhook receiver on {host}:{port}[/cyan]")
    console.print(f"[cyan]Loaded {endpoint_count} endpoint(s)[/cyan]")
    console.print("[green]Press Ctrl+C to stop.[/green]")

    try:
        receiver.start(blocking=True)
    except KeyboardInterrupt:
        receiver.stop()
        console.print("[green]Webhook receiver stopped.[/green]")


@webhook_app.command("test")
def webhook_test(
    endpoint_path: str = typer.Argument(..., help="Endpoint path to test (e.g., /webhooks/test)"),
    host: str = typer.Option("localhost", "--host", "-h", help="Webhook server host"),
    port: int = typer.Option(8080, "--port", "-p", help="Webhook server port"),
    data: Optional[str] = typer.Option(None, "--data", "-d", help="JSON data to send"),
) -> None:
    """Send a test webhook to an endpoint."""
    import urllib.request
    import urllib.error

    url = f"http://{host}:{port}{endpoint_path}"
    payload = data.encode() if data else b"{}"

    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            result = response.read().decode()
            console.print(f"[green]Response ({response.status}):[/green]")
            console.print(result)
    except urllib.error.HTTPError as e:
        console.print(f"[red]HTTP Error {e.code}: {e.reason}[/red]")
        raise typer.Exit(1)
    except urllib.error.URLError as e:
        console.print(f"[red]Failed to connect: {e}[/red]")
        raise typer.Exit(1)


# Watch (file watcher) commands
watch_app = typer.Typer(help="File watcher commands")
app.add_typer(watch_app, name="watch")


@watch_app.command("list")
def watch_list() -> None:
    """List configured file watches."""
    config_path = Path(".marktoflow/triggers/watches.yaml")

    if not config_path.exists():
        console.print("[yellow]No file watches configured.[/yellow]")
        console.print("Create .marktoflow/triggers/watches.yaml to configure file watches.")
        return

    import yaml

    try:
        watches = yaml.safe_load(config_path.read_text()) or {}
    except Exception as e:
        console.print(f"[red]Failed to load watches config: {e}[/red]")
        raise typer.Exit(1)

    watch_list_data = watches.get("watches", [])

    if not watch_list_data:
        console.print("[yellow]No file watches defined in config.[/yellow]")
        return

    table = Table(title="Configured File Watches")
    table.add_column("ID", style="cyan")
    table.add_column("Path")
    table.add_column("Patterns")
    table.add_column("Workflow")
    table.add_column("Recursive")

    for watch in watch_list_data:
        patterns = ", ".join(watch.get("patterns", ["*"]))
        recursive = "[green]Yes[/green]" if watch.get("recursive", True) else "[red]No[/red]"
        table.add_row(
            watch.get("id", "unknown"),
            watch.get("path", "."),
            patterns,
            watch.get("workflow_id", "-"),
            recursive,
        )

    console.print(table)


@watch_app.command("start")
def watch_start(
    path: Path = typer.Argument(
        Path("."),
        help="Directory to watch",
    ),
    patterns: Optional[list[str]] = typer.Option(
        None,
        "--pattern",
        "-p",
        help="Glob patterns to match (e.g., '*.py', '*.md')",
    ),
    workflow: Optional[str] = typer.Option(
        None,
        "--workflow",
        "-w",
        help="Workflow ID to trigger on file events",
    ),
    recursive: bool = typer.Option(
        True,
        "--recursive/--no-recursive",
        "-r/-R",
        help="Watch subdirectories recursively",
    ),
    debounce: float = typer.Option(
        1.0,
        "--debounce",
        "-d",
        help="Debounce interval in seconds",
    ),
) -> None:
    """Start watching a directory for file changes."""
    import signal

    try:
        from marktoflow.core.filewatcher import FileWatcher, WatchConfig, FileEventType
    except ImportError:
        console.print(
            "[red]File watcher not available. Install with: pip install marktoflow[triggers][/red]"
        )
        raise typer.Exit(1)

    if not path.exists():
        console.print(f"[red]Path does not exist: {path}[/red]")
        raise typer.Exit(1)

    # Build watch config
    config = WatchConfig(
        path=path.absolute(),
        patterns=patterns or ["*"],
        recursive=recursive,
        events=[FileEventType.CREATED, FileEventType.MODIFIED, FileEventType.DELETED],
        debounce_seconds=debounce,
        workflow_id=workflow,
    )

    watcher = FileWatcher()

    # Define callback
    def on_event(event, watch_config):
        event_type = event.event_type.value
        console.print(f"[cyan]{event_type.upper()}[/cyan] {event.src_path}")
        if workflow:
            console.print(f"  [yellow]Would trigger workflow: {workflow}[/yellow]")

    handle = watcher.add_watch(config, on_event)
    console.print(f"[cyan]Watching: {path.absolute()}[/cyan]")
    console.print(f"[cyan]Patterns: {', '.join(patterns or ['*'])}[/cyan]")
    console.print(f"[cyan]Recursive: {recursive}[/cyan]")
    if workflow:
        console.print(f"[cyan]Workflow: {workflow}[/cyan]")
    console.print("[green]Press Ctrl+C to stop.[/green]")

    # Handle shutdown gracefully
    def signal_handler(sig, frame):
        console.print("\n[yellow]Stopping file watcher...[/yellow]")
        watcher.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        watcher.start(blocking=True)
    except KeyboardInterrupt:
        pass

    console.print("[green]File watcher stopped.[/green]")


@watch_app.command("config")
def watch_config() -> None:
    """Show example file watch configuration."""
    example = """# File Watch Configuration
# Save to: .marktoflow/triggers/watches.yaml

watches:
  - id: python-files
    path: ./src
    patterns:
      - "*.py"
    ignore_patterns:
      - "__pycache__/*"
      - "*.pyc"
    recursive: true
    events:
      - created
      - modified
    debounce_seconds: 1.0
    workflow_id: lint-and-test
    workflow_inputs:
      check_types: true

  - id: config-changes
    path: ./config
    patterns:
      - "*.yaml"
      - "*.json"
    recursive: false
    events:
      - modified
    debounce_seconds: 2.0
    workflow_id: validate-config
"""
    console.print(Panel(example, title="Example watches.yaml", expand=False))


# Metrics commands
metrics_app = typer.Typer(help="Metrics and monitoring commands")
app.add_typer(metrics_app, name="metrics")


@metrics_app.command("start")
def metrics_start(
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(9090, "--port", "-p", help="Port to listen on"),
) -> None:
    """Start the metrics server for Prometheus scraping."""
    import signal

    try:
        from marktoflow.core.metrics import MetricsServer, MetricsCollector
    except ImportError:
        console.print(
            "[red]Metrics not available. Install with: pip install marktoflow[metrics][/red]"
        )
        raise typer.Exit(1)

    collector = MetricsCollector()
    server = MetricsServer(collector, host=host, port=port)

    console.print(f"[cyan]Starting metrics server on {host}:{port}[/cyan]")
    console.print(f"[cyan]Prometheus endpoint: http://{host}:{port}/metrics[/cyan]")
    console.print(f"[cyan]Health endpoint: http://{host}:{port}/health[/cyan]")
    console.print("[green]Press Ctrl+C to stop.[/green]")

    # Handle shutdown gracefully
    def signal_handler(sig, frame):
        console.print("\n[yellow]Stopping metrics server...[/yellow]")
        server.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        server.start(blocking=True)
    except KeyboardInterrupt:
        pass

    console.print("[green]Metrics server stopped.[/green]")


@metrics_app.command("show")
def metrics_show() -> None:
    """Show current workflow metrics from state store."""
    from pathlib import Path
    import json

    state_path = Path(".marktoflow/state/workflow-state/metrics.json")

    if not state_path.exists():
        console.print("[yellow]No metrics data found.[/yellow]")
        console.print("Metrics are collected when workflows are executed.")
        return

    try:
        data = json.loads(state_path.read_text())
    except Exception as e:
        console.print(f"[red]Failed to load metrics: {e}[/red]")
        raise typer.Exit(1)

    # Display summary
    console.print(Panel("[cyan]Workflow Metrics Summary[/cyan]", expand=False))

    if "workflows" in data:
        table = Table(title="Workflow Execution Stats")
        table.add_column("Workflow ID", style="cyan")
        table.add_column("Total Runs")
        table.add_column("Succeeded")
        table.add_column("Failed")
        table.add_column("Avg Duration")

        for wf_id, stats in data["workflows"].items():
            total = stats.get("total", 0)
            succeeded = stats.get("succeeded", 0)
            failed = stats.get("failed", 0)
            avg_duration = stats.get("avg_duration", 0)
            table.add_row(
                wf_id,
                str(total),
                f"[green]{succeeded}[/green]",
                f"[red]{failed}[/red]" if failed > 0 else "0",
                f"{avg_duration:.2f}s",
            )

        console.print(table)

    if "agents" in data:
        table = Table(title="Agent Usage Stats")
        table.add_column("Agent", style="cyan")
        table.add_column("Executions")
        table.add_column("Failovers From")
        table.add_column("Failovers To")

        for agent_name, stats in data["agents"].items():
            table.add_row(
                agent_name,
                str(stats.get("executions", 0)),
                str(stats.get("failovers_from", 0)),
                str(stats.get("failovers_to", 0)),
            )

        console.print(table)


@metrics_app.command("export")
def metrics_export(
    output: Path = typer.Argument(
        ...,
        help="Output file path (supports .json, .csv)",
    ),
    format: str = typer.Option(
        "json",
        "--format",
        "-f",
        help="Output format (json, csv, prometheus)",
    ),
) -> None:
    """Export metrics to a file."""
    try:
        from marktoflow.core.metrics import MetricsCollector
    except ImportError:
        console.print(
            "[red]Metrics not available. Install with: pip install marktoflow[metrics][/red]"
        )
        raise typer.Exit(1)

    collector = MetricsCollector()
    stats = collector.get_stats()

    if format == "json":
        import json

        output.write_text(json.dumps(stats, indent=2, default=str))
    elif format == "prometheus":
        prom_output = collector.get_prometheus_metrics()
        output.write_text(prom_output if isinstance(prom_output, str) else prom_output.decode())
    elif format == "csv":
        import csv

        with output.open("w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["metric", "value"])
            for key, value in stats.items():
                if isinstance(value, dict):
                    for sub_key, sub_value in value.items():
                        writer.writerow([f"{key}.{sub_key}", sub_value])
                else:
                    writer.writerow([key, value])
    else:
        console.print(f"[red]Unknown format: {format}[/red]")
        raise typer.Exit(1)

    console.print(f"[green]Metrics exported to: {output}[/green]")


# Queue commands
queue_app = typer.Typer(help="Message queue commands")
app.add_typer(queue_app, name="queue")


@queue_app.command("status")
def queue_status(
    queue_type: str = typer.Option(
        "memory",
        "--type",
        "-t",
        help="Queue type (memory, redis, rabbitmq)",
    ),
    redis_url: Optional[str] = typer.Option(
        None,
        "--redis-url",
        help="Redis connection URL (for redis type)",
    ),
) -> None:
    """Show queue status and statistics."""
    try:
        from marktoflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            REDIS_AVAILABLE,
            RABBITMQ_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="marktoflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print("[cyan]Queue Type:[/cyan] In-Memory (for testing only)")
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install marktoflow[redis][/red]"
            )
            raise typer.Exit(1)
        from marktoflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
        console.print(f"[cyan]Queue Type:[/cyan] Redis ({redis_url or 'localhost:6379'})")
    elif queue_type == "rabbitmq":
        if not RABBITMQ_AVAILABLE:
            console.print(
                "[red]RabbitMQ not available. Install with: pip install marktoflow[rabbitmq][/red]"
            )
            raise typer.Exit(1)
        console.print("[yellow]RabbitMQ status check not yet implemented.[/yellow]")
        return
    else:
        console.print(f"[red]Unknown queue type: {queue_type}[/red]")
        raise typer.Exit(1)

    try:
        queue.connect()
        length = queue.get_queue_length()
        console.print(f"[cyan]Queue Name:[/cyan] {config.name}")
        console.print(f"[cyan]Pending Messages:[/cyan] {length}")
        console.print("[green]Status: Connected[/green]")
        queue.disconnect()
    except Exception as e:
        console.print(f"[red]Failed to connect: {e}[/red]")
        raise typer.Exit(1)


@queue_app.command("publish")
def queue_publish(
    workflow_id: str = typer.Argument(..., help="Workflow ID to enqueue"),
    priority: str = typer.Option(
        "normal",
        "--priority",
        "-p",
        help="Message priority (low, normal, high, critical)",
    ),
    queue_type: str = typer.Option(
        "memory",
        "--type",
        "-t",
        help="Queue type (memory, redis)",
    ),
    redis_url: Optional[str] = typer.Option(
        None,
        "--redis-url",
        help="Redis connection URL",
    ),
    input_param: Optional[list[str]] = typer.Option(
        None,
        "--input",
        "-i",
        help="Input parameters (format: key=value)",
    ),
) -> None:
    """Publish a workflow to the message queue."""
    import uuid

    try:
        from marktoflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            QueueMessage,
            MessagePriority,
            REDIS_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    # Parse priority
    priority_map = {
        "low": MessagePriority.LOW,
        "normal": MessagePriority.NORMAL,
        "high": MessagePriority.HIGH,
        "critical": MessagePriority.CRITICAL,
    }
    if priority not in priority_map:
        console.print(f"[red]Invalid priority: {priority}[/red]")
        raise typer.Exit(1)

    # Parse inputs
    inputs = {}
    if input_param:
        for param in input_param:
            if "=" in param:
                key, value = param.split("=", 1)
                inputs[key] = value

    config = QueueConfig(name="marktoflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print("[yellow]Warning: In-memory queue does not persist.[/yellow]")
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install marktoflow[redis][/red]"
            )
            raise typer.Exit(1)
        from marktoflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
    else:
        console.print(f"[red]Unknown queue type: {queue_type}[/red]")
        raise typer.Exit(1)

    # Create message
    message = QueueMessage(
        id=str(uuid.uuid4()),
        workflow_id=workflow_id,
        priority=priority_map[priority],
        payload={"inputs": inputs} if inputs else {},
    )

    try:
        queue.connect()
        queue.publish(message)
        console.print(f"[green]Published workflow to queue:[/green]")
        console.print(f"  [cyan]Message ID:[/cyan] {message.id}")
        console.print(f"  [cyan]Workflow:[/cyan] {workflow_id}")
        console.print(f"  [cyan]Priority:[/cyan] {priority}")
        if inputs:
            console.print(f"  [cyan]Inputs:[/cyan] {inputs}")
        queue.disconnect()
    except Exception as e:
        console.print(f"[red]Failed to publish: {e}[/red]")
        raise typer.Exit(1)


@queue_app.command("worker")
def queue_worker(
    queue_type: str = typer.Option(
        "memory",
        "--type",
        "-t",
        help="Queue type (memory, redis)",
    ),
    redis_url: Optional[str] = typer.Option(
        None,
        "--redis-url",
        help="Redis connection URL",
    ),
    concurrency: int = typer.Option(
        1,
        "--concurrency",
        "-c",
        help="Number of concurrent workers",
    ),
) -> None:
    """Start a queue worker to process workflow messages."""
    import asyncio
    import signal

    try:
        from marktoflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            WorkflowQueueManager,
            REDIS_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="marktoflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print(
            "[yellow]Warning: In-memory queue. Messages must be published in same process.[/yellow]"
        )
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install marktoflow[redis][/red]"
            )
            raise typer.Exit(1)
        from marktoflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
    else:
        console.print(f"[red]Unknown queue type: {queue_type}[/red]")
        raise typer.Exit(1)

    # Create workflow executor function
    def executor(workflow_id: str, inputs: dict):
        from marktoflow.core.parser import WorkflowParser
        from marktoflow.core.engine import WorkflowEngine

        # Find workflow file
        workflow_path = Path(f".marktoflow/workflows/{workflow_id}.md")
        if not workflow_path.exists():
            # Try without .md extension
            workflow_path = Path(f".marktoflow/workflows/{workflow_id}")
            if not workflow_path.exists():
                raise FileNotFoundError(f"Workflow not found: {workflow_id}")

        parser = WorkflowParser()
        wf = parser.parse_file(workflow_path)

        engine = WorkflowEngine()
        return asyncio.run(engine.execute(wf, inputs=inputs))

    manager = WorkflowQueueManager(queue, executor)

    console.print(f"[cyan]Starting queue worker...[/cyan]")
    console.print(f"[cyan]Queue Type:[/cyan] {queue_type}")
    console.print(f"[cyan]Concurrency:[/cyan] {concurrency}")
    console.print("[green]Press Ctrl+C to stop.[/green]")

    # Handle shutdown gracefully
    def signal_handler(sig, frame):
        console.print("\n[yellow]Stopping worker...[/yellow]")
        manager.stop_worker()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        queue.connect()
        manager.start_worker(num_workers=concurrency)
    except KeyboardInterrupt:
        pass
    finally:
        queue.disconnect()

    console.print("[green]Worker stopped.[/green]")


@queue_app.command("purge")
def queue_purge(
    queue_type: str = typer.Option(
        "memory",
        "--type",
        "-t",
        help="Queue type (memory, redis)",
    ),
    redis_url: Optional[str] = typer.Option(
        None,
        "--redis-url",
        help="Redis connection URL",
    ),
    confirm: bool = typer.Option(
        False,
        "--yes",
        "-y",
        help="Confirm purge without prompting",
    ),
) -> None:
    """Purge all messages from the queue."""
    try:
        from marktoflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            REDIS_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="marktoflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install marktoflow[redis][/red]"
            )
            raise typer.Exit(1)
        from marktoflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
    else:
        console.print(f"[red]Unknown queue type: {queue_type}[/red]")
        raise typer.Exit(1)

    try:
        queue.connect()
        length = queue.get_queue_length()

        if length == 0:
            console.print("[yellow]Queue is already empty.[/yellow]")
            queue.disconnect()
            return

        if not confirm:
            response = typer.confirm(f"Purge {length} message(s) from queue?")
            if not response:
                console.print("[yellow]Cancelled.[/yellow]")
                queue.disconnect()
                return

        queue.purge()
        console.print(f"[green]Purged {length} message(s) from queue.[/green]")
        queue.disconnect()
    except Exception as e:
        console.print(f"[red]Failed to purge: {e}[/red]")
        raise typer.Exit(1)


# Bundle commands
@bundle_app.command("info")
def bundle_info(
    path: Path = typer.Argument(..., help="Path to the workflow bundle directory"),
) -> None:
    """Show information about a workflow bundle."""
    from marktoflow.tools.bundle import WorkflowBundle, is_bundle

    if not path.exists():
        console.print(f"[red]Bundle not found: {path}[/red]")
        raise typer.Exit(1)

    if not is_bundle(path):
        console.print(f"[red]Not a valid bundle: {path}[/red]")
        console.print("A bundle must be a directory with a workflow.md (or *.md) file.")
        raise typer.Exit(1)

    try:
        bundle = WorkflowBundle(path)
        info = bundle.get_info()
    except Exception as e:
        console.print(f"[red]Failed to load bundle: {e}[/red]")
        raise typer.Exit(1)

    # Display bundle info
    console.print(
        Panel(
            f"[cyan]Name:[/cyan] {info['name']}\n"
            f"[cyan]Path:[/cyan] {info['path']}\n"
            f"[cyan]Workflow File:[/cyan] {info['workflow_file'] or 'Not found'}",
            title="Bundle Info",
        )
    )

    # Workflow info
    wf = info["workflow"]
    if wf["error"]:
        console.print(f"[red]Workflow Error: {wf['error']}[/red]")
    else:
        console.print(
            Panel(
                f"[cyan]ID:[/cyan] {wf['id']}\n"
                f"[cyan]Name:[/cyan] {wf['name']}\n"
                f"[cyan]Version:[/cyan] {wf['version']}\n"
                f"[cyan]Steps:[/cyan] {wf['steps']}",
                title="Workflow",
            )
        )

    # Tools info
    tools_info = info["tools"]
    table = Table(title="Tools")
    table.add_column("Tool", style="cyan")
    table.add_column("Type")

    for tool in tools_info["script_tools"]:
        table.add_row(tool, "[green]Script[/green]")

    # Show inherited global tools (those not in script_tools)
    inherited = set(tools_info["all_tools"]) - set(tools_info["script_tools"])
    for tool in sorted(inherited):
        table.add_row(tool, "[yellow]Global[/yellow]")

    if tools_info["script_tools"] or inherited:
        console.print(table)
    else:
        console.print("[yellow]No tools found in bundle.[/yellow]")

    # Config info
    cfg = info["config"]
    console.print(
        Panel(
            f"[cyan]Agent:[/cyan] {cfg['agent']}\n"
            f"[cyan]Fallback:[/cyan] {cfg['fallback_agent'] or 'None'}\n"
            f"[cyan]Timeout:[/cyan] {cfg['timeout']}s\n"
            f"[cyan]Inherit Global Tools:[/cyan] {cfg['inherit_global_tools']}",
            title="Configuration",
        )
    )


@bundle_app.command("validate")
def bundle_validate(
    path: Path = typer.Argument(..., help="Path to the workflow bundle directory"),
) -> None:
    """Validate a workflow bundle."""
    from marktoflow.tools.bundle import WorkflowBundle, is_bundle

    if not path.exists():
        console.print(f"[red]Bundle not found: {path}[/red]")
        raise typer.Exit(1)

    if not is_bundle(path):
        console.print(f"[red]Not a valid bundle: {path}[/red]")
        raise typer.Exit(1)

    try:
        bundle = WorkflowBundle(path)
        errors = bundle.validate()
    except Exception as e:
        console.print(f"[red]Failed to load bundle: {e}[/red]")
        raise typer.Exit(1)

    if errors:
        console.print("[red]Validation failed:[/red]")
        for error in errors:
            console.print(f"  - {error}")
        raise typer.Exit(1)
    else:
        console.print(f"[green]Bundle '{bundle.name}' is valid.[/green]")


@bundle_app.command("run")
def bundle_run(
    path: Path = typer.Argument(..., help="Path to the workflow bundle directory"),
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
    """Run a workflow bundle."""
    import asyncio

    from marktoflow.tools.bundle import WorkflowBundle, is_bundle

    if not path.exists():
        console.print(f"[red]Bundle not found: {path}[/red]")
        raise typer.Exit(1)

    if not is_bundle(path):
        console.print(f"[red]Not a valid bundle: {path}[/red]")
        raise typer.Exit(1)

    # Parse inputs
    inputs = {}
    if input_param:
        for param in input_param:
            if "=" in param:
                key, value = param.split("=", 1)
                inputs[key] = value

    try:
        bundle = WorkflowBundle(path)
        workflow = bundle.load_workflow()
    except Exception as e:
        console.print(f"[red]Failed to load bundle: {e}[/red]")
        raise typer.Exit(1)

    # Validate
    errors = bundle.validate()
    if errors:
        console.print("[red]Validation errors:[/red]")
        for error in errors:
            console.print(f"  - {error}")
        raise typer.Exit(1)

    if dry_run:
        _show_execution_plan(workflow)
        # Also show available tools
        tools = bundle.load_tools()
        script_tools = tools.list_script_tools()
        if script_tools:
            console.print(f"\n[yellow]Bundle tools:[/yellow] {', '.join(script_tools)}")
        return

    # Run bundle
    console.print(f"[cyan]Running bundle: {bundle.name}[/cyan]")
    console.print(f"[cyan]Workflow: {workflow.metadata.name}[/cyan]")
    console.print(f"Agent: {agent or bundle.config.agent}")
    console.print()

    with console.status("[cyan]Executing workflow...[/cyan]"):
        result = asyncio.run(bundle.execute(inputs=inputs, agent=agent))

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


@bundle_app.command("list")
def bundle_list(
    path: Path = typer.Argument(
        Path("."),
        help="Directory to search for bundles",
    ),
) -> None:
    """List workflow bundles in a directory."""
    from marktoflow.tools.bundle import is_bundle, WorkflowBundle

    if not path.exists():
        console.print(f"[red]Directory not found: {path}[/red]")
        raise typer.Exit(1)

    bundles = []
    for item in path.iterdir():
        if item.is_dir() and is_bundle(item):
            try:
                bundle = WorkflowBundle(item)
                info = bundle.get_info()
                bundles.append(info)
            except Exception:
                bundles.append(
                    {
                        "name": item.name,
                        "path": str(item),
                        "workflow": {"name": None, "error": "Failed to load"},
                        "tools": {"script_tools": []},
                    }
                )

    if not bundles:
        console.print(f"[yellow]No bundles found in {path}[/yellow]")
        return

    table = Table(title="Workflow Bundles")
    table.add_column("Name", style="cyan")
    table.add_column("Workflow")
    table.add_column("Tools")
    table.add_column("Status")

    for b in bundles:
        wf = b["workflow"]
        if wf.get("error"):
            status = f"[red]{wf['error']}[/red]"
            wf_name = "-"
        else:
            status = "[green]Valid[/green]"
            wf_name = wf.get("name", "-")

        tools_count = len(b["tools"]["script_tools"])
        table.add_row(
            b["name"],
            wf_name,
            str(tools_count),
            status,
        )

    console.print(table)


@app.command()
def version() -> None:
    """Show version information."""
    from marktoflow import __version__

    if output_config.json_output:
        output_json({"version": __version__})
    else:
        console.print(f"marktoflow version {__version__}")


@app.command()
def doctor() -> None:
    """Check environment and diagnose issues."""
    import sys
    import shutil

    log_verbose("Running environment diagnostics...")

    issues = []
    checks = []

    # Python version check
    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info >= (3, 11)
    checks.append(
        {
            "name": "Python Version",
            "value": py_version,
            "status": "ok" if py_ok else "warning",
            "message": None if py_ok else "Python 3.11+ recommended",
        }
    )
    if not py_ok:
        issues.append("Python 3.11+ recommended for best compatibility")

    # Project initialized check
    marktoflow_dir = Path(".marktoflow")
    init_ok = marktoflow_dir.exists()
    checks.append(
        {
            "name": "Project Initialized",
            "value": str(marktoflow_dir) if init_ok else "Not found",
            "status": "ok" if init_ok else "error",
            "message": None if init_ok else "Run 'marktoflow init' to initialize",
        }
    )
    if not init_ok:
        issues.append("Project not initialized. Run 'marktoflow init'")

    # Config file check
    config_file = Path("marktoflow.yaml")
    config_ok = config_file.exists()
    checks.append(
        {
            "name": "Config File",
            "value": str(config_file) if config_ok else "Not found",
            "status": "ok" if config_ok else "warning",
            "message": None if config_ok else "No config file found",
        }
    )

    # Check for optional dependencies
    optional_deps = [
        ("watchdog", "triggers", "File watching"),
        ("prometheus_client", "metrics", "Prometheus metrics"),
        ("redis", "redis", "Redis queue"),
        ("pika", "rabbitmq", "RabbitMQ queue"),
        ("aiohttp", "async", "Async HTTP"),
    ]

    for module_name, extra, description in optional_deps:
        try:
            __import__(module_name)
            available = True
        except ImportError:
            available = False

        checks.append(
            {
                "name": description,
                "value": module_name,
                "status": "ok" if available else "info",
                "message": None if available else f"Install with: pip install marktoflow[{extra}]",
            }
        )

    # Check for git
    git_available = shutil.which("git") is not None
    checks.append(
        {
            "name": "Git",
            "value": "Available" if git_available else "Not found",
            "status": "ok" if git_available else "warning",
            "message": None if git_available else "Git recommended for version control",
        }
    )

    # Check workflows directory
    workflows_dir = Path(".marktoflow/workflows")
    if workflows_dir.exists():
        workflow_count = len(list(workflows_dir.glob("*.md")))
        checks.append(
            {
                "name": "Workflows",
                "value": f"{workflow_count} found",
                "status": "ok" if workflow_count > 0 else "info",
                "message": None if workflow_count > 0 else "No workflows yet",
            }
        )

    # Check tools directory
    tools_dir = Path(".marktoflow/tools")
    if tools_dir.exists():
        mcp_count = (
            len(list((tools_dir / "mcp").glob("*.yaml"))) if (tools_dir / "mcp").exists() else 0
        )
        custom_count = (
            len(list((tools_dir / "custom").iterdir())) if (tools_dir / "custom").exists() else 0
        )
        checks.append(
            {
                "name": "Tools",
                "value": f"{mcp_count} MCP, {custom_count} custom",
                "status": "ok",
                "message": None,
            }
        )

    # Output results
    if output_config.json_output:
        output_json(
            {
                "checks": checks,
                "issues": issues,
                "healthy": len([c for c in checks if c["status"] == "error"]) == 0,
            }
        )
    else:
        console.print(Panel("[cyan]Environment Diagnostics[/cyan]", expand=False))

        table = Table()
        table.add_column("Check", style="cyan")
        table.add_column("Value")
        table.add_column("Status")

        status_icons = {
            "ok": "[green]OK[/green]",
            "warning": "[yellow]WARN[/yellow]",
            "error": "[red]ERROR[/red]",
            "info": "[blue]INFO[/blue]",
        }

        for check in checks:
            status = status_icons.get(check["status"], check["status"])
            value = check["value"]
            if check["message"]:
                value = f"{value}\n[dim]{check['message']}[/dim]"
            table.add_row(check["name"], value, status)

        console.print(table)

        if issues:
            console.print("\n[yellow]Issues found:[/yellow]")
            for issue in issues:
                console.print(f"  - {issue}")
        else:
            console.print("\n[green]No critical issues found.[/green]")


# =============================================================================
# Template Commands
# =============================================================================


@template_app.command("list")
def template_list(
    category: Optional[str] = typer.Option(
        None,
        "--category",
        "-c",
        help="Filter by category",
    ),
    tags: Optional[str] = typer.Option(
        None,
        "--tags",
        "-t",
        help="Filter by tags (comma-separated)",
    ),
) -> None:
    """List available workflow templates."""
    from marktoflow.core.templates import TemplateRegistry, TemplateCategory

    log_verbose("Loading template registry...")
    registry = TemplateRegistry()

    # Parse filters
    cat = None
    if category:
        try:
            cat = TemplateCategory(category)
        except ValueError:
            console.print(f"[red]Invalid category: {category}[/red]")
            valid = ", ".join(c.value for c in TemplateCategory)
            console.print(f"[dim]Valid categories: {valid}[/dim]")
            raise typer.Exit(1)

    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    templates = registry.list(category=cat, tags=tag_list)

    if output_config.json_output:
        output_json(
            {
                "templates": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "category": t.category.value,
                        "description": t.metadata.description,
                        "tags": t.metadata.tags,
                        "version": t.metadata.version,
                    }
                    for t in templates
                ],
                "count": len(templates),
            }
        )
        return

    if not templates:
        console.print("[yellow]No templates found matching criteria.[/yellow]")
        return

    table = Table(title="Workflow Templates")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Category", style="yellow")
    table.add_column("Description")
    table.add_column("Tags", style="dim")

    for template in templates:
        table.add_row(
            template.id,
            template.name,
            template.category.value,
            template.metadata.description[:50] + "..."
            if len(template.metadata.description) > 50
            else template.metadata.description,
            ", ".join(template.metadata.tags[:3]),
        )

    console.print(table)
    console.print(f"\n[dim]Found {len(templates)} template(s)[/dim]")


@template_app.command("show")
def template_show(
    template_id: str = typer.Argument(..., help="Template ID to show"),
) -> None:
    """Show details of a workflow template."""
    from marktoflow.core.templates import TemplateRegistry

    log_verbose(f"Looking up template: {template_id}")
    registry = TemplateRegistry()
    template = registry.get(template_id)

    if not template:
        console.print(f"[red]Template not found: {template_id}[/red]")
        console.print("[dim]Use 'marktoflow template list' to see available templates[/dim]")
        raise typer.Exit(1)

    if output_config.json_output:
        output_json(template.to_dict())
        return

    meta = template.metadata

    # Build info panel
    info_lines = [
        f"[bold]Name:[/bold] {meta.name}",
        f"[bold]ID:[/bold] {meta.id}",
        f"[bold]Version:[/bold] {meta.version}",
        f"[bold]Category:[/bold] {meta.category.value}",
        f"[bold]Author:[/bold] {meta.author or 'Unknown'}",
        f"[bold]Tags:[/bold] {', '.join(meta.tags) or 'None'}",
        "",
        f"[bold]Description:[/bold]",
        meta.description,
    ]

    console.print(Panel("\n".join(info_lines), title=f"Template: {template_id}"))

    # Variables table
    if template.variables:
        console.print("\n[bold]Variables:[/bold]")
        var_table = Table()
        var_table.add_column("Name", style="cyan")
        var_table.add_column("Type", style="yellow")
        var_table.add_column("Required", style="red")
        var_table.add_column("Default")
        var_table.add_column("Description")

        for var in template.variables:
            var_table.add_row(
                var.name,
                var.type,
                "Yes" if var.required else "No",
                str(var.default) if var.default is not None else "-",
                var.description[:40] + "..." if len(var.description) > 40 else var.description,
            )

        console.print(var_table)

    # Requirements
    if meta.requirements:
        console.print("\n[bold]Requirements:[/bold]")
        for key, value in meta.requirements.items():
            console.print(f"  - {key}: {value}")

    # Examples
    if meta.examples:
        console.print("\n[bold]Examples:[/bold]")
        for i, example in enumerate(meta.examples, 1):
            console.print(f"  {i}. {example.get('name', 'Example')}")
            if example.get("variables"):
                console.print(f"     Variables: {example['variables']}")


@template_app.command("use")
def template_use(
    template_id: str = typer.Argument(..., help="Template ID to use"),
    output: Path = typer.Option(
        None,
        "--output",
        "-o",
        help="Output file path (default: <template_id>.md)",
    ),
    workflow_id: Optional[str] = typer.Option(
        None,
        "--id",
        help="Custom workflow ID",
    ),
    var: Optional[list[str]] = typer.Option(
        None,
        "--var",
        "-v",
        help="Variable values as key=value (can be repeated)",
    ),
    interactive: bool = typer.Option(
        False,
        "--interactive",
        "-i",
        help="Prompt for required variables",
    ),
) -> None:
    """Create a workflow from a template."""
    from marktoflow.core.templates import TemplateRegistry

    log_verbose(f"Using template: {template_id}")
    registry = TemplateRegistry()
    template = registry.get(template_id)

    if not template:
        console.print(f"[red]Template not found: {template_id}[/red]")
        console.print("[dim]Use 'marktoflow template list' to see available templates[/dim]")
        raise typer.Exit(1)

    # Parse variables from command line
    variables: dict[str, Any] = {}
    if var:
        for v in var:
            if "=" in v:
                key, value = v.split("=", 1)
                # Try to parse as JSON for complex types
                try:
                    variables[key] = json_module.loads(value)
                except (json_module.JSONDecodeError, ValueError):
                    variables[key] = value
            else:
                console.print(
                    f"[yellow]Warning: Invalid variable format '{v}', expected key=value[/yellow]"
                )

    # Interactive mode - prompt for required variables
    if interactive:
        for template_var in template.variables:
            if template_var.name not in variables:
                if template_var.required or template_var.default is None:
                    default_str = (
                        f" [{template_var.default}]" if template_var.default is not None else ""
                    )
                    prompt = f"{template_var.name} ({template_var.description}){default_str}"
                    value = typer.prompt(
                        prompt, default=str(template_var.default) if template_var.default else ""
                    )
                    if value:
                        variables[template_var.name] = value

    # Validate variables
    is_valid, errors = template.validate_variables(variables)
    if not is_valid:
        console.print("[red]Variable validation errors:[/red]")
        for error in errors:
            console.print(f"  - {error}")
        raise typer.Exit(1)

    # Determine output path
    output_path = output or Path(f"{template_id}.md")

    # Check if file exists
    if output_path.exists():
        if not typer.confirm(f"File {output_path} exists. Overwrite?"):
            raise typer.Exit(0)

    # Instantiate template
    try:
        result_path = template.instantiate(
            output_path=output_path,
            variables=variables,
            workflow_id=workflow_id,
        )

        if output_config.json_output:
            output_json(
                {
                    "success": True,
                    "template_id": template_id,
                    "output_path": str(result_path),
                    "variables": variables,
                }
            )
        else:
            console.print(f"[green]Created workflow from template:[/green] {result_path}")
            console.print(f"[dim]Template: {template.name}[/dim]")
            if variables:
                console.print(f"[dim]Variables: {variables}[/dim]")

    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@template_app.command("categories")
def template_categories() -> None:
    """List template categories."""
    from marktoflow.core.templates import TemplateRegistry, TemplateCategory

    registry = TemplateRegistry()
    categories = registry.categories()

    if output_config.json_output:
        output_json(
            {
                "categories": [
                    {"id": c.value, "count": len(registry.list(category=c))} for c in categories
                ]
            }
        )
        return

    console.print("[bold]Template Categories:[/bold]\n")
    for cat in TemplateCategory:
        count = len(registry.list(category=cat))
        if count > 0:
            console.print(f"  [cyan]{cat.value}[/cyan]: {count} template(s)")
        else:
            console.print(f"  [dim]{cat.value}[/dim]: 0 templates")


@template_app.command("search")
def template_search(
    query: str = typer.Argument(..., help="Search query"),
) -> None:
    """Search templates by name, description, or tags."""
    from marktoflow.core.templates import TemplateRegistry

    log_verbose(f"Searching templates for: {query}")
    registry = TemplateRegistry()
    results = registry.search(query)

    if output_config.json_output:
        output_json(
            {
                "query": query,
                "results": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "category": t.category.value,
                        "description": t.metadata.description,
                    }
                    for t in results
                ],
                "count": len(results),
            }
        )
        return

    if not results:
        console.print(f"[yellow]No templates found matching '{query}'[/yellow]")
        return

    table = Table(title=f"Search Results: '{query}'")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Category", style="yellow")
    table.add_column("Description")

    for template in results:
        table.add_row(
            template.id,
            template.name,
            template.category.value,
            template.metadata.description[:60] + "..."
            if len(template.metadata.description) > 60
            else template.metadata.description,
        )

    console.print(table)
    console.print(f"\n[dim]Found {len(results)} template(s)[/dim]")


@app.callback()
def main(
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="Enable verbose output",
    ),
    json_out: bool = typer.Option(
        False,
        "--json",
        help="Output results as JSON",
    ),
) -> None:
    """Universal AI Workflow Automation Framework."""
    output_config.verbose = verbose
    output_config.json_output = json_out


if __name__ == "__main__":
    app()
