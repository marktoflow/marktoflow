# Service Integrations API Reference

Complete API reference for all 30+ service integrations in marktoflow.

---

## Table of Contents

### Communication & Collaboration
- [Slack](#slack)
- [Discord](#discord)
- [Telegram](#telegram)
- [WhatsApp](#whatsapp)

### Email & Calendar
- [Gmail](#gmail)
- [Outlook](#outlook)
- [Google Calendar](#google-calendar)

### Project Management
- [Jira](#jira)
- [Linear](#linear)
- [GitHub](#github)

### Documentation & Knowledge
- [Notion](#notion)
- [Confluence](#confluence)
- [Google Docs](#google-docs)

### Data & Storage
- [Airtable](#airtable)
- [Google Sheets](#google-sheets)
- [Google Drive](#google-drive)
- [Supabase](#supabase)

### Databases
- [PostgreSQL](#postgresql)
- [MySQL](#mysql)

### APIs & HTTP
- [HTTP / GraphQL](#http--graphql)

### Browser Automation
- [Playwright](#playwright)

---

## Slack

Slack workspace integration using the Slack Web API.

### Configuration

```yaml
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: ${SLACK_BOT_TOKEN}
```

**Required Scopes:** `chat:write`, `channels:read`, `users:read` (varies by action)

### Actions

All methods from the Slack Web API SDK are available. Common actions:

#### `slack.chat.postMessage`

Post a message to a channel.

```yaml
action: slack.chat.postMessage
inputs:
  channel: string          # Required: Channel ID or name (#channel)
  text: string             # Required: Message text
  blocks: object[]         # Optional: Block Kit blocks
  thread_ts: string        # Optional: Thread timestamp
  reply_broadcast: boolean # Optional: Broadcast reply to channel
  attachments: object[]    # Optional: Legacy attachments
  link_names: boolean      # Optional: Link channel/user names
  mrkdwn: boolean         # Optional: Enable markdown (default: true)
  unfurl_links: boolean   # Optional: Unfurl links
  unfurl_media: boolean   # Optional: Unfurl media
```

**Example:**

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#general"
  text: "Deployment completed successfully! :rocket:"
  blocks:
    - type: section
      text:
        type: mrkdwn
        text: "*Deployment Status*\nEnvironment: Production\nVersion: v2.0.1"
output_variable: slack_response
```

#### `slack.chat.update`

Update an existing message.

```yaml
action: slack.chat.update
inputs:
  channel: string          # Required: Channel ID
  ts: string               # Required: Message timestamp
  text: string             # Optional: New message text
  blocks: object[]         # Optional: New blocks
```

#### `slack.chat.delete`

Delete a message.

```yaml
action: slack.chat.delete
inputs:
  channel: string          # Required: Channel ID
  ts: string               # Required: Message timestamp
```

#### `slack.users.info`

Get user information.

```yaml
action: slack.users.info
inputs:
  user: string             # Required: User ID
```

#### `slack.conversations.list`

List channels.

```yaml
action: slack.conversations.list
inputs:
  types: string            # Optional: Channel types (e.g., "public_channel,private_channel")
  exclude_archived: boolean # Optional: Exclude archived channels
  limit: number            # Optional: Max results (default: 100)
```

#### `slack.files.uploadV2`

Upload a file.

```yaml
action: slack.files.uploadV2
inputs:
  file: string             # Required: File path or Buffer
  filename: string         # Optional: Filename
  title: string            # Optional: File title
  channel_id: string       # Optional: Channel to share in
  initial_comment: string  # Optional: Message with file
```

---

## Discord

Discord bot integration using Discord API v10.

### Configuration

```yaml
tools:
  discord:
    sdk: discord
    auth:
      token: ${DISCORD_BOT_TOKEN}
      is_bot: true           # Optional: true for bot tokens (default)
```

### Actions

#### `discord.sendMessage`

Send a message to a channel.

```yaml
action: discord.sendMessage
inputs:
  channel_id: string       # Required: Channel ID
  content: string          # Optional: Message content
  embeds: object[]         # Optional: Message embeds
  components: object[]     # Optional: Message components (buttons, etc.)
  files: object[]          # Optional: File attachments
  tts: boolean             # Optional: Text-to-speech
  allowed_mentions: object # Optional: Allowed mentions config
```

**Example:**

```yaml
action: discord.sendMessage
inputs:
  channel_id: "123456789"
  content: "Deployment complete!"
  embeds:
    - title: "Deployment Status"
      description: "Version 2.0.1 deployed to production"
      color: 3066993  # Green
      fields:
        - name: "Environment"
          value: "Production"
          inline: true
        - name: "Status"
          value: "✅ Success"
          inline: true
```

#### `discord.editMessage`

Edit an existing message.

```yaml
action: discord.editMessage
inputs:
  channel_id: string       # Required: Channel ID
  message_id: string       # Required: Message ID
  content: string          # Optional: New content
  embeds: object[]         # Optional: New embeds
```

#### `discord.deleteMessage`

Delete a message.

```yaml
action: discord.deleteMessage
inputs:
  channel_id: string       # Required: Channel ID
  message_id: string       # Required: Message ID
```

#### `discord.getMessages`

Get channel messages.

```yaml
action: discord.getMessages
inputs:
  channel_id: string       # Required: Channel ID
  limit: number            # Optional: Max messages (1-100, default: 50)
  before: string           # Optional: Get messages before this ID
  after: string            # Optional: Get messages after this ID
```

#### `discord.addReaction`

Add emoji reaction to message.

```yaml
action: discord.addReaction
inputs:
  channel_id: string       # Required: Channel ID
  message_id: string       # Required: Message ID
  emoji: string            # Required: Emoji (e.g., "👍" or "custom_emoji:123")
```

#### `discord.createThread`

Create a thread from message.

```yaml
action: discord.createThread
inputs:
  channel_id: string       # Required: Channel ID
  name: string             # Required: Thread name
  auto_archive_duration: number # Optional: Minutes (60, 1440, 4320, 10080)
  type: number             # Optional: Thread type
  invitable: boolean       # Optional: Allow non-moderators to add users
```

---

## Gmail

Gmail integration using Google APIs.

### Configuration

```yaml
tools:
  gmail:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

**Setup:** Run `npx marktoflow connect gmail` for OAuth flow.

### Actions

#### `gmail.sendEmail`

Send an email.

```yaml
action: gmail.sendEmail
inputs:
  to: string | string[]    # Required: Recipient(s)
  subject: string          # Required: Email subject
  body: string             # Required: Email body
  cc: string | string[]    # Optional: CC recipients
  bcc: string | string[]   # Optional: BCC recipients
  from: string             # Optional: From address
  attachments: object[]    # Optional: File attachments
  html: boolean            # Optional: Body is HTML (default: false)
```

**Example:**

```yaml
action: gmail.sendEmail
inputs:
  to: ["user@example.com", "admin@example.com"]
  subject: "Weekly Report"
  body: |
    Hello team,

    Here's the weekly report...
  cc: "manager@example.com"
  html: false
```

#### `gmail.getEmails`

Get emails with filters.

```yaml
action: gmail.getEmails
inputs:
  max_results: number      # Optional: Max emails (default: 10)
  query: string            # Optional: Gmail search query
  label_ids: string[]      # Optional: Filter by labels
  include_spam_trash: boolean # Optional: Include spam/trash
```

**Example:**

```yaml
action: gmail.getEmails
inputs:
  max_results: 50
  query: "is:unread from:github.com subject:pull request"
  label_ids: ["INBOX"]
output_variable: github_emails
```

#### `gmail.getEmail`

Get specific email by ID.

```yaml
action: gmail.getEmail
inputs:
  id: string               # Required: Email ID
  format: string           # Optional: Format (full, metadata, minimal, raw)
```

#### `gmail.markAsRead` / `gmail.markAsUnread`

Mark email as read/unread.

```yaml
action: gmail.markAsRead
inputs:
  id: string               # Required: Email ID
```

#### `gmail.addLabels` / `gmail.removeLabels`

Manage email labels.

```yaml
action: gmail.addLabels
inputs:
  id: string               # Required: Email ID
  label_ids: string[]      # Required: Label IDs to add
```

#### `gmail.trash` / `gmail.delete`

Move to trash or permanently delete.

```yaml
action: gmail.trash
inputs:
  id: string               # Required: Email ID
```

#### `gmail.createDraft`

Create email draft.

```yaml
action: gmail.createDraft
inputs:
  to: string | string[]    # Required: Recipients
  subject: string          # Required: Subject
  body: string             # Required: Body
  cc: string | string[]    # Optional: CC
  bcc: string | string[]   # Optional: BCC
```

#### `gmail.listLabels`

List all labels.

```yaml
action: gmail.listLabels
inputs: {}
```

---

## Outlook

Microsoft Outlook/Office 365 integration.

### Configuration

```yaml
tools:
  outlook:
    sdk: '@microsoft/microsoft-graph-client'
    auth:
      token: ${MICROSOFT_GRAPH_TOKEN}
```

**Setup:** Requires Microsoft Graph API access token.

### Email Actions

#### `outlook.sendEmail`

Send an email.

```yaml
action: outlook.sendEmail
inputs:
  to: string | string[]    # Required: Recipients
  subject: string          # Required: Subject
  body: string             # Required: Body
  body_type: string        # Optional: "text" or "html" (default: "text")
  cc: string | string[]    # Optional: CC
  bcc: string | string[]   # Optional: BCC
  attachments: object[]    # Optional: Attachments
  importance: string       # Optional: "low", "normal", "high"
```

#### `outlook.getEmails`

Get emails.

```yaml
action: outlook.getEmails
inputs:
  folder: string           # Optional: Folder name (default: "inbox")
  top: number              # Optional: Max results (default: 10)
  filter: string           # Optional: OData filter
  select: string[]         # Optional: Fields to select
```

#### `outlook.reply`

Reply to email.

```yaml
action: outlook.reply
inputs:
  message_id: string       # Required: Message ID
  body: string             # Required: Reply body
  body_type: string        # Optional: "text" or "html"
  reply_all: boolean       # Optional: Reply to all (default: false)
```

#### `outlook.forward`

Forward email.

```yaml
action: outlook.forward
inputs:
  message_id: string       # Required: Message ID
  to: string | string[]    # Required: Recipients
  comment: string          # Optional: Forward comment
```

### Calendar Actions

#### `outlook.createEvent`

Create calendar event.

```yaml
action: outlook.createEvent
inputs:
  subject: string          # Required: Event subject
  start: string            # Required: Start time (ISO 8601)
  end: string              # Required: End time (ISO 8601)
  body: string             # Optional: Event description
  location: string         # Optional: Location
  attendees: string[]      # Optional: Attendee emails
  is_online_meeting: boolean # Optional: Create Teams meeting
  reminder_minutes: number # Optional: Reminder time
```

**Example:**

```yaml
action: outlook.createEvent
inputs:
  subject: "Team Standup"
  start: "2024-01-15T09:00:00Z"
  end: "2024-01-15T09:30:00Z"
  attendees:
    - "alice@company.com"
    - "bob@company.com"
  is_online_meeting: true
  reminder_minutes: 15
```

#### `outlook.getEvents`

Get calendar events.

```yaml
action: outlook.getEvents
inputs:
  start_date: string       # Optional: Filter start
  end_date: string         # Optional: Filter end
  top: number              # Optional: Max results
```

---

## Jira

Jira project management integration.

### Configuration

```yaml
tools:
  jira:
    sdk: jira.js
    auth:
      host: https://company.atlassian.net
      email: user@company.com
      api_token: ${JIRA_API_TOKEN}
```

### Actions

All Jira REST API v3 methods are available through the Version3Client. Common actions:

#### `jira.issues.createIssue`

Create a Jira issue.

```yaml
action: jira.issues.createIssue
inputs:
  fields:
    project:
      key: string          # Required: Project key
    summary: string        # Required: Issue summary
    description: string    # Optional: Issue description
    issuetype:
      name: string         # Required: Issue type (Bug, Task, Story, etc.)
    priority:
      name: string         # Optional: Priority
    labels: string[]       # Optional: Labels
    assignee:
      accountId: string    # Optional: Assignee account ID
```

**Example:**

```yaml
action: jira.issues.createIssue
inputs:
  fields:
    project:
      key: "PROJ"
    summary: "Fix login bug"
    description: "Users cannot log in with SSO"
    issuetype:
      name: "Bug"
    priority:
      name: "High"
    labels: ["backend", "urgent"]
output_variable: jira_issue
```

#### `jira.issues.getIssue`

Get issue details.

```yaml
action: jira.issues.getIssue
inputs:
  issueIdOrKey: string     # Required: Issue ID or key
  fields: string[]         # Optional: Fields to retrieve
  expand: string[]         # Optional: Additional data to expand
```

#### `jira.issues.updateIssue`

Update an issue.

```yaml
action: jira.issues.updateIssue
inputs:
  issueIdOrKey: string     # Required: Issue ID or key
  fields:
    summary: string        # Optional: New summary
    description: string    # Optional: New description
    assignee:
      accountId: string    # Optional: New assignee
```

#### `jira.issues.addComment`

Add comment to issue.

```yaml
action: jira.issues.addComment
inputs:
  issueIdOrKey: string     # Required: Issue ID or key
  body: string             # Required: Comment text
```

#### `jira.search.searchForIssuesUsingJql`

Search issues with JQL.

```yaml
action: jira.search.searchForIssuesUsingJql
inputs:
  jql: string              # Required: JQL query
  maxResults: number       # Optional: Max results (default: 50)
  fields: string[]         # Optional: Fields to return
```

**Example:**

```yaml
action: jira.search.searchForIssuesUsingJql
inputs:
  jql: "project = PROJ AND status = 'In Progress' AND assignee = currentUser()"
  maxResults: 100
  fields: ["summary", "status", "assignee", "created"]
output_variable: my_issues
```

---

## Linear

Linear project management integration.

### Configuration

```yaml
tools:
  linear:
    sdk: linear
    auth:
      api_key: ${LINEAR_API_KEY}
```

### Actions

#### `linear.createIssue`

Create an issue.

```yaml
action: linear.createIssue
inputs:
  team_id: string          # Required: Team ID
  title: string            # Required: Issue title
  description: string      # Optional: Issue description
  priority: number         # Optional: Priority (0-4)
  state_id: string         # Optional: Workflow state ID
  assignee_id: string      # Optional: Assignee ID
  label_ids: string[]      # Optional: Label IDs
  project_id: string       # Optional: Project ID
  estimate: number         # Optional: Estimate (story points)
  due_date: string         # Optional: Due date (ISO 8601)
```

**Example:**

```yaml
action: linear.createIssue
inputs:
  team_id: "{{linear_team_id}}"
  title: "Implement user authentication"
  description: "Add OAuth2 authentication flow"
  priority: 2  # High
  estimate: 5
  label_ids: ["backend", "security"]
output_variable: linear_issue
```

#### `linear.getIssue`

Get issue details.

```yaml
action: linear.getIssue
inputs:
  id: string               # Required: Issue ID or identifier (e.g., "PROJ-123")
```

#### `linear.updateIssue`

Update an issue.

```yaml
action: linear.updateIssue
inputs:
  issue_id: string         # Required: Issue ID
  title: string            # Optional: New title
  description: string      # Optional: New description
  state_id: string         # Optional: New state
  priority: number         # Optional: New priority
  assignee_id: string      # Optional: New assignee
```

#### `linear.searchIssues`

Search issues.

```yaml
action: linear.searchIssues
inputs:
  team_id: string          # Optional: Filter by team
  assignee_id: string      # Optional: Filter by assignee
  state_id: string         # Optional: Filter by state
  label_ids: string[]      # Optional: Filter by labels
  first: number            # Optional: Max results (default: 50)
```

#### `linear.addComment`

Add comment to issue.

```yaml
action: linear.addComment
inputs:
  issue_id: string         # Required: Issue ID
  body: string             # Required: Comment text
```

#### `linear.listTeams`

List all teams.

```yaml
action: linear.listTeams
inputs: {}
```

#### `linear.listProjects`

List projects.

```yaml
action: linear.listProjects
inputs:
  team_id: string          # Optional: Filter by team
```

---

## GitHub

GitHub integration using Octokit REST API.

### Configuration

```yaml
tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: ${GITHUB_TOKEN}   # Optional: Required for private repos
```

### Actions

All Octokit REST API methods are available. Common actions:

#### `github.repos.get`

Get repository information.

```yaml
action: github.repos.get
inputs:
  owner: string            # Required: Repository owner
  repo: string             # Required: Repository name
```

#### `github.issues.create`

Create an issue.

```yaml
action: github.issues.create
inputs:
  owner: string            # Required: Repository owner
  repo: string             # Required: Repository name
  title: string            # Required: Issue title
  body: string             # Optional: Issue description
  assignees: string[]      # Optional: Assignee usernames
  labels: string[]         # Optional: Label names
  milestone: number        # Optional: Milestone number
```

**Example:**

```yaml
action: github.issues.create
inputs:
  owner: "company"
  repo: "project"
  title: "Bug: Login fails on mobile"
  body: "**Description:**\nUsers report login issues on mobile devices\n\n**Steps to reproduce:**\n1. Open app\n2. Enter credentials\n3. Click login"
  labels: ["bug", "mobile", "priority:high"]
  assignees: ["developer1"]
output_variable: github_issue
```

#### `github.pulls.create`

Create a pull request.

```yaml
action: github.pulls.create
inputs:
  owner: string            # Required: Repository owner
  repo: string             # Required: Repository name
  title: string            # Required: PR title
  head: string             # Required: Branch with changes
  base: string             # Required: Base branch (e.g., "main")
  body: string             # Optional: PR description
  draft: boolean           # Optional: Create as draft
```

#### `github.repos.createRelease`

Create a release.

```yaml
action: github.repos.createRelease
inputs:
  owner: string            # Required: Repository owner
  repo: string             # Required: Repository name
  tag_name: string         # Required: Tag name
  name: string             # Optional: Release name
  body: string             # Optional: Release notes
  draft: boolean           # Optional: Create as draft
  prerelease: boolean      # Optional: Mark as prerelease
```

#### `github.actions.listWorkflowRuns`

List workflow runs.

```yaml
action: github.actions.listWorkflowRuns
inputs:
  owner: string            # Required: Repository owner
  repo: string             # Required: Repository name
  workflow_id: string      # Required: Workflow ID or filename
  status: string           # Optional: Filter by status
  per_page: number         # Optional: Results per page
```

---

## Notion

Notion workspace integration.

### Configuration

```yaml
tools:
  notion:
    sdk: notion
    auth:
      token: ${NOTION_TOKEN}  # Integration token
```

### Actions

#### `notion.createPage`

Create a page.

```yaml
action: notion.createPage
inputs:
  parent:
    type: string           # Required: "database_id" or "page_id"
    database_id: string    # Required if type is "database_id"
    page_id: string        # Required if type is "page_id"
  properties:              # Required: Page properties (database-specific)
    Name:
      title:
        - text:
            content: string
  children: object[]       # Optional: Page content blocks
```

**Example:**

```yaml
action: notion.createPage
inputs:
  parent:
    type: "database_id"
    database_id: "{{notion_db_id}}"
  properties:
    Name:
      title:
        - text:
            content: "New Task"
    Status:
      select:
        name: "In Progress"
  children:
    - object: "block"
      type: "paragraph"
      paragraph:
        rich_text:
          - type: "text"
            text:
              content: "Task description here..."
output_variable: notion_page
```

#### `notion.getPage`

Get page details.

```yaml
action: notion.getPage
inputs:
  page_id: string          # Required: Page ID
```

#### `notion.updatePage`

Update a page.

```yaml
action: notion.updatePage
inputs:
  page_id: string          # Required: Page ID
  properties:              # Optional: Properties to update
    Status:
      select:
        name: string
```

#### `notion.queryDatabase`

Query database.

```yaml
action: notion.queryDatabase
inputs:
  database_id: string      # Required: Database ID
  filter: object           # Optional: Filter conditions
  sorts: object[]          # Optional: Sort conditions
  page_size: number        # Optional: Results per page (max: 100)
```

**Example:**

```yaml
action: notion.queryDatabase
inputs:
  database_id: "{{tasks_db}}"
  filter:
    property: "Status"
    select:
      equals: "In Progress"
  sorts:
    - property: "Created"
      direction: "descending"
  page_size: 50
output_variable: active_tasks
```

#### `notion.appendBlocks`

Append blocks to page.

```yaml
action: notion.appendBlocks
inputs:
  page_id: string          # Required: Page ID
  blocks: object[]         # Required: Blocks to append
```

#### `notion.search`

Search workspace.

```yaml
action: notion.search
inputs:
  query: string            # Optional: Search query
  filter: object           # Optional: Filter by type
  sort: object             # Optional: Sort options
  page_size: number        # Optional: Results per page
```

---

## Confluence

Atlassian Confluence integration.

### Configuration

```yaml
tools:
  confluence:
    sdk: confluence
    auth:
      host: https://company.atlassian.net
      email: user@company.com
      api_token: ${CONFLUENCE_API_TOKEN}
```

### Actions

#### `confluence.createPage`

Create a page.

```yaml
action: confluence.createPage
inputs:
  space_id: string         # Required: Space ID
  title: string            # Required: Page title
  body:                    # Required: Page content
    value: string          # HTML content
    representation: string # Optional: "storage" (default) or "atlas_doc_format"
  parent_id: string        # Optional: Parent page ID
  status: string           # Optional: "current" or "draft" (default: "current")
```

**Example:**

```yaml
action: confluence.createPage
inputs:
  space_id: "{{confluence_space}}"
  title: "API Documentation"
  body:
    value: "<h1>Overview</h1><p>API documentation content...</p>"
    representation: "storage"
  parent_id: "{{parent_page_id}}"
output_variable: confluence_page
```

#### `confluence.getPage`

Get page details.

```yaml
action: confluence.getPage
inputs:
  page_id: string          # Required: Page ID
  include_body: boolean    # Optional: Include page content (default: false)
```

#### `confluence.updatePage`

Update a page.

```yaml
action: confluence.updatePage
inputs:
  page_id: string          # Required: Page ID
  title: string            # Optional: New title
  body:                    # Optional: New content
    value: string
    representation: string
  version:                 # Required: Version info
    number: number         # Increment from current version
```

#### `confluence.appendToPage`

Append content to page.

```yaml
action: confluence.appendToPage
inputs:
  page_id: string          # Required: Page ID
  content: string          # Required: HTML content to append
  body_format: string      # Optional: "storage" (default) or "atlas_doc_format"
```

#### `confluence.search`

Search Confluence.

```yaml
action: confluence.search
inputs:
  cql: string              # Required: CQL (Confluence Query Language)
  limit: number            # Optional: Max results (default: 25)
  start: number            # Optional: Offset for pagination
```

**Example:**

```yaml
action: confluence.search
inputs:
  cql: "space = DOCS AND type = page AND title ~ 'API'"
  limit: 50
output_variable: search_results
```

#### `confluence.addComment`

Add comment to page.

```yaml
action: confluence.addComment
inputs:
  page_id: string          # Required: Page ID
  body: string             # Required: Comment text
  body_format: string      # Optional: "storage" (default) or "atlas_doc_format"
```

---

## Airtable

Airtable database integration.

### Configuration

```yaml
tools:
  airtable:
    sdk: airtable
    auth:
      token: ${AIRTABLE_TOKEN}
      base_id: ${AIRTABLE_BASE_ID}  # Optional: Default base
```

### Actions

#### `airtable.listRecords`

List records from table.

```yaml
action: airtable.listRecords
inputs:
  table: string            # Required: Table name or ID
  base_id: string          # Optional: Base ID (overrides default)
  filter_by_formula: string # Optional: Airtable formula
  sort: object[]           # Optional: Sort configuration
  fields: string[]         # Optional: Fields to return
  max_records: number      # Optional: Max records
  view: string             # Optional: View name
```

**Example:**

```yaml
action: airtable.listRecords
inputs:
  table: "Tasks"
  filter_by_formula: "AND({Status} = 'In Progress', {Priority} = 'High')"
  sort:
    - field: "Due Date"
      direction: "asc"
  fields: ["Name", "Status", "Assignee", "Due Date"]
  max_records: 100
output_variable: high_priority_tasks
```

#### `airtable.getRecord`

Get a specific record.

```yaml
action: airtable.getRecord
inputs:
  table: string            # Required: Table name or ID
  record_id: string        # Required: Record ID
  base_id: string          # Optional: Base ID
```

#### `airtable.createRecord`

Create a record.

```yaml
action: airtable.createRecord
inputs:
  table: string            # Required: Table name or ID
  fields:                  # Required: Record fields
    <field_name>: any
  base_id: string          # Optional: Base ID
```

**Example:**

```yaml
action: airtable.createRecord
inputs:
  table: "Tasks"
  fields:
    Name: "Implement new feature"
    Status: "To Do"
    Priority: "High"
    Assignee: ["user@company.com"]
    Due Date: "2024-02-01"
output_variable: new_task
```

#### `airtable.updateRecord`

Update a record.

```yaml
action: airtable.updateRecord
inputs:
  table: string            # Required: Table name or ID
  record_id: string        # Required: Record ID
  fields:                  # Required: Fields to update
    <field_name>: any
  base_id: string          # Optional: Base ID
```

#### `airtable.deleteRecord`

Delete a record.

```yaml
action: airtable.deleteRecord
inputs:
  table: string            # Required: Table name or ID
  record_id: string        # Required: Record ID
  base_id: string          # Optional: Base ID
```

#### `airtable.findRecords`

Find records by formula.

```yaml
action: airtable.findRecords
inputs:
  table: string            # Required: Table name or ID
  formula: string          # Required: Airtable formula
  max_records: number      # Optional: Max results
  base_id: string          # Optional: Base ID
```

---

## Google Sheets

Google Sheets integration.

### Configuration

```yaml
tools:
  sheets:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

### Actions

#### `sheets.getValues`

Get cell values.

```yaml
action: sheets.getValues
inputs:
  spreadsheet_id: string   # Required: Spreadsheet ID
  range: string            # Required: A1 notation (e.g., "Sheet1!A1:D10")
```

**Example:**

```yaml
action: sheets.getValues
inputs:
  spreadsheet_id: "{{sheet_id}}"
  range: "Tasks!A2:E100"
output_variable: task_data
```

#### `sheets.appendValues`

Append rows to sheet.

```yaml
action: sheets.appendValues
inputs:
  spreadsheet_id: string   # Required: Spreadsheet ID
  range: string            # Required: Range to append to
  values: array[]          # Required: 2D array of values
  value_input_option: string # Optional: "USER_ENTERED" or "RAW"
```

**Example:**

```yaml
action: sheets.appendValues
inputs:
  spreadsheet_id: "{{sheet_id}}"
  range: "Sheet1!A:E"
  values:
    - ["Task 1", "In Progress", "Alice", "2024-01-15", "High"]
    - ["Task 2", "Done", "Bob", "2024-01-14", "Medium"]
  value_input_option: "USER_ENTERED"
```

#### `sheets.updateValues`

Update cell values.

```yaml
action: sheets.updateValues
inputs:
  spreadsheet_id: string   # Required: Spreadsheet ID
  range: string            # Required: Range to update
  values: array[]          # Required: 2D array of values
  value_input_option: string # Optional: "USER_ENTERED" or "RAW"
```

#### `sheets.clearValues`

Clear cell values.

```yaml
action: sheets.clearValues
inputs:
  spreadsheet_id: string   # Required: Spreadsheet ID
  range: string            # Required: Range to clear
```

#### `sheets.createSpreadsheet`

Create a spreadsheet.

```yaml
action: sheets.createSpreadsheet
inputs:
  title: string            # Required: Spreadsheet title
  sheets: object[]         # Optional: Sheet configurations
```

#### `sheets.addSheet`

Add a sheet to spreadsheet.

```yaml
action: sheets.addSheet
inputs:
  spreadsheet_id: string   # Required: Spreadsheet ID
  title: string            # Required: Sheet title
  index: number            # Optional: Sheet position
```

---

## Google Calendar

Google Calendar integration.

### Configuration

```yaml
tools:
  calendar:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

### Actions

#### `calendar.createEvent`

Create calendar event.

```yaml
action: calendar.createEvent
inputs:
  calendar_id: string      # Optional: Calendar ID (default: "primary")
  summary: string          # Required: Event title
  start:                   # Required: Start time
    date_time: string      # ISO 8601 datetime
    time_zone: string      # Optional: Timezone
  end:                     # Required: End time
    date_time: string      # ISO 8601 datetime
    time_zone: string      # Optional: Timezone
  description: string      # Optional: Event description
  location: string         # Optional: Event location
  attendees: object[]      # Optional: Attendees
  reminders: object        # Optional: Reminder settings
```

**Example:**

```yaml
action: calendar.createEvent
inputs:
  summary: "Team Standup"
  start:
    date_time: "2024-01-15T09:00:00-08:00"
    time_zone: "America/Los_Angeles"
  end:
    date_time: "2024-01-15T09:30:00-08:00"
    time_zone: "America/Los_Angeles"
  attendees:
    - email: "alice@company.com"
    - email: "bob@company.com"
  reminders:
    use_default: false
    overrides:
      - method: "email"
        minutes: 30
output_variable: calendar_event
```

#### `calendar.listEvents`

List calendar events.

```yaml
action: calendar.listEvents
inputs:
  calendar_id: string      # Optional: Calendar ID (default: "primary")
  time_min: string         # Optional: Start time filter (ISO 8601)
  time_max: string         # Optional: End time filter (ISO 8601)
  max_results: number      # Optional: Max results
  single_events: boolean   # Optional: Expand recurring events
  order_by: string         # Optional: Sort order
```

#### `calendar.updateEvent`

Update an event.

```yaml
action: calendar.updateEvent
inputs:
  calendar_id: string      # Optional: Calendar ID (default: "primary")
  event_id: string         # Required: Event ID
  summary: string          # Optional: New title
  start: object            # Optional: New start time
  end: object              # Optional: New end time
  description: string      # Optional: New description
```

#### `calendar.deleteEvent`

Delete an event.

```yaml
action: calendar.deleteEvent
inputs:
  calendar_id: string      # Optional: Calendar ID (default: "primary")
  event_id: string         # Required: Event ID
  send_updates: string     # Optional: "all", "externalOnly", "none"
```

---

## Google Drive

Google Drive integration.

### Configuration

```yaml
tools:
  drive:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

### Actions

#### `drive.listFiles`

List files and folders.

```yaml
action: drive.listFiles
inputs:
  page_size: number        # Optional: Max results (default: 100)
  q: string                # Optional: Search query
  order_by: string         # Optional: Sort order
  spaces: string           # Optional: "drive", "appDataFolder", "photos"
  fields: string           # Optional: Fields to return
```

**Example:**

```yaml
action: drive.listFiles
inputs:
  q: "mimeType='application/pdf' and '{{folder_id}}' in parents"
  page_size: 50
  order_by: "modifiedTime desc"
output_variable: pdf_files
```

#### `drive.getFile`

Get file metadata.

```yaml
action: drive.getFile
inputs:
  file_id: string          # Required: File ID
  fields: string           # Optional: Fields to return
```

#### `drive.downloadFile`

Download file content.

```yaml
action: drive.downloadFile
inputs:
  file_id: string          # Required: File ID
```

#### `drive.createFile`

Upload a file.

```yaml
action: drive.createFile
inputs:
  name: string             # Required: File name
  mime_type: string        # Required: MIME type
  parents: string[]        # Optional: Parent folder IDs
  content: string | Buffer # Required: File content
```

#### `drive.createFolder`

Create a folder.

```yaml
action: drive.createFolder
inputs:
  name: string             # Required: Folder name
  parent_id: string        # Optional: Parent folder ID
```

#### `drive.shareFile`

Share a file.

```yaml
action: drive.shareFile
inputs:
  file_id: string          # Required: File ID
  type: string             # Required: "user", "group", "domain", "anyone"
  role: string             # Required: "reader", "writer", "commenter", "owner"
  email_address: string    # Optional: Email (required for user/group)
  send_notification_email: boolean # Optional: Send notification
```

---

## Google Docs

Google Docs integration.

### Configuration

```yaml
tools:
  docs:
    sdk: googleapis
    auth:
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3000/callback
      refresh_token: ${GOOGLE_REFRESH_TOKEN}
      access_token: ${GOOGLE_ACCESS_TOKEN}
```

### Actions

#### `docs.createDocument`

Create a document.

```yaml
action: docs.createDocument
inputs:
  title: string            # Required: Document title
```

#### `docs.getDocument`

Get document content.

```yaml
action: docs.getDocument
inputs:
  document_id: string      # Required: Document ID
```

#### `docs.appendText`

Append text to document.

```yaml
action: docs.appendText
inputs:
  document_id: string      # Required: Document ID
  text: string             # Required: Text to append
```

#### `docs.insertText`

Insert text at position.

```yaml
action: docs.insertText
inputs:
  document_id: string      # Required: Document ID
  text: string             # Required: Text to insert
  index: number            # Required: Position to insert at
```

#### `docs.replaceAllText`

Find and replace text.

```yaml
action: docs.replaceAllText
inputs:
  document_id: string      # Required: Document ID
  find: string             # Required: Text to find
  replace: string          # Required: Replacement text
  match_case: boolean      # Optional: Case sensitive (default: false)
```

---

## Telegram

Telegram Bot integration.

### Configuration

```yaml
tools:
  telegram:
    sdk: telegram
    auth:
      token: ${TELEGRAM_BOT_TOKEN}
```

### Actions

#### `telegram.sendMessage`

Send a message.

```yaml
action: telegram.sendMessage
inputs:
  chat_id: string | number # Required: Chat ID
  text: string             # Required: Message text
  parse_mode: string       # Optional: "Markdown" or "HTML"
  disable_web_page_preview: boolean # Optional
  disable_notification: boolean     # Optional
  reply_to_message_id: number       # Optional
  reply_markup: object     # Optional: Inline keyboard
```

**Example:**

```yaml
action: telegram.sendMessage
inputs:
  chat_id: "{{telegram_chat_id}}"
  text: "*Deployment Complete!*\nVersion: 2.0.1\nStatus: ✅ Success"
  parse_mode: "Markdown"
```

#### `telegram.sendPhoto`

Send a photo.

```yaml
action: telegram.sendPhoto
inputs:
  chat_id: string | number # Required: Chat ID
  photo: string            # Required: File path or URL
  caption: string          # Optional: Photo caption
  parse_mode: string       # Optional: "Markdown" or "HTML"
```

#### `telegram.editMessageText`

Edit message text.

```yaml
action: telegram.editMessageText
inputs:
  chat_id: string | number # Required: Chat ID
  message_id: number       # Required: Message ID
  text: string             # Required: New text
  parse_mode: string       # Optional: "Markdown" or "HTML"
```

---

## WhatsApp

WhatsApp Business API integration.

### Configuration

```yaml
tools:
  whatsapp:
    sdk: whatsapp
    auth:
      phone_number_id: ${WHATSAPP_PHONE_NUMBER_ID}
      access_token: ${WHATSAPP_ACCESS_TOKEN}
```

### Actions

#### `whatsapp.sendText`

Send text message.

```yaml
action: whatsapp.sendText
inputs:
  to: string               # Required: Recipient phone number
  body: string             # Required: Message text
  preview_url: boolean     # Optional: Enable URL preview
```

**Example:**

```yaml
action: whatsapp.sendText
inputs:
  to: "+1234567890"
  body: "Hello! Your order #12345 has been shipped."
```

#### `whatsapp.sendTemplate`

Send template message.

```yaml
action: whatsapp.sendTemplate
inputs:
  to: string               # Required: Recipient phone number
  template_name: string    # Required: Template name
  language_code: string    # Required: Language code (e.g., "en_US")
  components: object[]     # Optional: Template components
```

#### `whatsapp.sendImage`

Send image message.

```yaml
action: whatsapp.sendImage
inputs:
  to: string               # Required: Recipient phone number
  link: string             # Optional: Image URL
  id: string               # Optional: Uploaded media ID
  caption: string          # Optional: Image caption
```

---

## PostgreSQL

PostgreSQL database integration.

### Configuration

```yaml
tools:
  postgres:
    sdk: pg
    auth:
      host: localhost
      port: 5432
      database: mydb
      user: postgres
      password: ${POSTGRES_PASSWORD}
      ssl: true              # Optional: Enable SSL
```

### Actions

#### `postgres.query`

Execute SQL query.

```yaml
action: postgres.query
inputs:
  sql: string              # Required: SQL query
  params: array            # Optional: Query parameters ($1, $2, etc.)
```

**Example:**

```yaml
action: postgres.query
inputs:
  sql: "SELECT * FROM users WHERE role = $1 AND active = $2"
  params: ["admin", true]
output_variable: admin_users
```

#### `postgres.select`

Select from table.

```yaml
action: postgres.select
inputs:
  table: string            # Required: Table name
  columns: string[]        # Optional: Columns to select (default: *)
  where: object            # Optional: WHERE conditions
  order_by: string         # Optional: ORDER BY clause
  limit: number            # Optional: LIMIT
  offset: number           # Optional: OFFSET
```

#### `postgres.insert`

Insert data.

```yaml
action: postgres.insert
inputs:
  table: string            # Required: Table name
  data: object             # Required: Data to insert
  returning: string[]      # Optional: Columns to return
```

**Example:**

```yaml
action: postgres.insert
inputs:
  table: "users"
  data:
    name: "Alice Smith"
    email: "alice@example.com"
    role: "admin"
    created_at: "{{now}}"
  returning: ["id", "created_at"]
output_variable: new_user
```

#### `postgres.update`

Update data.

```yaml
action: postgres.update
inputs:
  table: string            # Required: Table name
  data: object             # Required: Data to update
  where: object            # Required: WHERE conditions
  returning: string[]      # Optional: Columns to return
```

#### `postgres.delete`

Delete data.

```yaml
action: postgres.delete
inputs:
  table: string            # Required: Table name
  where: object            # Required: WHERE conditions
  returning: string[]      # Optional: Columns to return
```

---

## MySQL

MySQL database integration.

### Configuration

```yaml
tools:
  mysql:
    sdk: mysql2/promise
    auth:
      host: localhost
      port: 3306
      database: mydb
      user: root
      password: ${MYSQL_PASSWORD}
```

### Actions

Same as PostgreSQL: `query`, `select`, `insert`, `update`, `delete`, `transaction`.

---

## Supabase

Supabase (Postgres + Auth + Storage) integration.

### Configuration

```yaml
tools:
  supabase:
    sdk: supabase
    auth:
      url: https://project.supabase.co
      key: ${SUPABASE_KEY}
```

### Database Actions

#### `supabase.select`

Query data.

```yaml
action: supabase.select
inputs:
  table: string            # Required: Table name
  columns: string          # Optional: Columns (default: "*")
  filters: object          # Optional: Filters (eq, neq, gt, lt, etc.)
  order: object            # Optional: Sort order
  limit: number            # Optional: Limit
  offset: number           # Optional: Offset
```

**Example:**

```yaml
action: supabase.select
inputs:
  table: "tasks"
  columns: "id, title, status, assignee"
  filters:
    status: "In Progress"
    priority: "High"
  order:
    column: "created_at"
    ascending: false
  limit: 50
output_variable: tasks
```

#### `supabase.insert`

Insert data.

```yaml
action: supabase.insert
inputs:
  table: string            # Required: Table name
  data: object | object[]  # Required: Data to insert
  returning: string        # Optional: Columns to return
```

#### `supabase.update`

Update data.

```yaml
action: supabase.update
inputs:
  table: string            # Required: Table name
  data: object             # Required: Data to update
  filters: object          # Required: Filter conditions
```

#### `supabase.delete`

Delete data.

```yaml
action: supabase.delete
inputs:
  table: string            # Required: Table name
  filters: object          # Required: Filter conditions
```

### Storage Actions

#### `supabase.uploadFile`

Upload file to storage.

```yaml
action: supabase.uploadFile
inputs:
  bucket: string           # Required: Bucket name
  path: string             # Required: File path in bucket
  file: string | Buffer    # Required: File content
  content_type: string     # Optional: MIME type
  upsert: boolean          # Optional: Overwrite if exists
```

#### `supabase.getPublicUrl`

Get public URL for file.

```yaml
action: supabase.getPublicUrl
inputs:
  bucket: string           # Required: Bucket name
  path: string             # Required: File path
```

---

## HTTP / GraphQL

Generic HTTP and GraphQL client for custom APIs.

### Configuration

```yaml
tools:
  api:
    sdk: http
    auth:
      type: bearer | basic | apikey
      token: ${API_TOKEN}    # For bearer
      username: string       # For basic auth
      password: string       # For basic auth
      api_key: string        # For API key
      header_name: string    # API key header name (default: "X-API-Key")
    options:
      base_url: https://api.example.com
      headers:
        Content-Type: application/json
```

### HTTP Actions

#### `api.request`

Generic HTTP request.

```yaml
action: api.request
inputs:
  method: string           # Required: HTTP method
  path: string             # Required: Request path
  body: object             # Optional: Request body
  headers: object          # Optional: Additional headers
  params: object           # Optional: Query parameters
```

#### `api.get`

GET request.

```yaml
action: api.get
inputs:
  path: string             # Required: Request path
  params: object           # Optional: Query parameters
  headers: object          # Optional: Headers
```

**Example:**

```yaml
action: api.get
inputs:
  path: "/users"
  params:
    role: "admin"
    active: true
    limit: 50
output_variable: users
```

#### `api.post`

POST request.

```yaml
action: api.post
inputs:
  path: string             # Required: Request path
  body: object             # Required: Request body
  headers: object          # Optional: Headers
```

#### `api.put` / `api.patch` / `api.delete`

Similar to POST/GET.

### GraphQL Actions

#### `api.query`

Execute GraphQL query.

```yaml
action: api.query
inputs:
  query: string            # Required: GraphQL query
  variables: object        # Optional: Query variables
  operation_name: string   # Optional: Operation name
```

**Example:**

```yaml
action: api.query
inputs:
  query: |
    query GetUser($id: ID!) {
      user(id: $id) {
        id
        name
        email
        posts {
          title
          published
        }
      }
    }
  variables:
    id: "{{inputs.user_id}}"
output_variable: user_data
```

---

## Playwright

Browser automation with Playwright.

### Configuration

```yaml
tools:
  browser:
    sdk: playwright
    options:
      headless: boolean        # Optional: Headless mode (default: true)
      browser: string          # Optional: "chromium", "firefox", "webkit" (default: "chromium")
      viewport:                # Optional: Viewport size
        width: number
        height: number
      user_agent: string       # Optional: Custom user agent
      timezone_id: string      # Optional: Timezone
      locale: string           # Optional: Locale
```

### Actions

#### `browser.navigate`

Navigate to URL.

```yaml
action: browser.navigate
inputs:
  url: string              # Required: URL to navigate to
  wait_until: string       # Optional: "load", "domcontentloaded", "networkidle"
```

#### `browser.click`

Click element.

```yaml
action: browser.click
inputs:
  selector: string         # Required: CSS selector
  timeout: number          # Optional: Timeout in ms
```

#### `browser.type`

Type text into input.

```yaml
action: browser.type
inputs:
  selector: string         # Required: CSS selector
  text: string             # Required: Text to type
  delay: number            # Optional: Delay between keystrokes
```

#### `browser.extract`

Extract data from page.

```yaml
action: browser.extract
inputs:
  selectors: object        # Required: Selector map
  wait_for: string         # Optional: Wait for selector before extracting
```

**Example:**

```yaml
action: browser.extract
inputs:
  selectors:
    title: "h1.title"
    price: ".price"
    description: ".description"
    images: "img.product-image" # Returns array
  wait_for: ".product-details"
output_variable: product_data
```

#### `browser.screenshot`

Take screenshot.

```yaml
action: browser.screenshot
inputs:
  path: string             # Required: Output file path
  full_page: boolean       # Optional: Capture full page
  type: string             # Optional: "png" or "jpeg"
```

#### `browser.pdf`

Generate PDF.

```yaml
action: browser.pdf
inputs:
  path: string             # Required: Output file path
  format: string           # Optional: Paper format (e.g., "A4", "Letter")
  print_background: boolean # Optional: Include backgrounds
```

### AI-Powered Actions

When configured with an AI backend (Copilot or Claude Code):

#### `browser.act`

Perform natural language action.

```yaml
action: browser.act
inputs:
  action: string           # Required: Natural language action
  selector: string         # Optional: Target element
```

**Example:**

```yaml
action: browser.act
inputs:
  action: "Click the login button and fill in the username with 'alice@example.com'"
```

#### `browser.observe`

Get page elements description.

```yaml
action: browser.observe
inputs:
  instruction: string      # Optional: What to observe
```

#### `browser.aiExtract`

AI-powered data extraction.

```yaml
action: browser.aiExtract
inputs:
  instruction: string      # Required: What to extract
  schema: object           # Optional: JSON schema for validation
```

**Example:**

```yaml
action: browser.aiExtract
inputs:
  instruction: "Extract all product names, prices, and ratings from this page"
  schema:
    type: "array"
    items:
      type: "object"
      properties:
        name: { type: "string" }
        price: { type: "number" }
        rating: { type: "number" }
output_variable: products
```

---

## Next Steps

- [AI Agent Integrations](./ai-agents.md) - AI agents for code generation and task automation
- [Control Flow Guide](./control-flow.md) - Control flow structures
- [Examples](../../examples/) - Real-world workflow examples
