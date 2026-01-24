---
workflow:
  id: sprint-planning
  name: 'Automated Sprint Planning'
  version: '2.0.0'
  description: 'Automates sprint planning with velocity analysis and story selection'
  author: 'marktoflow'
  tags:
    - agile
    - planning
    - jira

tools:
  jira:
    sdk: 'jira.js'
    auth:
      host: '${JIRA_HOST}'
      email: '${JIRA_EMAIL}'
      apiToken: '${JIRA_API_TOKEN}'

  confluence:
    sdk: 'confluence'
    auth:
      host: '${CONFLUENCE_HOST}'
      username: '${CONFLUENCE_EMAIL}'
      apiToken: '${CONFLUENCE_API_TOKEN}'

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
    cron: '0 14 * * 5' # 2 PM every Friday
    timezone: 'America/New_York'

inputs:
  project_key:
    type: string
    required: true
    description: 'Jira project key'
  team_members:
    type: array
    required: true
    description: 'List of team member names'
  sprint_duration:
    type: integer
    default: 14
    description: 'Sprint duration in days'
  team_channel:
    type: string
    default: '#engineering'
    description: 'Slack channel to notify'

outputs:
  sprint_id:
    type: string
    description: 'Created sprint ID'
  selected_stories:
    type: integer
    description: 'Number of stories selected'
  estimated_points:
    type: integer
    description: 'Total story points'
---

# Automated Sprint Planning

This workflow analyzes past sprint velocity, selects appropriate stories for the upcoming sprint, and documents the sprint plan in Confluence.

## Step 1: Analyze Team Velocity

Get completed story points from the last 3 sprints.

```yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: 'project = {{ inputs.project_key }} AND sprint in closedSprints() ORDER BY sprint DESC'
  fields:
    - customfield_10016 # Story points
    - sprint
    - status
  maxResults: 100
output_variable: past_sprints
```

## Step 2: Calculate Average Velocity

Use Claude to analyze velocity trends.

```yaml
action: claude.chat.completions
inputs:
  model: 'claude-3-5-sonnet-20241022'
  messages:
    - role: 'user'
      content: |
        Analyze the following sprint data and calculate the team's average velocity:

        {{ past_sprints.issues | json }}

        Provide a JSON response with:
        {
          "average_velocity": number,
          "velocity_trend": "increasing|stable|decreasing",
          "recommended_capacity": number,
          "confidence": "high|medium|low"
        }
output_variable: velocity_analysis
```

## Step 3: Get Backlog Stories

Fetch prioritized backlog items.

```yaml
action: jira.issueSearch.searchForIssuesUsingJql
inputs:
  jql: "project = {{ inputs.project_key }} AND status = 'To Do' AND sprint is EMPTY ORDER BY priority DESC, created ASC"
  fields:
    - summary
    - description
    - customfield_10016 # Story points
    - priority
  maxResults: 50
output_variable: backlog_stories
```

## Step 4: Select Stories for Sprint

Use AI to select appropriate stories based on capacity.

```yaml
action: claude.chat.completions
inputs:
  model: 'claude-3-5-sonnet-20241022'
  messages:
    - role: 'user'
      content: |
        Select stories for the upcoming sprint based on:

        **Team Capacity:** {{ velocity_analysis.recommended_capacity }} points
        **Available Stories:**
        {% for story in backlog_stories.issues %}
        - [{{ story.key }}] {{ story.fields.summary }} ({{ story.fields.customfield_10016 || '?' }} points)
        {% endfor %}

        Select stories that:
        1. Fit within the capacity
        2. Are highest priority
        3. Have clear story points
        4. Balance different types of work

        Return JSON: { "selected_keys": ["KEY-1", "KEY-2"], "total_points": number, "rationale": "..." }
output_variable: selected_stories
```

## Step 5: Create New Sprint

Create the sprint in Jira.

```yaml
action: jira.sprints.createSprint
inputs:
  name: 'Sprint {{ Date.now() }}'
  startDate: '{{ new Date().toISOString() }}'
  endDate: '{{ new Date(Date.now() + inputs.sprint_duration * 24 * 60 * 60 * 1000).toISOString() }}'
  originBoardId: '${JIRA_BOARD_ID}'
output_variable: new_sprint
```

## Step 6: Add Stories to Sprint

Move selected stories to the sprint.

```yaml
action: jira.sprints.moveIssuesToSprintAndRank
inputs:
  sprintId: '{{ new_sprint.id }}'
  issues: '{{ selected_stories.selected_keys }}'
output_variable: sprint_update
```

## Step 7: Create Confluence Sprint Doc

Document the sprint plan.

```yaml
action: confluence.createPage
inputs:
  spaceKey: 'ENG'
  title: 'Sprint {{ new_sprint.name }} - Planning'
  body:
    storage:
      value: |
        <h2>Sprint Goal</h2>
        <p>{{ selected_stories.rationale }}</p>

        <h2>Capacity</h2>
        <p>Average Velocity: {{ velocity_analysis.average_velocity }} points</p>
        <p>Planned: {{ selected_stories.total_points }} points</p>

        <h2>Selected Stories</h2>
        <ul>
        {% for key in selected_stories.selected_keys %}
        <li><ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">{{ key }}</ac:parameter></ac:structured-macro></li>
        {% endfor %}
        </ul>
      representation: 'storage'
output_variable: confluence_page
```

## Step 8: Notify Team

Post sprint plan to Slack.

```yaml
action: slack.chat.postMessage
inputs:
  channel: '{{ inputs.team_channel }}'
  text: 'Sprint Planning Complete'
  blocks:
    - type: header
      text:
        type: plain_text
        text: '🎯 {{ new_sprint.name }} Planning Complete'
    - type: section
      fields:
        - type: mrkdwn
          text: "*Stories:*\n{{ selected_stories.selected_keys.length }}"
        - type: mrkdwn
          text: "*Points:*\n{{ selected_stories.total_points }}"
        - type: mrkdwn
          text: "*Duration:*\n{{ inputs.sprint_duration }} days"
        - type: mrkdwn
          text: "*Velocity:*\n{{ velocity_analysis.velocity_trend }}"
    - type: actions
      elements:
        - type: button
          text:
            type: plain_text
            text: 'View Sprint in Jira'
          url: '{{ new_sprint.self }}'
        - type: button
          text:
            type: plain_text
            text: 'View Planning Doc'
          url: '{{ confluence_page._links.webui }}'
output_variable: notification
```

## Step 9: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  sprint_id: '{{ new_sprint.id }}'
  selected_stories: '{{ selected_stories.selected_keys.length }}'
  estimated_points: '{{ selected_stories.total_points }}'
```
