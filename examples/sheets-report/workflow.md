---
workflow:
  id: sheets-report
  name: 'Google Sheets Report'
  version: '2.0.0'
  description: 'Read data from and write reports to Google Sheets'
  author: 'marktoflow'
  tags:
    - google-sheets
    - reporting
    - data

tools:
  sheets:
    sdk: 'google-sheets'
    auth:
      client_id: '${GOOGLE_CLIENT_ID}'
      client_secret: '${GOOGLE_CLIENT_SECRET}'
      refresh_token: '${GOOGLE_REFRESH_TOKEN}'

triggers:
  - type: manual

inputs:
  spreadsheet_id:
    type: string
    required: true
    description: 'Google Sheets spreadsheet ID'
  source_range:
    type: string
    default: 'Sheet1!A1:Z1000'
    description: 'Range to read data from'
  output_sheet:
    type: string
    default: 'Report'
    description: 'Sheet name to write report to'

outputs:
  rows_read:
    type: number
    description: 'Number of rows read from source'
  rows_written:
    type: number
    description: 'Number of rows written to report'
---

# Google Sheets Report

Read data from a Google Sheet, process it, and write a summary report.

## Step 1: Read Source Data

```yaml
action: sheets.spreadsheets.values.get
inputs:
  spreadsheetId: '{{ inputs.spreadsheet_id }}'
  range: '{{ inputs.source_range }}'
output_variable: source_data
```

## Step 2: Process Data

```yaml
action: script
inputs:
  code: |
    const rows = inputs.source_data.values || [];
    const headers = rows[0] || [];
    const data = rows.slice(1);

    // Calculate summary statistics
    const summary = {
      total_rows: data.length,
      headers: headers,
      processed_at: new Date().toISOString()
    };

    return summary;
output_variable: summary
```

## Step 3: Log Summary

```yaml
action: console.log
inputs:
  message: 'Processed {{ summary.total_rows }} rows from spreadsheet'
```

## Step 4: Write Report Header

```yaml
action: sheets.spreadsheets.values.update
inputs:
  spreadsheetId: '{{ inputs.spreadsheet_id }}'
  range: '{{ inputs.output_sheet }}!A1:C1'
  valueInputOption: 'USER_ENTERED'
  requestBody:
    values:
      - ['Report Generated', '{{ summary.processed_at }}', 'Total Rows: {{ summary.total_rows }}']
output_variable: write_result
```

## Step 5: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  rows_read: '{{ summary.total_rows }}'
  rows_written: 1
```

---

## Setup Instructions

1. **Enable Google Sheets API:**
   ```bash
   # Enable Sheets API in Google Cloud Console
   # Use same OAuth credentials as Gmail
   ```

2. **Connect Google Sheets:**
   ```bash
   marktoflow connect google-sheets
   ```

3. **Run Workflow:**
   ```bash
   marktoflow run examples/sheets-report/workflow.md \
     --input spreadsheet_id="your-spreadsheet-id"
   ```

## Finding Your Spreadsheet ID

The spreadsheet ID is in the URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## Example: Weekly Sales Report

```bash
marktoflow run examples/sheets-report/workflow.md \
  --input spreadsheet_id="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" \
  --input source_range="Sales!A1:E500" \
  --input output_sheet="Weekly Report"
```
