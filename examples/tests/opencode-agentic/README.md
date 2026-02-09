# OpenCode Agentic Integration Test

This test validates the **full agentic capabilities** of the OpenCode integration with marktoflow, using the `glm-4.7-flash` model in server mode.

## What This Tests

### Agentic Capabilities

- ✅ **Multi-step Reasoning**: Agent autonomously breaks down complex tasks
- ✅ **Code Generation**: Creates syntactically correct, well-structured code
- ✅ **File Operations**: Creates and manages files on the filesystem
- ✅ **Code Execution**: Runs generated code to accomplish tasks
- ✅ **Self-Verification**: Validates that tasks were completed correctly
- ✅ **Session Management**: Maintains conversation context across calls
- ✅ **Provider Detection**: Lists available LLM providers and models
- ✅ **Agent Modes**: Accesses different agent personalities/modes

### OpenCode SDK Features

This test exercises the **OpenCode SDK v1.1.53** integration:

- `opencode.listProviders()` - Enumerate available LLM providers
- `opencode.listAgents()` - List available agent modes
- `opencode.generate()` - Autonomous code generation with full tool access
- `opencode.getSessionId()` - Session persistence for multi-turn workflows

## Prerequisites

### 1. OpenCode Installation

```bash
# Install OpenCode CLI
curl -fsSL https://opencode.ai/install.sh | bash

# Verify installation
opencode --version
```

### 2. Start OpenCode Server

The test requires OpenCode to run in **server mode** for full agentic capabilities:

```bash
# Start server on port 4096
opencode serve --port 4096 --hostname 127.0.0.1
```

The server should output:
```
opencode server listening on http://127.0.0.1:4096
```

### 3. Configure Model

This test uses `glm-4.7-flash`. You can configure OpenCode to use:

- **Local VLLM**: For local inference with glm-4.7-flash
- **OpenAI**: Any OpenAI-compatible model
- **Anthropic**: Claude models
- **Other providers**: Any provider supported by OpenCode

To set your default model:
```bash
opencode config set model glm-4.7-flash
```

## Running the Test

### Basic Test

```bash
# Run with default task (Fibonacci calculator)
./marktoflow run examples/tests/opencode-agentic/workflow.md
```

### Custom Tasks

Test different agentic tasks:

```bash
# Test with JavaScript code generation
./marktoflow run examples/tests/opencode-agentic/workflow.md \
  --input task_description="Create a JavaScript function that reverses a string and write unit tests for it using Jest"

# Test with data processing
./marktoflow run examples/tests/opencode-agentic/workflow.md \
  --input task_description="Create a Python script that reads a CSV file, calculates statistics, and generates a summary report"

# Test with multi-file project
./marktoflow run examples/tests/opencode-agentic/workflow.md \
  --input task_description="Create a simple Express.js API with three endpoints: GET /users, POST /users, DELETE /users/:id. Include proper error handling."
```

## Expected Output

The workflow will:

1. **List Providers**: Display all available LLM providers and their models
2. **Execute Task**: Agent autonomously completes the requested task
3. **Show Session**: Display the persistent session ID
4. **List Agents**: Show available agent modes (code, chat, etc.)
5. **Display Results**: Show the agent's reasoning and completion confirmation

### Example Output

```
================================================================================
OPENCODE AGENTIC TEST RESULTS
================================================================================

✅ SESSION ID: ses_3bb7278b6ffeTWodtV6nQ3ZXIy

✅ AGENT RESPONSE:
**Task Complete**

✅ Created Python script `generate_fibonacci.py`
✅ Executed script successfully - generated fibonacci.txt
✅ Verified output file contains Fibonacci numbers: [0, 1, 1, 2, 3, 5, 8]

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

## Troubleshooting

### Error: "fetch failed"

The OpenCode server isn't running. Start it:
```bash
opencode serve --port 4096 --hostname 127.0.0.1
```

### Error: "Model not found: glm-4.7-flash"

The model isn't configured. Either:
1. Change the model in `workflow.md`
2. Configure your local VLLM to serve glm-4.7-flash
3. Use a different model supported by your OpenCode setup

### Server Port Already in Use

If port 4096 is taken:
```bash
# Use a different port
opencode serve --port 5000 --hostname 127.0.0.1
```

Then update the workflow:
```yaml
tools:
  opencode:
    sdk: 'opencode'
    options:
      model: 'glm-4.7-flash'
      mode: 'server'
      serverUrl: 'http://localhost:5000'  # Changed port
```

## Integration Architecture

This test validates the integration pattern:

```
marktoflow workflow
  ↓
OpenCode SDK v1.1.53
  ↓
OpenCode Server (http://localhost:4096)
  ↓
LLM Model (glm-4.7-flash via VLLM or other provider)
  ↓
Autonomous Code Execution
```

The agent has full access to:
- File system operations
- Code execution capabilities
- Multi-turn conversation context
- Tool usage for complex tasks

## Next Steps

After running this test:

1. **Verify Agentic Behavior**: Check that the agent broke down the task autonomously
2. **Inspect Generated Code**: Review the quality of code generation
3. **Test Session Persistence**: Try multi-step workflows that reuse the session
4. **Try Complex Tasks**: Test with more sophisticated agentic tasks
5. **Integrate into Workflows**: Use OpenCode in production workflows for code generation

## Related Documentation

- [OpenCode Documentation](https://docs.opencode.ai)
- [OpenCode SDK Reference](https://github.com/opencode-ai/opencode-sdk)
- [marktoflow AI Agents Guide](../../../docs/SETUP_AI_AGENTS.md)
- [marktoflow YAML API](../../../docs/YAML-API.md)
