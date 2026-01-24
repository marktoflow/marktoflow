---
workflow:
  id: dependency-update
  name: 'Automated Dependency Updates'
  version: '2.0.0'
  description: 'Checks for outdated packages and creates update PRs with changelog'
  author: 'marktoflow'
  tags:
    - dependencies
    - security
    - maintenance

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

  claude:
    sdk: 'claude-code'
    auth:
      api_key: '${ANTHROPIC_API_KEY}'

triggers:
  - type: schedule
    cron: '0 10 * * 1' # 10 AM every Monday
    timezone: 'America/New_York'

inputs:
  repo:
    type: string
    required: true
    description: 'Repository in owner/repo format'
  package_manager:
    type: string
    enum: ['npm', 'yarn', 'pnpm']
    default: 'npm'
    description: 'Package manager to use'
  notification_channel:
    type: string
    default: '#engineering'
    description: 'Slack channel for notifications'

outputs:
  pr_url:
    type: string
    description: 'Created PR URL'
  updates_count:
    type: integer
    description: 'Number of packages updated'
---

# Automated Dependency Updates

This workflow checks for outdated npm packages, analyzes security vulnerabilities, creates an update branch, and opens a PR with a comprehensive changelog.

## Step 1: Get Repository

Fetch repository details.

```yaml
action: github.repos.get
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
output_variable: repo_details
```

## Step 2: Get Current package.json

Fetch the current package.json file.

```yaml
action: github.repos.getContent
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  path: 'package.json'
output_variable: package_json_content
```

## Step 3: Analyze Outdated Packages

Use Claude to analyze which packages should be updated.

````yaml
action: claude.chat.completions
inputs:
  model: 'claude-3-5-sonnet-20241022'
  messages:
    - role: 'user'
      content: |
        Analyze the following package.json and identify packages that should be updated:

        ```json
        {{ Buffer.from(package_json_content.data.content, 'base64').toString() }}
        ```

        Provide a JSON response with:
        {
          "updates": [
            {
              "package": "package-name",
              "current": "1.0.0",
              "latest": "1.1.0",
              "type": "minor|major|patch",
              "breaking": boolean,
              "security": boolean,
              "priority": "high|medium|low"
            }
          ],
          "summary": "Overall recommendation"
        }
output_variable: update_analysis
````

## Step 4: Create Update Branch

Create a new branch for the updates.

```yaml
action: github.git.createRef
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  ref: 'refs/heads/deps/update-{{ Date.now() }}'
  sha: '{{ repo_details.data.default_branch.sha }}'
output_variable: update_branch
```

## Step 5: Generate Updated package.json

Use script to update package versions.

```yaml
action: script
inputs:
  code: |
    const pkg = JSON.parse(Buffer.from(context.package_json_content.data.content, 'base64').toString());
    const updates = JSON.parse(context.update_analysis).updates;

    for (const update of updates) {
      if (update.priority !== 'low' && !update.breaking) {
        if (pkg.dependencies && pkg.dependencies[update.package]) {
          pkg.dependencies[update.package] = `^${update.latest}`;
        }
        if (pkg.devDependencies && pkg.devDependencies[update.package]) {
          pkg.devDependencies[update.package] = `^${update.latest}`;
        }
      }
    }

    return {
      updated_content: Buffer.from(JSON.stringify(pkg, null, 2)).toString('base64'),
      update_count: updates.filter(u => u.priority !== 'low' && !u.breaking).length
    };
output_variable: updated_package
```

## Step 6: Commit Updated package.json

Commit the changes to the new branch.

```yaml
action: github.repos.createOrUpdateFileContents
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  path: 'package.json'
  message: 'chore(deps): update dependencies'
  content: '{{ updated_package.updated_content }}'
  branch: "{{ update_branch.data.ref.split('/').pop() }}"
output_variable: commit_result
```

## Step 7: Generate Changelog

Create a comprehensive changelog using Claude.

```yaml
action: claude.chat.completions
inputs:
  model: 'claude-3-5-sonnet-20241022'
  messages:
    - role: 'user'
      content: |
        Generate a changelog for these dependency updates:

        {{ update_analysis | json }}

        Format as a markdown document with:
        - Summary of changes
        - Breaking changes (if any)
        - Security fixes
        - New features
        - Bug fixes
        - Grouped by package type
output_variable: changelog
```

## Step 8: Create Pull Request

Open a PR with the updates.

```yaml
action: github.pulls.create
inputs:
  owner: "{{ inputs.repo.split('/')[0] }}"
  repo: "{{ inputs.repo.split('/')[1] }}"
  title: 'chore(deps): update dependencies - {{ updated_package.update_count }} packages'
  head: "{{ update_branch.data.ref.split('/').pop() }}"
  base: '{{ repo_details.data.default_branch }}'
  body: |
    ## 📦 Dependency Updates

    This PR updates {{ updated_package.update_count }} packages to their latest compatible versions.

    {{ changelog }}

    ## ✅ Checklist

    - [ ] All tests pass
    - [ ] No breaking changes
    - [ ] Security vulnerabilities addressed

    ---
    *Generated by marktoflow v2.0*
output_variable: pull_request
```

## Step 9: Notify Team

Post notification to Slack.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ inputs.notification_channel }}'
  text: 'Dependency Update PR Created'
  blocks:
    - type: header
      text:
        type: plain_text
        text: '📦 Dependency Update PR'
    - type: section
      text:
        type: mrkdwn
        text: |
          *Repository:* {{ inputs.repo }}
          *Updates:* {{ updated_package.update_count }} packages
          *PR:* <{{ pull_request.data.html_url }}|#{{ pull_request.data.number }}>
    - type: actions
      elements:
        - type: button
          text:
            type: plain_text
            text: 'Review PR'
          url: '{{ pull_request.data.html_url }}'
          style: 'primary'
output_variable: notification
```

## Step 10: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  pr_url: '{{ pull_request.data.html_url }}'
  updates_count: '{{ updated_package.update_count }}'
```
