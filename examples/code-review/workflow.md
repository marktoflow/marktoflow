---
workflow:
  id: code-review
  name: 'Automated Code Review'
  version: '2.1.0'
  description: 'AI-powered code review using Nunjucks templates and GitHub API'
  author: 'marktoflow'
  tags:
    - code-review
    - quality
    - automation
    - nunjucks

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

triggers:
  - type: webhook
    path: /webhooks/github/pull-request
    events:
      - pull_request.opened
      - pull_request.synchronize

inputs:
  pr_number:
    type: number
    required: true
    description: 'Pull request number to review'
  repo:
    type: string
    required: true
    description: 'Repository in owner/repo format'
  focus_areas:
    type: array
    default: ['security', 'performance', 'maintainability']
    description: 'Areas to focus review on'

outputs:
  review_summary:
    type: string
    description: 'Summary of the review'
  issues_found:
    type: array
    description: 'List of issues found'
  approved:
    type: boolean
    description: 'Whether the PR is approved'
---

# Automated Code Review

This workflow performs AI-powered code review on pull requests using Nunjucks templates
for clean, maintainable transformations.

## Nunjucks Features Used

- **Filters**: `| split`, `| first`, `| match`, `| parse_json`, `| join`, `| upper`
- **Control Flow**: `{% for %}`, `{% if %}`, `{% endif %}`
- **Variables**: `{{ variable }}`, `{{ obj.property }}`, `{{ arr[0] }}`

---

## Step 1: Fetch PR Details

Get the pull request information using pipeline filters to extract owner/repo.

```yaml
action: github.pulls.get
inputs:
  owner: "{{ inputs.repo | split('/') | first }}"
  repo: "{{ inputs.repo | split('/') | last }}"
  pull_number: '{{ inputs.pr_number }}'
output_variable: pr_details
```

## Step 2: Get Changed Files

Retrieve the list of files changed in this PR.

```yaml
action: github.pulls.listFiles
inputs:
  owner: "{{ inputs.repo | split('/') | first }}"
  repo: "{{ inputs.repo | split('/') | last }}"
  pull_number: '{{ inputs.pr_number }}'
output_variable: changed_files
```

## Step 3: Get File Contents

Fetch the actual content of changed files for analysis.

```yaml
action: github.repos.getContent
inputs:
  owner: "{{ inputs.repo | split('/') | first }}"
  repo: "{{ inputs.repo | split('/') | last }}"
  path: '{{ changed_files[0].filename }}'
  ref: '{{ pr_details.head.ref }}'
output_variable: file_content
```

## Step 4: Analyze Code Changes

Review the code changes using the AI agent. Note the use of Nunjucks
`{% for %}` loops and `| join` filter in the prompt.

```yaml
action: agent.chat.completions
inputs:
  messages:
    - role: 'user'
      content: |
        Review the following pull request changes:

        **PR Title:** {{ pr_details.title }}
        **Author:** {{ pr_details.user.login }}
        **Description:** {{ pr_details.body }}

        **Changed Files:**
        {% for file in changed_files %}
        - {{ file.filename }} (+{{ file.additions }} -{{ file.deletions }})
        {% endfor %}

        **Focus Areas:** {{ inputs.focus_areas | join(', ') }}

        Please review these changes and identify:
        1. Security vulnerabilities (SQL injection, XSS, secrets exposure, etc.)
        2. Performance issues (N+1 queries, memory leaks, inefficient algorithms)
        3. Code quality problems (complexity, duplication, naming conventions)
        4. Missing error handling
        5. Test coverage gaps

        For each issue, provide:
        - File and line number
        - Severity (critical, high, medium, low)
        - Description of the issue
        - Suggested fix

        Format your response as a JSON object with this structure:
        ```json
        {
          "issues": [
            {
              "file": "path/to/file.ts",
              "line": 42,
              "severity": "high",
              "category": "security",
              "description": "Issue description",
              "suggestion": "How to fix"
            }
          ],
          "recommendation": "APPROVE or REQUEST_CHANGES",
          "summary": "Overall assessment"
        }
        ```
output_variable: analysis_results
```

## Step 5: Extract JSON from AI Response

Use the `match` filter to extract JSON from markdown code blocks.
The filter takes a regex pattern and optional capture group index.

```yaml
action: core.set
inputs:
  analysis_json: "{{ analysis_results.choices[0].message.content | match('/```json\\s*([\\s\\S]*?)\\s*```/', 1) }}"
output_variable: extracted
```

## Step 6: Parse JSON Analysis

Convert the extracted JSON string to an object using `parse_json` filter.

```yaml
action: core.set
inputs:
  analysis: "{{ extracted.analysis_json | parse_json }}"
output_variable: analysis
```

## Step 7: Generate Review Summary

Build the review comment using Nunjucks control structures.
The `{% if %}`, `{% for %}`, and filters make this readable and maintainable.

```yaml
action: core.template
inputs:
  template: |
    ## Automated Code Review

    **Summary:** {{ analysis.summary }}

    **Issues Found:** {{ analysis.issues | count }}

    {% if analysis.issues | count > 0 %}
    ### Issues

    {% for issue in analysis.issues %}
    **{{ issue.severity | upper }}** `{{ issue.file }}:{{ issue.line }}`
    - **{{ issue.category }}:** {{ issue.description }}
    - **Suggestion:** {{ issue.suggestion }}

    {% endfor %}
    {% endif %}

    ---
    *Powered by marktoflow with Nunjucks templates*
  context: "{{ { analysis: analysis } }}"
output_variable: review_comment
```

## Step 8: Post Review Comment

Post the review as a comment on the PR.

```yaml
action: github.pulls.createReview
inputs:
  owner: "{{ inputs.repo | split('/') | first }}"
  repo: "{{ inputs.repo | split('/') | last }}"
  pull_number: '{{ inputs.pr_number }}'
  body: '{{ review_comment }}'
  event: "{{ analysis.recommendation | default('COMMENT') }}"
output_variable: review_posted
```

## Step 9: Set Outputs

Set the workflow outputs for downstream processing.

```yaml
action: workflow.set_outputs
inputs:
  review_summary: '{{ review_comment }}'
  issues_found: '{{ analysis.issues }}'
  approved: "{{ analysis.recommendation == 'APPROVE' }}"
```

---

## Nunjucks Quick Reference

### Built-in Nunjucks Filters
- `upper`, `lower`, `capitalize`, `title` - String case
- `trim`, `replace` - String manipulation
- `first`, `last`, `length` - Array access
- `join`, `reverse`, `sort` - Array operations
- `default` - Fallback values

### Custom marktoflow Filters
- `split(delimiter)` - Split string into array
- `match(pattern, group)` - Regex extraction
- `notMatch(pattern)` - Regex negative test
- `regexReplace(pattern, replacement, flags)` - Regex substitution
- `parse_json`, `to_json` - JSON operations
- `count`, `sum`, `unique`, `flatten` - Array operations

### Control Structures
```jinja
{% for item in items %}
  {{ item }}
{% endfor %}

{% if condition %}
  ...
{% elif other %}
  ...
{% else %}
  ...
{% endif %}
```

### Loop Variables
```jinja
{% for item in items %}
  {{ loop.index }}      {# 1-based index #}
  {{ loop.index0 }}     {# 0-based index #}
  {{ loop.first }}      {# true if first iteration #}
  {{ loop.last }}       {# true if last iteration #}
{% endfor %}
```

See [Template Expressions Guide](../../docs/TEMPLATE-EXPRESSIONS.md) for complete documentation.
