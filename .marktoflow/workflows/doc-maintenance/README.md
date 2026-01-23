# Documentation Maintenance Workflow

Automatically maintain component documentation across large codebases by intelligently detecting outdated documentation and updating only what needs to be changed.

## Features

- 🔍 **Smart Detection**: Analyzes code vs documentation to identify truly outdated content
- 🎯 **Minimal Changes**: Only updates documentation that is inaccurate or outdated
- 💾 **Safe Updates**: Creates backups before modifying files
- 🧪 **Dry Run Mode**: Preview changes before applying them
- 📊 **Detailed Reports**: Generates comprehensive summary reports
- 🔄 **Batch Processing**: Efficiently processes multiple components
- 🎛️ **Configurable**: Customize patterns, exclusions, and processing limits

## How It Works

1. **Discovery**: Scans codebase to identify components based on directory pattern
2. **Analysis**: For each component, compares code with documentation using AI
3. **Decision**: Determines if documentation needs updates (not just stylistic changes)
4. **Update**: Updates only outdated/inaccurate documentation
5. **Report**: Generates summary of all changes made

## Prerequisites

- Python 3.11+
- Ollama running locally (or OpenCode/Claude as fallback)
- marktoflow installed

## Quick Start

### 1. Basic Usage

Update documentation for all components in `src/`:

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --agent ollama
```

### 2. Dry Run (Preview Changes)

See what would be updated without making changes:

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input dry_run=true \
  --agent ollama
```

### 3. Custom Component Pattern

Process components in a monorepo structure:

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input component_pattern="packages/*/" \
  --agent ollama
```

### 4. Specific Documentation Files

Only update README.md and API.md files:

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input doc_files='["README.md","API.md"]' \
  --agent ollama
```

### 5. Process Limited Set

Process only first 5 components (useful for testing):

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input max_components=5 \
  --agent ollama
```

## Configuration

### Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `codebase_path` | string | **required** | Root path of the codebase |
| `component_pattern` | string | `"src/*/"` | Glob pattern to identify components |
| `doc_files` | array | `["README.md", "DOCS.md", "API.md"]` | Documentation files to check |
| `dry_run` | boolean | `false` | Preview mode without writing changes |
| `exclude_patterns` | array | `["node_modules", "dist", "build"]` | Patterns to exclude |
| `max_components` | integer | `0` | Max components to process (0 = unlimited) |

### Environment Variables

Create a `.env` file in this bundle directory:

```bash
# Ollama configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

# Or use OpenAI
OPENAI_API_KEY=sk-...

# Logging
MARKTOFLOW_LOG_LEVEL=INFO
```

## Output

### During Execution

Progress updates show:
- Component being processed
- Whether documentation was updated or valid
- Confidence level of analysis
- Number of issues found

Example:
```
[1/15] auth-service
- Status: UPDATED
- Confidence: high
- Issues: 3

[2/15] payment-service
- Status: VALID
- Confidence: high
- Issues: 0
```

### Final Report

A markdown report is generated at `.marktoflow/state/doc-maintenance-report.md`:

```markdown
# Documentation Maintenance Report

**Codebase:** /path/to/project
**Completed:** 2026-01-23T10:30:00
**Dry Run:** No

## Summary

- **Total Components Processed:** 15
- **Documentation Updated:** 3 (20.0%)
- **Documentation Valid:** 12 (80.0%)

## Updated Components

- **auth-service** - 3 issues (confidence: high)
- **user-profile** - 2 issues (confidence: medium)
- **api-gateway** - 1 issues (confidence: high)

## Valid Components (No Updates Needed)

- payment-service
- email-service
- notification-service
...
```

## Examples for Different Project Structures

### Monorepo (Lerna/Nx style)

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input component_pattern="packages/*/" \
  --input exclude_patterns='["node_modules","dist",".next"]'
```

### Microservices

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input component_pattern="services/*/" \
  --input doc_files='["README.md","API.md","DEPLOY.md"]'
```

### Python Package

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input component_pattern="src/mypackage/*/" \
  --input exclude_patterns='["__pycache__","*.pyc",".pytest_cache"]'
```

### Go Modules

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input component_pattern="cmd/*/" \
  --input doc_files='["README.md","USAGE.md"]'
```

## Best Practices

1. **Always Start with Dry Run**: Test on a few components first
   ```bash
   --input dry_run=true --input max_components=3
   ```

2. **Use Version Control**: Commit before running to easily review changes
   ```bash
   git commit -am "Before doc maintenance"
   ```

3. **Review Changes**: After execution, review with git diff
   ```bash
   git diff
   ```

4. **Incremental Updates**: Process in batches during development
   ```bash
   --input max_components=10
   ```

5. **CI/CD Integration**: Run as a scheduled job
   ```bash
   # Weekly documentation maintenance
   0 0 * * 0 marktoflow bundle run ...
   ```

## Troubleshooting

### No Components Found

- Check `component_pattern` matches your directory structure
- Verify `codebase_path` is correct
- Check exclude patterns aren't filtering everything

### Documentation Not Updated

- AI determined documentation is still valid
- Check confidence level - may be set to only update "high" confidence
- Review the analysis output in logs

### Script Errors

Make sure tools are executable:
```bash
chmod +x .marktoflow/workflows/doc-maintenance/tools/*.py
```

## Advanced Usage

### Custom Analysis Prompt

Modify the `analyze_component` step in `workflow.md` to customize how documentation is evaluated.

### Different AI Models

Switch between agents:
```bash
# Use OpenCode
--agent opencode

# Use Claude
--agent claude

# Use specific Ollama model
--ollama-host http://localhost:11434 --model llama3:70b
```

### Batch Processing with Monitoring

```bash
# Process in batches with delays
for i in {0..50..10}; do
  marktoflow bundle run .marktoflow/workflows/doc-maintenance \
    --input codebase_path=$(pwd) \
    --input max_components=10 \
    --agent ollama
  sleep 60  # Cool down
done
```

## Integration Examples

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Run doc maintenance on changed components only

marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=$(pwd) \
  --input dry_run=false \
  --agent ollama
```

### GitHub Actions

```yaml
name: Documentation Maintenance

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  maintain-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install marktoflow
        run: pip install marktoflow
      - name: Run documentation maintenance
        run: |
          marktoflow bundle run .marktoflow/workflows/doc-maintenance \
            --input codebase_path=$(pwd) \
            --agent openai \
            --openai-api-key ${{ secrets.OPENAI_API_KEY }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: Update component documentation'
          body: 'Automated documentation maintenance'
```

## Support

For issues or questions:
- Check the workflow execution logs
- Review the generated report in `.marktoflow/state/`
- Ensure AI agent (Ollama/OpenCode/Claude) is properly configured
