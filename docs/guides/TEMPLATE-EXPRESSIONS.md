# Template Expressions Guide

Complete guide to marktoflow's **Nunjucks-based template system** including pipeline syntax, regex filters, custom helpers, and declarative operations.

---

## Table of Contents

- [Overview](#overview)
- [Nunjucks Template Engine](#nunjucks-template-engine)
- [Pipeline Syntax](#pipeline-syntax)
- [Regex Filters](#regex-filters)
- [Built-in Helpers](#built-in-helpers)
- [Built-in Operations](#built-in-operations)
- [Integration with Control Flow](#integration-with-control-flow)
- [Best Practices](#best-practices)
- [Migration Guide](#migration-guide)

---

## Overview

marktoflow v2.0 uses **[Nunjucks](https://mozilla.github.io/nunjucks/)** as its template engine - a powerful, flexible templating system for JavaScript that is compatible with Jinja2. This provides:

1. **Pipeline Syntax** - Chain operations like `{{ value | filter1 | filter2 }}`
2. **Regex Filters** - Pattern matching with `match`, `notMatch`, `regexReplace`
3. **50+ Custom Filters** - String, array, object, date, logic, validation, JSON, math
4. **Control Structures** - `{% for %}`, `{% if %}`, `{% elif %}`, `{% else %}`
5. **Built-in Operations** - Declarative alternatives to script blocks

---

## Nunjucks Template Engine

marktoflow uses Nunjucks for all template processing. This gives you:

### Why Nunjucks?

- **Industry Standard** - Same syntax as Python's Jinja2, familiar to many developers
- **Full-Featured** - Loops, conditionals, filters, macros, and more
- **Extensible** - Easy to add custom filters and functions
- **Well-Documented** - Extensive [official documentation](https://mozilla.github.io/nunjucks/templating.html)
- **Battle-Tested** - Used by Mozilla, Node.js Foundation, and thousands of projects

### Basic Syntax

```yaml
# Variable interpolation
message: "{{ user.name }}"

# Filters (pipeline syntax)
slug: "{{ title | lower | replace(' ', '-') }}"

# Control structures in templates
content: |
  {% for item in items %}
  - {{ item.name }}: {{ item.value }}
  {% endfor %}

# Conditionals
status: |
  {% if count > 0 %}Found {{ count }} items{% else %}No items{% endif %}
```

### Built-in Nunjucks Filters

Nunjucks provides these filters out of the box:
- `abs`, `batch`, `capitalize`, `center`, `default`, `dictsort`
- `dump`, `escape`, `first`, `float`, `forceescape`, `groupby`
- `indent`, `int`, `join`, `last`, `length`, `list`, `lower`
- `nl2br`, `random`, `reject`, `rejectattr`, `replace`, `reverse`
- `round`, `safe`, `select`, `selectattr`, `slice`, `sort`
- `string`, `striptags`, `sum`, `title`, `trim`, `truncate`
- `upper`, `urlencode`, `urlize`, `wordcount`, `wordwrap`

See [Nunjucks Built-in Filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters) for details.

### Custom marktoflow Filters

marktoflow extends Nunjucks with 50+ additional filters documented below.

---

## Pipeline Syntax

Pipeline syntax lets you chain multiple operations together for clean, readable transformations.

### Basic Usage

```yaml
# Extract owner from repo string
owner: "{{ inputs.repo | split('/') | first() }}"

# Convert to uppercase and trim
name: "{{ user.name | upper() | trim() }}"

# Default value if null/undefined
channel: "{{ config.channel | default('#general') }}"
```

### Chaining Multiple Filters

```yaml
# Complex transformation pipeline
result: "{{ repo | split('/') | first() | upper() | prefix('ORG: ') }}"
# Input: "facebook/react"
# Output: "ORG: FACEBOOK"

# Multi-step processing
users: "{{ csv_data | split(',') | unique() | sort() | join(', ') }}"
# Input: "alice,bob,alice,charlie"
# Output: "alice, bob, charlie"
```

### With Arguments

```yaml
# Filters can take arguments
slug: "{{ title | replace(' ', '-') | lower() }}"
excerpt: "{{ content | truncate(100, '...') }}"
subset: "{{ items | slice(0, 5) }}"
```

### Variable References in Arguments

```yaml
# Use variables as filter arguments
delimiter: "{{ text | split(separator) }}"
formatted: "{{ date | format_date(format_string) }}"
```

---

## Regex Filters

Nunjucks filters for pattern matching and extraction. All patterns use the format `/pattern/flags`.

### Pattern Match (`match`)

Extract values using regex patterns. Returns the full match, first capture group, or specified group:

```yaml
steps:
  # Extract issue key (e.g., "ABC-123")
  - action: core.set
    inputs:
      issue_key: "{{ commit_message | match('/([A-Z]+-\\d+)/') }}"

  # Extract specific capture group (1-indexed)
  - action: core.set
    inputs:
      username: "{{ email | match('/^([^@]+)@/', 1) }}"

  # Extract semantic version parts
  - action: core.set
    inputs:
      major: "{{ version | match('/^(\\d+)\\./', 1) }}"
      minor: "{{ version | match('/^\\d+\\.(\\d+)\\./', 1) }}"

  # Extract JSON from markdown code blocks
  - action: core.set
    inputs:
      json: "{{ response | match('/```json\\s*([\\s\\S]*?)\\s*```/', 1) }}"
```

### Negative Match (`notMatch`)

Check if a value does NOT match a pattern (returns boolean):

```yaml
steps:
  - type: if
    condition: "{{ status | notMatch('/^(error|failed)/') }}"
    then:
      - action: continue.processing

  - type: if
    condition: "{{ branch | notMatch('/^(main|master|develop)$/') }}"
    then:
      - action: run.tests
```

### Regex Replace (`regexReplace`)

Replace patterns in strings:

```yaml
steps:
  # Remove all digits
  - action: core.set
    inputs:
      cleaned: "{{ text | regexReplace('/\\d+/', '', 'g') }}"

  # Replace underscores with hyphens
  - action: core.set
    inputs:
      slug: "{{ name | regexReplace('/_+/', '-', 'g') }}"

  # Remove HTML tags
  - action: core.set
    inputs:
      plain: "{{ html | regexReplace('/<[^>]+>/', '', 'g') }}"
```

### Pattern Format

Patterns use the format `/pattern/flags`:
- `/pattern/` - Basic pattern without flags
- `/pattern/i` - Case-insensitive
- `/pattern/g` - Global (replace all)
- `/pattern/m` - Multiline mode
- `/pattern/gi` - Combine flags

### Boolean Checks in Conditions

To check if a pattern matches (boolean), use `match` and check for null:

```yaml
steps:
  - type: if
    condition: "{{ error_message | match('/timeout/') }}"
    then:
      - action: retry.operation

  - type: if
    condition: "{{ email | match('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/') }}"
    then:
      - action: sendEmail
```

### Escaping in Regex

Remember to escape backslashes in YAML strings:

```yaml
# Wrong - single backslash gets consumed by YAML
pattern: "{{ text | match('/\d+/') }}"  # May not work

# Correct - double backslash
pattern: "{{ text | match('/\\d+/') }}"  # Works correctly
```

---

## Built-in Helpers

60+ helper functions across 8 categories.

### String Helpers (14)

| Helper | Description | Example |
|--------|-------------|---------|
| `split(delimiter)` | Split string into array | `{{ "a,b,c" \| split(",") }}` → `["a", "b", "c"]` |
| `join(delimiter)` | Join array into string | `{{ ["a", "b"] \| join("-") }}` → `"a-b"` |
| `trim()` | Remove whitespace | `{{ "  hello  " \| trim() }}` → `"hello"` |
| `upper()` | Convert to uppercase | `{{ "hello" \| upper() }}` → `"HELLO"` |
| `lower()` | Convert to lowercase | `{{ "HELLO" \| lower() }}` → `"hello"` |
| `title()` | Title case | `{{ "hello world" \| title() }}` → `"Hello World"` |
| `capitalize()` | Capitalize first letter | `{{ "hello" \| capitalize() }}` → `"Hello"` |
| `slugify()` | Convert to URL slug | `{{ "Hello World!" \| slugify() }}` → `"hello-world"` |
| `prefix(str)` | Add prefix | `{{ "world" \| prefix("hello-") }}` → `"hello-world"` |
| `suffix(str)` | Add suffix | `{{ "hello" \| suffix("-world") }}` → `"hello-world"` |
| `replace(search, replace)` | Replace all occurrences | `{{ "a,b,c" \| replace(",", "-") }}` → `"a-b-c"` |
| `truncate(length, ellipsis)` | Truncate string | `{{ "hello world" \| truncate(5) }}` → `"hello..."` |
| `substring(start, end)` | Extract substring | `{{ "hello" \| substring(1, 4) }}` → `"ell"` |
| `contains(search)` | Check if contains | `{{ "hello world" \| contains("world") }}` → `true` |

### Array Helpers (10)

| Helper | Description | Example |
|--------|-------------|---------|
| `first()` | Get first element | `{{ [1, 2, 3] \| first() }}` → `1` |
| `last()` | Get last element | `{{ [1, 2, 3] \| last() }}` → `3` |
| `nth(index)` | Get nth element | `{{ [1, 2, 3] \| nth(1) }}` → `2` |
| `count()` | Get array length | `{{ [1, 2, 3] \| count() }}` → `3` |
| `sum()` | Sum numbers | `{{ [1, 2, 3] \| sum() }}` → `6` |
| `unique()` | Remove duplicates | `{{ [1, 2, 2, 3] \| unique() }}` → `[1, 2, 3]` |
| `flatten()` | Flatten one level | `{{ [[1, 2], [3, 4]] \| flatten() }}` → `[1, 2, 3, 4]` |
| `reverse()` | Reverse array | `{{ [1, 2, 3] \| reverse() }}` → `[3, 2, 1]` |
| `sort(reverse)` | Sort array | `{{ [3, 1, 2] \| sort() }}` → `[1, 2, 3]` |
| `slice(start, end)` | Extract slice | `{{ [1, 2, 3, 4] \| slice(1, 3) }}` → `[2, 3]` |

### Object Helpers (7)

| Helper | Description | Example |
|--------|-------------|---------|
| `path(pathStr)` | Access nested path | `{{ user \| path("contact.email") }}` |
| `keys()` | Get object keys | `{{ obj \| keys() }}` → `["a", "b", "c"]` |
| `values()` | Get object values | `{{ obj \| values() }}` → `[1, 2, 3]` |
| `entries()` | Get key-value pairs | `{{ obj \| entries() }}` → `[["a", 1], ["b", 2]]` |
| `pick(...keys)` | Select keys | `{{ obj \| pick("id", "name") }}` |
| `omit(...keys)` | Exclude keys | `{{ obj \| omit("password", "secret") }}` |
| `merge(other)` | Merge objects | `{{ obj1 \| merge(obj2) }}` |

### Date Helpers (5)

| Helper | Description | Example |
|--------|-------------|---------|
| `now()` | Current timestamp | `{{ now() }}` → `1706745600000` |
| `format_date(format)` | Format date | `{{ date \| format_date("YYYY-MM-DD") }}` → `"2024-02-01"` |
| `add_days(days)` | Add days to date | `{{ date \| add_days(7) }}` |
| `subtract_days(days)` | Subtract days | `{{ date \| subtract_days(7) }}` |
| `diff_days(other)` | Days difference | `{{ date1 \| diff_days(date2) }}` → `5` |

**Date Format Patterns:**
- `YYYY` - 4-digit year
- `MM` - 2-digit month
- `DD` - 2-digit day
- `HH` - 2-digit hour (24h)
- `mm` - 2-digit minute
- `ss` - 2-digit second

### Logic Helpers (5)

| Helper | Description | Example |
|--------|-------------|---------|
| `default(fallback)` | Default if null/undefined | `{{ value \| default("N/A") }}` |
| `or(...values)` | First truthy value | `{{ null \| or(undefined, "first") }}` → `"first"` |
| `and(...values)` | Check all truthy | `{{ true \| and(1, "value") }}` → `true` |
| `not()` | Negate boolean | `{{ true \| not() }}` → `false` |
| `ternary(ifTrue, ifFalse)` | Conditional | `{{ approved \| ternary("✅", "❌") }}` |

### Validation Helpers (6)

| Helper | Description | Example |
|--------|-------------|---------|
| `is_array()` | Check if array | `{{ value \| is_array() }}` |
| `is_object()` | Check if object | `{{ value \| is_object() }}` |
| `is_string()` | Check if string | `{{ value \| is_string() }}` |
| `is_number()` | Check if number | `{{ value \| is_number() }}` |
| `is_empty()` | Check if empty | `{{ value \| is_empty() }}` |
| `is_null()` | Check if null | `{{ value \| is_null() }}` |

### JSON Helpers (2)

| Helper | Description | Example |
|--------|-------------|---------|
| `parse_json()` | Parse JSON string | `{{ '{"a":1}' \| parse_json() }}` → `{a: 1}` |
| `to_json()` | Stringify to JSON | `{{ {a: 1} \| to_json() }}` → `'{"a":1}'` |

### Math Helpers (6)

| Helper | Description | Example |
|--------|-------------|---------|
| `abs()` | Absolute value | `{{ -5 \| abs() }}` → `5` |
| `round()` | Round to integer | `{{ 3.7 \| round() }}` → `4` |
| `floor()` | Round down | `{{ 3.7 \| floor() }}` → `3` |
| `ceil()` | Round up | `{{ 3.2 \| ceil() }}` → `4` |
| `min()` | Minimum value | `{{ [1, 2, 3] \| min() }}` → `1` |
| `max()` | Maximum value | `{{ [1, 2, 3] \| max() }}` → `3` |

---

## Built-in Operations

Declarative operations that replace verbose script blocks.

### core.set

Set multiple variables at once:

```yaml
- action: core.set
  inputs:
    count: 42
    message: "Hello World"
    active: true
    items: ["a", "b", "c"]
```

All inputs become variables accessible in subsequent steps.

### core.transform

Array transformations without scripts:

#### Map Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ issues }}"
    operation: map
    expression: "{{ item.key }}"
  output_variable: issue_keys
```

#### Filter Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ issues }}"
    operation: filter
    expression: "{{ item.status == 'open' }}"
  output_variable: open_issues
```

#### Reduce Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ numbers }}"
    operation: reduce
    expression: "{{ accumulator + item }}"
    initial_value: 0
  output_variable: sum
```

#### Find Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ users }}"
    operation: find
    expression: "{{ item.role == 'admin' }}"
  output_variable: admin_user
```

#### Group By Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ items }}"
    operation: group_by
    field: "category"
  output_variable: grouped_items
```

#### Unique Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ items }}"
    operation: unique
    field: "id"
  output_variable: unique_items
```

#### Sort Operation

```yaml
- action: core.transform
  inputs:
    input: "{{ items }}"
    operation: sort
    field: "priority"
    reverse: true
  output_variable: sorted_items
```

### core.extract

Safe nested value access with defaults:

```yaml
- action: core.extract
  inputs:
    input: "{{ api_response }}"
    path: "data.user.email"
    default: "unknown@example.com"
  output_variable: email
```

**Path Syntax:**
- Dot notation: `user.name`, `data.items.0.value`
- Array indexing: `items[0]`, `users[0].email`
- Nested: `response.data.users[0].contact.email`

### core.format

Value formatting with multiple types:

#### Date Formatting

```yaml
- action: core.format
  inputs:
    value: "{{ timestamp }}"
    type: date
    format: "YYYY-MM-DD HH:mm:ss"
  output_variable: formatted_date
```

#### Number Formatting

```yaml
- action: core.format
  inputs:
    value: "{{ price }}"
    type: number
    decimals: 2
  output_variable: formatted_price
```

#### Currency Formatting

```yaml
- action: core.format
  inputs:
    value: "{{ amount }}"
    type: currency
    currency: "USD"
  output_variable: formatted_amount
```

Supported currencies: USD, EUR, GBP, JPY

#### String Templates

```yaml
- action: core.format
  inputs:
    value: "Hello {{ name }}, you have {{ count }} messages"
    type: string
  output_variable: message
```

#### JSON Formatting

```yaml
- action: core.format
  inputs:
    value: "{{ data }}"
    type: json
    indent: 2
  output_variable: pretty_json
```

---

## Integration with Control Flow

Template expressions work seamlessly with all control flow structures:

### If/Else Conditions

```yaml
- type: if
  condition: "{{ repo | split('/') | first() }} == 'facebook'"
  then: [...]
  else: [...]
```

### Switch Expressions

```yaml
- type: switch
  expression: "{{ title | split(':') | first() | trim() | lower() }}"
  cases:
    fix: [...]
    feat: [...]
    docs: [...]
```

### For-Each Items

```yaml
- type: for_each
  items: "{{ csv_data | split(',') | unique() }}"
  item_variable: user
  steps:
    - action: process.user
      inputs:
        name: "{{ user | trim() | upper() }}"
```

### While Conditions

```yaml
- type: while
  condition: "{{ items | count() }} > 0"
  steps:
    - action: process.item
```

### Map/Filter Expressions

```yaml
- type: map
  items: "{{ users }}"
  expression: "{{ item.name | upper() }}"
  output_variable: names

- type: filter
  items: "{{ emails }}"
  condition: "{{ item | contains('@example.com') }}"
  output_variable: filtered
```

### Parallel Branch Inputs

```yaml
- type: parallel
  branches:
    - id: process_owner
      steps:
        - action: core.set
          inputs:
            owner: "{{ repo | split('/') | first() }}"
    - id: process_name
      steps:
        - action: core.set
          inputs:
            name: "{{ repo | split('/') | last() }}"
```

---

## Best Practices

### 1. Use Pipeline Syntax for Clarity

**Before:**
```yaml
owner: "{{ inputs.repo.split('/')[0] }}"
```

**After:**
```yaml
owner: "{{ inputs.repo | split('/') | first() }}"
```

### 2. Chain Operations for Readability

**Before:**
```yaml
- action: core.set
  inputs:
    parts: "{{ text.split(',') }}"
- action: core.transform
  inputs:
    input: "{{ parts }}"
    operation: unique
  output_variable: unique_parts
```

**After:**
```yaml
- action: core.set
  inputs:
    unique_parts: "{{ text | split(',') | unique() }}"
```

### 3. Use Default Values

**Before:**
```yaml
- type: if
  condition: "{{ config.channel !== null && config.channel !== undefined }}"
  then:
    - action: slack.chat.postMessage
      inputs:
        channel: "{{ config.channel }}"
  else:
    - action: slack.chat.postMessage
      inputs:
        channel: "#general"
```

**After:**
```yaml
- action: slack.chat.postMessage
  inputs:
    channel: "{{ config.channel | default('#general') }}"
```

### 4. Use Built-in Operations Over Scripts

**Before:**
```yaml
- action: script.execute
  inputs:
    code: |
      const keys = context.issues.map(i => i.key);
      return keys;
  output_variable: issue_keys
```

**After:**
```yaml
- action: core.transform
  inputs:
    input: "{{ issues }}"
    operation: map
    expression: "{{ item.key }}"
  output_variable: issue_keys
```

### 5. Use Regex Operators for Pattern Matching

**Before:**
```yaml
- action: script.execute
  inputs:
    code: |
      if (/timeout/.test(context.error)) {
        return true;
      }
      return false;
  output_variable: is_timeout
```

**After (Nunjucks):**
```yaml
- type: if
  condition: "{{ error | match('/timeout/') }}"
  then: [...]
```

---

## Migration Guide

### Migrating to Nunjucks Templates

The new Nunjucks syntax is cleaner and more powerful. Here's how to migrate:

#### Step 1: Replace Array Access

```yaml
# Old (JavaScript-style)
owner: "{{ inputs.repo.split('/')[0] }}"

# New (Nunjucks filters)
owner: "{{ inputs.repo | split('/') | first }}"
```

#### Step 2: Replace Ternary Operators

```yaml
# Old (JavaScript-style)
status: "{{ approved ? 'APPROVED' : 'REJECTED' }}"

# New (Nunjucks ternary filter)
status: "{{ approved | ternary('APPROVED', 'REJECTED') }}"
```

#### Step 3: Replace Scripts with Built-in Operations

```yaml
# Old (script block)
- action: script.execute
  inputs:
    code: |
      return context.items.map(i => i.key);
  output_variable: keys

# New (core.transform)
- action: core.transform
  inputs:
    input: "{{ items }}"
    operation: map
    expression: "{{ item.key }}"
  output_variable: keys
```

#### Step 4: Use Regex Filters

```yaml
# Old (script block)
- action: script.execute
  inputs:
    code: |
      return /error/i.test(context.message);
  output_variable: has_error

# New (Nunjucks match filter)
- type: if
  condition: "{{ message | match('/error/i') }}"
  then: [...]
```

### Example: Complete Workflow Migration

**Before:**
```yaml
steps:
  - id: extract_owner
    action: script.execute
    inputs:
      code: |
        return context.inputs.repo.split('/')[0];
    output_variable: owner

  - id: check_org
    action: script.execute
    inputs:
      code: |
        return context.owner === 'facebook';
    output_variable: is_facebook

  - id: notify
    type: if
    condition: "{{ is_facebook }}"
    then:
      - action: slack.chat.postMessage
        inputs:
          text: "{{ 'Facebook repo: ' + inputs.repo }}"
```

**After:**
```yaml
steps:
  - id: notify
    type: if
    condition: "{{ inputs.repo | split('/') | first() }} == 'facebook'"
    then:
      - action: slack.chat.postMessage
        inputs:
          text: "{{ inputs.repo | prefix('Facebook repo: ') }}"
```

**Benefits:**
- Reduced from 3 steps to 1
- Eliminated 2 script blocks
- More readable and maintainable
- Same functionality, cleaner code

---

## Complete Example

Here's a real-world workflow using all template expression features:

```yaml
---
workflow:
  id: pr-notification
  name: 'PR Notification with Template Expressions'

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  repo:
    type: string
    required: true
    description: "Repository in owner/name format"
  pr_number:
    type: number
    required: true

steps:
  # Fetch PR details
  - id: get_pr
    action: github.pulls.get
    inputs:
      owner: "{{ inputs.repo | split('/') | first() }}"
      repo: "{{ inputs.repo | split('/') | last() }}"
      pull_number: "{{ inputs.pr_number }}"
    output_variable: pr

  # Check if PR is from Facebook org
  - id: check_org
    type: if
    condition: "{{ inputs.repo | split('/') | first() }} == 'facebook'"
    then:
      # High priority notification
      - id: priority_notify
        action: slack.chat.postMessage
        inputs:
          channel: "#critical"
          text: "🚨 {{ pr.title | prefix('Facebook PR: ') }}"

  # Extract issue key from title if present
  - id: extract_issue
    action: core.set
    inputs:
      issue_key: "{{ pr.title | match('/([A-Z]+-\\d+)/', 1) | default('No issue key') }}"

  # Format PR metadata
  - id: format_metadata
    action: core.set
    inputs:
      status: "{{ pr.merged | ternary('✅ Merged', '⏳ Open') }}"
      author: "{{ pr.user.login | upper() }}"
      slug: "{{ pr.title | slugify() }}"
      created: "{{ pr.created_at | format_date('YYYY-MM-DD') }}"

  # Get changed files
  - id: get_files
    action: github.pulls.listFiles
    inputs:
      owner: "{{ inputs.repo | split('/') | first() }}"
      repo: "{{ inputs.repo | split('/') | last() }}"
      pull_number: "{{ inputs.pr_number }}"
    output_variable: files

  # Extract file extensions
  - id: get_extensions
    action: core.transform
    inputs:
      input: "{{ files }}"
      operation: map
      expression: "{{ item.filename | split('.') | last() }}"
    output_variable: extensions

  # Get unique extensions
  - id: unique_extensions
    action: core.set
    inputs:
      exts: "{{ extensions | unique() | sort() | join(', ') }}"

  # Send summary notification
  - id: notify
    action: slack.chat.postMessage
    inputs:
      channel: "{{ '#prs' }}"
      text: |
        **PR Update**
        Title: {{ pr.title }}
        Status: {{ status }}
        Author: {{ author }}
        Issue: {{ issue_key }}
        Files: {{ files | count() }} changed ({{ exts }})
        Created: {{ created }}
---
```

This example demonstrates:
- ✅ Pipeline syntax (`split | first`, `slugify`, `unique | sort | join`)
- ✅ Regex extraction with `match` filter
- ✅ Helper functions (`default`, `ternary`, `upper`, `count`)
- ✅ Built-in operations (`core.transform`, `core.set`)
- ✅ Date formatting (`format_date`)
- ✅ Clean, readable workflow

---

## Summary

Template expressions in marktoflow v2.0 are powered by **Nunjucks**, a full-featured templating engine:

- **Nunjucks Engine** - Industry-standard [Jinja2-compatible](https://mozilla.github.io/nunjucks/) templating
- **Pipeline Syntax** - `{{ value | filter1 | filter2 }}`
- **Regex Filters** - `match`, `notMatch`, `regexReplace`
- **50+ Custom Filters** - String, array, object, date, logic, validation, JSON, math
- **Built-in Operations** - core.set, core.transform, core.extract, core.format
- **Control Structures** - `{% for %}`, `{% if %}`, `{% elif %}`, `{% else %}`

Make your workflows cleaner, more maintainable, and more powerful with Nunjucks templates!
