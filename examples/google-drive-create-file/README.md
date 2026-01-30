# Google Drive File Creator

Create text files on Google Drive using the Drive API.

## Quick Start

```bash
./marktoflow run examples/google-drive-create-file/workflow.md
```

This creates a file named `test.txt` in your Google Drive root.

## Features

- ✅ Create text files on Google Drive
- ✅ Custom filename and content
- ✅ Optional folder placement
- ✅ Returns file ID and view link
- ✅ OAuth2 authentication

## Prerequisites

1. Google Cloud project with Drive API enabled
2. OAuth2 credentials (Desktop app)
3. Environment variables set (see Setup in workflow.md)

## Usage Examples

### Create Default File

```bash
./marktoflow run examples/google-drive-create-file/workflow.md
```

### Create Custom File

```bash
./marktoflow run examples/google-drive-create-file/workflow.md \
  --input filename="meeting-notes.txt" \
  --input content="Meeting notes from today's standup..."
```

### Create File in Folder

```bash
./marktoflow run examples/google-drive-create-file/workflow.md \
  --input filename="report.txt" \
  --input content="Quarterly report data..." \
  --input folder_id="1ABC123xyz..."
```

## Output

The workflow returns:
- `file_id` - Google Drive file ID
- `file_name` - Name of the created file
- `web_view_link` - Direct link to view the file

## See Also

- [Google Drive Integration Docs](../../docs/yaml-api/services.md#google-drive)
- [Gmail Notification Example](../gmail-notification/)
- [Google Sheets Report Example](../sheets-report/)
