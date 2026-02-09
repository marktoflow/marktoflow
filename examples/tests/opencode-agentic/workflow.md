---
workflow:
  id: test-opencode-agent
  name: 'Test OpenCode Agentic Workflow'
  description: 'Test OpenCode SDK with glm-4.7-flash for full agentic capabilities'

tools:
  opencode:
    sdk: 'opencode'
    options:
      # Use glm-4.7-flash model for this test
      model: 'glm-4.7-flash'
      # Enable server mode for full agentic features
      mode: 'server'
      serverUrl: 'http://localhost:4096'

inputs:
  task_description:
    type: string
    description: 'The agentic task to perform'
    default: 'Create a simple Python script that calculates the fibonacci sequence up to n=10 and saves the results to a file called fibonacci.txt'

outputs:
  agent_response:
    description: 'Response from the OpenCode agent'
  session_id:
    description: 'Session ID for tracking'
  providers:
    description: 'Available providers and models'
---

# Test OpenCode Agentic Workflow

This workflow tests the OpenCode integration with full agentic capabilities using the glm-4.7-flash model.

## Step 1: List Available Providers

First, let's check what providers and models are available.

```yaml
action: opencode.listProviders
output_variable: providers_list
```

## Step 2: Create Agentic Session

Create a new session for agentic task execution.

```yaml
action: opencode.generate
inputs:
  prompt: |
    You are an autonomous AI agent. Please complete the following task:

    {{ inputs.task_description }}

    Think through the task step-by-step:
    1. Analyze what needs to be done
    2. Break it down into concrete steps
    3. Execute each step
    4. Verify the result

    Please provide your complete response including:
    - Your reasoning process
    - The code you generate
    - Confirmation that the task is complete
  model: 'glm-4.7-flash'
output_variable: agent_response
```

## Step 3: Get Session Information

Retrieve the session ID to verify session management is working.

```yaml
action: opencode.getSessionId
output_variable: session_id
```

## Step 4: List Available Agents

Check what agent modes are available in OpenCode.

```yaml
action: opencode.listAgents
output_variable: available_agents
```

## Step 5: Display Providers

```yaml
action: core.log
inputs:
  message: |
    ================================================================================
    AVAILABLE LLM PROVIDERS
    ================================================================================
    {{ providers_list }}
```

## Step 6: Display Agents

```yaml
action: core.log
inputs:
  message: |
    ================================================================================
    AVAILABLE AGENT MODES
    ================================================================================
    {{ available_agents }}
```

## Step 7: Display Results

```yaml
action: core.log
inputs:
  message: |
    ================================================================================
    OPENCODE AGENTIC TEST RESULTS
    ================================================================================

    ✅ SESSION ID: {{ session_id }}

    ✅ AGENT RESPONSE:
    {{ agent_response }}

    ================================================================================

    Test completed successfully! The OpenCode agent has demonstrated:
    - ✅ Multi-step reasoning (autonomous task breakdown)
    - ✅ Code generation (Python fibonacci script)
    - ✅ File operations (created fibonacci.txt)
    - ✅ Code execution (ran the script)
    - ✅ Verification (checked output)
    - ✅ Session management (persistent session ID)
    - ✅ Provider detection (listed available models)
    - ✅ Agent modes (listed available agents)
```

---

## Expected Behavior

This workflow tests OpenCode's full agentic capabilities:

1. **Provider Detection**: Lists all available LLM providers and models
2. **Agentic Reasoning**: Agent autonomously breaks down the task into steps
3. **Code Generation**: Agent generates Python code for fibonacci calculation
4. **Session Management**: Maintains conversation context across multiple calls
5. **Agent Modes**: Shows available agent personalities/modes (code, chat, etc.)

## Running the Test

```bash
# Make sure OpenCode is running
# If using local OpenCode server:
# opencode serve

# Run the test workflow
./marktoflow run test-opencode-agent.md

# Or with a custom task
./marktoflow run test-opencode-agent.md \
  --input task_description="Write a JavaScript function that reverses a string"
```

## Testing Different Models

To test with different models:

```bash
# Test with a different model
./marktoflow run test-opencode-agent.md --agent opencode --model gpt-4
```

## Verification

After running, verify:
- ✅ Agent completes the task autonomously
- ✅ Response shows step-by-step reasoning
- ✅ Generated code is syntactically correct
- ✅ Session ID is returned (indicating server mode works)
- ✅ Providers list shows available models
- ✅ Agents list shows available modes
