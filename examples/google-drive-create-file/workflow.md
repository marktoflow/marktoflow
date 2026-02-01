---
workflow:
  id: google-drive-create-file
  name: 'Google Drive File Creator'
  version: '1.0.0'
  description: 'Create a text file on Google Drive'
  author: 'marktoflow'
  tags:
    - google-drive
    - file-creation
    - storage

tools:
  drive:
    sdk: 'google-drive'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      redirect_uri: 'http://localhost:3000/callback'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'
      access_token: '${GOOGLE_ACCESS_TOKEN}'

triggers:
  - type: manual

inputs:
  filename:
    type: string
    default: 'test.txt'
    description: 'Name of the file to create'
  content:
    type: string
    default: 'Hello from marktoflow! This is a test file created via the Google Drive API.'
    description: 'Content of the text file'
  folder_id:
    type: string
    required: false
    description: 'Optional: ID of the folder where the file should be created'

outputs:
  file_id:
    type: string
    description: 'ID of the created file'
  file_name:
    type: string
    description: 'Name of the created file'
  web_view_link:
    type: string
    description: 'Link to view the file in Google Drive'
---

# Google Drive File Creator

Create a text file on Google Drive using the Drive API with OAuth2 authentication.

## Step 1: Log Action

```yaml
action: core.log
inputs:
  message: 'Creating file "{{ inputs.filename }}" on Google Drive...'
  level: info
```

## Step 2: Create File on Google Drive

```yaml
action: drive.createFile
inputs:
  name: '{{ inputs.filename }}'
  content: '{{ inputs.content }}'
  contentType: 'text/plain'
  mimeType: 'text/plain'
  parents: '{{ [inputs.folder_id] if inputs.folder_id else [] }}'
output_variable: created_file
```

## Step 3: Log Success

```yaml
action: core.log
inputs:
  message: 'File created successfully! File ID: {{ created_file.id }}, Link: {{ created_file.webViewLink }}'
  level: info
```

## Step 4: Set Workflow Outputs

```yaml
action: workflow.set_outputs
inputs:
  file_id: '{{ created_file.id }}'
  file_name: '{{ created_file.name }}'
  web_view_link: '{{ created_file.webViewLink }}'
  status: 'success'
```

---

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Desktop app" as the application type
4. Name it (e.g., "marktoflow Drive Access")
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
npx marktoflow connect google-drive
```

This will:
- Open your browser for authentication
- Request access to your Google Drive
- Save the refresh token to your environment

### 5. Run the Workflow

**Basic Usage (creates test.txt with default content):**

```bash
./marktoflow run examples/google-drive-create-file/workflow.md
```

**Custom Filename and Content:**

```bash
./marktoflow run examples/google-drive-create-file/workflow.md \
  --input filename="my-notes.txt" \
  --input content="These are my important notes."
```

**Create File in Specific Folder:**

```bash
# First, get the folder ID from Google Drive URL
# URL format: https://drive.google.com/drive/folders/FOLDER_ID_HERE

./marktoflow run examples/google-drive-create-file/workflow.md \
  --input filename="project-notes.txt" \
  --input content="Project documentation goes here." \
  --input folder_id="your_folder_id_here"
```

---

## Example Output

```json
{
  "workflowId": "google-drive-create-file",
  "status": "completed",
  "output": {
    "file_id": "1ABC123xyz...",
    "file_name": "test.txt",
    "web_view_link": "https://drive.google.com/file/d/1ABC123xyz.../view",
    "status": "success"
  }
}
```

---

## Related Examples

- **[Gmail Notification](../gmail-notification/workflow.md)** - Send emails via Gmail
- **[Google Sheets Report](../sheets-report/workflow.md)** - Create reports in Google Sheets

---

## Troubleshooting

### Authentication Errors

If you get authentication errors:

1. Ensure your OAuth credentials are correctly set in `.env`
2. Make sure the Google Drive API is enabled in your Google Cloud project
3. Try refreshing your tokens by running `npx marktoflow connect google-drive` again

### Permission Errors

If you get permission errors:

- Verify the folder ID is correct (if specified)
- Ensure your Google account has write access to the folder
- Check that the OAuth scopes include Drive access

### File Not Appearing

If the file is created but you can't see it:

- Check the "All items" view in Google Drive
- If a folder ID was specified, navigate to that folder
- The file might be in "My Drive" root if no folder was specified
