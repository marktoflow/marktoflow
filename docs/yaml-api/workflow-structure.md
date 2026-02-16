# Workflow Structure

A marktoflow workflow is a markdown file with YAML frontmatter:

```yaml
---
workflow:
  id: string              # Required: Unique workflow identifier
  name: string            # Required: Human-readable name
  version: string         # Optional: Version (default: "1.0.0")
  description: string     # Optional: Workflow description
  author: string          # Optional: Author name
  tags: string[]          # Optional: Tags for categorization

tools:
  # Tool configurations (see Tool Configuration section)

inputs:
  # Input parameters (see Inputs section)

triggers:
  # Trigger configurations (see Triggers section)

steps:
  # Optional: Steps can be defined here instead of markdown
---

# Workflow Documentation

Markdown content with step definitions in code blocks...

## Step 1: Example

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Hello!"
```
```

---

## Workflow Metadata

### `workflow` (required)

Top-level workflow metadata object.

#### Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `id` | `string` | Yes | - | Unique workflow identifier (lowercase, hyphens allowed) |
| `name` | `string` | Yes | - | Human-readable workflow name |
| `version` | `string` | No | `"1.0.0"` | Semantic version |
| `description` | `string` | No | - | Workflow description |
| `author` | `string` | No | - | Author name or email |
| `tags` | `string[]` | No | - | Tags for categorization and search |

#### Example

```yaml
workflow:
  id: daily-standup-slack
  name: Daily Standup Slack Notification
  version: 2.1.0
  description: Automatically sends daily standup reminders to Slack
  author: DevOps Team <devops@company.com>
  tags:
    - slack
    - standup
    - automation
```
