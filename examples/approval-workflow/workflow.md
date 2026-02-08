---
workflow:
  id: approval-workflow
  name: 'Expense Approval Workflow'
  description: 'Submit expense for approval with human review'
  version: '1.0.0'

inputs:
  employee_name:
    type: string
    required: true
    description: 'Name of the employee submitting the expense'

  amount:
    type: number
    required: true
    description: 'Expense amount in USD'

  category:
    type: string
    required: true
    description: 'Expense category'

outputs:
  approval_status:
    description: 'Whether the expense was approved or rejected'

  reviewer_comments:
    description: 'Comments from the reviewer'
---

# Expense Approval Workflow

This workflow demonstrates human-in-the-loop functionality with form-based approval.

## Step 1: Log expense submission

```yaml
type: action
action: core.log
inputs:
  level: 'info'
  message: 'Expense submitted by {{ inputs.employee_name }}: ${{ inputs.amount }} for {{ inputs.category }}'
output_variable: submission_log
```

## Step 2: Wait for approval

This step pauses the workflow and waits for a manager to review and approve/reject the expense.

```yaml
type: wait
mode: form
fields:
  decision:
    type: select
    label: 'Approval Decision'
    description: 'Approve or reject this expense'
    required: true
    options:
      - 'Approved'
      - 'Rejected'

  comments:
    type: text
    label: 'Reviewer Comments'
    description: 'Optional comments about this decision'
    required: false

  reviewer_name:
    type: string
    label: 'Reviewer Name'
    description: 'Your name'
    required: true
output_variable: approval_response
```

## Step 3: Process approval decision

```yaml
type: if
condition: "{{ approval_response.decision == 'Approved' }}"
then:
  - type: action
    action: core.log
    inputs:
      level: 'info'
      message: 'Expense APPROVED by {{ approval_response.reviewer_name }}: ${{ inputs.amount }} for {{ inputs.employee_name }}'
    output_variable: approval_log

  - type: action
    action: workflow.set_outputs
    inputs:
      approval_status: 'approved'
      reviewer_comments: '{{ approval_response.comments }}'
      reviewer_name: '{{ approval_response.reviewer_name }}'

else:
  - type: action
    action: core.log
    inputs:
      level: 'warn'
      message: 'Expense REJECTED by {{ approval_response.reviewer_name }}: ${{ inputs.amount }} for {{ inputs.employee_name }}'
    output_variable: rejection_log

  - type: action
    action: workflow.set_outputs
    inputs:
      approval_status: 'rejected'
      reviewer_comments: '{{ approval_response.comments }}'
      reviewer_name: '{{ approval_response.reviewer_name }}'
```

## Step 4: Send notification

```yaml
type: action
action: core.log
inputs:
  level: 'info'
  message: 'Workflow completed. Status: {{ outputs.approval_status }}'
output_variable: completion_log
```
