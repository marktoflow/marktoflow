# Troubleshooting Guide

This guide helps you diagnose and fix common issues with marktoflow workflows.

## Debug Mode

When a workflow fails or behaves unexpectedly, use `--debug` mode for detailed diagnostic information:

```bash
marktoflow run workflow.md --debug
```

Debug mode provides:
- **Workflow details** - ID, version, steps, tools, required inputs
- **Parsed inputs** - Shows how input parameters were interpreted
- **AI agent overrides** - Configuration details when using `--agent` flag
- **Step execution** - Detailed information for each step including inputs and outputs
- **Error details** - Complete error messages with stack traces
- **Execution context** - Steps executed before failure

### Debug Output Example

```
🐛 Debug: Workflow Details
  ID: my-workflow
  Version: 1.0.0
  Steps: 5
  Tools: slack, jira, github
  Inputs Required: project_key, channel

🐛 Debug: Parsed Inputs
  project_key: "PROJ"
  channel: "#engineering"

🐛 Debug: Starting Workflow Execution
  Workflow: My Workflow
  Steps to execute: 5

🐛 Debug: Step Start - step-1
  Action: jira.issueSearch.searchForIssuesUsingJql
  Inputs: {
    "jql": "project = PROJ"
  }

🐛 Debug: Step Complete - step-1
  Status: completed
  Duration: 1234ms
  Output (truncated): {"issues":[...]...}
```

## Common Issues

### 1. "Workflow failed: Cannot read properties of undefined"

**Cause:** SDK method call failed due to incorrect method path or authentication.

**Solution:**
1. Enable debug mode to see which step failed:
   ```bash
   marktoflow run workflow.md --debug
   ```

2. Check the action name is correct:
   ```yaml
   # ✅ Correct
   action: slack.chat.postMessage

   # ❌ Wrong
   action: slack.postMessage
   ```

3. Verify authentication credentials are set:
   ```bash
   echo $SLACK_BOT_TOKEN
   ```

### 2. "Request failed with status code 401" or "403"

**Cause:** Authentication failed - invalid or missing credentials.

**Solution:**
1. Check environment variables are set:
   ```bash
   marktoflow doctor
   ```

2. Verify tokens/keys are correct:
   ```bash
   # For Jira
   echo $JIRA_API_TOKEN
   echo $JIRA_HOST
   echo $JIRA_EMAIL

   # For Slack
   echo $SLACK_BOT_TOKEN
   ```

3. Regenerate tokens if needed:
   ```bash
   marktoflow connect jira
   ```

### 3. "Request failed with status code 404"

**Cause:** Resource not found - invalid IDs, wrong endpoint, or missing permissions.

**Solution:**
1. Enable debug mode to see the request:
   ```bash
   marktoflow run workflow.md --debug
   ```

2. Verify IDs and parameters:
   ```yaml
   # Check these values exist
   inputs:
     project_key: 'PROJ'  # Does this project exist?
     issue_id: '123'      # Is this the correct ID?
   ```

3. Check API endpoint is correct:
   - For Jira Cloud: `https://your-domain.atlassian.net`
   - For Jira Server: `https://jira.your-company.com`

### 4. "Unknown agent provider"

**Cause:** Invalid agent name passed to `--agent` flag.

**Solution:**
Use a supported agent provider:
```bash
# ✅ Correct
marktoflow run workflow.md --agent claude
marktoflow run workflow.md --agent copilot
marktoflow run workflow.md --agent ollama

# ❌ Wrong
marktoflow run workflow.md --agent anthropic
```

Supported providers:
- `claude` or `claude-agent`
- `openai`, `vllm`, or `openai-compatible`
- `copilot` or `github-copilot`
- `opencode`
- `ollama`
- `codex`

### 5. "Workflow not found"

**Cause:** File path is incorrect or file doesn't exist.

**Solution:**
1. Check the file exists:
   ```bash
   ls -la workflow.md
   ```

2. Use correct path:
   ```bash
   # Relative to current directory
   marktoflow run examples/sprint-planning/workflow.md

   # Or absolute path
   marktoflow run /full/path/to/workflow.md
   ```

3. Check `.marktoflow/workflows/` directory:
   ```bash
   marktoflow workflow list
   ```

