# Playwright Integration Guide

marktoflow integrates with [Playwright](https://playwright.dev/) to provide powerful browser automation capabilities for web scraping, testing, and automation tasks.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Actions Reference](#actions-reference)
- [Examples](#examples)
- [Cloud Browser Services](#cloud-browser-services)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Installation

Playwright is included with `@marktoflow/integrations`. Install the browsers:

```bash
# Install all browsers
npx playwright install

# Install specific browser
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

## Quick Start

### Basic Workflow

```yaml
---
workflow:
  id: my-automation
  name: 'My Web Automation'

tools:
  browser:
    sdk: 'playwright'
    options:
      headless: true
      browser_type: 'chromium'
---

# My Automation

## Navigate to Page

```yaml
action: browser.navigate
inputs:
  url: 'https://example.com'
output_variable: page
```

## Extract Data

```yaml
action: browser.extract
inputs:
  selector: 'h1'
  text: true
output_variable: title
```

## Close Browser

```yaml
action: browser.close
inputs: {}
```
```

## Configuration

### Tool Configuration

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      # Browser type
      browser_type: 'chromium'  # chromium | firefox | webkit

      # Headless mode
      headless: true

      # Viewport size
      viewport:
        width: 1280
        height: 720

      # Slow down operations (ms)
      slow_mo: 0

      # Default timeout (ms)
      timeout: 30000

      # Custom user agent
      user_agent: 'My Custom UA'

      # Locale
      locale: 'en-US'

      # Timezone
      timezone_id: 'America/New_York'

      # Geolocation
      geolocation:
        latitude: 40.7128
        longitude: -74.0060

      # Permissions
      permissions:
        - 'geolocation'
        - 'notifications'

      # Ignore HTTPS errors
      ignore_https_errors: false

      # Device emulation
      device_name: 'iPhone 13'

      # Proxy settings
      proxy:
        server: 'http://proxy.example.com:8080'
        username: 'user'
        password: 'pass'

      # Extra HTTP headers
      extra_http_headers:
        X-Custom-Header: 'value'

      # Record video
      record_video:
        dir: '/tmp/videos'
        size:
          width: 1280
          height: 720

      # Connect to remote browser
      ws_endpoint: 'ws://browserless:3000'
```

### Device Emulation

Playwright supports device emulation for mobile testing:

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      device_name: 'iPhone 13'
```

Available devices include:
- `iPhone 13`, `iPhone 13 Pro`, `iPhone 13 Pro Max`
- `iPhone 12`, `iPhone 11`, `iPhone SE`
- `iPad`, `iPad Pro`, `iPad Mini`
- `Pixel 5`, `Pixel 4`, `Galaxy S9+`
- `Desktop Chrome`, `Desktop Firefox`, `Desktop Safari`

## Actions Reference

### Navigation

#### `browser.navigate`

Navigate to a URL.

```yaml
action: browser.navigate
inputs:
  url: 'https://example.com'
  waitUntil: 'networkidle'  # load | domcontentloaded | networkidle | commit
  timeout: 30000
  referer: 'https://google.com'
output_variable: result
```

**Output:**
```json
{
  "url": "https://example.com",
  "title": "Example Domain"
}
```

#### `browser.goBack` / `browser.goForward`

Navigate browser history.

```yaml
action: browser.goBack
inputs:
  waitUntil: 'networkidle'
```

#### `browser.reload`

Reload the current page.

```yaml
action: browser.reload
inputs:
  waitUntil: 'networkidle'
```

### Interactions

#### `browser.click`

Click an element.

```yaml
action: browser.click
inputs:
  selector: '#button'
  button: 'left'        # left | right | middle
  clickCount: 1
  delay: 0              # ms between mousedown/mouseup
  force: false          # click even if not visible
  position:             # click position relative to element
    x: 10
    y: 10
  modifiers:            # modifier keys
    - 'Control'
    - 'Shift'
  timeout: 30000
```

#### `browser.dblclick`

Double-click an element.

```yaml
action: browser.dblclick
inputs:
  selector: '#item'
```

#### `browser.type`

Type text with keyboard simulation.

```yaml
action: browser.type
inputs:
  selector: '#input'
  text: 'Hello World'
  delay: 50             # ms between keystrokes
  clear: true           # clear field first
  timeout: 30000
```

#### `browser.fill`

Fill an input field instantly.

```yaml
action: browser.fill
inputs:
  selector: '#input'
  value: 'Hello World'
  force: false
  timeout: 30000
```

#### `browser.select`

Select dropdown options.

```yaml
# Single select
action: browser.select
inputs:
  selector: '#dropdown'
  values: 'option1'

# Multi-select
action: browser.select
inputs:
  selector: '#multi-select'
  values:
    - 'option1'
    - 'option2'
```

#### `browser.check` / `browser.uncheck`

Toggle checkboxes.

```yaml
action: browser.check
inputs:
  selector: '#checkbox'
  force: false
  timeout: 30000
```

#### `browser.hover`

Hover over an element.

```yaml
action: browser.hover
inputs:
  selector: '#menu'
  position:
    x: 10
    y: 10
```

#### `browser.focus`

Focus an element.

```yaml
action: browser.focus
inputs:
  selector: '#input'
```

#### `browser.press`

Press a keyboard key on a focused element.

```yaml
action: browser.press
inputs:
  selector: '#input'
  key: 'Enter'          # Enter | Tab | Escape | ArrowDown | etc.
  delay: 0
```

#### `browser.keyboard`

Press keys without focusing an element.

```yaml
action: browser.keyboard
inputs:
  key: 'Control+A'
```

### Forms

#### `browser.fillForm`

Fill multiple form fields at once.

```yaml
action: browser.fillForm
inputs:
  fields:
    username: 'john'
    password: 'secret'
    remember: true      # checkbox
    country: 'US'       # select
    interests:          # multi-select
      - 'tech'
      - 'science'
  submit: true          # click submit button
  formSelector: 'form'  # form selector
```

#### `browser.uploadFile`

Upload files to an input.

```yaml
action: browser.uploadFile
inputs:
  selector: '#file-input'
  files: '/path/to/file.pdf'

# Multiple files
action: browser.uploadFile
inputs:
  selector: '#file-input'
  files:
    - '/path/to/file1.pdf'
    - '/path/to/file2.jpg'
```

### Data Extraction

#### `browser.extract`

Extract data from elements.

```yaml
action: browser.extract
inputs:
  selector: '.item'
  text: true            # extract text content
  html: true            # extract inner HTML
  attributes:           # extract attributes
    - 'href'
    - 'data-id'
  properties:           # extract JS properties
    - 'offsetWidth'
  all: true             # all matches or first only
output_variable: result
```

**Output (all: true):**
```json
{
  "data": [
    { "text": "Item 1", "href": "/item/1" },
    { "text": "Item 2", "href": "/item/2" }
  ],
  "count": 2
}
```

**Output (all: false, single property):**
```json
{
  "data": "Item 1",
  "count": 1
}
```

#### `browser.evaluate`

Execute JavaScript in the page.

```yaml
action: browser.evaluate
inputs:
  expression: 'document.title'
output_variable: title

# With function
action: browser.evaluate
inputs:
  expression: |
    () => {
      return {
        url: window.location.href,
        cookies: document.cookie,
        localStorage: { ...localStorage }
      };
    }
output_variable: pageData
```

#### `browser.content`

Get full page HTML.

```yaml
action: browser.content
inputs: {}
output_variable: html
```

#### `browser.pageInfo`

Get page URL and title.

```yaml
action: browser.pageInfo
inputs:
  includeContent: false
output_variable: info
```

### Screenshots & PDFs

#### `browser.screenshot`

Take a screenshot.

```yaml
action: browser.screenshot
inputs:
  path: '/tmp/screenshot.png'
  type: 'png'           # png | jpeg
  quality: 80           # jpeg only, 0-100
  fullPage: true        # full page or viewport
  selector: '#element'  # screenshot specific element
  clip:                 # clip region
    x: 0
    y: 0
    width: 800
    height: 600
  omitBackground: false
output_variable: result
```

**Output:**
```json
{
  "data": "base64-encoded-image",
  "path": "/tmp/screenshot.png",
  "type": "png"
}
```

#### `browser.pdf`

Generate PDF (Chromium only).

```yaml
action: browser.pdf
inputs:
  path: '/tmp/page.pdf'
  format: 'A4'          # Letter | Legal | A0-A6 | etc.
  scale: 1.0
  landscape: false
  printBackground: true
  displayHeaderFooter: false
  headerTemplate: '<div>Header</div>'
  footerTemplate: '<div>Footer</div>'
  pageRanges: '1-5'
  margin:
    top: '1cm'
    right: '1cm'
    bottom: '1cm'
    left: '1cm'
output_variable: result
```

### Waiting

#### `browser.wait`

Wait for various conditions.

```yaml
# Wait for selector
action: browser.wait
inputs:
  selector: '#element'
  state: 'visible'      # attached | detached | visible | hidden
  timeout: 30000

# Wait for URL
action: browser.wait
inputs:
  url: 'https://example.com/success'
  timeout: 30000

# Wait for load state
action: browser.wait
inputs:
  loadState: 'networkidle'  # load | domcontentloaded | networkidle
  timeout: 30000

# Wait for network idle
action: browser.wait
inputs:
  networkIdle: true
  timeout: 30000

# Wait for function
action: browser.wait
inputs:
  function: 'window.myVar === true'
  timeout: 30000

# Wait for timeout (delay)
action: browser.wait
inputs:
  timeout: 2000
```

### Cookies & Storage

#### `browser.cookies`

Get or set cookies.

```yaml
# Set cookies
action: browser.cookies
inputs:
  cookies:
    - name: 'session'
      value: 'abc123'
      domain: '.example.com'
      path: '/'
      secure: true
      httpOnly: true
      sameSite: 'Lax'
output_variable: cookies

# Get cookies for URLs
action: browser.cookies
inputs:
  urls:
    - 'https://example.com'
output_variable: cookies
```

#### `browser.clearCookies`

Clear all cookies.

```yaml
action: browser.clearCookies
inputs: {}
```

#### `browser.storage`

Manage localStorage and sessionStorage.

```yaml
# Set storage
action: browser.storage
inputs:
  localStorage:
    key1: 'value1'
    key2: 'value2'
  sessionStorage:
    temp: 'data'

# Get storage
action: browser.storage
inputs:
  getStorage: 'both'    # local | session | both
output_variable: storage
```

### Network

#### `browser.blockRequests`

Block requests matching patterns.

```yaml
action: browser.blockRequests
inputs:
  patterns:
    - 'ads.example.com'
    - 'tracking.js'
    - '.png'
```

### Page Management

#### `browser.newPage`

Open a new page/tab.

```yaml
action: browser.newPage
inputs: {}
```

#### `browser.getPages`

List all open pages.

```yaml
action: browser.getPages
inputs: {}
output_variable: pages
```

#### `browser.switchToPage`

Switch to a different page.

```yaml
# By index
action: browser.switchToPage
inputs:
  indexOrUrl: 0

# By URL pattern
action: browser.switchToPage
inputs:
  indexOrUrl: 'example.com'
```

#### `browser.closePage`

Close current page.

```yaml
action: browser.closePage
inputs: {}
```

### Media

#### `browser.emulateMedia`

Emulate media type or color scheme.

```yaml
action: browser.emulateMedia
inputs:
  media: 'print'        # screen | print | null
  colorScheme: 'dark'   # light | dark | no-preference | null
  reducedMotion: 'reduce'
```

### Downloads

#### `browser.download`

Download a file.

```yaml
action: browser.download
inputs:
  selector: '#download-link'  # click to trigger download
  path: '/tmp/downloaded-file.pdf'
output_variable: result
```

### Dialogs

#### `browser.handleDialog`

Handle alert/confirm/prompt dialogs.

```yaml
action: browser.handleDialog
inputs:
  action: 'accept'      # accept | dismiss
  promptText: 'input'   # for prompt dialogs
```

### Cleanup

#### `browser.close`

Close the browser.

```yaml
action: browser.close
inputs: {}
```

## Examples

### Web Scraping

```yaml
---
workflow:
  id: scraper
  name: 'Web Scraper'

tools:
  browser:
    sdk: 'playwright'
    options:
      headless: true
---

## Navigate

```yaml
action: browser.navigate
inputs:
  url: 'https://news.ycombinator.com'
  waitUntil: 'networkidle'
```

## Extract Headlines

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

## Close

```yaml
action: browser.close
```
```

### Form Automation

```yaml
## Fill Login Form

```yaml
action: browser.fillForm
inputs:
  fields:
    username: '{{ inputs.username }}'
    password: '{{ inputs.password }}'
  submit: true
```

## Wait for Redirect

```yaml
action: browser.wait
inputs:
  url: '/dashboard'
  timeout: 10000
```
```

### Screenshot with Error Handling

```yaml
## Take Screenshot

```yaml
type: try
steps:
  - id: screenshot
    action: browser.screenshot
    inputs:
      path: '/tmp/page.png'
      fullPage: true
catch:
  - id: error_screenshot
    action: browser.screenshot
    inputs:
      path: '/tmp/error.png'
finally:
  - id: cleanup
    action: browser.close
```
```

## Cloud Browser Services

### Browserless

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      ws_endpoint: 'wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}'
```

### Browserbase

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      ws_endpoint: 'wss://connect.browserbase.com?apiKey=${BROWSERBASE_API_KEY}'
```

### Self-hosted Browserless

```bash
# Run browserless with Docker
docker run -p 3000:3000 browserless/chrome
```

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      ws_endpoint: 'ws://localhost:3000'
```

## Best Practices

### 1. Always Close the Browser

```yaml
type: try
steps:
  - id: automation
    action: browser.navigate
    # ... more steps
finally:
  - id: cleanup
    action: browser.close
```

### 2. Use Appropriate Wait Strategies

```yaml
# Wait for network to settle
action: browser.wait
inputs:
  loadState: 'networkidle'

# Wait for specific element
action: browser.wait
inputs:
  selector: '#content'
  state: 'visible'
```

### 3. Handle Errors Gracefully

```yaml
type: try
steps:
  - id: click
    action: browser.click
    inputs:
      selector: '#button'
      timeout: 5000
catch:
  - id: fallback
    action: browser.click
    inputs:
      selector: '.alternative-button'
```

### 4. Use Headless Mode in Production

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      headless: true  # faster, no display needed
```

### 5. Set Appropriate Timeouts

```yaml
tools:
  browser:
    sdk: 'playwright'
    options:
      timeout: 60000  # increase for slow pages
```

## Troubleshooting

### Browser Not Found

```bash
# Install browsers
npx playwright install
```

### Timeout Errors

- Increase timeout in options or per-action
- Use `networkidle` wait strategy
- Check for dynamic content loading

### Element Not Found

- Verify selector is correct
- Wait for element to appear
- Check if element is in iframe

### HTTPS Errors

```yaml
options:
  ignore_https_errors: true
```

### Headless Detection

Some sites detect headless browsers. Try:

```yaml
options:
  headless: false  # use headed mode
  user_agent: 'Mozilla/5.0...'  # custom UA
```

Or use cloud services with stealth mode (Browserbase, Browserless).
