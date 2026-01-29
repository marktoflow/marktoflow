---
workflow:
  id: test-nested-viz
  name: 'Test Nested Step Visualization'
  description: 'Comprehensive test of nested step visualization features'
  version: '1.0.0'

tools:
  console:
    sdk: 'builtin'

inputs:
  severity:
    type: string
    default: 'medium'
    description: 'Test severity level'
  items:
    type: array
    default: [1, 2, 3]
    description: 'Test items for loops'

triggers:
  - type: manual
---

# Test Nested Step Visualization

This workflow tests all control flow nested step visualization features.

## Step 1: If/Else Routing Example

This demonstrates if/else as a routing node with 2 outputs. Based on severity, it routes to either critical handling or standard processing.

```yaml
type: if
condition: "{{ inputs.severity === 'critical' }}"
```

## Step 2: Then Path - Critical Alert

```yaml
action: console.log
inputs:
  message: 'CRITICAL: Paging on-call engineer immediately!'
output_variable: critical_response
```

## Step 3: Else Path - Standard Processing

```yaml
action: console.log
inputs:
  message: 'Standard severity - adding to queue for review'
output_variable: standard_response
```

## Step 4: For Each with Nested Steps

```yaml
type: for_each
items: "{{ inputs.items }}"
item_variable: item
steps:
  - id: loop-step-1
    name: 'Process Item'
    action: console.log
    inputs:
      message: 'Processing item {{ item }}'

  - id: loop-step-2
    name: 'Transform Item'
    action: console.log
    inputs:
      message: 'Transforming item {{ item }}'

  - id: loop-step-3
    name: 'Save Item'
    action: console.log
    inputs:
      message: 'Saving item {{ item }}'
```

## Step 5: After Loop Completion

```yaml
action: console.log
inputs:
  message: 'All items processed! Total: {{ inputs.items.length }}'
output_variable: loop_summary
```

## Step 7: Try/Catch Error Routing Example

This demonstrates try/catch as a routing node with 2 outputs (success/error). It attempts a risky API call and routes to either success or error handling.

```yaml
type: try
```

## Step 8: Success Path - API Call Succeeded

```yaml
action: console.log
inputs:
  message: 'API call successful! Processing response data.'
output_variable: api_success
```

## Step 9: Error Path - API Call Failed

```yaml
action: console.log
inputs:
  message: 'API call failed! Sending alert to monitoring system.'
output_variable: api_error
```

## Step 10: Switch/Case with Multiple Branches

```yaml
type: switch
expression: "{{ inputs.severity }}"
cases:
  critical:
    - id: critical-1
      name: 'Page On-Call'
      action: console.log
      inputs:
        message: 'Paging on-call engineer'

    - id: critical-2
      name: 'Create Incident'
      action: console.log
      inputs:
        message: 'Creating P0 incident'

    - id: critical-3
      name: 'Alert Team'
      action: console.log
      inputs:
        message: 'Alerting entire team'

  high:
    - id: high-1
      name: 'Create Ticket'
      action: console.log
      inputs:
        message: 'Creating high priority ticket'

    - id: high-2
      name: 'Notify Team'
      action: console.log
      inputs:
        message: 'Notifying team lead'

  medium:
    - id: medium-1
      name: 'Log to Dashboard'
      action: console.log
      inputs:
        message: 'Logging to monitoring dashboard'

    - id: medium-2
      name: 'Queue for Review'
      action: console.log
      inputs:
        message: 'Adding to review queue'

  low:
    - id: low-1
      name: 'Add to Backlog'
      action: console.log
      inputs:
        message: 'Adding to backlog'

default:
  - id: default-1
    name: 'Unknown Severity'
    action: console.log
    inputs:
      message: 'Handling unknown severity level'

  - id: default-2
    name: 'Request Clarification'
    action: console.log
    inputs:
      message: 'Requesting severity clarification'
```

## Step 11: Parallel Execution with Nested Steps

```yaml
type: parallel
branches:
  - id: branch-1
    name: 'Data Processing'
    steps:
      - id: branch1-step1
        name: 'Fetch Data'
        action: console.log
        inputs:
          message: 'Fetching data for branch 1'

      - id: branch1-step2
        name: 'Process Data'
        action: console.log
        inputs:
          message: 'Processing data for branch 1'

  - id: branch-2
    name: 'Notification'
    steps:
      - id: branch2-step1
        name: 'Send Email'
        action: console.log
        inputs:
          message: 'Sending email notification'

      - id: branch2-step2
        name: 'Send Slack'
        action: console.log
        inputs:
          message: 'Sending Slack notification'

  - id: branch-3
    name: 'Logging'
    steps:
      - id: branch3-step1
        name: 'Log to File'
        action: console.log
        inputs:
          message: 'Logging to file'

      - id: branch3-step2
        name: 'Log to Database'
        action: console.log
        inputs:
          message: 'Logging to database'
```

## Step 12: Completion Log

```yaml
action: console.log
inputs:
  message: 'All nested step visualization tests complete!'
output_variable: completion_log
```

## Expected Visualization

When loaded in the GUI, you should see:

1. **If/Else Node** (Step 1):
   - Simple routing node with 2 outputs
   - Green "then" output → connects to Step 2 (Critical Alert)
   - Red "else" output → connects to Step 3 (Standard Processing)
   - No nested step groups

2. **For Each Node** (Step 4):
   - Purple "For Each" group with 3 iteration steps
   - Step count indicator showing "3 steps"
   - Collapsible group container

3. **Switch Node** (Step 5):
   - Simple routing node with multiple outputs (one per case)
   - Each case output connects to its corresponding group container
   - Purple outputs for: critical, high, medium, low cases
   - Gray output for default case
   - Nested step groups for each case branch

4. **Try/Catch Node** (Step 6):
   - Simple routing node with 2 outputs
   - Green "success" output → connects to Step 7 (API Success)
   - Red "error" output → connects to Step 8 (API Error)
   - No nested step groups

5. **Parallel Node** (Step 9):
   - Single output (waits for all branches to complete)
   - Cyan "Data Processing" branch with 2 steps
   - Cyan "Notification" branch with 2 steps
   - Cyan "Logging" branch with 2 steps
   - All branches with nested step groups

## Testing Checklist

- [ ] All control flow nodes render correctly
- [ ] Group containers show with correct colors
- [ ] Step counts display accurately
- [ ] Clicking group header toggles collapse
- [ ] Collapsed groups show step count badge
- [ ] Expanded groups show all nested steps
- [ ] Auto-layout positions groups correctly
- [ ] Edges connect properly (control flow → group → steps)
- [ ] Parent-child relationships work (dragging parent moves children)
- [ ] No visual overlaps or clipping
- [ ] Zoom in/out works smoothly
- [ ] Minimap shows all nodes

## Performance Test

This workflow has:
- 5 control flow nodes
- 12 group containers
- 32 nested step nodes
- 44 total nodes (including trigger and output)

Expected performance:
- Render time: < 500ms
- Layout time: < 200ms
- Interaction latency: < 50ms
