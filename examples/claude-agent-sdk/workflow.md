---
workflow:
  id: claude-agent-sdk-demo
  name: 'Claude Agent SDK Demo'
  version: '2.0.0'
  description: 'Demonstrates the Claude Agent SDK integration for agentic workflows'
  author: 'marktoflow'
  tags:
    - ai
    - agent
    - code-review
    - automation

tools:
  # Claude Agent SDK - full agentic capabilities
  agent:
    sdk: 'claude-agent'
    options:
      model: 'claude-sonnet-4-20250514'
      permissionMode: 'acceptEdits'
      maxTurns: 30
      maxBudgetUsd: 2.0
      # Enable built-in tools
      allowedTools:
        - Read
        - Write
        - Edit
        - Bash
        - Glob
        - Grep
        - WebSearch
        - Task
      # Define specialized subagents
      agents:
        code-reviewer:
          description: 'Review code for quality and best practices'
          tools: [Read, Glob, Grep]
          prompt: 'You are a senior code reviewer. Focus on code quality, bugs, and maintainability.'
        security-auditor:
          description: 'Audit code for security vulnerabilities'
          tools: [Read, Glob, Grep]
          prompt: 'You are a security expert. Look for OWASP Top 10 vulnerabilities.'
        test-writer:
          description: 'Write comprehensive tests'
          tools: [Read, Write, Glob]
          prompt: 'You are a testing expert. Write thorough unit and integration tests.'

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
    type: integer
    required: true
    description: 'Pull request number to review'
  repo:
    type: string
    required: true
    description: 'Repository in owner/repo format'
  review_depth:
    type: string
    default: 'thorough'
    description: 'Review depth: quick, thorough, or comprehensive'
---

# Claude Agent SDK Demo Workflow

This workflow demonstrates the full capabilities of the Claude Agent SDK integration,
including agentic task execution, subagent delegation, and real-time tool usage.

## Step 1: Fetch PR Details

Get the pull request information using the GitHub API.

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

## Step 3: Agentic Code Review

Use the Claude Agent SDK with full agentic capabilities to perform a comprehensive code review.
The agent can read files, search the codebase, and delegate to specialized subagents.

```yaml
action: agent.run
inputs:
  prompt: |
    Perform a comprehensive code review for this pull request:

    **PR Title:** {{ pr_details.title }}
    **Author:** {{ pr_details.user.login }}
    **Description:** {{ pr_details.body }}

    **Changed Files:**
    {% for file in changed_files %}
    - {{ file.filename }} (+{{ file.additions }} -{{ file.deletions }})
    {% endfor %}

    Instructions:
    1. Use the Read tool to examine each changed file
    2. Use Grep to find related code patterns and usages
    3. Delegate to the code-reviewer subagent for quality analysis
    4. Delegate to the security-auditor subagent for security review

    For each issue found, provide:
    - File path and line number
    - Severity (critical, high, medium, low)
    - Category (security, performance, quality, maintainability)
    - Clear description
    - Suggested fix

    Format your final response as JSON with this structure:
    {
      "issues": [...],
      "summary": "...",
      "recommendation": "APPROVE" | "REQUEST_CHANGES"
    }

  tools:
    - Read
    - Glob
    - Grep
    - Task
  permissionMode: 'acceptEdits'
  maxTurns: 25
output_variable: agent_review
```

## Step 4: Security Deep Dive (Conditional)

If critical or high severity issues were found, perform a deeper security analysis.

```yaml
action: agent.run
conditions:
  - "agent_review.result.includes('critical') || agent_review.result.includes('high')"
inputs:
  prompt: |
    Perform a deep security analysis on the files flagged in the initial review:

    Initial findings:
    {{ agent_review.result }}

    Use the security-auditor subagent to:
    1. Check for injection vulnerabilities (SQL, XSS, command injection)
    2. Verify authentication and authorization logic
    3. Look for sensitive data exposure
    4. Check cryptographic implementations
    5. Review input validation

    Provide detailed remediation steps for each security issue.

  tools:
    - Read
    - Glob
    - Grep
    - Task
  systemPrompt: 'You are a senior security engineer performing a thorough security audit.'
output_variable: security_analysis
```

## Step 5: Generate Test Suggestions

Use the agent to suggest missing tests based on the code changes.

```yaml
action: agent.run
inputs:
  prompt: |
    Analyze the changed files and suggest tests that should be added:

    **Changed Files:**
    {% for file in changed_files %}
    - {{ file.filename }}
    {% endfor %}

    Instructions:
    1. Read each changed file
    2. Identify functions and code paths that need testing
    3. Suggest specific test cases with descriptions
    4. For each test, explain what it should verify

    Delegate to the test-writer subagent for detailed test recommendations.

  tools:
    - Read
    - Glob
    - Grep
    - Task
output_variable: test_suggestions
```

## Step 6: Compile Review Report

Generate a comprehensive review report combining all analyses.

