---
workflow:
  id: copilot-code-review
  name: 'AI Code Review with GitHub Copilot'
  version: '2.0.0'
  description: 'Automated code review using GitHub Copilot for pull requests'
  author: 'marktoflow'
  tags:
    - code-review
    - github
    - ai
    - quality

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

  copilot:
    adapter: github-copilot
    config:
      model: gpt-4.1
      logLevel: info

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
    description: 'Review focus areas'

outputs:
  review_comment:
    type: string
    description: 'AI-generated review comment'
  issues_found:
    type: integer
    description: 'Number of issues found'
---

# AI Code Review with GitHub Copilot

This workflow automatically reviews pull requests using GitHub Copilot, checking for security vulnerabilities, performance issues, and code quality concerns.

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

## Step 2: Fetch Pull Request Files

Get the list of files changed in the pull request.

```yaml
action: github.pulls.listFiles
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  pull_number: '{{ inputs.pull_number }}'
output_variable: pr_files
```

## Step 3: Get File Contents

Fetch the content of each changed file for analysis.

```yaml
action: script.execute
inputs:
  code: |
    const files = [];
    for (const file of context.pr_files.data) {
      if (file.status === 'removed') continue;
      
      const content = await context.github.repos.getContent({
        owner: context.repo_info.owner,
        repo: context.repo_info.repo,
        path: file.filename,
        ref: context.pull_request.head.sha
      });
      
      files.push({
        filename: file.filename,
        content: Buffer.from(content.data.content, 'base64').toString('utf-8'),
        changes: file.changes,
        patch: file.patch
      });
    }
    return { files };
output_variable: file_contents
```

## Step 4: Analyze Code with Copilot

Use GitHub Copilot to perform comprehensive code review.

````yaml
action: copilot.send
inputs:
  prompt: |
    Review the following pull request for {{ inputs.repository }}:

    **Focus Areas**: {{ inputs.focus_areas | join(', ') }}

    **Files Changed** ({{ pr_files.data.length }} files):
    {% for file in file_contents.files %}

    ### {{ file.filename }} ({{ file.changes }} changes)

    ```diff
    {{ file.patch }}
    ```

    **Current Content**:
    ```
    {{ file.content }}
    ```
    {% endfor %}

    Please provide:
    1. **Security Issues**: Any vulnerabilities or security concerns
    2. **Performance Issues**: Inefficient code or potential bottlenecks
    3. **Code Quality**: Best practices, readability, maintainability
    4. **Suggestions**: Specific improvements with code examples

    Format your response as:
    - Use bullet points for each issue
    - Include file name and line numbers when relevant
    - Provide code snippets for suggested fixes
    - Rate severity: 🔴 Critical | 🟡 Warning | 🟢 Suggestion
  systemMessage: |
    You are an expert code reviewer with deep knowledge of:
    - Security best practices (OWASP, CWE)
    - Performance optimization
    - Clean code principles
    - Language-specific idioms and patterns

    Be thorough but constructive. Focus on actionable feedback.
output_variable: review_analysis
````

## Step 5: Analyze Sentiment and Extract Issues

Parse the review to count issues by severity.

```yaml
action: script.execute
inputs:
  code: |
    const review = context.review_analysis;
    const critical = (review.match(/🔴/g) || []).length;
    const warnings = (review.match(/🟡/g) || []).length;
    const suggestions = (review.match(/🟢/g) || []).length;

    return {
      total_issues: critical + warnings + suggestions,
      critical_count: critical,
      warning_count: warnings,
      suggestion_count: suggestions
    };
output_variable: issue_stats
```

## Step 6: Generate Review Summary

Create a concise summary for the PR comment.

```yaml
action: copilot.send
inputs:
  prompt: |
    Based on this detailed code review:

    {{ review_analysis }}

    Create a concise executive summary (2-3 sentences) that highlights:
    - Overall code quality assessment
    - Most critical issues (if any)
    - Key recommendations

    Keep it professional and encouraging.
  systemMessage: 'You are a technical communicator. Be clear and concise.'
output_variable: review_summary
```

## Step 7: Post Review Comment

Add the AI-generated review as a comment on the pull request.

```yaml
action: github.issues.createComment
inputs:
  owner: '{{ repo_info.owner }}'
  repo: '{{ repo_info.repo }}'
  issue_number: '{{ inputs.pull_number }}'
  body: |
    ## 🤖 AI Code Review by GitHub Copilot

    ### Summary

    {{ review_summary }}

    **Issues Found**: {{ issue_stats.total_issues }} total
    - 🔴 Critical: {{ issue_stats.critical_count }}
    - 🟡 Warnings: {{ issue_stats.warning_count }}
    - 🟢 Suggestions: {{ issue_stats.suggestion_count }}

    ---

    ### Detailed Analysis

    {{ review_analysis }}

    ---

    <sub>Automated review by [marktoflow](https://github.com/marktoflow) using GitHub Copilot SDK</sub>
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
    {% if issue_stats.critical_count > 0 %}
    - needs-work
    - security-review
    {% elif issue_stats.warning_count > 0 %}
    - needs-review
    {% else %}
    - ready-for-review
    {% endif %}
    - ai-reviewed
retry:
  max_attempts: 2
  on_failure: continue
```

## Step 9: Notify Team (Optional)

Send a notification to Slack if critical issues are found.

```yaml
condition: '{{ issue_stats.critical_count > 0 }}'
action: slack.chat.postMessage
inputs:
  channel: '#code-review'
  text: |
    🚨 Critical issues found in PR #{{ inputs.pull_number }} for {{ inputs.repository }}

    **Issues**: {{ issue_stats.critical_count }} critical, {{ issue_stats.warning_count }} warnings

    <{{ pull_request.html_url }}|View Pull Request>
retry:
  max_attempts: 2
  on_failure: continue
```

## Output

Set workflow outputs for downstream use.

```yaml
action: script.execute
inputs:
  code: |
    return {
      review_comment: context.review_analysis,
      issues_found: context.issue_stats.total_issues
    };
output_variable: workflow_result
```
