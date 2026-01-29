---
workflow:
  id: linear-sync
  name: 'Linear Issue Sync'
  version: '2.0.0'
  description: 'Sync Linear issues to other systems or generate reports'
  author: 'marktoflow'
  tags:
    - linear
    - issues
    - sync

tools:
  linear:
    sdk: 'http'
    auth:
      type: 'bearer'
      token: '${LINEAR_API_KEY}'
    options:
      base_url: 'https://api.linear.app'
      headers:
        Content-Type: 'application/json'

triggers:
  - type: manual
  - type: schedule
    config:
      cron: '0 9 * * 1-5'
      timezone: 'America/New_York'

inputs:
  team_key:
    type: string
    required: true
    description: 'Linear team key (e.g., ENG, PROD)'
  status_filter:
    type: array
    default: ['In Progress', 'Todo']
    description: 'Issue statuses to include'

outputs:
  issues:
    type: array
    description: 'List of issues matching criteria'
  issue_count:
    type: number
    description: 'Total number of issues found'
---

# Linear Issue Sync

Fetch and sync Linear issues using the GraphQL API.

## Step 1: Fetch Issues

Query Linear's GraphQL API for team issues.

```yaml
action: http.request
inputs:
  url: 'https://api.linear.app/graphql'
  method: POST
  body:
    query: |
      query TeamIssues($teamKey: String!, $states: [String!]) {
        team(key: $teamKey) {
          id
          name
          issues(filter: { state: { name: { in: $states } } }, first: 50) {
            nodes {
              id
              identifier
              title
              description
              priority
              state {
                name
              }
              assignee {
                name
                email
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    variables:
      teamKey: '{{ inputs.team_key }}'
      states: '{{ inputs.status_filter }}'
output_variable: linear_response
```

## Step 2: Process Issues

```yaml
action: script
inputs:
  code: |
    const team = inputs.linear_response.data?.team;
    if (!team) {
      return { issues: [], count: 0, error: 'Team not found' };
    }

    const issues = team.issues.nodes.map(issue => ({
      id: issue.id,
      key: issue.identifier,
      title: issue.title,
      status: issue.state?.name,
      priority: issue.priority,
      assignee: issue.assignee?.name || 'Unassigned',
      updated: issue.updatedAt
    }));

    return {
      team_name: team.name,
      issues: issues,
      count: issues.length
    };
output_variable: processed
```

## Step 3: Log Summary

```yaml
action: console.log
inputs:
  message: |
    Linear Sync Complete for {{ processed.team_name }}
    Found {{ processed.count }} issues matching status filter
```

## Step 4: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  issues: '{{ processed.issues }}'
  issue_count: '{{ processed.count }}'
```

---

## Setup Instructions

1. **Create Linear API Key:**
   - Go to Linear Settings > API > Personal API keys
   - Create a new key with read access

2. **Set Environment Variable:**
   ```bash
   export LINEAR_API_KEY=lin_api_xxxxx
   ```

3. **Run Workflow:**
   ```bash
   marktoflow run examples/linear-sync/workflow.md \
     --input team_key="ENG"
   ```

## Example: Fetch All In-Progress Issues

```bash
marktoflow run examples/linear-sync/workflow.md \
  --input team_key="ENG" \
  --input status_filter='["In Progress"]'
```

## Example: Daily Standup Report

Schedule this workflow to run daily and sync with Slack:

```yaml
triggers:
  - type: schedule
    config:
      cron: '0 9 * * 1-5'
```

Then add a Slack notification step to post the results.
