---
workflow:
  id: opencode-example
  name: 'OpenCode Example Workflow'
  version: '1.0.0'
  description: 'Demonstrates using OpenCode agent for analysis and generation'
  author: 'marktoflow'
  tags:
    - ai
    - code-analysis
    - generation

inputs:
  code_to_analyze:
    type: string
    description: 'Python code to analyze'
    default: |
      def process_data(items):
          results = []
          for item in items:
              if item != None:
                  results.append(item * 2)
          return results

outputs:
  code_analysis:
    type: object
    description: 'Structured analysis of the code'
  improved_code:
    type: string
    description: 'Improved version of the code'
  final_report:
    type: string
    description: 'Complete markdown report'
---

# OpenCode Example Workflow

This workflow demonstrates the OpenCode adapter capabilities.

## Step 1: Analyze Code Quality

Analyze a code snippet and provide structured feedback.

```yaml
action: agent.analyze
inputs:
  prompt_template: |
    Analyze the following Python code for quality, potential bugs, and improvements:

    ```python
    {{ inputs.code_to_analyze }}
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

output_variable: code_analysis
```

## Step 2: Generate Improved Version

Generate an improved version of the code based on the analysis.

```yaml
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

output_variable: improved_code
```

## Step 3: Generate Report

Create a summary report of the code review.

```yaml
action: agent.generate_report
inputs:
  include:
    - Original analysis findings
    - Improved code
    - Summary of changes made
    - Recommendations for further improvement

output_variable: final_report
```

## Step 4: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  code_analysis: '{{ code_analysis }}'
  improved_code: '{{ improved_code }}'
  final_report: '{{ final_report }}'
```

## Results

The workflow will produce:
1. `code_analysis` - Structured analysis of the code
2. `improved_code` - Enhanced version of the code
3. `final_report` - Complete markdown report

All generated using your configured OpenCode backend (GitHub Copilot, local model, etc.)!
