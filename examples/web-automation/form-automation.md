---
workflow:
  id: form-automation
  name: 'Form Automation'
  version: '1.0.0'
  description: 'Automate form filling and submission'

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
  login_url:
    type: string
    required: true
    default: 'https://the-internet.herokuapp.com/login'
  username:
    type: string
    required: true
    default: 'tomsmith'
  password:
    type: string
    required: true
    default: 'SuperSecretPassword!'
---

# Form Automation

Demonstrates automated form filling, submission, and validation.

## Step 1: Navigate to Login Page

```yaml
action: browser.navigate
inputs:
  url: '{{ inputs.login_url }}'
  waitUntil: 'networkidle'
output_variable: login_page
```

## Step 2: Fill Login Form

```yaml
action: browser.fillForm
inputs:
  fields:
    username: '{{ inputs.username }}'
    password: '{{ inputs.password }}'
  submit: true
  formSelector: '#login'
output_variable: form_result
```

## Step 3: Wait for Navigation

```yaml
action: browser.wait
inputs:
  loadState: 'networkidle'
  timeout: 5000
```

## Step 4: Verify Login Success

```yaml
action: browser.extract
inputs:
  selector: '.flash'
  text: true
  all: false
output_variable: flash_message
```

## Step 5: Take Screenshot of Result

```yaml
action: browser.screenshot
inputs:
  path: '/tmp/login-result.png'
  type: 'png'
output_variable: screenshot
```

## Step 6: Display Results

```yaml
action: console.log
inputs:
  message: |
    ===== Form Automation Results =====

    Login URL: {{ inputs.login_url }}
    Username: {{ inputs.username }}

    Result: {{ flash_message.data }}

    Screenshot: {{ screenshot.path }}
    ===================================
```

## Step 7: Logout (Cleanup)

```yaml
type: try
steps:
  - id: click_logout
    action: browser.click
    inputs:
      selector: 'a[href="/logout"]'
      timeout: 3000

  - id: wait_logout
    action: browser.wait
    inputs:
      loadState: 'networkidle'
catch:
  - id: log_logout_error
    action: console.log
    inputs:
      message: 'Logout skipped or failed'
```

## Step 8: Close Browser

```yaml
action: browser.close
inputs: {}
```

---

## Running the Workflow

```bash
# Basic usage with default credentials
marktoflow run examples/web-automation/form-automation.md

# Custom credentials
marktoflow run examples/web-automation/form-automation.md \
  -i username=myuser \
  -i password=mypassword

# Custom login URL
marktoflow run examples/web-automation/form-automation.md \
  -i login_url=https://myapp.com/login
```

## Form Automation Actions

### Individual Field Actions

```yaml
# Type with delay (simulates human typing)
action: browser.type
inputs:
  selector: '#email'
  text: 'user@example.com'
  delay: 50  # ms between keystrokes

# Fill instantly (faster, no simulation)
action: browser.fill
inputs:
  selector: '#email'
  value: 'user@example.com'

# Select dropdown
action: browser.select
inputs:
  selector: '#country'
  values: 'US'

# Multi-select
action: browser.select
inputs:
  selector: '#interests'
  values:
    - 'technology'
    - 'science'
    - 'art'

# Check/uncheck checkbox
action: browser.check
inputs:
  selector: '#remember-me'

action: browser.uncheck
inputs:
  selector: '#newsletter'
```

### Batch Form Filling

```yaml
action: browser.fillForm
inputs:
  fields:
    first_name: 'John'
    last_name: 'Doe'
    email: 'john@example.com'
    country: 'US'           # Select option
    terms: true             # Check checkbox
    interests:              # Multi-select
      - 'technology'
      - 'science'
  submit: true
  formSelector: '#registration-form'
```

## Handling Dynamic Forms

```yaml
# Wait for field to appear
- id: wait_for_field
  action: browser.wait
  inputs:
    selector: '#dynamic-field'
    state: 'visible'
    timeout: 10000

# Fill the dynamic field
- id: fill_dynamic
  action: browser.fill
  inputs:
    selector: '#dynamic-field'
    value: 'dynamic value'
```

## File Uploads

```yaml
action: browser.uploadFile
inputs:
  selector: '#file-input'
  files: '/path/to/document.pdf'

# Multiple files
action: browser.uploadFile
inputs:
  selector: '#file-input'
  files:
    - '/path/to/file1.pdf'
    - '/path/to/file2.jpg'
```
