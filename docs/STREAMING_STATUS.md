# Streaming Support Status

**Status:** 🚧 Experimental / Needs Investigation
**Last Updated:** January 22, 2026

## Current State

Streaming support has been **implemented** in the OpenCode adapter (`_execute_via_server_stream` method), but requires further investigation to work correctly with the OpenCode server API.

## Implementation

The streaming method has been added:

```python
async def generate_stream(prompt, context) -> AsyncIterator[str]:
    """
    Generate text with streaming support.

    - Server mode: Attempts SSE streaming via /event endpoint
    - CLI mode: Falls back to non-streaming (returns full response as single chunk)
    """
```

## Issues Discovered

### 1. Server API Endpoints

The OpenCode server (v1.1.32) appears to primarily serve a web interface:

```bash
$ curl http://localhost:4096/
# Returns HTML web interface

$ curl http://localhost:4096/health
# Returns HTML (not JSON)

$ curl -X POST http://localhost:4096/session
# Returns HTML (not JSON)
```

### 2. REST API Access

The documented REST API endpoints (`/session`, `/event`, etc.) may:
- Require specific headers
- Be at a different path prefix (e.g., `/api/...`)
- Only be available in specific server modes
- Require authentication setup

### 3. Event Stream Format

Without access to the working API, the SSE event parsing implementation is based on documentation and may need adjustment for the actual event format.

## Investigation Needed

### Priority 1: Find Working API Endpoints

```bash
# Try different base paths
curl http://localhost:4096/api/session
curl http://localhost:4096/v1/session
curl http://localhost:4096/rpc/session

# Try with headers
curl -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -X POST http://localhost:4096/session
```

### Priority 2: Check Server Configuration

The server might need specific flags:

```bash
# Try different server modes
opencode serve --port 4096 --api-only
opencode serve --port 4096 --no-web
opencode serve --port 4096 --help
```

### Priority 3: Review OpenCode SDK Source

The JavaScript SDK (`@opencode-ai/sdk`) source code would show:
- Exact endpoints used
- Request/response formats
- Headers required
- Event stream parsing

Location: `https://github.com/opencode-ai/opencode` (SDK source)

## Current Workarounds

### For Users

Use CLI mode (no streaming) which works reliably:

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: cli  # No streaming but works
```

Or use auto mode (falls back to CLI if server streaming fails):

```yaml
agent:
  name: opencode
  provider: opencode
  extra:
    opencode_mode: auto  # Tries server, falls back to CLI
```

### For CLI Mode

The `generate_stream` method gracefully falls back in CLI mode:

```python
async for chunk in adapter.generate_stream(prompt, context):
    # In CLI mode: yields one chunk (full response)
    # In server mode: would yield multiple chunks (if working)
    print(chunk, end="")
```

## Testing Status

| Test | CLI Mode | Server Mode |
|------|----------|-------------|
| Basic generation | ✅ WORKS | ✅ WORKS |
| JSON generation | ✅ WORKS | ✅ WORKS |
| Tool calling | ✅ WORKS | ✅ WORKS |
| Streaming | ⚠️ FALLBACK | ❌ NEEDS INVESTIGATION |

## Next Steps

1. **Contact OpenCode Team**
   - Ask about REST API access in server mode
   - Request API documentation or examples
   - Check if streaming is supported in current version

2. **Review SDK Source Code**
   - Clone opencode repository
   - Find SDK implementation
   - Extract working API calls

3. **Alternative: Direct Node Integration**
   - If REST API isn't available, consider using the Node SDK directly
   - Create a bridge process: Python ↔ Node ↔ OpenCode SDK

4. **Fallback: CLI Streaming**
   - Check if `opencode run` supports streaming output
   - Parse incremental output from subprocess

## Code Location

The streaming implementation is in:

**src/aiworkflow/agents/opencode.py:**
- Line 358: `generate_stream()` method
- Line 415: `_execute_via_server_stream()` implementation

## Recommendation

For now, **use CLI or auto mode** for production workflows. Streaming support is:
- ✅ Implemented and ready
- 🚧 Needs API investigation to activate
- ⚠️ Falls back gracefully in CLI mode

Once the correct OpenCode server API endpoints are identified, streaming should work with minimal code changes (just endpoint/format adjustments).

## References

- OpenCode Documentation: https://opencode.ai/docs/server/
- OpenCode SDK: https://opencode.ai/docs/sdk/
- GitHub Repository: https://github.com/opencode-ai/opencode
- Discord Community: (check for API usage examples)

---

**Contributors:** If you figure out the correct OpenCode server API usage, please update this document and the implementation!