### 6. Template Syntax Errors

**Cause:** Invalid template syntax in workflow YAML.

**Solution:**
1. Check template syntax:
   ```yaml
   # ✅ Correct
   text: "{{ inputs.message }}"

   # ❌ Wrong - missing quotes
   text: {{ inputs.message }}

   # ❌ Wrong - incorrect brackets
   text: "{ inputs.message }"
   ```

2. Validate workflow:
   ```bash
   marktoflow run workflow.md --dry-run
   ```

### 7. Step Always Skipped

**Cause:** Condition evaluates to false, or previous step failed.

**Solution:**
1. Use debug mode to see conditions:
   ```bash
   marktoflow run workflow.md --debug
   ```

2. Check condition syntax:
   ```yaml
   # Make sure the condition is correct
   condition: '{{ result.success == true }}'
   ```

3. Verify variable names:
   ```yaml
   # Check output_variable from previous step matches
   action: slack.chat.postMessage
   output_variable: slack_result

   # Later step must use the same name
   condition: '{{ slack_result.ok }}'
   ```

### 8. Timeout Errors

**Cause:** Step takes longer than default timeout (usually 30s).

**Solution:**
1. Increase timeout in step configuration:
   ```yaml
   action: long-running-task
   timeout: 300000  # 5 minutes in milliseconds
   ```

2. For API calls, check network connectivity:
   ```bash
   # Test connectivity
   curl -I https://api.service.com
   ```

### 9. Environment Variable Not Found

**Cause:** Variable referenced in workflow is not set.

**Solution:**
1. Check which variables are needed:
   ```bash
   marktoflow run workflow.md --debug
   ```

2. Set missing variables:
   ```bash
   export VARIABLE_NAME="value"
   ```

3. Or use `.env` file:
   ```bash
   echo "VARIABLE_NAME=value" >> .env
   ```

### 10. SDK Initialization Failed

**Cause:** SDK cannot be loaded or initialized.

**Solution:**
1. Check SDK name is correct:
   ```yaml
   tools:
     slack:
       sdk: '@slack/web-api'  # Must match npm package name
   ```

2. Verify the integration is supported:
   ```bash
   marktoflow tools list
   ```

3. Check authentication configuration:
   ```yaml
   tools:
     jira:
       sdk: 'jira.js'
       auth:
         host: '${JIRA_HOST}'        # Required
         email: '${JIRA_EMAIL}'      # Required
         api_token: '${JIRA_API_TOKEN}'  # Required (not apiToken)
   ```

## Getting More Help

### 1. Use Verbose Mode

For step-by-step execution without full debug details:
```bash
marktoflow run workflow.md --verbose
```

### 2. Dry Run Mode

Test workflow without making actual API calls:
```bash
marktoflow run workflow.md --dry-run
```

### 3. Check Environment

Verify your setup is correct:
```bash
marktoflow doctor
```

### 4. Debug Command

Use the interactive debugger for step-by-step execution:
```bash
marktoflow debug workflow.md
```

Commands available in debug mode:
- `continue` - Run to next breakpoint
- `step` - Execute next step
- `variables` - Show current variables
- `inspect <variable>` - Inspect variable value
- `quit` - Exit debugger

### 5. Enable Debug Logging

For maximum detail, combine flags:
```bash
marktoflow run workflow.md --debug --verbose
```

### 6. Check Logs

Review execution logs if persistence is enabled:
```bash
# Check workflow execution history
ls -la .marktoflow/logs/

# View recent execution
tail -f .marktoflow/logs/latest.log
```

## Reporting Issues

When reporting bugs, include:

1. **Debug output:**
   ```bash
   marktoflow run workflow.md --debug > debug.log 2>&1
   ```

2. **Environment info:**
   ```bash
   marktoflow doctor
   marktoflow version
   node --version
   ```

3. **Workflow file** (sanitize sensitive data)

4. **Steps to reproduce**

Report issues at: https://github.com/marktoflow/marktoflow/issues

## See Also

- [Installation Guide](./INSTALLATION.md)
- [AI Agents Guide](./AI-AGENTS.md)
- [REST API Guide](./REST-API-GUIDE.md)
- [Workflow Examples](../examples/)
