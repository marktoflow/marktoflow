# Variable Resolution

## Template Syntax

marktoflow uses a Jinja2-inspired template syntax for variable interpolation.

### Simple Interpolation

Use `{{ variable }}` for simple variable references:

```yaml
text: '{{ inputs.message }}'
channel: '{{ slack_response.channel }}'
count: '{{ results.length }}'
```

### Expressions

Template expressions support basic operations:

```yaml
# Arithmetic
total: '{{ count + 1 }}'
average: '{{ sum / count }}'

# String concatenation
full_name: '{{ first_name }} {{ last_name }}'

# Ternary/conditional
status: '{{ success ? "completed" : "failed" }}'

# Array access
first: '{{ items[0] }}'
last: '{{ items[items.length - 1] }}'
```

### Jinja2 Filters and Control Structures

In multi-line strings (using `|`), you can use Jinja2-style filters and control structures:

```yaml
action: slack.chat.postMessage
inputs:
  text: |
    **Daily Report**

    {% for item in items %}
    - {{ item.name }}: {{ item.status }}
    {% endfor %}

    {% if errors.length > 0 %}
    **Errors:** {{ errors | length }}
    {% endif %}

    Total: {{ items | length }} items
```

**Available Filters:**
- `length` - Get array/string length
- `join(separator)` - Join array elements
- `upper` / `lower` - Case conversion
- `default(value)` - Default value if undefined
- `first` / `last` - First/last array element
- `sort` / `reverse` - Array ordering

**Control Structures:**
- `{% for item in array %}...{% endfor %}` - Iteration
- `{% if condition %}...{% elif %}...{% else %}...{% endif %}` - Conditionals
- `{% set var = value %}` - Variable assignment

### Input Variables

Access workflow inputs with `inputs.` prefix:

```yaml
text: "{{inputs.message}}"
channel: "{{inputs.channel}}"
```

### Step Output Variables

Reference step outputs by their `output_variable` name:

```yaml
# Step 1: Get user info
action: slack.users.info
inputs:
  user: "{{inputs.user_id}}"
output_variable: user_info

# Step 2: Use output from Step 1
action: slack.chat.postMessage
inputs:
  channel: "{{inputs.channel}}"
  text: "Hello {{user_info.user.real_name}}!"
```

### Nested Property Access

Access nested properties with dot notation:

```yaml
text: "{{user_info.user.profile.email}}"
```

### Array Access

Access array elements by index:

```yaml
first_item: "{{results[0]}}"
```

### Loop Variables

Special variables available in loops:

```yaml
# In for_each loops:
item: "{{item}}"              # Current item
index: "{{index}}"            # Current index (if index_variable set)
loop.index: "{{loop.index}}"  # Current iteration index
loop.first: "{{loop.first}}"  # true if first iteration
loop.last: "{{loop.last}}"    # true if last iteration
loop.length: "{{loop.length}}"# Total iterations
```

### Step Metadata

Access step execution metadata:

```yaml
# Check step status
condition: step_id.status == 'completed'

# Access retry count
retry_count: "{{step_id.retryCount}}"

# Access error message
error_msg: "{{step_id.error}}"
```

## Environment Variables

Reference environment variables in `tools.auth` and `inputs.default`:

```yaml
auth:
  token: ${SLACK_BOT_TOKEN}

inputs:
  api_url:
    type: string
    default: ${API_URL}
```

**Note:** Environment variables use `${VAR}` syntax (dollar sign), while template variables use `{{var}}` (double braces).
