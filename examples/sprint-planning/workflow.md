---
workflow:
  id: sprint-planning
  name: "Sprint Planning Assistant"
  version: "1.0.0"
  description: "Automates sprint planning tasks including capacity planning, story refinement, and sprint creation"
  author: "marktoflow"
  tags:
    - project-management
    - jira
    - agile
    - sprint

compatibility:
  agents:
    - claude-code: recommended
    - opencode: supported

requirements:
  tools:
    - jira
    - confluence
    - slack
  features:
    - tool_calling: required

triggers:
  - type: schedule
    cron: "0 9 * * 1"  # Every Monday at 9 AM
    timezone: "America/New_York"
  - type: webhook
    path: /webhooks/sprint/start
    events:
      - sprint.planning.requested

inputs:
  project_key:
    type: string
    required: true
    description: "JIRA project key (e.g., PROJ)"
  sprint_duration_weeks:
    type: integer
    default: 2
    description: "Sprint duration in weeks"
  team_members:
    type: array
    required: true
    description: "List of team member usernames"
  velocity_sprints:
    type: integer
    default: 3
    description: "Number of past sprints to calculate velocity"
  planning_channel:
    type: string
    default: "#sprint-planning"
    description: "Slack channel for planning updates"

outputs:
  sprint_id:
    type: string
    description: "Created sprint ID"
  sprint_goal:
    type: string
    description: "Generated sprint goal"
  committed_points:
    type: integer
    description: "Total story points committed"
  capacity_percentage:
    type: number
    description: "Team capacity utilization percentage"
---

# Sprint Planning Assistant

This workflow automates the sprint planning process by analyzing team capacity,
calculating velocity, suggesting stories for the sprint, and creating the sprint
in JIRA with appropriate goals and documentation.

## Step 1: Get Backlog Items

Fetch prioritized backlog items ready for sprint planning.

```yaml
action: jira.search
inputs:
  jql: |
    project = {{ inputs.project_key }} 
    AND sprint IS EMPTY 
    AND status = "Ready for Development"
    AND "Story Points" IS NOT EMPTY
    ORDER BY Rank ASC
  fields:
    - summary
    - description
    - issuetype
    - priority
    - customfield_10016  # Story Points
    - labels
    - components
    - assignee
  max_results: 50
output_variable: backlog_items
```

## Step 2: Get Previous Sprint Data

Analyze previous sprints for velocity calculation.

```yaml
action: jira.get_sprints
inputs:
  project: "{{ inputs.project_key }}"
  state: "closed"
  max_results: "{{ inputs.velocity_sprints }}"
output_variable: previous_sprints
```

## Step 3: Calculate Team Velocity

Calculate average velocity from past sprints.

```yaml
action: jira.get_sprint_report
inputs:
  sprint_ids: "{{ previous_sprints | map(attribute='id') | list }}"
output_variable: sprint_reports
```

## Step 4: Get Team Availability

Check team member availability for the upcoming sprint.

```yaml
action: agent.process
inputs:
  task: "calculate_capacity"
  data:
    team_members: "{{ inputs.team_members }}"
    sprint_weeks: "{{ inputs.sprint_duration_weeks }}"
  instructions: |
    Calculate team capacity for the sprint:
    - Standard capacity: 8 hours/day, 5 days/week per person
    - Account for typical meeting overhead (20%)
    - Return total available hours and person-days
output_variable: team_capacity
```

## Step 5: Analyze Velocity and Recommend Commitment

Use AI to analyze velocity trends and recommend sprint commitment.

```yaml
action: agent.analyze
inputs:
  task: "velocity_analysis"
  context:
    sprint_reports: "{{ sprint_reports }}"
    team_capacity: "{{ team_capacity }}"
    backlog: "{{ backlog_items }}"
  instructions: |
    Analyze the team's velocity from past sprints:
    
    1. Calculate average velocity (story points completed)
    2. Identify velocity trends (increasing, stable, decreasing)
    3. Factor in any capacity changes for upcoming sprint
    4. Recommend a sustainable commitment level
    5. Flag any risks or concerns
    
    Return:
    - average_velocity: number
    - velocity_trend: string
    - recommended_points: number
    - confidence: high/medium/low
    - risks: array of strings
output_variable: velocity_analysis
```

## Step 6: Select Stories for Sprint

Recommend stories to include in the sprint based on priority and capacity.

```yaml
action: agent.process
inputs:
  task: "story_selection"
  data:
    backlog: "{{ backlog_items }}"
    recommended_points: "{{ velocity_analysis.recommended_points }}"
    velocity_analysis: "{{ velocity_analysis }}"
  instructions: |
    Select stories for the sprint:
    
    1. Start from top of prioritized backlog
    2. Add stories until reaching recommended points
    3. Consider story dependencies and groupings
    4. Ensure mix of story types if possible
    5. Leave ~10% buffer for unexpected work
    
    Return:
    - selected_stories: array of issue keys
    - total_points: number
    - buffer_points: number
    - groupings: logical groupings of related stories
output_variable: sprint_selection
```

## Step 7: Generate Sprint Goal

Create a meaningful sprint goal based on selected stories.

