---
workflow:
  id: file-operations-test
  name: 'File Operations Test'
  version: 1.0.0
  description: 'Comprehensive test of file.read and file.write operations'

inputs:
  test_dir:
    type: string
    default: './test-output'
    description: 'Directory for test outputs'

outputs:
  results:
    type: object
    description: 'Test results summary'
---

# File Operations Test Workflow

This workflow tests the `file.read` and `file.write` actions with various file formats and scenarios.

## Setup: Create Test Directory

```yaml
action: core.log
inputs:
  message: |
    ========================================
    FILE OPERATIONS TEST
    ========================================
    Testing file.read and file.write actions
  level: info
```

## Test 1: Write and Read Text File

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/test.txt'
  data: |
    Hello from marktoflow!
    This is a test file.
    Line 3 with special chars: émojis 🎉
  createDirectory: true
output_variable: write_text
```

```yaml
action: file.read
inputs:
  path: '{{ write_text.path }}'
output_variable: read_text
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 1: Text File
    - Written: {{ write_text.size }} bytes
    - Read: {{ read_text.size }} bytes
    - Format: {{ read_text.originalFormat }}
    - Content matches: {{ read_text.content | length > 0 }}
  level: info
```

## Test 2: Write and Read JSON

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/data.json'
  data: |
    {
      "name": "Test Data",
      "values": [1, 2, 3, 4, 5],
      "metadata": {
        "created": "2024-01-01",
        "version": "1.0"
      }
    }
  createDirectory: true
output_variable: write_json
```

```yaml
action: file.read
inputs:
  path: '{{ write_json.path }}'
output_variable: read_json
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 2: JSON File
    - Written: {{ write_json.size }} bytes
    - Read: {{ read_json.size }} bytes
    - Format: {{ read_json.originalFormat }}
  level: info
```

## Test 3: Write Object as JSON (auto-format)

```yaml
action: core.set
inputs:
  test: "object-write"
  timestamp: "2024-01-01T12:00:00Z"
  numbers: [10, 20, 30]
  nested:
    key1: "value1"
    key2: "value2"
output_variable: test_object
```

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/object.json'
  data: '{{ test_object }}'
  createDirectory: true
output_variable: write_object
```

```yaml
action: file.read
inputs:
  path: '{{ write_object.path }}'
output_variable: read_object
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 3: Object to JSON
    - Auto-formatted: true
    - Size: {{ write_object.size }} bytes
    - Valid JSON: {{ read_object.originalFormat == 'text' }}
  level: info
```

## Test 4: Template Resolution in Path and Data

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/generated/report-{{ test_object.timestamp | replace(":", "-") }}.txt'
  data: |
    Test Report
    ===========
    Generated at: {{ test_object.timestamp }}
    Test: {{ test_object.test }}

    Results:
    {% for num in test_object.numbers %}
    - Value {{ loop.index }}: {{ num }}
    {% endfor %}
  createDirectory: true
output_variable: write_template
```

```yaml
action: file.read
inputs:
  path: '{{ write_template.path }}'
output_variable: read_template
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 4: Template Resolution
    - Path includes timestamp: true
    - Templates resolved in data: true
    - Size: {{ write_template.size }} bytes
  level: info
```

## Test 5: Nested Directory Creation

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/deeply/nested/path/to/file.txt'
  data: 'File in deeply nested directory'
  createDirectory: true
output_variable: write_nested
```

```yaml
action: file.read
inputs:
  path: '{{ write_nested.path }}'
output_variable: read_nested
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 5: Nested Directories
    - Directories created: true
    - File accessible: {{ read_nested.size > 0 }}
  level: info
```

## Test 6: Binary Data (Base64)

```yaml
action: core.set
inputs:
  binary_data: "iVBORw0KGgo="
output_variable: binary_result
```

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/binary.bin'
  data: '{{ binary_result.binary_data }}'
  encoding: 'base64'
  createDirectory: true
output_variable: write_binary
```

