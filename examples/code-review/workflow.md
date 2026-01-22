---
workflow:
  id: code-review
  name: "Automated Code Review"
  version: "1.0.0"
  description: "Reviews code changes and provides feedback"
  author: "aiworkflow"
  tags:
    - code-review
    - quality
    - automation

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    - aider: limited

requirements:
  tools:
    - git
    - github
  features:
    - tool_calling: required
    - file_reading: required

triggers:
  - type: webhook
    path: /webhooks/github/pull-request
    events:
      - pull_request.opened
      - pull_request.synchronize

inputs:
  pr_number:
    type: integer
    required: true
    description: "Pull request number to review"
  repo:
    type: string
    required: true
    description: "Repository in owner/repo format"
  focus_areas:
    type: array
    default: ["security", "performance", "maintainability"]
    description: "Areas to focus review on"

outputs:
  review_summary:
    type: string
    description: "Summary of the review"
  issues_found:
    type: array
    description: "List of issues found"
  approved:
    type: boolean
    description: "Whether the PR is approved"
---

# Automated Code Review

This workflow performs an automated code review on pull requests, checking for
security issues, performance problems, and code quality concerns.

## Step 1: Fetch PR Details

Get the pull request information and changed files.

```yaml
action: github.get_pull_request
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
output_variable: pr_details
```

## Step 2: Get Changed Files

Retrieve the list of files changed in this PR.

```yaml
action: github.list_pr_files
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
output_variable: changed_files
```

## Step 3: Analyze Code Changes

Review each changed file for issues.

```yaml
action: agent.analyze
inputs:
  task: "code_review"
  files: "{{ changed_files }}"
  focus_areas: "{{ inputs.focus_areas }}"
  instructions: |
    Review the following code changes and identify:
    1. Security vulnerabilities (SQL injection, XSS, etc.)
    2. Performance issues (N+1 queries, memory leaks, etc.)
    3. Code quality problems (complexity, duplication, naming)
    4. Missing error handling
    5. Test coverage gaps
    
    For each issue, provide:
    - File and line number
    - Severity (critical, high, medium, low)
    - Description of the issue
    - Suggested fix
output_variable: analysis_results
on_error:
  action: continue
  fallback:
    issues: []
    summary: "Analysis could not be completed"
```

## Step 4: Check for Security Issues

Run security-specific checks on the changes.

```yaml
action: security.scan
inputs:
  files: "{{ changed_files }}"
  rules:
    - secrets-detection
    - dependency-vulnerabilities
    - code-injection
output_variable: security_results
condition: "'security' in inputs.focus_areas"
```

## Step 5: Generate Review Summary

Compile all findings into a review summary.

```yaml
action: agent.generate
inputs:
  task: "summarize"
  data:
    analysis: "{{ analysis_results }}"
    security: "{{ security_results }}"
    pr: "{{ pr_details }}"
  template: |
    ## Code Review Summary
    
    **PR:** #{{ pr.number }} - {{ pr.title }}
    **Author:** {{ pr.author }}
    **Files Changed:** {{ pr.changed_files_count }}
    
    ### Issues Found
    {% for issue in analysis.issues %}
    - **[{{ issue.severity }}]** {{ issue.file }}:{{ issue.line }} - {{ issue.description }}
    {% endfor %}
    
    ### Security Findings
    {% for finding in security.findings %}
    - {{ finding.rule }}: {{ finding.message }}
    {% endfor %}
    
    ### Recommendation
    {{ analysis.recommendation }}
output_variable: review_summary
```

## Step 6: Post Review Comment

Post the review as a comment on the PR.

```yaml
action: github.create_review
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ inputs.pr_number }}"
  body: "{{ review_summary }}"
  event: "{{ 'APPROVE' if analysis_results.issues | selectattr('severity', 'eq', 'critical') | list | length == 0 else 'REQUEST_CHANGES' }}"
output_variable: review_posted
```

## Step 7: Set Outputs

Set the workflow outputs for downstream processing.

```yaml
action: workflow.set_outputs
inputs:
  review_summary: "{{ review_summary }}"
  issues_found: "{{ analysis_results.issues }}"
  approved: "{{ analysis_results.issues | selectattr('severity', 'eq', 'critical') | list | length == 0 }}"
```
