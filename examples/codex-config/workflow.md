---
workflow:
  id: codex-code-review
  name: 'AI Code Review with OpenAI Codex'
  version: '2.0.0'
  description: 'Automated code review and analysis using OpenAI Codex SDK'
  author: 'marktoflow'
  tags:
    - code-review
    - ai
    - codex
    - quality

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

  codex:
    sdk: '@openai/codex-sdk'
    auth:
      api_key: '${OPENAI_API_KEY}'
    options:
      model: 'codex-1'
      sandboxMode: 'read-only'
      skipGitRepoCheck: true
      reasoningEffort: 'high'

triggers:
  - type: webhook
    path: /github-pr
    events:
      - pull_request.opened
      - pull_request.synchronize

inputs:
  repository:
    type: string
    required: true
    description: 'Repository in owner/repo format'
  pull_number:
    type: integer
    required: true
    description: 'Pull request number'
  focus_areas:
    type: array
    default:
      - security
      - performance
      - code_quality
      - typescript
    description: 'Review focus areas'

outputs:
  review_comment:
    type: string
    description: 'AI-generated review comment'
  issues_found:
    type: integer
    description: 'Number of issues found'
---

# AI Code Review with OpenAI Codex

This workflow uses OpenAI Codex to perform intelligent code reviews with deep reasoning capabilities, structured output, and comprehensive analysis.

## Step 1: Parse Repository Info

Extract owner and repo from repository string.

```yaml
action: script.execute
inputs:
  code: |
    const [owner, repo] = context.inputs.repository.split('/');
    return { owner, repo };
output_variable: repo_info
```

## Step 2: Fetch Pull Request Details

Get the pull request information and changed files.

```yaml
action: github.pulls.get
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  pull_number: '{{ inputs.pull_number }}'
output_variable: pr_details
```

## Step 3: Fetch Pull Request Files

Get the list of files changed in the pull request.

```yaml
action: github.pulls.listFiles
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  pull_number: '{{ inputs.pull_number }}'
output_variable: pr_files
```

## Step 4: Analyze Code with Codex

Use OpenAI Codex to perform deep code analysis with high reasoning effort.

````yaml
action: codex.codeReview
inputs:
  prompt: |
    Review the following pull request for {{ inputs.repository }}:

    **PR Title**: {{ pr_details.data.title }}
    **PR Description**: {{ pr_details.data.body }}
    **Focus Areas**: {{ inputs.focus_areas | join(', ') }}

    **Files Changed** ({{ pr_files.data.length }} files):
    {% for file in pr_files.data %}
    - {{ file.filename }} ({{ file.status }}, +{{ file.additions }}/-{{ file.deletions }})
    {% endfor %}

    Please analyze each file and provide:
    1. **Security Issues**: Vulnerabilities, injection risks, auth problems
    2. **Performance Issues**: Inefficient algorithms, N+1 queries, memory leaks
    3. **Code Quality**: Maintainability, readability, best practices
    4. **TypeScript Issues**: Type safety, proper typing, any usage

    Format each issue with:
    - 🔴 Critical | 🟡 Warning | 🟢 Suggestion
    - File and line reference
    - Clear explanation
    - Suggested fix with code example
  focusAreas: '{{ inputs.focus_areas }}'
  workingDirectory: '.'
output_variable: code_review
````

## Step 5: Get Structured Issue Summary

Use Codex structured output to extract issues in a parseable format.

```yaml
action: codex.structured
inputs:
  prompt: |
    Based on this code review analysis, extract all issues found:

    {{ code_review.content }}

    Return a JSON object with the issues.
  schema:
    type: object
    properties:
      summary:
        type: string
        description: 'Overall assessment (1-2 sentences)'
      issues:
        type: array
        items:
          type: object
          properties:
            severity:
              type: string
              enum: ['critical', 'warning', 'suggestion']
            category:
              type: string
              enum: ['security', 'performance', 'quality', 'typescript']
            file:
              type: string
            line:
              type: integer
            description:
              type: string
            fix:
              type: string
      stats:
        type: object
        properties:
          total:
            type: integer
          critical:
            type: integer
          warnings:
            type: integer
          suggestions:
            type: integer
    required: ['summary', 'issues', 'stats']
output_variable: structured_review
```

## Step 6: Generate Improvement Suggestions

Ask Codex to suggest code improvements with examples.

````yaml
action: codex.codeAnalyze
inputs:
  prompt: |
    Based on this pull request review:

    {{ code_review.content }}

    Provide 3-5 specific code improvement suggestions with:
    1. What to change
    2. Why it improves the code
    3. A code example showing the improvement

    Focus on the most impactful changes that would improve {{ inputs.focus_areas | join(' and ') }}.
output_variable: improvements
````

## Step 7: Post Review Comment

Add the AI-generated review as a comment on the pull request.

```yaml
action: github.issues.createComment
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  issue_number: '{{ inputs.pull_number }}'
  body: |
    ## 🤖 AI Code Review by OpenAI Codex

    ### Summary

    {{ structured_review.summary }}

    **Issues Found**: {{ structured_review.stats.total }} total
    - 🔴 Critical: {{ structured_review.stats.critical }}
    - 🟡 Warnings: {{ structured_review.stats.warnings }}
    - 🟢 Suggestions: {{ structured_review.stats.suggestions }}

    ---

    ### Detailed Analysis

    {{ code_review.content }}

    ---

    ### Improvement Suggestions

    {{ improvements.content }}

    ---

    <sub>Automated review by [marktoflow](https://github.com/marktoflow) using OpenAI Codex SDK</sub>
output_variable: comment_result
```

## Step 8: Label Pull Request

Add labels based on review findings.

```yaml
action: github.issues.addLabels
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  issue_number: '{{ inputs.pull_number }}'
  labels: |
    {% if structured_review.stats.critical > 0 %}
    - needs-work
    - security-review
    {% elif structured_review.stats.warnings > 0 %}
    - needs-review
    {% else %}
    - ready-for-review
    {% endif %}
    - ai-reviewed
    - codex-reviewed
errorHandling:
  action: continue
  maxRetries: 2
```

## Step 9: Research Best Practices (Optional)

If security issues are found, use Codex web search to find relevant security guidelines.

```yaml
condition: '{{ structured_review.stats.critical > 0 }}'
action: codex.webSearch
inputs:
  prompt: |
    Find best practices and security guidelines for the issues found:
    {% for issue in structured_review.issues %}
    {% if issue.severity == 'critical' %}
    - {{ issue.description }}
    {% endif %}
    {% endfor %}

    Focus on OWASP guidelines and industry best practices.
  searchMode: 'live'
output_variable: security_research
errorHandling:
  action: continue
```

## Output

Set workflow outputs for downstream use.

```yaml
action: script.execute
inputs:
  code: |
    return {
      review_comment: context.code_review.content,
      issues_found: context.structured_review.stats.total,
      thread_id: context.code_review.threadId
    };
output_variable: workflow_result
```
