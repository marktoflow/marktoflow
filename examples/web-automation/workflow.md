---
workflow:
  id: web-automation-demo
  name: 'Web Automation Demo'
  version: '1.0.0'
  description: 'Demonstrates browser automation with Playwright for web scraping and testing'

tools:
  browser:
    sdk: 'playwright'
    options:
      headless: true
      browser_type: 'chromium'
      viewport:
        width: 1280
        height: 720
      timeout: 30000

inputs:
  target_url:
    type: string
    required: false
    default: 'https://news.ycombinator.com'
  screenshot_path:
    type: string
    required: false
    default: '/tmp/screenshot.png'
---

# Web Automation Demo

This workflow demonstrates marktoflow's browser automation capabilities using Playwright.

## Step 1: Navigate to Target Page

```yaml
action: browser.navigate
inputs:
  url: '{{ inputs.target_url }}'
  waitUntil: 'networkidle'
output_variable: page_info
```

Navigate to the target URL and wait for the page to fully load.

## Step 2: Extract Page Title

```yaml
action: browser.pageInfo
inputs: {}
output_variable: page_details
```

Get basic page information including URL and title.

## Step 3: Extract Headlines

```yaml
action: browser.extract
inputs:
  selector: '.titleline > a'
  text: true
  attributes:
    - 'href'
  all: true
output_variable: headlines
```

Extract all headline links from Hacker News front page.

## Step 4: Take Screenshot

```yaml
action: browser.screenshot
inputs:
  path: '{{ inputs.screenshot_path }}'
  fullPage: true
  type: 'png'
output_variable: screenshot
```

Capture a full-page screenshot of the current state.

## Step 5: Display Results

```yaml
action: console.log
inputs:
  message: |
    ===== Web Automation Results =====

    Page URL: {{ page_details.url }}
    Page Title: {{ page_details.title }}

    Headlines Found: {{ headlines.count }}

    Top 5 Headlines:
    {% for item in headlines.data | slice(0, 5) %}
    - {{ item.text }} ({{ item.href }})
    {% endfor %}

    Screenshot saved to: {{ screenshot.path }}
    ===================================
```

## Step 6: Close Browser

```yaml
action: browser.close
inputs: {}
output_variable: close_result
```

Clean up by closing the browser instance.

---

## Features Demonstrated

1. **Page Navigation** - Navigate to URLs with different wait strategies
2. **Data Extraction** - Extract text and attributes from multiple elements
3. **Screenshots** - Capture full-page or element screenshots
4. **Page Information** - Get page URL, title, and content

## Running the Workflow

```bash
# Basic usage
marktoflow run examples/web-automation/workflow.md

# Custom URL
marktoflow run examples/web-automation/workflow.md -i target_url=https://example.com

# Custom screenshot path
marktoflow run examples/web-automation/workflow.md -i screenshot_path=/tmp/my-screenshot.png

# Debug mode
marktoflow run examples/web-automation/workflow.md --debug
```

## Browser Configuration Options

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      # Browser type: chromium, firefox, or webkit
      browser_type: 'chromium'

      # Run in headless mode (no visible window)
      headless: true

      # Viewport size
      viewport:
        width: 1920
        height: 1080

      # Slow down operations for debugging
      slow_mo: 100

      # Custom user agent
      user_agent: 'Custom User Agent String'

      # Locale and timezone
      locale: 'en-US'
      timezone_id: 'America/New_York'

      # Ignore HTTPS errors
      ignore_https_errors: true

      # Device emulation (e.g., 'iPhone 13', 'Pixel 5')
      device_name: 'iPhone 13'

      # Proxy settings
      proxy:
        server: 'http://proxy.example.com:8080'
        username: 'user'
        password: 'pass'

      # Connect to remote browser (Browserless, etc.)
      ws_endpoint: 'ws://browserless:3000'
```

## Available Actions

| Action | Description |
|--------|-------------|
| `browser.navigate` | Navigate to a URL |
| `browser.click` | Click an element |
| `browser.type` | Type text into an element |
| `browser.fill` | Fill an input field |
| `browser.select` | Select dropdown options |
| `browser.check` | Check a checkbox |
| `browser.uncheck` | Uncheck a checkbox |
| `browser.hover` | Hover over an element |
| `browser.screenshot` | Take a screenshot |
| `browser.pdf` | Generate PDF (Chromium only) |
| `browser.extract` | Extract data from elements |
| `browser.evaluate` | Run JavaScript in page |
| `browser.wait` | Wait for conditions |
| `browser.fillForm` | Fill multiple form fields |
| `browser.cookies` | Manage cookies |
| `browser.storage` | Manage local/session storage |
| `browser.close` | Close the browser |

See [Playwright Integration Guide](../../docs/PLAYWRIGHT-GUIDE.md) for complete documentation.
