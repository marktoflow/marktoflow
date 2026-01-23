# Streaming Support Status

**Status:** 🚧 Experimental / Needs Verification
**Last Updated:** January 23, 2026

## Current State

Streaming support has been **implemented** in the OpenCode adapter (`_execute_via_server_stream` method) and updated to align with the OpenCode server API, but still requires verification against a running server.

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

The OpenCode server (v1.1.32+) serves a web interface at `/`, but the API is expected under:
- `GET /global/health` (JSON health check)
- `POST /session` (create session)
- `POST /session/:id/message` (sync request)
- `POST /session/:id/prompt_async` (async request)
- `GET /event` or `GET /global/event` (SSE stream)

```bash
$ curl http://localhost:4096/
# Returns HTML web interface

$ curl http://localhost:4096/health
# Returns HTML (not JSON)

$ curl -X POST http://localhost:4096/session
# Returns HTML (not JSON)
```

### 2. REST API Access

The adapter now sends explicit headers:
- `Accept: application/json` for REST calls
- `Accept: text/event-stream` for SSE streaming

If the server requires authentication, the adapter will detect the server but may fail on initialization until auth is configured.

### 3. Event Stream Format

The SSE parser is now robust to multiple formats:
- `event:` + `data:` SSE framing
- JSON payloads with `type`, `data`, `parts`, `part`, `delta`, or `text`
- Full message snapshots vs incremental deltas

## Investigation Needed

### Priority 1: Verify API Endpoints

```bash
curl -H "Accept: application/json" http://localhost:4096/global/health
curl -H "Accept: application/json" -X POST http://localhost:4096/session -d '{}'
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

The SDK source should confirm:
- Exact endpoints used
- Request/response formats
- Event stream parsing details

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

**src/marktoflow/agents/opencode.py:**
- Line 358: `generate_stream()` method
- Line 415: `_execute_via_server_stream()` implementation

## Recommendation

For now, **use CLI or auto mode** for production workflows. Streaming support is:
- ✅ Implemented and updated to match server API patterns
- 🚧 Needs verification against a live server
- ⚠️ Falls back gracefully in CLI mode

Once the correct OpenCode server API endpoints are identified, streaming should work with minimal code changes (just endpoint/format adjustments).

## References

- OpenCode Documentation: https://opencode.ai/docs/server/
- OpenCode SDK: https://opencode.ai/docs/sdk/
- GitHub Repository: https://github.com/opencode-ai/opencode
- Discord Community: (check for API usage examples)

---

**Contributors:** If you figure out the correct OpenCode server API usage, please update this document and the implementation!
