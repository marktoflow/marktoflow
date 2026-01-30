---
workflow:
  id: test-debug
  name: 'Test Debug Workflow'
  version: '1.0.0'
  description: 'Simple workflow to test debugger'

inputs:
  message:
    type: string
    required: false
    default: 'Hello from debug!'

steps:
  - id: step-1
    name: 'First Step'
    action: console.log
    inputs:
      message: 'Step 1: {{ inputs.message }}'
    output_variable: result1

  - id: step-2
    name: 'Second Step'
    action: console.log
    inputs:
      message: 'Step 2: Processing...'
    output_variable: result2

  - id: step-3
    name: 'Third Step'
    action: console.log
    inputs:
      message: 'Step 3: Done! Previous result: {{ result1 }}'
    output_variable: result3
---

# Test Debug Workflow

This workflow is used to test the step-by-step debugger.

## Steps

1. **Step 1**: Log the input message
2. **Step 2**: Log a processing message
3. **Step 3**: Log completion with reference to step 1
