# Web Automation Examples

This directory contains example workflows demonstrating marktoflow's browser automation capabilities using Playwright.

## Prerequisites

```bash
# Install playwright browsers
npx playwright install

# Or install specific browser
npx playwright install chromium
```

## Examples

### 1. Basic Web Automation (`workflow.md`)

Demonstrates fundamental browser automation:
- Page navigation
- Data extraction
- Screenshots
- Page information

```bash
marktoflow run examples/web-automation/workflow.md
```

### 2. Web Scraper (`web-scraper.md`)

Advanced scraping with pagination:
- Multi-page scraping
- Data extraction from multiple elements
- Pagination handling
- JavaScript evaluation

```bash
marktoflow run examples/web-automation/web-scraper.md -i max_pages=5
```

### 3. Form Automation (`form-automation.md`)

Automated form filling and submission:
- Form field filling
- Checkbox/dropdown handling
- Form submission
- Result validation

```bash
marktoflow run examples/web-automation/form-automation.md
```

## Browser Options

All examples support these browser configuration options:

| Option | Description | Default |
|--------|-------------|---------|
| `browser_type` | chromium, firefox, webkit | chromium |
| `headless` | Run without visible window | true |
| `viewport` | Window size | 1280x720 |
| `slow_mo` | Slow down operations (ms) | 0 |
| `timeout` | Default timeout (ms) | 30000 |
| `user_agent` | Custom user agent | Browser default |
| `locale` | Browser locale | System default |
| `timezone_id` | Timezone | System default |
| `device_name` | Device emulation | None |
| `proxy` | Proxy server settings | None |
| `ws_endpoint` | Remote browser connection | None |

## Cloud Browser Services

For production workloads, connect to cloud browser services:

### Browserless

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      ws_endpoint: 'wss://chrome.browserless.io?token=YOUR_TOKEN'
```

### Browserbase

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      ws_endpoint: 'wss://connect.browserbase.com?apiKey=YOUR_KEY'
```

## Tips

1. **Use networkidle** - Wait for all network activity to settle
2. **Handle errors** - Wrap actions in try/catch blocks
3. **Add delays** - Use `slow_mo` for debugging
4. **Take screenshots** - Capture state for debugging
5. **Close browser** - Always clean up resources

## Documentation

- [Playwright Integration Guide](../../docs/PLAYWRIGHT-GUIDE.md)
- [Control Flow Guide](../../docs/CONTROL-FLOW-GUIDE.md)
