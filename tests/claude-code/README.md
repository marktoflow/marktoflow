# Claude Code Adapter Tests

This directory contains tests for the Claude Code adapter implementation.

## Test Files

### Basic Functionality Tests

**`test_claude_code_adapter.py`** - Core functionality tests
- Tests CLI mode execution
- Tests JSON generation with schema
- Validates capabilities reporting
- Tests initialization and cleanup

**Usage:**
```bash
# Prerequisites
export ANTHROPIC_API_KEY="your-api-key"

# Run all tests
python tests/claude-code/test_claude_code_adapter.py
```

## Prerequisites

### Required
1. **Claude Code CLI installed**
   ```bash
   # Check installation
   claude --version

   # If not installed, follow:
   # https://github.com/anthropics/claude-code
   ```

2. **Anthropic API Key**
   ```bash
   # Set API key
   export ANTHROPIC_API_KEY="your-key"

   # Or configure via Claude
   claude config set api_key YOUR_KEY
   ```

   Get your API key from: https://console.anthropic.com/

## Quick Start

```bash
# 1. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 2. Verify Claude Code works
claude -p "Say hello"

# 3. Run tests
python tests/claude-code/test_claude_code_adapter.py
```

## Test Status

| Test | Status | Notes |
|------|--------|-------|
| CLI Mode | ✅ READY | Basic execution working |
| JSON Generation | ✅ READY | Schema-based output |
| Capabilities | ✅ READY | Feature reporting |
| Streaming | 🚧 TODO | Future enhancement |
| SDK Mode | 🚧 TODO | Waiting for SDK release |

## Expected Behavior

### Test 1: CLI Mode
- Initializes adapter
- Executes simple generation
- Returns Python code
- Cleans up resources

### Test 2: JSON Generation
- Tests structured output
- Validates schema compliance
- Parses JSON from response

### Test 3: Capabilities
- Reports Claude Code features:
  - Native tool calling
  - Advanced reasoning
  - Extended thinking mode
  - 200K context window
  - MCP support

## Troubleshooting

### "Claude Code CLI not found"
```bash
# Check PATH
which claude

# If not found, install:
# https://github.com/anthropics/claude-code
```

### "API key not set"
```bash
# Set environment variable
export ANTHROPIC_API_KEY="your-key"

# Or configure globally
claude config set api_key YOUR_KEY

# Verify
claude config show
```

### "Rate limit exceeded"
- **Free tier**: Limited requests per day
- **Paid tier**: Higher limits
- **Solution**: Wait or upgrade plan

### "Timeout errors"
For slow responses, increase timeout:
```yaml
extra:
  claude_code_timeout: 900  # 15 minutes
```

## Cost Considerations

Running these tests will use Anthropic API credits:

| Model | Cost per Test | Total (3 tests) |
|-------|---------------|-----------------|
| Sonnet 3.5 | ~$0.01 | ~$0.03 |
| Opus 3 | ~$0.05 | ~$0.15 |
| Haiku 3 | ~$0.001 | ~$0.003 |

**Tip:** Use `claude_code_model: haiku` for testing to minimize costs.

## Future Tests

Planned additions:
- [ ] Extended thinking mode tests
- [ ] Streaming support tests
- [ ] File context tests
- [ ] MCP integration tests
- [ ] SDK mode tests (when available)
- [ ] Performance benchmarks
- [ ] Multi-turn conversation tests

## See Also

- [Claude Code Examples](../../examples/claude-code-config/README.md)
- [Claude API Documentation](https://docs.anthropic.com)
- [MCP Documentation](https://docs.anthropic.com/claude/docs/mcp)
- [Claude SDK (future)](https://github.com/anthropics/claude-agent-sdk-python)

---

**Status:** ✅ CLI Mode Ready | 🚧 SDK Mode Coming Soon
