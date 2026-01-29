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

## Step 1: If/Else with Nested Steps

```yaml
type: if
condition: "{{ inputs.severity === 'critical' }}"
then:
  - id: then-step-1
    name: 'Critical Action 1'
    action: console.log
    inputs:
      message: 'Executing critical action 1'

  - id: then-step-2
    name: 'Critical Action 2'
    action: console.log
    inputs:
      message: 'Executing critical action 2'

  - id: then-step-3
    name: 'Critical Action 3'
    action: console.log
    inputs:
      message: 'Executing critical action 3'

else:
  - id: else-step-1
    name: 'Non-Critical Action'
    action: console.log
    inputs:
      message: 'Executing non-critical action'

  - id: else-step-2
    name: 'Log Status'
    action: console.log
    inputs:
      message: 'Status logged'
```

## Step 2: For Each with Nested Steps

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

## Step 3: Try/Catch with Nested Steps

```yaml
type: try
try:
  - id: try-step-1
    name: 'Risky Operation 1'
    action: console.log
    inputs:
      message: 'Attempting risky operation 1'

  - id: try-step-2
    name: 'Risky Operation 2'
    action: console.log
    inputs:
      message: 'Attempting risky operation 2'

catch:
  - id: catch-step-1
    name: 'Handle Error'
    action: console.log
    inputs:
      message: 'Handling error'

  - id: catch-step-2
    name: 'Log Error'
    action: console.log
    inputs:
      message: 'Error logged'

finally:
  - id: finally-step-1
    name: 'Cleanup Resources'
    action: console.log
    inputs:
      message: 'Cleaning up resources'
```

## Step 4: Switch/Case with Multiple Branches

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

## Step 5: Parallel Execution with Nested Steps

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

## Step 6: Completion Log

```yaml
action: console.log
inputs:
  message: 'All nested step visualization tests complete!'
output_variable: completion_log
```

## Expected Visualization

When loaded in the GUI, you should see:

1. **If/Else Node**:
   - Green "Then" group with 3 steps
   - Red "Else" group with 2 steps
   - Both groups collapsible

2. **For Each Node**:
   - Purple "For Each" group with 3 iteration steps
   - Step count indicator showing "3 steps"

3. **Try/Catch Node**:
   - Blue "Try" group with 2 steps
   - Orange "Catch" group with 2 steps
   - Purple "Finally" group with 1 step
   - All three branches visible side-by-side

4. **Switch Node**:
   - Cyan "Case: critical" group with 3 steps
   - Cyan "Case: high" group with 2 steps
   - Cyan "Case: medium" group with 2 steps
   - Cyan "Case: low" group with 1 step
   - Slate "Default" group with 2 steps
   - All cases arranged horizontally

5. **Parallel Node**:
   - Cyan "Data Processing" branch with 2 steps
   - Cyan "Notification" branch with 2 steps
   - Cyan "Logging" branch with 2 steps
   - All branches side-by-side

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
