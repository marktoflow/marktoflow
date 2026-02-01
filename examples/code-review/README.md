# Code Review Example

AI-powered automated code review using Nunjucks templates.

## Overview

This workflow performs automated code review on GitHub pull requests using:

- **Nunjucks Templates** - Clean, Jinja2-compatible template syntax
- **Pipeline Filters** - Chain operations like `{{ value | split('/') | first }}`
- **Regex Filters** - Extract data with `match`, `notMatch`, `regexReplace`
- **Control Structures** - `{% for %}`, `{% if %}` for dynamic content

## Features

- Fetches PR details and changed files from GitHub
- Sends code to AI agent for analysis
- Extracts structured JSON from AI response using `match` filter
- Generates formatted review comment with Nunjucks templates
- Posts review to GitHub PR

## Usage

```bash
marktoflow run examples/code-review/workflow.md \
  --input pr_number=123 \
  --input repo="owner/repository"
```

## Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token with repo permissions

## Nunjucks Highlights

### Pipeline Syntax
```yaml
owner: "{{ inputs.repo | split('/') | first }}"
```

### Regex Extraction
```yaml
json: "{{ response | match('/```json\\s*([\\s\\S]*?)\\s*```/', 1) }}"
```

### Control Flow in Templates
```jinja
{% for issue in analysis.issues %}
**{{ issue.severity | upper }}** `{{ issue.file }}:{{ issue.line }}`
{% endfor %}
```

## Learn More

- [Template Expressions Guide](../../docs/TEMPLATE-EXPRESSIONS.md) - Complete Nunjucks documentation
- [marktoflow Documentation](../../docs/DETAILED-GUIDE.md) - Full feature guide
