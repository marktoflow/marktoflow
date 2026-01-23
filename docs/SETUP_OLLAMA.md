# Ollama Local Model Setup Guide for OpenCode

This guide shows you how to configure marktoflow's OpenCode adapter to use Ollama for completely local, private LLM execution.

## Why Ollama?

✅ **100% Free** - No API costs, no subscriptions
✅ **Fully Private** - All processing happens on your machine
✅ **No Internet Required** - Works offline once models are downloaded
✅ **Fast** - No network latency, direct hardware access
✅ **Open Source** - Full control over your AI stack

## Prerequisites

### System Requirements

**Minimum:**
- 8GB RAM (for 7B models)
- 10GB disk space
- macOS, Linux, or Windows

**Recommended:**
- 16GB+ RAM (for 13B+ models)
- NVIDIA GPU with 8GB+ VRAM (optional, for acceleration)
- 50GB+ disk space (for multiple models)

### Supported Hardware

- **CPU-only:** Works but slower (2-10 tokens/sec)
- **Apple Silicon (M1/M2/M3):** Excellent performance (15-30 tokens/sec)
- **NVIDIA GPU:** Best performance (30-100+ tokens/sec)
- **AMD GPU:** Experimental ROCm support

## Installation

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
# Or download from https://ollama.ai
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
```bash
# Download installer from https://ollama.ai/download/windows
# Run the .exe installer
```

**Verify installation:**
```bash
ollama --version
# Should show: ollama version 0.1.x or higher
```

### Step 2: Start Ollama Service

**macOS/Linux:**
```bash
# Ollama runs as a background service automatically after install
# If not running:
ollama serve
```

**Windows:**
```bash
# Ollama runs as a Windows service automatically
# Check status in Services app
```

**Verify it's running:**
```bash
curl http://localhost:11434/api/tags
# Should return JSON with model list
```

### Step 3: Download Models

Choose models based on your hardware:

**For 8GB RAM (Small Models - Fast but less capable):**
```bash
ollama pull llama3.2:1b      # 1B params - Very fast, basic tasks
ollama pull phi3:mini         # 3.8B params - Good balance
ollama pull qwen2.5:3b        # 3B params - Code-focused
```

**For 16GB RAM (Medium Models - Good balance):**
```bash
ollama pull llama3.2:3b       # 3B params - Fast and capable
ollama pull qwen2.5:7b        # 7B params - Excellent for code
ollama pull deepseek-coder:6.7b  # 6.7B params - Best for coding
ollama pull mistral:7b        # 7B params - Great general model
```

**For 32GB+ RAM or GPU (Large Models - Best quality):**
```bash
ollama pull llama3.1:13b      # 13B params - High quality
ollama pull qwen2.5:14b       # 14B params - Excellent reasoning
ollama pull codellama:13b     # 13B params - Code specialist
ollama pull mixtral:8x7b      # 47B params - Very powerful
```

**Verify download:**
```bash
ollama list
# Shows all downloaded models
```

### Step 4: Test Ollama

Quick test:
```bash
ollama run qwen2.5:7b "Write a Python hello world function"
```

You should see a response. Press `Ctrl+D` to exit the interactive mode.

### Step 5: Install OpenCode

```bash
# macOS/Linux
curl -fsSL https://opencode.ai/install.sh | sh

# Or with Homebrew
brew install opencode

# Verify
opencode --version
```

### Step 6: Configure OpenCode for Ollama

Edit OpenCode's configuration file:

```bash
# Create/edit config
nano ~/.config/opencode/opencode.json
```

Add this configuration:

```json
{
  "providers": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "baseURL": "http://localhost:11434/v1"
    }
  },
  "model": "ollama/qwen2.5:7b",
  "small_model": "ollama/llama3.2:1b"
}
```

**Model Recommendations:**

For **coding workflows:**
```json
{
  "model": "ollama/deepseek-coder:6.7b",
  "small_model": "ollama/qwen2.5:3b"
}
```

