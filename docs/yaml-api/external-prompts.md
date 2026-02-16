# External Prompts

External prompts allow you to store prompt templates in separate markdown files with optional YAML frontmatter for variable definitions. This enables prompt reuse, better organization, and cleaner workflows.

## Prompt File Format

Prompt files use markdown with optional YAML frontmatter:

```markdown
---
name: Code Review
description: Review code for quality and security
variables:
  code:
    type: string
    required: true
    description: The code to review
  language:
    type: string
    default: auto
    description: Programming language
  focus:
    type: array
    default: ['security', 'performance', 'maintainability']
---

# Code Review

Review this {{ prompt.language }} code:

\```
{{ prompt.code }}
\```

Focus on these areas:
{% for area in prompt.focus %}
- {{ area }}
{% endfor %}

Provide specific, actionable feedback.
```

## Frontmatter Variables

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | No | Human-readable prompt name |
| `description` | `string` | No | Description of what the prompt does |
| `variables` | `object` | No | Variable definitions (see below) |

### Variable Definition

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | No | Data type: `string`, `number`, `boolean`, `array`, `object` |
| `required` | `boolean` | No | Whether the variable is required |
| `default` | `any` | No | Default value if not provided |
| `description` | `string` | No | Human-readable description |

## Using External Prompts in Workflows

Reference external prompts using the `prompt` and `prompt_inputs` properties:

```yaml
steps:
  - id: review
    action: agent.chat.completions
    prompt: ./prompts/code-review.md
    prompt_inputs:
      code: '{{ inputs.code }}'
      language: typescript
    output_variable: review
```

## Template Syntax in Prompts

External prompts support two template syntaxes:

### `{{ prompt.variable }}` - Prompt Variables

Access variables defined in the prompt or passed via `prompt_inputs`:

```markdown
Language: {{ prompt.language }}
Code: {{ prompt.code }}
```

### `{{ variable }}` - Workflow Context

Access workflow variables and context (resolved during execution):

```markdown
User: {{ inputs.user_name }}
Previous result: {{ previous_step.output }}
```

## Examples

### Basic Prompt

**prompts/summarize.md:**
```markdown
---
variables:
  content:
    type: string
    required: true
  max_words:
    type: number
    default: 100
---

Summarize the following content in {{ prompt.max_words }} words or less:

{{ prompt.content }}
```

**workflow.md:**
```yaml
- id: summarize
  action: agent.chat.completions
  prompt: ./prompts/summarize.md
  prompt_inputs:
    content: '{{ document.text }}'
    max_words: 50
```

### Multi-Step Analysis Prompt

**prompts/security-analysis.md:**
```markdown
---
name: Security Analysis
variables:
  code:
    type: string
    required: true
  severity_threshold:
    type: string
    default: medium
    description: Minimum severity to report (low, medium, high, critical)
---

# Security Analysis

Analyze the following code for security vulnerabilities.

## Code to Analyze

\```
{{ prompt.code }}
\```

## Requirements

1. Identify vulnerabilities with severity >= {{ prompt.severity_threshold }}
2. For each vulnerability found, provide:
   - Severity level
   - Description
   - Location in code
   - Recommended fix
3. Format output as JSON
```

**workflow.md:**
```yaml
- id: security-scan
  action: agent.chat.completions
  model: opus
  prompt: ./prompts/security-analysis.md
  prompt_inputs:
    code: '{{ inputs.source_code }}'
    severity_threshold: high
  output_variable: security_results
```

## Validation

Prompts are validated when loaded:

1. **Required variables** - All required variables must be provided in `prompt_inputs`
2. **Type checking** - Values must match declared types
3. **Unused inputs warning** - Warns about `prompt_inputs` not used in the prompt

## Path Resolution

Prompt paths are resolved relative to the workflow file:

```
project/
├── workflows/
│   └── main.md         # workflow: prompt: ../prompts/review.md
└── prompts/
    └── review.md
```