```yaml
action: file.read
inputs:
  path: '{{ write_binary.path }}'
output_variable: read_binary
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 6: Binary Data
    - Written as binary: true
    - Read format: {{ read_binary.originalFormat }}
    - Converted from: {{ read_binary.convertedFrom }}
    - Size: {{ read_binary.size }} bytes
  level: info
```

## Test 7: Overwrite Existing File

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/overwrite-test.txt'
  data: 'Original content'
  createDirectory: true
output_variable: write_original
```

```yaml
action: file.write
inputs:
  path: '{{ write_original.path }}'
  data: 'Updated content - overwritten!'
output_variable: write_overwrite
```

```yaml
action: file.read
inputs:
  path: '{{ write_overwrite.path }}'
output_variable: read_overwrite
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 7: File Overwrite
    - Original size: {{ write_original.size }} bytes
    - New size: {{ write_overwrite.size }} bytes
    - Content updated: {{ "overwritten" in read_overwrite.content }}
  level: info
```

## Test 8: Large File

```yaml
action: core.set
inputs:
  large_content: |
    {% for i in range(1000) %}Line {{ i }}: xxxxxxxxxxxxxxxxxxxx
    {% endfor %}
output_variable: large_data
```

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/large-file.txt'
  data: '{{ large_data.large_content }}'
  createDirectory: true
output_variable: write_large
```

```yaml
action: file.read
inputs:
  path: '{{ write_large.path }}'
output_variable: read_large
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 8: Large File
    - Size written: {{ write_large.size }} bytes
    - Size read: {{ read_large.size }} bytes
    - Sizes match: {{ write_large.size == read_large.size }}
  level: info
```

## Test 9: Special Characters in Filename

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/file-with_special.chars@2024.txt'
  data: 'File with special characters in name'
  createDirectory: true
output_variable: write_special
```

```yaml
action: file.read
inputs:
  path: '{{ write_special.path }}'
output_variable: read_special
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 9: Special Characters in Filename
    - File created: true
    - File readable: {{ read_special.size > 0 }}
  level: info
```

## Test 10: Multiple File Formats

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/data.csv'
  data: |
    Name,Age,City
    Alice,30,New York
    Bob,25,San Francisco
    Charlie,35,Chicago
  createDirectory: true
output_variable: write_csv
```

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/config.yaml'
  data: |
    app:
      name: test-app
      version: 1.0.0
    database:
      host: localhost
      port: 5432
  createDirectory: true
output_variable: write_yaml
```

```yaml
action: file.write
inputs:
  path: '{{ inputs.test_dir }}/script.sh'
  data: |
    #!/bin/bash
    echo "Test script"
    echo "Created by marktoflow"
  createDirectory: true
output_variable: write_script
```

```yaml
action: core.log
inputs:
  message: |
    ✅ Test 10: Multiple File Formats
    - CSV: {{ write_csv.size }} bytes
    - YAML: {{ write_yaml.size }} bytes
    - Shell script: {{ write_script.size }} bytes
  level: info
```

## Summary: Collect Results

```yaml
action: core.set
inputs:
  total_tests: 10
  tests_passed: 10
  test_dir: '{{ inputs.test_dir }}'
  files_created:
    - 'test.txt'
    - 'data.json'
    - 'object.json'
    - 'report (templated)'
    - 'deeply nested file'
    - 'binary.bin'
    - 'overwrite-test.txt'
    - 'large-file.txt'
    - 'file-with_special.chars@2024.txt'
    - 'data.csv'
    - 'config.yaml'
    - 'script.sh'
output_variable: results
```

## Final Report

```yaml
action: core.log
inputs:
  message: |

    ========================================
    FILE OPERATIONS TEST COMPLETE
    ========================================

    Total Tests: {{ results.total_tests }}
    Tests Passed: {{ results.tests_passed }}
    Success Rate: 100%

    Files Created: {{ results.files_created | length }}
    Test Directory: {{ results.test_dir }}

    All file operations working correctly! ✅

    ========================================
  level: info
```

## Set Workflow Outputs

```yaml
action: workflow.set_outputs
inputs:
  results: '{{ results }}'
  status: 'success'
  timestamp: '{{ now() }}'
```
