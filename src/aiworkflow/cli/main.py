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
schedule_app = typer.Typer(help="Scheduler management commands")
bundle_app = typer.Typer(help="Workflow bundle commands")

app.add_typer(workflow_app, name="workflow")
app.add_typer(agent_app, name="agent")
app.add_typer(tools_app, name="tools")
app.add_typer(schedule_app, name="schedule")
app.add_typer(bundle_app, name="bundle")


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

    if not workflow.exists():
        console.print(f"[red]Workflow not found: {workflow}[/red]")
        raise typer.Exit(1)

    # Check if this is a bundle directory
    from aiworkflow.tools.bundle import is_bundle

    if workflow.is_dir() and is_bundle(workflow):
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


# Schedule commands
@schedule_app.command("list")
def schedule_list() -> None:
    """List scheduled workflows."""
    from aiworkflow.core.scheduler import Scheduler

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

    from aiworkflow.core.scheduler import Scheduler

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

    from aiworkflow.core.scheduler import Scheduler

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
    from aiworkflow.core.scheduler import Scheduler

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
    from aiworkflow.core.webhook import WebhookReceiver

    config_path = Path(".aiworkflow/triggers/webhooks.yaml")
    receiver = WebhookReceiver(config_path=config_path)

    endpoints = receiver.list_endpoints()

    if not endpoints:
        console.print("[yellow]No webhook endpoints configured.[/yellow]")
        console.print("Create .aiworkflow/triggers/webhooks.yaml to configure webhooks.")
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
    from aiworkflow.core.webhook import WebhookReceiver

    config_path = Path(".aiworkflow/triggers/webhooks.yaml")
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
    config_path = Path(".aiworkflow/triggers/watches.yaml")

    if not config_path.exists():
        console.print("[yellow]No file watches configured.[/yellow]")
        console.print("Create .aiworkflow/triggers/watches.yaml to configure file watches.")
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
        from aiworkflow.core.filewatcher import FileWatcher, WatchConfig, FileEventType
    except ImportError:
        console.print(
            "[red]File watcher not available. Install with: pip install aiworkflow[triggers][/red]"
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
# Save to: .aiworkflow/triggers/watches.yaml

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
        from aiworkflow.core.metrics import MetricsServer, MetricsCollector
    except ImportError:
        console.print(
            "[red]Metrics not available. Install with: pip install aiworkflow[metrics][/red]"
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

    state_path = Path(".aiworkflow/state/workflow-state/metrics.json")

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
        from aiworkflow.core.metrics import MetricsCollector
    except ImportError:
        console.print(
            "[red]Metrics not available. Install with: pip install aiworkflow[metrics][/red]"
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
        from aiworkflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            REDIS_AVAILABLE,
            RABBITMQ_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="aiworkflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print("[cyan]Queue Type:[/cyan] In-Memory (for testing only)")
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install aiworkflow[redis][/red]"
            )
            raise typer.Exit(1)
        from aiworkflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
        console.print(f"[cyan]Queue Type:[/cyan] Redis ({redis_url or 'localhost:6379'})")
    elif queue_type == "rabbitmq":
        if not RABBITMQ_AVAILABLE:
            console.print(
                "[red]RabbitMQ not available. Install with: pip install aiworkflow[rabbitmq][/red]"
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
        from aiworkflow.core.queue import (
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

    config = QueueConfig(name="aiworkflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print("[yellow]Warning: In-memory queue does not persist.[/yellow]")
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install aiworkflow[redis][/red]"
            )
            raise typer.Exit(1)
        from aiworkflow.core.queue import RedisQueue

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
        from aiworkflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            WorkflowQueueManager,
            REDIS_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="aiworkflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
        console.print(
            "[yellow]Warning: In-memory queue. Messages must be published in same process.[/yellow]"
        )
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install aiworkflow[redis][/red]"
            )
            raise typer.Exit(1)
        from aiworkflow.core.queue import RedisQueue

        queue = RedisQueue(config=config, url=redis_url or "redis://localhost:6379")
    else:
        console.print(f"[red]Unknown queue type: {queue_type}[/red]")
        raise typer.Exit(1)

    # Create workflow executor function
    def executor(workflow_id: str, inputs: dict):
        from aiworkflow.core.parser import WorkflowParser
        from aiworkflow.core.engine import WorkflowEngine

        # Find workflow file
        workflow_path = Path(f".aiworkflow/workflows/{workflow_id}.md")
        if not workflow_path.exists():
            # Try without .md extension
            workflow_path = Path(f".aiworkflow/workflows/{workflow_id}")
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
        from aiworkflow.core.queue import (
            InMemoryQueue,
            QueueConfig,
            REDIS_AVAILABLE,
        )
    except ImportError:
        console.print("[red]Queue module not available.[/red]")
        raise typer.Exit(1)

    config = QueueConfig(name="aiworkflow-default")

    if queue_type == "memory":
        queue = InMemoryQueue(config)
    elif queue_type == "redis":
        if not REDIS_AVAILABLE:
            console.print(
                "[red]Redis not available. Install with: pip install aiworkflow[redis][/red]"
            )
            raise typer.Exit(1)
        from aiworkflow.core.queue import RedisQueue

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
    from aiworkflow.tools.bundle import WorkflowBundle, is_bundle

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
    from aiworkflow.tools.bundle import WorkflowBundle, is_bundle

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

    from aiworkflow.tools.bundle import WorkflowBundle, is_bundle

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
    from aiworkflow.tools.bundle import is_bundle, WorkflowBundle

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
    from aiworkflow import __version__

    console.print(f"aiworkflow version {__version__}")


@app.callback()
def main() -> None:
    """Universal AI Workflow Automation Framework."""
    pass


if __name__ == "__main__":
    app()
