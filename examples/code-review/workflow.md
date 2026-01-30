---
workflow:
  id: code-review
  name: 'Automated Code Review'
  version: '2.0.0'
  description: 'Reviews code changes and provides feedback using native GitHub API'
  author: 'marktoflow'
  tags:
    - code-review
    - quality
    - automation

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

  script:
    sdk: 'script'
    options:
      path: 'inline'

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

This workflow performs an automated code review on pull requests using the native GitHub API integration, checking for security issues, performance problems, and code quality concerns.

## Step 1: Fetch PR Details

Get the pull request information.

```yaml
action: github.pulls.get
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  pull_number: '{{ inputs.pr_number }}'
output_variable: pr_details
```

## Step 2: Get Changed Files

Retrieve the list of files changed in this PR.

```yaml
action: github.pulls.listFiles
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  pull_number: '{{ inputs.pr_number }}'
output_variable: changed_files
```

## Step 3: Get File Contents

Fetch the actual content of changed files for analysis.

```yaml
action: github.repos.getContent
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  path: '{{ changed_files[0].filename }}'
  ref: '{{ pr_details.head.ref }}'
output_variable: file_content
```

## Step 4: Analyze Code Changes

Review the code changes using the selected AI agent.

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
output_variable: analysis_results
```

## Step 5: Generate Review Summary

Compile all findings into a review comment.

```yaml
action: script.execute
inputs:
  code: |
    // Extract content from agent response
    const responseText = context.analysis_results?.choices?.[0]?.message?.content ||
                         context.analysis_results || '';

    // Try to parse JSON from the response
    let analysis;
    try {
      // If the response is already parsed, use it directly
      if (typeof responseText === 'object') {
        analysis = responseText;
      } else {
        // Otherwise, try to extract JSON from markdown code blocks or raw text
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                         responseText.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[1] || jsonMatch[0]) :
                   { issues: [], summary: responseText, approved: true };
      }
    } catch (e) {
      // If parsing fails, create a simple structure
      analysis = {
        issues: [],
        summary: String(responseText).substring(0, 500),
        approved: true
      };
    }

    // Ensure we have the required fields
    if (!analysis.issues) analysis.issues = [];
    if (!analysis.summary) analysis.summary = 'Review completed';
    const critical = analysis.issues.filter(i => i.severity === 'critical').length;
    const high = analysis.issues.filter(i => i.severity === 'high').length;

    let comment = `## 🤖 Automated Code Review\n\n`;
    comment += `**Summary:** ${analysis.summary}\n\n`;
    comment += `**Issues Found:** ${analysis.issues.length} (${critical} critical, ${high} high)\n\n`;

    if (analysis.issues.length > 0) {
      comment += `### Issues\n\n`;
      for (const issue of analysis.issues) {
        const emoji = issue.severity === 'critical' ? '🚨' : 
                     issue.severity === 'high' ? '⚠️' : 
                     issue.severity === 'medium' ? '⚡' : 'ℹ️';
        comment += `${emoji} **[${issue.severity.toUpperCase()}]** \`${issue.file}:${issue.line}\`\n`;
        comment += `   **${issue.category}:** ${issue.description}\n`;
        comment += `   **Suggestion:** ${issue.suggestion}\n\n`;
      }
    }

    comment += `\n---\n*Powered by marktoflow v2.0*`;

    return {
      comment,
      approved: critical === 0 && high === 0
    };
output_variable: review_data
```

## Step 6: Post Review Comment

Post the review as a comment on the PR.

```yaml
action: github.pulls.createReview
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  pull_number: '{{ inputs.pr_number }}'
  body: '{{ review_data.comment }}'
  event: "{{ review_data.approved ? 'APPROVE' : 'REQUEST_CHANGES' }}"
output_variable: review_posted
```

## Step 7: Set Outputs

Set the workflow outputs for downstream processing.

```yaml
action: workflow.set_outputs
inputs:
  review_summary: '{{ review_data.comment }}'
  issues_found: '{{ JSON.parse(analysis_results).issues }}'
  approved: '{{ review_data.approved }}'
```
