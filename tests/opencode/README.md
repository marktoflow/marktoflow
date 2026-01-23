# OpenCode Adapter Tests

This directory contains tests for the OpenCode adapter implementation.

## Test Files

### Basic Functionality Tests

**`test_opencode_adapter.py`** - Core functionality tests
- Tests CLI mode execution
- Tests server mode execution
- Tests auto mode with fallback
- Validates initialization and cleanup

**Usage:**
```bash
# Test all modes
python tests/opencode/test_opencode_adapter.py all

# Test specific mode
python tests/opencode/test_opencode_adapter.py cli
python tests/opencode/test_opencode_adapter.py server
python tests/opencode/test_opencode_adapter.py auto
```

### Integration Tests

**`test_opencode_integration.py`** - Advanced feature tests
- Streaming support
- Tool calling integration
- MCP bridge integration
- Workflow execution

**Usage:**
```bash
# Test all features
python tests/opencode/test_opencode_integration.py all

# Test specific feature
python tests/opencode/test_opencode_integration.py streaming
python tests/opencode/test_opencode_integration.py tool_calling
python tests/opencode/test_opencode_integration.py mcp_bridge
python tests/opencode/test_opencode_integration.py workflow
```

### Performance Benchmarks

**`benchmark_opencode.py`** - Performance testing
- Initialization benchmarks
- Simple generation benchmarks
- JSON generation benchmarks
- Multiple requests benchmarks
- CLI vs Server comparison

**Usage:**
```bash
# Benchmark both modes (5 iterations)
python tests/opencode/benchmark_opencode.py

# Custom iterations and warmup
python tests/opencode/benchmark_opencode.py --iterations 10 --warmup 2

# Test specific mode
python tests/opencode/benchmark_opencode.py --mode cli
python tests/opencode/benchmark_opencode.py --mode server
```

### Streaming Tests

**`test_streaming.py`** - Comprehensive streaming tests
- Simple streaming
- Streaming vs regular generation
- CLI fallback behavior

**`test_streaming_simple.py`** - Quick streaming test
- Minimal test for debugging streaming issues

**Note:** Streaming is experimental and requires OpenCode server running.

**Usage:**
```bash
# Start OpenCode server first
opencode serve --port 4096

# Run streaming tests
python tests/opencode/test_streaming.py
python tests/opencode/test_streaming_simple.py
```

## Prerequisites

### Required
- OpenCode CLI installed (`opencode --version`)
- OpenCode configured with a provider:
  - GitHub Copilot: `opencode /connect`
  - Or Ollama: See `docs/SETUP_OLLAMA.md`

### For Server Mode Tests
- OpenCode server running: `opencode serve --port 4096`
- Or enable auto-start in config: `opencode_server_autostart: true`

## Quick Start

```bash
# 1. Install OpenCode (if not already)
curl -fsSL https://opencode.ai/install.sh | sh

# 2. Configure with GitHub Copilot
opencode /connect  # Select: GitHub Copilot

# 3. Run basic tests
python tests/opencode/test_opencode_adapter.py all

# 4. Run integration tests
python tests/opencode/test_opencode_integration.py all

# 5. Run benchmarks
python tests/opencode/benchmark_opencode.py
```

## Test Status

| Test Suite | Status | Notes |
|------------|--------|-------|
| test_opencode_adapter.py | ✅ PASSING | All modes working |
| test_opencode_integration.py | ✅ READY | Tool calling, MCP bridge ready |
| benchmark_opencode.py | ✅ WORKING | Performance metrics complete |
| test_streaming.py | 🚧 EXPERIMENTAL | Needs server API investigation |
| test_streaming_simple.py | 🚧 EXPERIMENTAL | Debugging tool |

## Troubleshooting

### "OpenCode CLI not found"
```bash
# Install OpenCode
curl -fsSL https://opencode.ai/install.sh | sh

# Verify
which opencode
```

### "Server not running" (Server mode tests)
```bash
# Start server
opencode serve --port 4096

# Or use CLI/auto mode instead
python tests/opencode/test_opencode_adapter.py cli
```

### "Authentication failed"
```bash
# Re-authenticate
opencode /connect
```

## See Also

- [OpenCode Documentation](../../docs/OPENCODE.md)
- [GitHub Copilot Setup](../../docs/SETUP_GITHUB_COPILOT.md)
- [Ollama Setup](../../docs/SETUP_OLLAMA.md)
- [Test Results](../../TEST_RESULTS.md)
