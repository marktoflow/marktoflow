# Expense Approval Workflow

This example demonstrates marktoflow's **human-in-the-loop** functionality using form-based approval steps.

## Features Demonstrated

- ✅ **Wait Step with Form Mode** - Pauses workflow execution for human input
- ✅ **Form Field Types** - Select dropdown, text area, and string input
- ✅ **Conditional Logic** - Different actions based on approval decision
- ✅ **Form Data Access** - Access submitted form data via `{stepId}_response` variable

## How It Works

1. **Submit Expense** - Workflow starts with employee name, amount, and category
2. **Wait for Approval** - Workflow pauses and presents a form to a reviewer
3. **Form Submission** - Reviewer approves/rejects with optional comments
4. **Process Decision** - Workflow resumes and processes the decision
5. **Set Outputs** - Final status and comments are saved as workflow outputs

## Running the Workflow

### Via CLI

```bash
marktoflow run examples/approval-workflow/workflow.md \
  --input employee_name="John Doe" \
  --input amount=250 \
  --input category="Travel"
```

### Via GUI

1. Start the GUI server: `marktoflow gui`
2. Open http://localhost:3001
3. Navigate to the workflow
4. Click "Execute" and provide inputs
5. When the workflow pauses, you'll see the form URL in the step output
6. Open the form URL to submit your approval decision
7. The workflow will automatically resume after form submission

## API Endpoints

### Get Form Schema

```http
GET /api/form/{runId}/{stepId}/{token}
```

Returns the form fields and metadata.

### Submit Form Data

```http
POST /api/form/{runId}/{stepId}/{token}
Content-Type: application/json

{
  "decision": "Approved",
  "comments": "Looks good!",
  "reviewer_name": "Jane Manager"
}
```

Submits the form data and resumes workflow execution.

## Form Field Types

The workflow uses these field types (all supported by marktoflow):

| Type | Description | Example |
|------|-------------|---------|
| `select` | Dropdown with predefined options | Approval decision (Approved/Rejected) |
| `text` | Multi-line text area | Reviewer comments |
| `string` | Single-line text input | Reviewer name |
| `number` | Numeric input | Amounts, quantities |
| `boolean` | Checkbox | Yes/no questions |
| `date` | Date picker | Deadlines, schedules |
| `email` | Email input with validation | Contact emails |
| `url` | URL input with validation | Reference links |

## Accessing Form Data

When a form is submitted, the data is injected into the workflow context as:

```
{stepId}_response
```

For this workflow, the approval step has `output_variable: approval_response`, so the form data is accessed via:

```
{{ approval_response_response.decision }}
{{ approval_response_response.comments }}
{{ approval_response_response.reviewer_name }}
```

## Real-Time Updates

When using the GUI:

1. WebSocket connection provides real-time execution updates
2. Form submission triggers immediate workflow resumption
3. Step progress is displayed live in the UI

## Production Considerations

In production environments, consider:

- **Authentication** - Verify form submitter identity via tokens
- **Expiration** - Set timeouts for form submissions
- **Notifications** - Send emails/Slack messages with form links
- **Validation** - Add custom validation rules for form fields
- **Audit Trail** - Log all approval decisions with timestamps

## Related Examples

- `examples/human-approval` - Simple approval workflow
- `examples/multi-step-form` - Complex multi-stage forms
- `examples/conditional-approval` - Dynamic approval rules

## Learn More

- [Wait Steps Documentation](../../docs/wait-steps.md)
- [Form Fields Reference](../../docs/form-fields.md)
- [Human-in-the-Loop Patterns](../../docs/human-in-the-loop.md)
