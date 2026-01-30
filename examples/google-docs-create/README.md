# Google Docs Creator

Create Google Docs using the Docs API with optional initial content.

## Quick Start

```bash
./marktoflow run examples/google-docs-create/workflow.md
```

This creates a document named "Test Document" with default content.

## Features

- ✅ Create Google Docs with custom titles
- ✅ Add initial content to documents
- ✅ Optional content insertion (create blank docs)
- ✅ Returns document ID and direct link
- ✅ OAuth2 authentication with auto-token loading

## Prerequisites

1. Google Cloud project with Docs API enabled
2. OAuth2 credentials (Desktop app)
3. Environment variables set (see Setup in workflow.md)

## Usage Examples

### Create Document with Custom Title

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Meeting Notes"
```

### Create Document with Custom Content

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Project Plan" \
  --input content="# Project Plan\n\nObjectives:\n1. Goal 1\n2. Goal 2"
```

### Create Blank Document

```bash
./marktoflow run examples/google-docs-create/workflow.md \
  --input title="Blank Doc" \
  --input add_content=false
```

## Output

The workflow returns:
- `document_id` - Google Docs document ID
- `title` - Document title
- `document_url` - Direct link to open the document
- `status` - Workflow status

## Authentication

Run once to authenticate:

```bash
./marktoflow connect google-docs
```

This saves your tokens to `.marktoflow/credentials/google-docs.json` for automatic loading.

## See Also

- [Google Docs Integration Docs](../../docs/yaml-api/services.md#google-docs)
- [Google Drive Example](../google-drive-create-file/)
- [Google Sheets Example](../sheets-report/)
