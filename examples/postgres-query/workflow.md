---
workflow:
  id: postgres-query
  name: 'PostgreSQL Database Query'
  version: '2.0.0'
  description: 'Execute queries against a PostgreSQL database'
  author: 'marktoflow'
  tags:
    - database
    - postgres
    - sql

tools:
  db:
    sdk: 'pg'
    auth:
      host: '${POSTGRES_HOST}'
      port: '${POSTGRES_PORT}'
      database: '${POSTGRES_DATABASE}'
      user: '${POSTGRES_USER}'
      password: '${POSTGRES_PASSWORD}'
      ssl: 'false'

triggers:
  - type: manual

inputs:
  query:
    type: string
    required: true
    description: 'SQL query to execute'
  params:
    type: array
    default: []
    description: 'Query parameters for prepared statements'
  limit:
    type: number
    default: 100
    description: 'Maximum rows to return'

outputs:
  rows:
    type: array
    description: 'Query result rows'
  row_count:
    type: number
    description: 'Number of rows returned'
---

# PostgreSQL Database Query

Execute SQL queries against a PostgreSQL database with parameterized queries for safety.

## Step 1: Execute Query

```yaml
action: db.query
inputs:
  text: '{{ inputs.query }} LIMIT {{ inputs.limit }}'
  values: '{{ inputs.params }}'
output_variable: query_result
```

## Step 2: Log Result Summary

```yaml
action: console.log
inputs:
  message: 'Query executed successfully. Returned {{ query_result.rows.length }} rows.'
```

## Step 3: Set Outputs

```yaml
action: workflow.set_outputs
inputs:
  rows: '{{ query_result.rows }}'
  row_count: '{{ query_result.rows.length }}'
```

---

## Setup Instructions

1. **Set Environment Variables:**
   ```bash
   export POSTGRES_HOST=localhost
   export POSTGRES_PORT=5432
   export POSTGRES_DATABASE=mydb
   export POSTGRES_USER=postgres
   export POSTGRES_PASSWORD=your_password
   ```

2. **Run Query:**
   ```bash
   marktoflow run examples/postgres-query/workflow.md \
     --input query="SELECT * FROM users WHERE status = \$1" \
     --input params='["active"]'
   ```

## Example Queries

### Select all users
```bash
marktoflow run examples/postgres-query/workflow.md \
  --input query="SELECT id, name, email FROM users ORDER BY created_at DESC"
```

### Parameterized query
```bash
marktoflow run examples/postgres-query/workflow.md \
  --input query="SELECT * FROM orders WHERE customer_id = \$1 AND status = \$2" \
  --input params='[123, "completed"]'
```

### Aggregation query
```bash
marktoflow run examples/postgres-query/workflow.md \
  --input query="SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
```

## Security Notes

- Always use parameterized queries (`$1`, `$2`, etc.) to prevent SQL injection
- The `params` input accepts an array of values that map to placeholders
- Database credentials are stored in environment variables, not in the workflow