For **general tasks:**
```json
{
  "model": "ollama/llama3.2:3b",
  "small_model": "ollama/llama3.2:1b"
}
```

For **best quality** (needs 32GB+ RAM):
```json
{
  "model": "ollama/qwen2.5:14b",
  "small_model": "ollama/qwen2.5:7b"
}
```

### Step 7: Test OpenCode with Ollama

```bash
opencode run "Write a function to calculate factorial"
```

You should see a code response. If this works, you're ready!

### Step 8: Configure marktoflow

Create or update your workflow configuration:

**Auto Mode (Recommended):**

```yaml
# config.yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: auto
```

**CLI Mode:**

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: cli
```

**Server Mode (Better Performance):**

Start OpenCode server:
```bash
opencode serve --port 4096
```

Configure marktoflow:
```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: server
    opencode_server_url: http://localhost:4096
```

### Step 9: Test with marktoflow

Create a test workflow:

```markdown
---
name: Ollama Test
description: Test local AI with Ollama
agent: opencode
version: 1.0.0
---

# Ollama Test Workflow

## Generate Code

```yaml
id: generate_code
action: agent.generate_response
inputs:
  context: "Write a Python function to reverse a string"
output: code
```

## Analyze Code

```yaml
id: analyze_code
action: agent.analyze
inputs:
  prompt_template: "Review this code: {{ code }}"
  categories:
    quality: "Code quality issues"
    improvements: "Suggested improvements"
output: analysis
```
```

Run it:
```bash
marktoflow run test-ollama.md
```

## Model Selection Guide

### Best for Coding

| Model | Size | RAM Needed | Speed | Quality |
|-------|------|------------|-------|---------|
| `qwen2.5:3b` | 1.9GB | 8GB | ⚡⚡⚡ | ⭐⭐⭐ |
| `deepseek-coder:6.7b` | 3.8GB | 16GB | ⚡⚡ | ⭐⭐⭐⭐ |
| `qwen2.5:7b` | 4.7GB | 16GB | ⚡⚡ | ⭐⭐⭐⭐ |
| `qwen2.5:14b` | 8.9GB | 32GB | ⚡ | ⭐⭐⭐⭐⭐ |
| `codellama:13b` | 7.4GB | 32GB | ⚡ | ⭐⭐⭐⭐ |

### Best for General Tasks

| Model | Size | RAM Needed | Speed | Quality |
|-------|------|------------|-------|---------|
| `llama3.2:1b` | 1.3GB | 8GB | ⚡⚡⚡ | ⭐⭐ |
| `llama3.2:3b` | 2.0GB | 8GB | ⚡⚡⚡ | ⭐⭐⭐ |
| `mistral:7b` | 4.1GB | 16GB | ⚡⚡ | ⭐⭐⭐⭐ |
| `llama3.1:13b` | 7.4GB | 32GB | ⚡ | ⭐⭐⭐⭐⭐ |

### Performance Tuning

**Enable GPU Acceleration (NVIDIA):**

Ollama automatically detects and uses GPU if available. Verify:
```bash
ollama run qwen2.5:7b
# Should show: using GPU
```

**Adjust Context Window:**

Edit `~/.config/opencode/opencode.json`:
```json
{
  "model": "ollama/qwen2.5:7b",
  "small_model": "ollama/llama3.2:1b",
  "modelOptions": {
    "num_ctx": 8192  // Larger context (uses more RAM)
  }
}
```

**Control CPU/GPU Usage:**

```bash
# Limit CPU threads
export OLLAMA_NUM_THREADS=4

# Use specific GPU
export CUDA_VISIBLE_DEVICES=0

# Restart ollama
ollama serve
```

## Advanced Configuration

### Multiple Ollama Instances

Run Ollama on different ports for parallel processing:

```bash
# Terminal 1
OLLAMA_HOST=127.0.0.1:11434 ollama serve

