---
workflow:
  id: openai-example
  name: 'OpenAI Example Workflow'
  version: '2.0.0'
  description: 'Demonstrates using OpenAI-compatible APIs for code analysis and generation'
  author: 'marktoflow'
  tags:
    - ai
    - code-analysis
    - generation

# Agent is selected via --agent flag or GUI
# Supported agents: openai, vllm, claude-agent, copilot, opencode, ollama
# No explicit tool configuration needed - use agent.* actions

inputs:
  code_to_analyze:
    type: string
    description: 'Python code to analyze'
    default: |
      def process_items(items):
          result = []
          for i in range(len(items)):
              if items[i] != None:
                  result.append(items[i] * 2)
          return result

outputs:
  code_analysis:
    type: object
    description: 'Structured analysis of the code'
  improved_code:
    type: string
    description: 'Improved version of the code'
  documentation:
    type: string
    description: 'Generated documentation'
---

# OpenAI Example Workflow

This workflow demonstrates the OpenAI adapter's capabilities.

## Step 1: Analyze Code Quality

Use the AI model to analyze code.

```yaml
action: agent.analyze
inputs:
  prompt_template: |
    Analyze the following Python code for quality, bugs, and improvements:

    ```python
    {{ inputs.code_to_analyze }}
    ```

  categories:
    quality: 'Code quality and style issues'
    bugs: 'Potential bugs or errors'
    performance: 'Performance considerations'
    improvements: 'Suggested improvements'

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

Generate an improved version based on the analysis.

```yaml
action: agent.generate_response
inputs:
  context: |
    Based on this analysis:

    Quality: {{ code_analysis.quality | join(', ') }}
    Bugs: {{ code_analysis.bugs | join(', ') }}
    Performance: {{ code_analysis.performance | join(', ') }}
    Improvements: {{ code_analysis.improvements | join(', ') }}

    Generate an improved version of the code that addresses all issues.

  requirements:
    - Include type hints
    - Add comprehensive docstring
    - Handle edge cases
    - Use Pythonic idioms
    - Follow PEP 8 style guide

output_variable: improved_code
```

## Step 3: Generate Documentation

Create documentation for the improved code.

```yaml
action: agent.generate_response
inputs:
  context: |
    Generate comprehensive documentation for this code:

    {{ improved_code }}

  tone: professional

  requirements:
    - Explain what the function does
    - Document parameters and return value
    - Include usage examples
    - Note any important edge cases
    - Format as markdown

output_variable: documentation
```

## Step 4: Create Summary Report

Generate a summary of all improvements.

```yaml
action: agent.generate_report
inputs:
  include:
    - Original code analysis
    - Improved code version
    - Documentation generated
    - Summary of changes made

output_variable: final_report
```

## Step 5: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  code_analysis: '{{ code_analysis }}'
  improved_code: '{{ improved_code }}'
  documentation: '{{ documentation }}'
  final_report: '{{ final_report }}'
```

---

## Results

The workflow produces:
1. **code_analysis** - Structured analysis with categories
2. **improved_code** - Enhanced version with best practices
3. **documentation** - Complete documentation
4. **final_report** - Summary report in markdown

## Usage

```bash
# Run with OpenAI
marktoflow run examples/tests/openai-config/workflow.md --agent openai

# Run with VLLM (local endpoint)
marktoflow run examples/tests/openai-config/workflow.md --agent vllm

# With custom code to analyze
marktoflow run examples/tests/openai-config/workflow.md \
  --agent openai \
  --input code_to_analyze="def add(a, b): return a + b"
```
