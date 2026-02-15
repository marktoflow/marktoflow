---
workflow:
  id: multi-agent-code-review
  name: Multi-Agent Code Review
  description: Run security, performance, and quality reviews in parallel

inputs:
  code_file:
    type: string
    description: Path to the code file to review
  repository:
    type: string
    description: Repository name

steps:
  # Step 1: Read the code file
  - id: read_code
    action: file.read
    inputs:
      path: "{{ inputs.code_file }}"
    output_variable: code_content

  # Step 2: Run parallel reviews with different agents
  - id: parallel_reviews
    action: parallel.spawn
    inputs:
      agents:
        - id: security_review
          provider: claude
          model: sonnet
          prompt: |
            Review the following code for security vulnerabilities:

            File: {{ inputs.code_file }}
            Repository: {{ inputs.repository }}

            Code:
            ```
            {{ code_content }}
            ```

            Provide a detailed security analysis including:
            1. Potential vulnerabilities (SQL injection, XSS, authentication issues, etc.)
            2. Severity rating (Critical, High, Medium, Low)
            3. Recommended fixes
            4. OWASP Top 10 compliance

            Format: JSON with structure { vulnerabilities: [], summary: "" }

        - id: performance_review
          provider: copilot
          model: gpt-4
          prompt: |
            Analyze the following code for performance issues:

            File: {{ inputs.code_file }}

            Code:
            ```
            {{ code_content }}
            ```

            Provide analysis of:
            1. Time complexity
            2. Space complexity
            3. Bottlenecks
            4. Optimization opportunities
            5. Database query efficiency (if applicable)

            Format: JSON with structure { issues: [], optimizations: [], summary: "" }

        - id: quality_review
          provider: claude
          model: haiku
          prompt: |
            Review code quality and best practices:

            Code:
            ```
            {{ code_content }}
            ```

            Analyze:
            1. Code organization and structure
            2. Naming conventions
            3. Documentation and comments
            4. Error handling
            5. Test coverage gaps
            6. SOLID principles adherence

            Format: JSON with structure { issues: [], suggestions: [], score: 0-100 }

      wait: all  # Wait for all agents to complete
      timeout: 2m
      onError: partial  # Accept partial results if some agents fail

    output_variable: review_results

  # Step 3: Generate consolidated report
  - id: generate_report
    action: claude.chat.completions
    inputs:
      model: sonnet
      messages:
        - role: user
          content: |
            Create a consolidated code review report from these parallel reviews:

            Security Review: {{ review_results.security_review.output | tojson }}
            Performance Review: {{ review_results.performance_review.output | tojson }}
            Quality Review: {{ review_results.quality_review.output | tojson }}

            Generate a markdown report with:
            1. Executive summary
            2. Critical issues (from all reviews)
            3. Recommendations prioritized by impact
            4. Overall code health score
    output_variable: report

outputs:
  final_report: "{{ report.choices[0].message.content }}"
  security_issues: "{{ review_results.security_review.output.vulnerabilities }}"
  performance_issues: "{{ review_results.performance_review.output.issues }}"
  quality_score: "{{ review_results.quality_review.output.score }}"
---

# Multi-Agent Code Review

This workflow demonstrates parallel execution of multiple AI agents performing different types of code reviews simultaneously.

## Usage

```bash
# Run the workflow
./marktoflow run examples/parallel-agents/multi-agent-code-review.md \
  --input code_file=src/api/auth.ts \
  --input repository=my-app

# With specific agent providers
./marktoflow run examples/parallel-agents/multi-agent-code-review.md \
  --input code_file=src/api/auth.ts \
  --input repository=my-app
```

## Expected Output

The workflow will:
1. Execute 3 AI agents in parallel (security, performance, quality)
2. Complete in ~30-60 seconds (vs 90-180 seconds sequential)
3. Generate a consolidated report with all findings
4. Output the final report to console

## Benefits

- **3x faster**: Reviews run in parallel instead of sequentially
- **Diverse perspectives**: Different models provide complementary insights
- **Cost visibility**: Track cost per agent and total cost
- **Fault tolerant**: Partial results accepted if one agent fails
- **Detailed metrics**: Timing and success tracking per agent