# Terminal 2
OLLAMA_HOST=127.0.0.1:11435 ollama serve
```

Configure OpenCode:
```json
{
  "providers": {
    "ollama-primary": {
      "npm": "@ai-sdk/openai-compatible",
      "baseURL": "http://localhost:11434/v1"
    },
    "ollama-secondary": {
      "npm": "@ai-sdk/openai-compatible",
      "baseURL": "http://localhost:11435/v1"
    }
  }
}
```

### Remote Ollama Server

Run Ollama on a powerful server, access from laptop:

**On server:**
```bash
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**On client (OpenCode config):**
```json
{
  "providers": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "baseURL": "http://your-server-ip:11434/v1"
    }
  }
}
```

### Docker Deployment

```bash
docker run -d \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --gpus all \
  --name ollama \
  ollama/ollama

# Pull models
docker exec ollama ollama pull qwen2.5:7b
```

## Troubleshooting

### "Connection refused" or "Ollama not running"

**Check if Ollama is running:**
```bash
ps aux | grep ollama
# Should show ollama process

# If not running:
ollama serve
```

**Check port:**
```bash
curl http://localhost:11434/api/tags
# Should return JSON

# If connection refused:
lsof -i :11434  # Check if port is in use
```

### "Model not found"

**List installed models:**
```bash
ollama list
```

**Pull missing model:**
```bash
ollama pull qwen2.5:7b
```

### "Out of memory" errors

**Use smaller model:**
```bash
ollama pull llama3.2:1b  # Only 1.3GB
```

**Or reduce context:**
```json
{
  "modelOptions": {
    "num_ctx": 2048  // Smaller context window
  }
}
```

### Slow performance

**1. Check if GPU is being used:**
```bash
nvidia-smi  # Should show ollama process if using GPU
```

**2. Use smaller model:**
```bash
ollama pull qwen2.5:3b  # Faster than 7b
```

**3. Reduce parallel requests:**
```yaml
extra:
  opencode_mode: cli  # One request at a time
```

### "Model download failed"

**Retry download:**
```bash
ollama pull qwen2.5:7b
# Press Ctrl+C if stuck, then retry
```

**Check disk space:**
```bash
df -h
# Need 5-10GB free per model
```

## Cost Comparison

| Solution | Setup Cost | Monthly Cost | Privacy | Speed |
|----------|------------|--------------|---------|-------|
| **Ollama** | $0 | $0 | ⭐⭐⭐⭐⭐ | ⚡⚡⚡ (with GPU) |
| GitHub Copilot | $0 | $10-39 | ⭐⭐ | ⚡⚡⚡⚡ |
| OpenAI API | $0 | ~$20-100 | ⭐ | ⚡⚡⚡⭐ |
| Anthropic API | $0 | ~$30-150 | ⭐ | ⚡⚡⚡⭐ |

**Ollama is best for:**
- Privacy-sensitive work
- Offline development
- High-volume usage
- Learning and experimentation

**GitHub Copilot is best for:**
- Premium model access
- Minimal setup
- Enterprise support

## Model Updates

**Check for updates:**
```bash
ollama list
# Compare with latest versions at https://ollama.ai/library
```

**Update a model:**
```bash
ollama pull qwen2.5:7b  # Re-download latest version
```

**Remove old models:**
```bash
ollama rm llama2:7b  # Free up disk space
```

## Next Steps

- ✅ [GitHub Copilot Setup](./SETUP_GITHUB_COPILOT.md)
- ✅ [OpenCode Configuration Examples](../examples/opencode-config/README.md)
- ✅ [Performance Benchmarking](../benchmark_opencode.py)
- ✅ [Integration Tests](../test_opencode_integration.py)

## Resources

- **Ollama Documentation**: https://github.com/ollama/ollama
- **Model Library**: https://ollama.ai/library
- **OpenCode Documentation**: https://opencode.ai/docs
- **marktoflow Issues**: https://github.com/yourusername/marktoflow/issues

---

**Last Updated:** January 2026
**Ollama Version:** 0.1.x+
**Recommended Models:** Qwen2.5, DeepSeek Coder, Llama 3.x