```yaml
action: script
inputs:
  code: |
    // Parse the agent's JSON response
    let reviewData;
    try {
      // Extract JSON from the agent response
      const jsonMatch = context.agent_review.result.match(/\{[\s\S]*\}/);
      reviewData = jsonMatch ? JSON.parse(jsonMatch[0]) : { issues: [], summary: 'Review completed', recommendation: 'APPROVE' };
    } catch (e) {
      reviewData = { issues: [], summary: context.agent_review.result, recommendation: 'COMMENT' };
    }

    const critical = reviewData.issues.filter(i => i.severity === 'critical').length;
    const high = reviewData.issues.filter(i => i.severity === 'high').length;
    const medium = reviewData.issues.filter(i => i.severity === 'medium').length;

    let comment = `## 🤖 Automated Code Review (Claude Agent SDK)\n\n`;
    comment += `**Summary:** ${reviewData.summary}\n\n`;
    comment += `### Issues Found\n`;
    comment += `- 🚨 Critical: ${critical}\n`;
    comment += `- ⚠️ High: ${high}\n`;
    comment += `- ⚡ Medium: ${medium}\n\n`;

    if (reviewData.issues.length > 0) {
      comment += `### Details\n\n`;
      for (const issue of reviewData.issues) {
        const emoji = issue.severity === 'critical' ? '🚨' :
                     issue.severity === 'high' ? '⚠️' :
                     issue.severity === 'medium' ? '⚡' : 'ℹ️';
        comment += `${emoji} **[${issue.severity.toUpperCase()}]** \`${issue.file}:${issue.line || 'N/A'}\`\n`;
        comment += `   **${issue.category}:** ${issue.description}\n`;
        if (issue.suggestion) {
          comment += `   **Suggestion:** ${issue.suggestion}\n`;
        }
        comment += '\n';
      }
    }

    // Add security analysis if available
    if (context.security_analysis && context.security_analysis.result) {
      comment += `### 🔒 Security Analysis\n\n`;
      comment += context.security_analysis.result.substring(0, 1000);
      if (context.security_analysis.result.length > 1000) {
        comment += '...\n';
      }
      comment += '\n\n';
    }

    // Add test suggestions
    if (context.test_suggestions && context.test_suggestions.result) {
      comment += `### 🧪 Suggested Tests\n\n`;
      comment += context.test_suggestions.result.substring(0, 1000);
      if (context.test_suggestions.result.length > 1000) {
        comment += '...\n';
      }
      comment += '\n\n';
    }

    // Add cost tracking info
    if (context.agent_review.costUsd) {
      comment += `---\n`;
      comment += `*Review cost: $${context.agent_review.costUsd.toFixed(4)} | `;
      comment += `Duration: ${(context.agent_review.durationMs / 1000).toFixed(1)}s | `;
      comment += `Tokens: ${context.agent_review.usage?.inputTokens || 0} in / ${context.agent_review.usage?.outputTokens || 0} out*\n`;
    }

    comment += `\n---\n*Powered by marktoflow v2.0 + Claude Agent SDK*`;

    return {
      comment,
      approved: critical === 0 && high === 0,
      event: critical === 0 && high === 0 ? 'APPROVE' : 'REQUEST_CHANGES',
      sessionId: context.agent_review.sessionId
    };
output_variable: review_report
```

## Step 7: Post Review to GitHub

Post the review comment to the pull request.

```yaml
action: github.pulls.createReview
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  pull_number: '{{ inputs.pr_number }}'
  body: '{{ review_report.comment }}'
  event: '{{ review_report.event }}'
output_variable: posted_review
```

---

## Usage

```bash
# Run the workflow
marktoflow run examples/claude-agent-sdk/workflow.md \
  --input repo=owner/repo \
  --input pr_number=123 \
  --input review_depth=thorough

# With environment variables
export GITHUB_TOKEN=ghp_...
export ANTHROPIC_API_KEY=sk-ant-...
marktoflow run examples/claude-agent-sdk/workflow.md \
  --input repo=myorg/myrepo \
  --input pr_number=42
```

## Features Demonstrated

1. **Agentic Task Execution** - The agent uses built-in tools (Read, Grep, Glob) autonomously
2. **Subagent Delegation** - Specialized subagents handle specific aspects (security, testing)
3. **Tool Composition** - Multiple tools work together for comprehensive analysis
4. **Cost Tracking** - Automatic tracking of API costs and token usage
5. **Session Management** - Sessions can be resumed for follow-up queries
6. **Structured Output** - JSON response parsing for reliable data extraction

## Configuration Options

The `claude-agent` SDK supports extensive configuration:

```yaml
tools:
  agent:
    sdk: 'claude-agent'
    options:
      # Model selection
      model: 'claude-sonnet-4-20250514'

      # Permission mode: default, acceptEdits, bypassPermissions, plan
      permissionMode: 'acceptEdits'

      # Resource limits
      maxTurns: 50
      maxBudgetUsd: 5.0
      maxThinkingTokens: 10000

      # Working directory
      cwd: '${WORKSPACE_PATH}'

      # Files to exclude from automatic context loading
      # Useful for filtering out large documentation files, generated content, or sensitive files
      excludeFiles:
        - 'CLAUDE.md'
        - 'AGENTS.md'
        - '.env'
        - '*.log'

      # Environment variables passed to tools
      env:
        NODE_ENV: 'production'

      # Built-in tools to enable
      allowedTools:
        - Read
        - Write
        - Edit
        - Bash
        - Glob
        - Grep
        - WebSearch
        - WebFetch
        - Task
        - TodoWrite

      # Custom MCP servers
      mcpServers:
        playwright:
          type: stdio
          command: npx
          args: ['@playwright/mcp@latest']
        database:
          type: http
          url: 'http://localhost:3000/mcp'

      # Subagent definitions
      agents:
        researcher:
          description: 'Research topics using web and documentation'
          tools: [WebSearch, WebFetch, Read]
          model: haiku
        implementer:
          description: 'Implement code changes'
          tools: [Read, Write, Edit, Bash]
          model: sonnet
```
