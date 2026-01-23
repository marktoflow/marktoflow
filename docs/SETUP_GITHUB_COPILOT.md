# GitHub Copilot Setup Guide for OpenCode

This guide shows you how to configure marktoflow's OpenCode adapter to use GitHub Copilot as the LLM backend.

## Why GitHub Copilot?

✅ **No API keys needed** - Uses your existing GitHub Copilot subscription
✅ **Official support** - GitHub and OpenCode partnered in January 2026
✅ **No extra cost** - Included with Copilot Pro, Pro+, Business, or Enterprise
✅ **High-quality models** - Access to latest GPT-4 and Claude models
✅ **Simple setup** - One-time authentication flow

## Prerequisites

### 1. GitHub Copilot Subscription

You need one of these subscriptions:
- **GitHub Copilot Pro** ($10/month) - Personal use
- **GitHub Copilot Pro+** ($39/month) - Includes Claude Opus, o1, etc.
- **GitHub Copilot Business** - For organizations
- **GitHub Copilot Enterprise** - For large enterprises

Check your subscription at: https://github.com/settings/copilot

### 2. OpenCode CLI Installed

Install OpenCode if you haven't already:

```bash
# macOS/Linux
curl -fsSL https://opencode.ai/install.sh | sh

# Or with Homebrew (macOS)
brew install opencode

# Windows
# Download from https://github.com/opencode-ai/opencode/releases
```

Verify installation:
```bash
opencode --version
# Should show: 1.1.x or higher
```

## Setup Steps

### Step 1: Connect OpenCode to GitHub Copilot

Open your terminal and run:

```bash
opencode /connect
```

This will:
1. Show you a list of available providers
2. Select **"GitHub Copilot"**
3. Open your browser for GitHub authentication
4. Ask you to authorize OpenCode

**Follow the prompts:**
```
? Select a provider:
  OpenAI
  Anthropic
❯ GitHub Copilot
  Google AI
  ...

Opening browser for GitHub authentication...
✓ Authenticated successfully!
```

### Step 2: Verify Configuration

Check your OpenCode configuration:

```bash
cat ~/.config/opencode/opencode.json
```

You should see something like:

```json
{
  "providers": {
    "github-copilot": {
      "token": "ghu_..." // Auto-generated
    }
  },
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

### Step 3: Test OpenCode with Copilot

Test that it's working:

```bash
opencode run "Write a Python function that says hello"
```

You should see a response from the AI. If this works, you're all set!

### Step 4: Configure marktoflow

Now configure marktoflow to use OpenCode with your GitHub Copilot setup.

Create or update your workflow configuration:

**Option A: Auto Mode (Recommended)**

```yaml
# config.yaml or .marktoflow/config.yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: auto  # Tries server, falls back to CLI
```

**Option B: CLI Mode (Simple)**

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: cli
```

**Option C: Server Mode (Performance)**

First, start the OpenCode server:
```bash
opencode serve --port 4096
```

Then configure:
```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: server
    opencode_server_url: http://localhost:4096
```

### Step 5: Test with marktoflow

Create a simple test workflow:

```markdown
---
name: Test GitHub Copilot
description: Test workflow using GitHub Copilot via OpenCode
agent: opencode
version: 1.0.0
---

# Test Workflow

## Step 1: Generate Code

```yaml
id: test_generation
action: agent.generate_response
inputs:
  context: "Write a Python function that calculates fibonacci numbers"
output: code_result
```

## Step 2: Analyze Code

```yaml
id: test_analysis
action: agent.analyze
inputs:
  prompt_template: "Analyze the following code: {{ code_result }}"
  categories:
    quality: "Code quality"
    performance: "Performance considerations"
output: analysis_result
```
```

Run it:
```bash
marktoflow run test-workflow.md
```

## Model Selection

GitHub Copilot gives you access to multiple models. Configure in `~/.config/opencode/opencode.json`:

### Claude Models (Recommended for Code)

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5"
}
```

### GPT Models

```json
{
  "model": "openai/gpt-4o",
  "small_model": "openai/gpt-4o-mini"
}
```

### O1 Models (Pro+ only)

```json
{
  "model": "openai/o1",
  "small_model": "openai/o1-mini"
}
```

## Troubleshooting

### "Authentication failed" or "Unauthorized"

**Solution 1:** Re-authenticate
```bash
opencode /connect
# Select GitHub Copilot again
```

**Solution 2:** Check subscription
```bash
# Visit https://github.com/settings/copilot
# Ensure your subscription is active
```

### "Rate limit exceeded"

GitHub Copilot has usage limits. If you hit them:

1. **Wait a few minutes** - Limits reset periodically
2. **Upgrade to Pro+** - Higher limits
3. **Use a different model** - Switch between Claude/GPT

### "OpenCode not found"

Make sure OpenCode is in your PATH:
```bash
which opencode
# Should show: /path/to/opencode

# If not found, reinstall:
curl -fsSL https://opencode.ai/install.sh | sh
```

### "Connection refused" (Server Mode)

If using server mode:
```bash
# Check if server is running
curl http://localhost:4096/health

# If not, start it:
opencode serve --port 4096
```

Or use auto mode which falls back to CLI:
```yaml
extra:
  opencode_mode: auto
```

## Advanced Configuration

### Custom Port for Server Mode

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: server
    opencode_server_url: http://localhost:8080  # Custom port
```

Then start server on that port:
```bash
opencode serve --port 8080
```

### Auto-Start Server

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: server
    opencode_server_autostart: true  # Starts server automatically
    opencode_server_url: http://localhost:4096
```

### Organization SSO

If using GitHub Copilot Business/Enterprise with SSO:

1. Complete SSO authorization when prompted during `/connect`
2. OpenCode will handle token refresh automatically
3. If issues, contact your GitHub org admin

## Cost Optimization

GitHub Copilot pricing is **flat-rate**, not per-token, so you can:

✅ Use it as much as you want (within rate limits)
✅ Use the best models (Claude Opus, GPT-4) freely
✅ Run long workflows without worrying about cost

**Pro Tips:**
- Pro ($10/mo): Great for personal projects, basic models
- Pro+ ($39/mo): Best value, includes all premium models
- Business/Enterprise: Best for teams, higher rate limits

## Security & Privacy

### What GitHub Sees

According to GitHub's privacy policy:
- Prompts and code sent to models for processing
- May be used to improve Copilot (can opt out)
- Not used to train public models

### Opting Out of Data Collection

1. Go to https://github.com/settings/copilot
2. Under "Suggestions matching public code"
3. Disable "Allow GitHub to use my data for product improvements"

### Alternative: Use Local Models

If privacy is a concern, consider using [Ollama instead](./SETUP_OLLAMA.md) for fully local processing.

## Next Steps

- ✅ [OpenCode Configuration Examples](../examples/opencode-config/README.md)
- ✅ [Ollama Setup (Local Models)](./SETUP_OLLAMA.md)
- ✅ [Performance Benchmarking](../benchmark_opencode.py)
- ✅ [Integration Tests](../test_opencode_integration.py)

## Support

- **OpenCode Issues**: https://github.com/opencode-ai/opencode/issues
- **GitHub Copilot Support**: https://support.github.com/
- **marktoflow Issues**: https://github.com/yourusername/marktoflow/issues

---

**Last Updated:** January 2026
**OpenCode Version:** 1.1.32+
**GitHub Copilot:** Official support since January 16, 2026
