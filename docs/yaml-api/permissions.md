# Permissions

Permission restrictions allow you to control what operations a workflow or individual steps can perform. Permissions can be set at both the workflow level (applied to all steps) and the step level (overrides workflow-level settings).

## Structure

```yaml
permissions:
  # File operations
  read: boolean | string[]        # Allow reading files (true, false, or glob patterns)
  write: boolean | string[]       # Allow writing files (true, false, or glob patterns)

  # Command execution
  execute: boolean | string[]     # Allow command execution
  allowed_commands: string[]      # Whitelist of allowed commands
  blocked_commands: string[]      # Blacklist of blocked commands

  # Directory restrictions
  allowed_directories: string[]   # Directories where operations are allowed
  blocked_paths: string[]         # Paths that are always blocked

  # Network
  network: boolean                # Allow network access
  allowed_hosts: string[]         # Whitelist of allowed hosts

  # Limits
  max_file_size: number           # Maximum file size in bytes
```

## Workflow-Level Permissions

Apply permissions to all steps in the workflow:

```yaml
workflow:
  id: secure-workflow
  name: "Secure Workflow"

permissions:
  read: true
  write: ['./output/**', './tmp/**']
  blocked_commands: ['rm -rf', 'sudo', 'chmod']
  network: false

steps:
  - id: process
    action: script.execute
    inputs:
      script: ./scripts/process.js
```

## Step-Level Permissions

Override or restrict permissions for specific steps:

```yaml
steps:
  - id: analyze
    action: agent.chat.completions
    permissions:
      write: false              # Step cannot write any files
    inputs:
      messages:
        - role: user
          content: "Analyze: {{ inputs.code }}"

  - id: save
    action: script.execute
    permissions:
      write: ['./output/*.json']  # Only allow writing JSON to output dir
    inputs:
      code: |
        fs.writeFileSync('./output/result.json', JSON.stringify(data));
```

## Permission Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `read` | `boolean \| string[]` | `true` | Allow file reads. If array, specifies allowed glob patterns |
| `write` | `boolean \| string[]` | `true` | Allow file writes. If array, specifies allowed glob patterns |
| `execute` | `boolean \| string[]` | `true` | Allow command execution. If array, specifies allowed commands |
| `allowed_commands` | `string[]` | `[]` | Whitelist of allowed commands (supports wildcards) |
| `blocked_commands` | `string[]` | `[]` | Blacklist of blocked commands (supports wildcards) |
| `allowed_directories` | `string[]` | `[]` | Only allow operations in these directories |
| `blocked_paths` | `string[]` | `[]` | Always block operations on these paths |
| `network` | `boolean` | `true` | Allow network requests |
| `allowed_hosts` | `string[]` | `[]` | Whitelist of allowed hosts (supports `*.example.com` wildcards) |
| `max_file_size` | `number` | - | Maximum file size in bytes |

## Permission Resolution

When both workflow and step permissions are defined, they are merged:

1. **Step permissions override workflow permissions** - If a step defines `write: false`, it overrides `write: true` at workflow level
2. **Lists are merged** - `blocked_commands` from both levels are combined
3. **Most restrictive wins for limits** - The smaller `max_file_size` is used

## Examples

### Restrict Writes to Specific Directories

```yaml
permissions:
  read: true
  write:
    - './output/**'
    - './tmp/**'
    - './logs/*.log'
  blocked_paths:
    - '.env'
    - '**/secrets/**'
    - '**/*.key'
```

### Block Dangerous Commands

```yaml
permissions:
  execute: true
  blocked_commands:
    - 'rm -rf'
    - 'sudo *'
    - 'chmod *'
    - 'curl * | bash'
```

### Network Whitelist

```yaml
permissions:
  network: true
  allowed_hosts:
    - 'api.slack.com'
    - '*.github.com'
    - 'hooks.slack.com'
```

### Read-Only Step

```yaml
- id: analyze
  action: agent.chat.completions
  permissions:
    write: false
    execute: false
    network: false
  inputs:
    messages:
      - role: user
        content: "Review this code for security issues"
```