```yaml
action: agent.generate
inputs:
  task: "sprint_goal"
  data:
    stories: "{{ sprint_selection.selected_stories }}"
    backlog_items: "{{ backlog_items }}"
  template: |
    Based on the selected stories, generate a sprint goal that:
    - Is outcome-focused, not output-focused
    - Is measurable and achievable
    - Communicates value to stakeholders
    - Follows the format: "Enable [users] to [outcome] by [delivering what]"
    
    Also provide:
    - A brief sprint theme (2-3 words)
    - Key deliverables (bullet points)
    - Success criteria
output_variable: sprint_goal_content
```

## Step 8: Create Sprint in JIRA

Create the new sprint with the generated goal.

```yaml
action: jira.create_sprint
inputs:
  project: "{{ inputs.project_key }}"
  name: "Sprint {{ now | datetimeformat('%Y.%m.%d') }}"
  goal: "{{ sprint_goal_content.goal }}"
  start_date: "{{ (now + timedelta(days=1)) | datetimeformat('%Y-%m-%d') }}"
  end_date: "{{ (now + timedelta(weeks=inputs.sprint_duration_weeks)) | datetimeformat('%Y-%m-%d') }}"
output_variable: new_sprint
```

## Step 9: Move Stories to Sprint

Add selected stories to the new sprint.

```yaml
action: jira.move_issues_to_sprint
inputs:
  sprint_id: "{{ new_sprint.id }}"
  issues: "{{ sprint_selection.selected_stories }}"
output_variable: move_result
```

## Step 10: Create Sprint Planning Document

Generate a Confluence page with sprint details.

```yaml
action: confluence.create_page
inputs:
  space: "{{ inputs.project_key }}"
  parent_title: "Sprint Planning"
  title: "Sprint Planning - {{ now | datetimeformat('%Y-%m-%d') }}"
  content: |
    <h1>Sprint Planning Summary</h1>
    
    <h2>Sprint Goal</h2>
    <p><strong>{{ sprint_goal_content.goal }}</strong></p>
    
    <h2>Sprint Theme</h2>
    <p>{{ sprint_goal_content.theme }}</p>
    
    <h2>Key Deliverables</h2>
    <ul>
    {% for item in sprint_goal_content.deliverables %}
      <li>{{ item }}</li>
    {% endfor %}
    </ul>
    
    <h2>Capacity & Commitment</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Team Velocity (Avg)</td><td>{{ velocity_analysis.average_velocity }} pts</td></tr>
      <tr><td>Recommended Commitment</td><td>{{ velocity_analysis.recommended_points }} pts</td></tr>
      <tr><td>Actual Commitment</td><td>{{ sprint_selection.total_points }} pts</td></tr>
      <tr><td>Buffer</td><td>{{ sprint_selection.buffer_points }} pts</td></tr>
      <tr><td>Capacity Utilization</td><td>{{ (sprint_selection.total_points / velocity_analysis.recommended_points * 100) | round }}%</td></tr>
    </table>
    
    <h2>Stories in Sprint</h2>
    <table>
      <tr><th>Key</th><th>Summary</th><th>Points</th><th>Assignee</th></tr>
    {% for story in backlog_items if story.key in sprint_selection.selected_stories %}
      <tr>
        <td><a href="https://jira.company.com/browse/{{ story.key }}">{{ story.key }}</a></td>
        <td>{{ story.summary }}</td>
        <td>{{ story.story_points }}</td>
        <td>{{ story.assignee or 'Unassigned' }}</td>
      </tr>
    {% endfor %}
    </table>
    
    <h2>Risks & Notes</h2>
    <ul>
    {% for risk in velocity_analysis.risks %}
      <li>⚠️ {{ risk }}</li>
    {% endfor %}
    </ul>
    
    <h2>Success Criteria</h2>
    <ul>
    {% for criterion in sprint_goal_content.success_criteria %}
      <li>{{ criterion }}</li>
    {% endfor %}
    </ul>
output_variable: confluence_page
```

## Step 11: Notify Team on Slack

Post sprint planning summary to the team channel.

```yaml
action: slack.post_message
inputs:
  channel: "{{ inputs.planning_channel }}"
  blocks:
    - type: header
      text: ":rocket: Sprint Planning Complete"
    - type: section
      fields:
        - type: mrkdwn
          text: "*Sprint:* {{ new_sprint.name }}"
        - type: mrkdwn
          text: "*Duration:* {{ inputs.sprint_duration_weeks }} weeks"
        - type: mrkdwn
          text: "*Committed:* {{ sprint_selection.total_points }} story points"
        - type: mrkdwn
          text: "*Stories:* {{ sprint_selection.selected_stories | length }}"
    - type: section
      text: "*Sprint Goal:* {{ sprint_goal_content.goal }}"
    - type: divider
    - type: section
      text: "*Key Deliverables:*\n{% for item in sprint_goal_content.deliverables %}• {{ item }}\n{% endfor %}"
    - type: context
      elements:
        - type: mrkdwn
          text: "<{{ confluence_page.url }}|View Sprint Planning Document> | <https://jira.company.com/secure/RapidBoard.jspa?rapidView={{ inputs.project_key }}|Open Sprint Board>"
output_variable: slack_notification
```

## Step 12: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  sprint_id: "{{ new_sprint.id }}"
  sprint_goal: "{{ sprint_goal_content.goal }}"
  committed_points: "{{ sprint_selection.total_points }}"
  capacity_percentage: "{{ (sprint_selection.total_points / velocity_analysis.recommended_points * 100) | round }}"
```
