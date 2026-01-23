---
name: OpenCode Example Workflow
description: Demonstrates using OpenCode agent for analysis and generation
agent: opencode
version: 1.0.0
---

# OpenCode Example Workflow

This workflow demonstrates the OpenCode adapter capabilities.

## Step 1: Analyze Code Quality

Analyze a code snippet and provide structured feedback.

```yaml
id: analyze_code
action: agent.analyze
inputs:
  prompt_template: |
    Analyze the following Python code for quality, potential bugs, and improvements:

    ```python
    def process_data(items):
        results = []
        for item in items:
            if item != None:
                results.append(item * 2)
        return results
    ```

    Provide analysis in the following categories:

  categories:
    quality: Code quality and style issues
    bugs: Potential bugs or errors
    performance: Performance considerations
    improvements: Suggested improvements

  output_schema:
    type: object
    properties:
      quality:
        type: array
        items:
          type: string
      bugs:
        type: array
        items:
          type: string
      performance:
        type: array
        items:
          type: string
      improvements:
        type: array
        items:
          type: string

output: code_analysis
```

## Step 2: Generate Improved Version

Generate an improved version of the code based on the analysis.

```yaml
id: generate_improved_code
action: agent.generate_response
inputs:
  context: |
    Based on this analysis:

    Quality Issues: {{ code_analysis.quality | join(', ') }}
    Bugs: {{ code_analysis.bugs | join(', ') }}
    Performance: {{ code_analysis.performance | join(', ') }}
    Improvements: {{ code_analysis.improvements | join(', ') }}

    Generate an improved version of the original code that addresses these issues.

  tone: professional

  requirements:
    - Include docstring
    - Add type hints
    - Handle edge cases
    - Follow PEP 8

output: improved_code
```

## Step 3: Generate Report

Create a summary report of the code review.

```yaml
id: create_report
action: agent.generate_report
inputs:
  include:
    - Original analysis findings
    - Improved code
    - Summary of changes made
    - Recommendations for further improvement

output: final_report
```

## Results

The workflow will produce:
1. `code_analysis` - Structured analysis of the code
2. `improved_code` - Enhanced version of the code
3. `final_report` - Complete markdown report

All generated using your configured OpenCode backend (GitHub Copilot, local model, etc.)!
