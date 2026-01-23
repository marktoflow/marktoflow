---
name: Claude Code Example Workflow
description: Demonstrates using Claude Code for code analysis and generation
agent: claude-code
version: 1.0.0
---

# Claude Code Example Workflow

This workflow demonstrates the Claude Code adapter's capabilities.

## Step 1: Analyze Code Quality

Use Claude's advanced reasoning to analyze code.

```yaml
id: analyze_code
action: agent.analyze
inputs:
  prompt_template: |
    Analyze the following Python code for quality, bugs, and improvements:

    ```python
    def process_items(items):
        result = []
        for i in range(len(items)):
            if items[i] != None:
                result.append(items[i] * 2)
        return result
    ```

  categories:
    quality: "Code quality and style issues"
    bugs: "Potential bugs or errors"
    performance: "Performance considerations"
    improvements: "Suggested improvements"

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

Generate an improved version based on the analysis.

```yaml
id: generate_improved
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

output: improved_code
```

## Step 3: Generate Documentation

Create documentation for the improved code.

```yaml
id: generate_docs
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

output: documentation
```

## Step 4: Create Summary Report

Generate a summary of all improvements.

```yaml
id: create_report
action: agent.generate_report
inputs:
  include:
    - Original code analysis
    - Improved code version
    - Documentation generated
    - Summary of changes made

output: final_report
```

## Results

The workflow produces:
1. **code_analysis** - Structured analysis with categories
2. **improved_code** - Enhanced version with best practices
3. **documentation** - Complete documentation
4. **final_report** - Summary report in markdown

All generated using Claude 3.5 Sonnet's advanced reasoning!

## Usage

```bash
# Run the workflow
marktoflow run examples/claude-code-config/workflow.md

# With custom model
marktoflow run workflow.md --config config-advanced.yaml
```

## Expected Output

The workflow will:
1. Identify issues like:
   - Using `range(len())` instead of enumerate
   - Checking `!= None` instead of `is not None`
   - Not handling empty lists
   - Missing type hints and docstrings

2. Generate improved code with:
   - List comprehension for better performance
   - Proper None checking
   - Type hints
   - Comprehensive docstring
   - Edge case handling

3. Create professional documentation

4. Provide a complete summary report

## Advanced: Using File Context

Claude Code can read files from the working directory:

```yaml
# In config
extra:
  working_directory: ./src

# In workflow
inputs:
  context: "Review the authentication.py file for security issues"
```

Claude will automatically find and analyze `./src/authentication.py`!
