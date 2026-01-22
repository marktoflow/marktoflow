# Example Workflow Bundles

This directory contains example workflow bundles demonstrating the aiworkflow framework's self-contained workflow capabilities.

## Bundle Structure

Each bundle is a self-contained directory with:

```
bundle-name/
├── workflow.md      # Main workflow definition
├── config.yaml      # Bundle configuration
├── tools/           # Script tools
│   ├── tool1.py     # Python tool script
│   ├── tool2.sh     # Bash tool script
│   └── ...
└── tools.yaml       # Tool metadata and schemas
```

## Available Examples

### 1. Code Review (`code-review/`)

Automated code review workflow that:
- Fetches PR details from GitHub
- Analyzes code changes for issues
- Runs security scans
- Posts review comments

**Tools:** `github.py`, `security.py`

```bash
aiworkflow bundle run examples/code-review --input repo=owner/repo --input pr_number=123
```

### 2. Daily Standup (`daily-standup/`)

Aggregates team updates and generates daily standup summaries:
- Fetches JIRA updates from the last 24 hours
- Gets Slack channel activity
- Generates AI-powered summary
- Posts to team channel

**Tools:** `jira.py`, `slack.py`

```bash
aiworkflow bundle run examples/daily-standup --input jira_project=PROJ
```

### 3. Dependency Update (`dependency-update/`)

Automated dependency updates with changelog generation:
- Checks for outdated packages
- Runs security audit
- Creates update branch
- Opens PR with changelog

**Tools:** `git.sh`, `npm.py`, `github.py`

```bash
aiworkflow bundle run examples/dependency-update --input repo=owner/repo --input package_manager=npm
```

### 4. Incident Response (`incident-response/`)

Automated incident detection and response coordination:
- Creates incident Slack channel
- Gets on-call responders from PagerDuty
- Gathers metrics from Datadog
- Posts initial assessment
- Creates incident ticket in JIRA

**Tools:** `slack.py`, `pagerduty.py`, `datadog.py`, `github.py`, `jira.py`

```bash
aiworkflow bundle run examples/incident-response \
  --input incident_id=INC-001 \
  --input severity=high \
  --input service=api-gateway \
  --input description="API latency spike"
```

### 5. Sprint Planning (`sprint-planning/`)

Automates sprint planning process:
- Analyzes team velocity from past sprints
- Selects stories based on capacity
- Generates sprint goal
- Creates sprint in JIRA
- Documents in Confluence
- Notifies team in Slack

**Tools:** `jira.py`, `confluence.py`, `slack.py`

```bash
aiworkflow bundle run examples/sprint-planning \
  --input project_key=PROJ \
  --input team_members='["alice", "bob", "carol"]'
```

## Running Bundles

### Basic Usage

```bash
# Run a bundle
aiworkflow run examples/code-review

# With inputs
aiworkflow run examples/code-review --input repo=owner/repo --input pr_number=42

# Dry run (show execution plan)
aiworkflow run examples/code-review --dry-run
```

### Bundle Commands

```bash
# Show bundle information
aiworkflow bundle info examples/code-review

# Validate bundle structure
aiworkflow bundle validate examples/code-review
```

## Creating Your Own Bundle

1. Create a directory for your bundle:
   ```bash
   mkdir my-workflow
   ```

2. Create `workflow.md` with YAML frontmatter:
   ```markdown
   ---
   workflow:
     id: my-workflow
     name: "My Workflow"
     version: "1.0.0"
   ---
   
   # My Workflow
   
   ## Step 1: Do Something
   
   ```yaml
   action: my_tool.operation
   inputs:
     param: "{{ inputs.value }}"
   output_variable: result
   ```
   ```

3. Create `tools/` directory with executable scripts:
   ```bash
   mkdir tools
   # Create Python or bash scripts
   ```

4. (Optional) Create `tools.yaml` for tool metadata
5. (Optional) Create `config.yaml` for bundle settings

## Script Tool Format

### Python Scripts

```python
#!/usr/bin/env python3
import argparse
import json

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation")
    parser.add_argument("--param", required=True)
    args = parser.parse_args()
    
    result = {"success": True, "data": args.param}
    print(json.dumps(result))

if __name__ == "__main__":
    main()
```

### Bash Scripts

```bash
#!/usr/bin/env bash
operation="$1"
shift

# Parse --key=value arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --param=*) param="${1#*=}"; shift ;;
        *) shift ;;
    esac
done

echo "{\"success\": true, \"param\": \"$param\"}"
```

## Notes

- All example tools return mock data for demonstration
- In production, replace with real API calls
- Scripts must be executable (`chmod +x`)
- Output should be valid JSON for structured data
