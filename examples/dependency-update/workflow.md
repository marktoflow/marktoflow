---
workflow:
  id: dependency-update
  name: "Automated Dependency Updates"
  version: "1.0.0"
  description: "Checks for dependency updates and creates PRs with changelogs"
  author: "marktoflow"
  tags:
    - dependencies
    - security
    - maintenance

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported
    - aider: supported

requirements:
  tools:
    - git
    - github
    - npm  # or pip, cargo, etc.
  features:
    - tool_calling: required
    - file_editing: required

triggers:
  - type: schedule
    cron: "0 6 * * 1"  # Every Monday at 6 AM
    timezone: "UTC"

inputs:
  repo:
    type: string
    required: true
    description: "Repository in owner/repo format"
  package_manager:
    type: string
    enum: ["npm", "pip", "cargo", "go"]
    default: "npm"
    description: "Package manager to use"
  update_type:
    type: string
    enum: ["all", "security", "minor", "patch"]
    default: "minor"
    description: "Type of updates to apply"
  auto_merge:
    type: boolean
    default: false
    description: "Automatically merge if CI passes"

outputs:
  pr_url:
    type: string
    description: "URL of the created PR"
  updates_count:
    type: integer
    description: "Number of dependencies updated"
  security_fixes:
    type: integer
    description: "Number of security vulnerabilities fixed"
---

# Automated Dependency Updates

This workflow checks for outdated dependencies, creates a branch with updates,
generates a changelog, and opens a pull request.

## Step 1: Clone Repository

Clone the repository to work with.

```yaml
action: git.clone
inputs:
  repo: "{{ inputs.repo }}"
  depth: 1
output_variable: repo_path
```

## Step 2: Check for Outdated Dependencies

List all outdated dependencies.

```yaml
action: "{{ inputs.package_manager }}.outdated"
inputs:
  path: "{{ repo_path }}"
  format: "json"
output_variable: outdated_deps
```

## Step 3: Check Security Advisories

Check for known security vulnerabilities.

```yaml
action: "{{ inputs.package_manager }}.audit"
inputs:
  path: "{{ repo_path }}"
  format: "json"
output_variable: security_audit
```

## Step 4: Filter Updates

Filter updates based on configuration.

```yaml
action: agent.process
inputs:
  task: "filter_updates"
  data:
    outdated: "{{ outdated_deps }}"
    security: "{{ security_audit }}"
    update_type: "{{ inputs.update_type }}"
  instructions: |
    Filter the dependency updates based on the update_type:
    - "all": Include all updates
    - "security": Only include security fixes
    - "minor": Include minor and patch updates (no major)
    - "patch": Only include patch updates
    
    Return a list of updates to apply with:
    - package name
    - current version
    - target version
    - is_security_fix (boolean)
    - changelog_url if available
output_variable: updates_to_apply
```

## Step 5: Create Update Branch

Create a new branch for the updates.

```yaml
action: git.create_branch
inputs:
  path: "{{ repo_path }}"
  name: "deps/update-{{ now | datetimeformat('%Y%m%d') }}"
  from: "main"
output_variable: branch_name
```

## Step 6: Apply Updates

Apply each dependency update.

```yaml
action: "{{ inputs.package_manager }}.update"
inputs:
  path: "{{ repo_path }}"
  packages: "{{ updates_to_apply | map(attribute='name') | list }}"
output_variable: update_result
```

## Step 7: Generate Changelog

Generate a changelog for the updates.

```yaml
action: agent.generate
inputs:
  task: "changelog"
  data:
    updates: "{{ updates_to_apply }}"
  template: |
    ## Dependency Updates
    
    This PR updates {{ updates | length }} dependencies.
    
    ### Security Fixes
    {% for u in updates if u.is_security_fix %}
    - **{{ u.name }}**: {{ u.current }} → {{ u.target }} (🔒 Security)
    {% else %}
    _No security fixes in this update._
    {% endfor %}
    
    ### Other Updates
    {% for u in updates if not u.is_security_fix %}
    - **{{ u.name }}**: {{ u.current }} → {{ u.target }}
    {% else %}
    _No other updates._
    {% endfor %}
    
    ### Changelogs
    {% for u in updates if u.changelog_url %}
    - [{{ u.name }}]({{ u.changelog_url }})
    {% endfor %}
output_variable: changelog
```

## Step 8: Commit Changes

Commit the updated dependency files.

```yaml
action: git.commit
inputs:
  path: "{{ repo_path }}"
  message: "chore(deps): update {{ updates_to_apply | length }} dependencies"
  files:
    - "package.json"
    - "package-lock.json"
    - "requirements.txt"
    - "Cargo.toml"
    - "Cargo.lock"
    - "go.mod"
    - "go.sum"
output_variable: commit_result
```

## Step 9: Push Branch

Push the update branch to the remote.

```yaml
action: git.push
inputs:
  path: "{{ repo_path }}"
  branch: "{{ branch_name }}"
output_variable: push_result
```

## Step 10: Create Pull Request

Open a PR with the dependency updates.

```yaml
action: github.create_pull_request
inputs:
  repo: "{{ inputs.repo }}"
  title: "chore(deps): Update {{ updates_to_apply | length }} dependencies"
  body: "{{ changelog }}"
  head: "{{ branch_name }}"
  base: "main"
  labels:
    - dependencies
    - automated
  reviewers: []
  draft: false
output_variable: pr_result
```

## Step 11: Enable Auto-Merge

Enable auto-merge if configured and CI passes.

```yaml
action: github.enable_auto_merge
inputs:
  repo: "{{ inputs.repo }}"
  pr_number: "{{ pr_result.number }}"
  merge_method: "squash"
output_variable: auto_merge_result
condition: "inputs.auto_merge == true"
```

## Step 12: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  pr_url: "{{ pr_result.html_url }}"
  updates_count: "{{ updates_to_apply | length }}"
  security_fixes: "{{ updates_to_apply | selectattr('is_security_fix') | list | length }}"
```
