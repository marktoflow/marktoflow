---
workflow:
  id: google-docs-create
  name: 'Google Docs Creator'
  version: '1.0.0'
  description: 'Create a new Google Doc with optional content'
  author: 'marktoflow'
  tags:
    - google-docs
    - document
    - productivity

tools:
  docs:
    sdk: 'google-docs'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      redirect_uri: 'http://localhost:8484/callback'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
      access_token: '${GOOGLE_ACCESS_TOKEN}'

triggers:
  - type: manual

inputs:
  title:
    type: string
    default: 'Test Document'
    description: 'Title of the document to create'
  content:
    type: string
    default: 'This is a test document created by marktoflow!\n\nYou can add more content here.'
    description: 'Initial content to add to the document'
  add_content:
    type: boolean
    default: true
    description: 'Whether to add initial content to the document'

outputs:
  document_id:
    type: string
    description: 'ID of the created document'
  title:
    type: string
    description: 'Title of the created document'
  document_url:
    type: string
    description: 'URL to view the document'
---

# Google Docs Creator

Create a new Google Doc using the Docs API with OAuth2 authentication.

## Step 1: Log Action

```yaml
action: core.log
inputs:
  message: 'Creating Google Doc with title: "{{ inputs.title }}"...'
  level: info
```

## Step 2: Create Document

```yaml
action: docs.createDocument
inputs:
  title: '{{ inputs.title }}'
output_variable: created_doc
```

## Step 3: Log Creation Success

```yaml
action: core.log
inputs:
  message: 'Document created! ID: {{ created_doc.documentId }}'
  level: info
```

## Step 4: Add Content (Conditional)

```yaml
action: docs.appendText
inputs:
  documentId: '{{ created_doc.documentId }}'
  text: '{{ inputs.content }}'
conditions:
  - '{{ inputs.add_content }}'
output_variable: content_added
```

## Step 5: Log Content Added

```yaml
action: core.log
inputs:
  message: 'Content added to document'
  level: info
conditions:
  - '{{ inputs.add_content }}'
```

## Step 6: Set Workflow Outputs

```yaml
action: workflow.set_outputs
inputs:
  document_id: '{{ created_doc.documentId }}'
  title: '{{ created_doc.title }}'
  document_url: 'https://docs.google.com/document/d/{{ created_doc.documentId }}/edit'
  status: 'success'
```

---

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Docs API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Docs API"
   - Click "Enable"

### 2. Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Desktop app" as the application type
4. Name it (e.g., "marktoflow Docs Access")
5. Download the credentials JSON file

### 3. Set Environment Variables

Create a `.env` file in your project root:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_ACCESS_TOKEN=your_access_token_here
```

### 4. Obtain OAuth Tokens

Run the OAuth flow to get your refresh token:

```bash
./marktoflow connect google-docs
```

This will:
- Open your browser for authentication
- Request access to your Google Docs
- Save the refresh token to your environment

### 5. Run the Workflow

**Basic Usage (creates document with default title and content):**

```bash
./marktoflow run examples/google-docs-create/workflow.md
```

**Custom Title:**

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Meeting Notes - Q1 Planning"
```

**Custom Title and Content:**

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Project Proposal" \
  --input content="# Project Overview\n\nThis document outlines our proposal for the new project.\n\n## Goals\n- Objective 1\n- Objective 2"
```

**Create Empty Document (no initial content):**

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Blank Document" \
  --input add_content=false
```

---

## Example Output

```json
{
  "workflowId": "google-docs-create",
  "status": "completed",
  "output": {
    "document_id": "1ABC123xyz...",
    "title": "Test Document",
    "document_url": "https://docs.google.com/document/d/1ABC123xyz.../edit",
    "status": "success"
  }
}
```

---

## Advanced Usage

### Create Multiple Documents

Use a loop in your workflow or call this workflow multiple times:

```bash
for title in "Doc 1" "Doc 2" "Doc 3"; do
  ./marktoflow run examples/google-docs-create/workflow.md --input title="$title"
done
```

### Use in Other Workflows

Call this as a sub-workflow:

```yaml
- id: create-report-doc
  workflow: ./examples/google-docs-create/workflow.md
  inputs:
    title: 'Monthly Report'
    content: 'Report generated on {{ now() }}'
  output_variable: report_doc
```

---

## Related Examples

- **[Google Drive File Creator](../google-drive-create-file/workflow.md)** - Create files in Google Drive
- **[Google Sheets Report](../sheets-report/workflow.md)** - Create spreadsheets
- **[Gmail Notification](../gmail-notification/workflow.md)** - Send emails

---

## Troubleshooting

### Authentication Errors

If you get authentication errors:

1. Ensure your OAuth credentials are correctly set in `.env`
2. Make sure the Google Docs API is enabled in your Google Cloud project
3. Try refreshing your tokens by running `./marktoflow connect google-docs` again

### Permission Errors

If you get permission errors:

- Verify the OAuth scopes include Docs access
- Check that your Google account has permission to create documents

### Document Not Appearing

If the document is created but you can't see it:

- Check your Google Drive (documents are automatically saved there)
- The document might be in "My Drive" root
- Use the `document_url` from the output to open it directly
