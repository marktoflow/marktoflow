---
workflow:
  id: doc-maintenance
  name: 'Documentation Maintenance Workflow'
  version: '2.0.0'
  description: 'Intelligently update component documentation across a codebase, only when documentation is outdated'
  author: 'marktoflow'
  tags:
    - documentation
    - maintenance
    - automation

tools:
  ollama:
    sdk: 'ollama'
    auth:
      host: '${OLLAMA_HOST}'

inputs:
  codebase_path:
    type: string
    description: 'Root path of the codebase to process'
    required: true
  component_pattern:
    type: string
    description: 'Glob pattern to identify components (e.g., "src/**/", "packages/*/")'
    default: 'src/*/'
  doc_files:
    type: array
    description: 'Documentation file patterns to check (README.md, DOCS.md, etc.)'
    default: ['README.md', 'DOCS.md', 'API.md']
  dry_run:
    type: boolean
    description: 'If true, show what would be updated without making changes'
    default: false
  exclude_patterns:
    type: array
    description: 'Patterns to exclude (node_modules, dist, etc.)'
    default: ['node_modules', 'dist', 'build', '__pycache__', '.git']
  max_components:
    type: number
    description: 'Maximum number of components to process (0 = unlimited)'
    default: 0

outputs:
  summary:
    type: object
    description: 'Summary of documentation updates'
  updated_components:
    type: array
    description: 'List of components with updated documentation'
---

# Documentation Maintenance Workflow

This workflow automatically maintains documentation across a large codebase by:
1. Identifying all components in the codebase
2. Analyzing code and existing documentation
3. Determining if documentation is outdated or inaccurate
4. Updating only documentation that needs updates
5. Preserving documentation that is still valid

## Step 1: Discover Components

Scan the codebase to identify all components based on the specified pattern.

```yaml
action: script.execute
inputs:
  script: discover_components.py
  args:
    codebase_path: '{{ inputs.codebase_path }}'
    pattern: '{{ inputs.component_pattern }}'
    exclude: '{{ inputs.exclude_patterns }}'
output_variable: components_list
```

## Step 2: Initialize Tracking

Initialize tracking variables for the documentation maintenance process.

```yaml
action: script.execute
inputs:
  script: init_tracking.py
  args:
    total_components: '{{ components_list.total }}'
output_variable: tracking
```

## Step 3: Process Each Component

Iterate through each component to analyze and update documentation as needed.

