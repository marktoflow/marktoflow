# Example Project for Documentation Maintenance Workflow

This is an example microservices project to demonstrate the documentation maintenance workflow.

## Project Structure

```
example-project/
├── src/
│   ├── auth-service/       # Authentication service (OUTDATED DOCS)
│   │   ├── README.md       # Documentation missing OAuth2, MFA, social login
│   │   └── server.py       # Code with new features
│   ├── payment-service/    # Payment processing (VALID DOCS)
│   │   ├── README.md       # Documentation is accurate
│   │   └── service.py      # Code matches docs
│   └── user-service/       # User management (NO DOCS YET)
│       └── api.py
```

## Testing the Workflow

From the marktoflow-automation root directory:

### 1. Dry Run (Preview Changes)

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=.marktoflow/workflows/doc-maintenance/example-project \
  --input component_pattern="src/*/" \
  --input dry_run=true \
  --agent ollama
```

Expected result:
- auth-service: NEEDS UPDATE (missing OAuth2, MFA, social login features)
- payment-service: VALID (documentation matches code)
- user-service: NEEDS UPDATE (no documentation exists)

### 2. Apply Updates

```bash
marktoflow bundle run .marktoflow/workflows/doc-maintenance \
  --input codebase_path=.marktoflow/workflows/doc-maintenance/example-project \
  --input component_pattern="src/*/" \
  --agent ollama
```

### 3. Review Changes

Check the generated report:
```bash
cat .marktoflow/state/doc-maintenance-report.md
```

Check updated files:
```bash
diff .marktoflow/workflows/doc-maintenance/example-project/src/auth-service/README.md.backup.* \
     .marktoflow/workflows/doc-maintenance/example-project/src/auth-service/README.md
```

## What Should Happen

### auth-service
**Before:** Basic documentation mentioning only login/register/password-reset
**After:** Updated to include OAuth2, JWT, MFA, social login, session management

### payment-service
**Before:** Accurate documentation
**After:** No changes (already valid)

### user-service
**Before:** No README.md
**After:** May create basic documentation (depending on workflow configuration)
