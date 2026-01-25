---
workflow:
  id: validate-input
  name: 'Input Validation'
  version: '1.0.0'
  description: 'Reusable validation workflow'

inputs:
  data:
    type: string
    required: true
    description: 'Data to validate'
  min_length:
    type: number
    required: false
    default: 1
    description: 'Minimum length'
  max_length:
    type: number
    required: false
    default: 1000
    description: 'Maximum length'

steps:
  - id: check_length
    action: script.execute
    inputs:
      code: |
        const data = inputs.data;
        const minLen = inputs.min_length || 1;
        const maxLen = inputs.max_length || 1000;

        if (data.length < minLen) {
          throw new Error(`Data too short: ${data.length} < ${minLen}`);
        }
        if (data.length > maxLen) {
          throw new Error(`Data too long: ${data.length} > ${maxLen}`);
        }

        return {
          valid: true,
          length: data.length,
          message: 'Validation passed'
        };
    output_variable: result
---

# Input Validation Sub-Workflow

This sub-workflow validates input data against length constraints.

## Usage

Call this sub-workflow from a parent workflow:

```yaml
steps:
  - id: validate
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.user_data }}'
      min_length: 5
      max_length: 100
    output_variable: validation_result
```

## Outputs

- `valid` (boolean): Whether validation passed
- `length` (number): Length of the data
- `message` (string): Validation message
