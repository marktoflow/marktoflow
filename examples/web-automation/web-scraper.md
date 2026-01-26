---
workflow:
  id: web-scraper
  name: 'Web Scraper'
  version: '1.0.0'
  description: 'Advanced web scraping with pagination and data extraction'

tools:
  browser:
    sdk: 'playwright'
    options:
      headless: true
      browser_type: 'chromium'
      viewport:
        width: 1280
        height: 720

inputs:
  base_url:
    type: string
    required: false
    default: 'https://quotes.toscrape.com'
  max_pages:
    type: number
    required: false
    default: 3
---

# Web Scraper

Advanced web scraping workflow that extracts quotes from multiple pages.

## Step 1: Navigate to First Page

```yaml
action: browser.navigate
inputs:
  url: '{{ inputs.base_url }}'
  waitUntil: 'networkidle'
output_variable: initial_page
```

## Step 2: Scrape Multiple Pages

```yaml
type: for
collection: '{{ range(1, inputs.max_pages + 1) }}'
item_variable: page_num
steps:
  - id: extract_quotes
    action: browser.extract
    inputs:
      selector: '.quote'
      all: true
      text: false
      html: false
    output_variable: raw_quotes

  - id: extract_quote_details
    action: browser.evaluate
    inputs:
      expression: |
        () => {
          return Array.from(document.querySelectorAll('.quote')).map(quote => ({
            text: quote.querySelector('.text')?.textContent?.trim(),
            author: quote.querySelector('.author')?.textContent?.trim(),
            tags: Array.from(quote.querySelectorAll('.tag')).map(t => t.textContent)
          }));
        }
    output_variable: page_quotes

  - id: log_progress
    action: console.log
    inputs:
      message: 'Page {{ page_num }}: Found {{ page_quotes | length }} quotes'

  - id: check_next_page
    action: browser.extract
    inputs:
      selector: '.pager .next a'
      attributes:
        - 'href'
      all: false
    output_variable: next_link

  - id: navigate_next
    type: if
    condition: '{{ next_link.data and page_num < inputs.max_pages }}'
    then:
      - id: go_next
        action: browser.click
        inputs:
          selector: '.pager .next a'

      - id: wait_load
        action: browser.wait
        inputs:
          loadState: 'networkidle'
output_variable: scraped_data
```

## Step 3: Display Summary

```yaml
action: console.log
inputs:
  message: |
    ===== Web Scraping Complete =====

    Base URL: {{ inputs.base_url }}
    Pages Scraped: {{ inputs.max_pages }}

    Sample Quote:
    "{{ scraped_data[0].page_quotes[0].text }}"
    - {{ scraped_data[0].page_quotes[0].author }}

    ================================
```

## Step 4: Close Browser

```yaml
action: browser.close
inputs: {}
```

---

## Running the Workflow

```bash
# Basic usage
marktoflow run examples/web-automation/web-scraper.md

# Custom settings
marktoflow run examples/web-automation/web-scraper.md \
  -i base_url=https://quotes.toscrape.com \
  -i max_pages=5
```

## Tips for Web Scraping

1. **Use networkidle** - Wait for all network requests to complete
2. **Handle pagination** - Loop through pages with conditions
3. **Evaluate JavaScript** - For complex extraction logic
4. **Respect rate limits** - Add delays between requests
5. **Handle errors** - Use try/catch for robust scraping
