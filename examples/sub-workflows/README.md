# Sub-Workflows Example

This example demonstrates how to use sub-workflows in marktoflow to create reusable, composable workflow components.

## What are Sub-Workflows?

Sub-workflows allow you to:

- **Modularize** complex workflows into smaller, reusable pieces
- **Compose** workflows by calling other workflows as steps
- **Maintain** common workflow patterns in one place
- **Test** workflow components independently

## Directory Structure

```
sub-workflows/
├── common/                    # Reusable sub-workflows
│   ├── validate-input.md      # Input validation
│   └── send-notification.md   # Slack notifications
├── user-onboarding.md         # Main workflow example
└── README.md                  # This file
```

## Sub-Workflow Syntax

To call a sub-workflow, use the `workflow` field instead of `action`:

```yaml
steps:
  - id: validate_data
    workflow: ./common/validate-input.md # Path to sub-workflow
    inputs:
      data: '{{ inputs.user_input }}'
      min_length: 5
      max_length: 100
    output_variable: validation_result
```

## Key Features

### 1. Relative Path Resolution

Sub-workflow paths are relative to the parent workflow's directory:

```yaml
# In examples/sub-workflows/user-onboarding.md
workflow: ./common/validate-input.md
# Resolves to: examples/sub-workflows/common/validate-input.md
```

### 2. Input/Output Passing

Inputs are passed as template variables:

```yaml
# Parent passes inputs to sub-workflow
inputs:
  data: '{{ inputs.username }}'
  min_length: 3

# Sub-workflow receives them as inputs.data, inputs.min_length
```

Outputs are stored in the parent's output variable:

```yaml
output_variable: validation_result
# Access: {{ validation_result.valid }}
```

### 3. Nested Sub-Workflows

Sub-workflows can call other sub-workflows (unlimited depth):

```yaml
# level1.md calls level2.md calls level3.md
steps:
  - id: call_level2
    workflow: ./level2.md
    inputs:
      data: '{{ inputs.data }}'
```

### 4. Error Handling

Sub-workflow errors propagate to the parent:

```yaml
steps:
  - id: validate
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.data }}'
    error_handling:
      action: stop # Stop on validation failure
      max_retries: 0 # No retries
```

## Examples

### 1. Reusable Validation

`common/validate-input.md` - Validates data length:

```yaml
workflow:
  id: validate-input
  name: 'Input Validation'

inputs:
  data: { type: string, required: true }
  min_length: { type: number, default: 1 }
  max_length: { type: number, default: 1000 }

steps:
  - id: check_length
    action: script.execute
    inputs:
      code: |
        // Validation logic
        return { valid: true, length: data.length };
    output_variable: result
```

### 2. Reusable Notifications

`common/send-notification.md` - Sends formatted Slack messages:

```yaml
workflow:
  id: send-notification
  name: 'Send Notification'

inputs:
  channel: { type: string, required: true }
  message: { type: string, required: true }
  level: { type: string, default: 'info' }

steps:
  - id: format_message
    action: script.execute
    # Format with emoji based on level

  - id: send_slack
    action: slack.chat.postMessage
    # Send to Slack
```

### 3. Main Workflow Composition

`user-onboarding.md` - Orchestrates multiple sub-workflows:

```yaml
steps:
  # Validate username
  - id: validate_username
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.username }}'

  # Validate email
  - id: validate_email
    workflow: ./common/validate-input.md
    inputs:
      data: '{{ inputs.email }}'

  # Create account
  - id: create_account
    action: script.execute
    # Account creation logic

  # Notify via Slack
  - id: notify_success
    workflow: ./common/send-notification.md
    inputs:
      channel: '#onboarding'
      message: 'User created: {{ user_account.username }}'
```

## Running the Examples

### Run the main workflow:

```bash
marktoflow run examples/sub-workflows/user-onboarding.md \
  --input username=johndoe \
  --input email=john@example.com \
  --input slack_channel=#onboarding
```

### Test individual sub-workflows:

```bash
# Test validation sub-workflow
marktoflow run examples/sub-workflows/common/validate-input.md \
  --input data="test-data" \
  --input min_length=5 \
  --input max_length=20

# Test notification sub-workflow
marktoflow run examples/sub-workflows/common/send-notification.md \
  --input channel="#test" \
  --input message="Hello from sub-workflow" \
  --input level="info"
```

### Dry-run mode:

```bash
marktoflow run examples/sub-workflows/user-onboarding.md \
  --input username=johndoe \
  --input email=john@example.com \
  --dry-run \
  --verbose
```

## Benefits of Sub-Workflows

### 1. Reusability

- Write validation logic once, use everywhere
- Share common patterns across workflows
- Reduce code duplication

### 2. Maintainability

- Update logic in one place
- Easier to test individual components
- Clear separation of concerns

### 3. Composition

- Build complex workflows from simple parts
- Mix and match sub-workflows
- Create workflow libraries

### 4. Testing

- Test sub-workflows independently
- Mock sub-workflow outputs
- Easier debugging

## Best Practices

### 1. Keep Sub-Workflows Focused

- Each sub-workflow should do one thing well
- Clear inputs and outputs
- Self-contained logic

### 2. Document Inputs/Outputs

- Use descriptive input names
- Document expected output structure
- Include usage examples

### 3. Handle Errors Gracefully

- Validate inputs early
- Provide meaningful error messages
- Use appropriate error handling

### 4. Organize by Function

```
workflows/
├── common/           # Shared utilities
│   ├── validate-*.md
│   └── notify-*.md
├── integrations/     # Service-specific
│   ├── slack/
│   └── github/
└── main-*.md         # Top-level workflows
```

### 5. Version Your Sub-Workflows

```yaml
workflow:
  id: validate-input
  version: '1.0.0' # Semantic versioning
```

## Advanced Patterns

### 1. Conditional Sub-Workflow Execution

```yaml
steps:
  - id: validate_prod
    workflow: ./common/strict-validation.md
    inputs:
      data: '{{ inputs.data }}'
    conditions:
      - "inputs.environment == 'production'"
```

### 2. Dynamic Sub-Workflow Selection

```yaml
steps:
  - id: select_validator
    action: script.execute
    inputs:
      code: |
        const env = inputs.environment;
        return { 
          workflow: env === 'prod' 
            ? './common/strict-validation.md'
            : './common/basic-validation.md'
        };
    output_variable: validator

  # Use dynamic path (requires template support)
  - id: validate
    workflow: '{{ validator.workflow }}'
    inputs:
      data: '{{ inputs.data }}'
```

### 3. Sub-Workflow Libraries

Create a library of reusable sub-workflows:

```
.marktoflow/
└── library/
    ├── validation/
    │   ├── email.md
    │   ├── phone.md
    │   └── username.md
    ├── notifications/
    │   ├── slack.md
    │   ├── email.md
    │   └── webhook.md
    └── integrations/
        ├── github-pr.md
        ├── jira-ticket.md
        └── linear-issue.md
```

## Limitations

1. **No circular dependencies**: Sub-workflows cannot call themselves or create circular chains
2. **No dynamic paths yet**: Workflow paths must be static strings (not templates)
3. **Shared context**: Sub-workflows execute in the same engine context as parent

## Next Steps

- Explore other examples in the `examples/` directory
- Read the full documentation at `docs/SUB-WORKFLOWS.md`
- Create your own reusable sub-workflow library
- Contribute sub-workflows to the community

## Questions?

- Check the main README: `../../README.md`
- Read the docs: `../../docs/`
- Open an issue: https://github.com/scottgl9/marktoflow/issues