```yaml
type: for_each
items: '{{ components_list.components }}'
item_variable: component
steps:
  # Step 3.1: Analyze Component
  - id: analyze_component
    name: 'Analyze Component'
    action: ollama.analyze
    inputs:
      prompt: |
        You are a technical documentation auditor. Your task is to compare component code with its documentation and determine if the documentation is outdated or inaccurate.

        Component: {{ component.name }}
        Location: {{ component.path }}

        Documentation files found:
        {% for doc in component.docs %}
        - {{ doc.filename }}: {{ doc.size }} bytes, last modified {{ doc.modified }}
        {% endfor %}

        Code files ({{ component.code_files | length }} files):
        {% for file in component.code_files[:20] %}
        - {{ file.path }}
        {% endfor %}

        Your analysis should:
        1. Review the code structure, exported functions/classes, and key features
        2. Review the existing documentation content
        3. Identify specific areas where documentation is:
           - OUTDATED: Code changed but docs didn't
           - MISSING: Code features not documented
           - INACCURATE: Documentation describes incorrect behavior
        4. Ignore style/wording - focus only on technical accuracy

        Return a JSON object with this structure:
        {
          "needs_update": boolean,
          "confidence": "high" | "medium" | "low",
          "issues": [
            {
              "type": "outdated" | "missing" | "inaccurate",
              "severity": "critical" | "important" | "minor",
              "description": "Brief description of the issue",
              "location": "Which doc file or section"
            }
          ],
          "recommendation": "Brief recommendation for what to update"
        }

        If documentation is accurate and up-to-date, return needs_update: false.
      format: json
      context: '{{ component }}'
    output_variable: analysis

  # Step 3.2: Check if Update Needed and update if necessary
  - type: if
    condition: '{{ analysis.needs_update == true && (analysis.confidence == "high" || analysis.confidence == "medium") }}'
    then:
      # Step 3.3: Update Documentation
      - id: update_documentation
        name: 'Update Documentation'
        action: ollama.generate
        inputs:
          prompt: |
            You are a technical documentation writer. Update the documentation for this component based on the analysis.

            Component: {{ component.name }}
            Analysis: {{ analysis.recommendation }}

            Issues to address:
            {% for issue in analysis.issues %}
            - [{{ issue.severity }}] {{ issue.description }} (in {{ issue.location }})
            {% endfor %}

            CRITICAL RULES:
            1. Make ONLY the minimum changes necessary to fix the identified issues
            2. Preserve existing structure, formatting, and examples that are still valid
            3. Do NOT rephrase or reword content that is already accurate
            4. Keep the same tone and style as the existing documentation
            5. Update version numbers, API signatures, and technical details only where incorrect
            6. Add missing sections only for undocumented features

            Existing documentation:
            ---
            {{ component.docs | first | path('content') }}
            ---

            Return the updated documentation content, preserving all valid existing content.
          temperature: 0.3
        output_variable: updated_docs

      # Step 3.4: Write Updated Documentation
      - id: write_updated_docs
        name: 'Write Updated Documentation'
        action: script.execute
        inputs:
          script: write_docs.py
          args:
            component_path: '{{ component.path }}'
            doc_file: '{{ component.docs | first | path("filename") }}'
            content: '{{ updated_docs }}'
            dry_run: '{{ inputs.dry_run }}'
        output_variable: write_result

  # Step 3.5: Record Result
  - id: record_result
    name: 'Record Result'
    action: script.execute
    inputs:
      script: record_result.py
      args:
        component: '{{ component.name }}'
        updated: '{{ analysis.needs_update }}'
        issues: '{{ analysis.issues.length }}'
        confidence: '{{ analysis.confidence }}'
        dry_run: '{{ inputs.dry_run }}'
    output_variable: record

  # Step 3.6: Progress Update
  - id: progress_update
    name: 'Progress Update'
    action: core.log
    inputs:
      message: |
        [{{ loop.index + 1 }}/{{ components_list.total }}] {{ component.name }}
        - Status: {{ analysis.needs_update | ternary('UPDATED', 'VALID') }}
        - Confidence: {{ analysis.confidence }}
        - Issues: {{ analysis.issues.length }}
```

## Step 4: Generate Summary Report

```yaml
action: script.execute
inputs:
  script: generate_summary.py
  args:
    codebase_path: '{{ inputs.codebase_path }}'
    total_processed: '{{ components_list.total }}'
    dry_run: '{{ inputs.dry_run }}'
output_variable: summary
```

## Step 5: Output Results

```yaml
action: workflow.set_outputs
inputs:
  summary: '{{ summary }}'
  updated_components: '{{ summary.updated }}'
  valid_components: '{{ summary.valid }}'
  total_processed: '{{ components_list.total }}'
  dry_run: '{{ inputs.dry_run }}'
```

---

## Usage Examples

### Basic usage
```bash
marktoflow run examples/doc-maintenance/workflow.md \
  --input codebase_path=/path/to/project
```

### Dry run (preview changes)
```bash
marktoflow run examples/doc-maintenance/workflow.md \
  --input codebase_path=/path/to/project \
  --input dry_run=true
```

### Custom component pattern
```bash
marktoflow run examples/doc-maintenance/workflow.md \
  --input codebase_path=/path/to/project \
  --input component_pattern="packages/*/" \
  --input doc_files='["README.md","CONTRIBUTING.md"]'
```

### Process first 5 components only
```bash
marktoflow run examples/doc-maintenance/workflow.md \
  --input codebase_path=/path/to/project \
  --input max_components=5
```
