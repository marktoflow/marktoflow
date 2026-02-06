---
workflow:
  id: secrets-demo
  name: 'External Secrets Demo'
  version: '1.0.0'
  description: 'Demonstrates using external secret managers for secure credential management'

# Configure secret providers
secrets:
  providers:
    - type: env
      config: {}
      cacheEnabled: true
  defaultCacheTTL: 300  # 5 minutes
  referencePrefix: 'secret:'
  throwOnNotFound: true

# Tool configuration with secret references
tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${secret:env://SLACK_BOT_TOKEN}'

  github:
    sdk: '@octokit/rest'
    auth:
      token: '${secret:env://GITHUB_TOKEN}'

inputs:
  message:
    type: string
    required: true
    description: 'Message to post'
---

# External Secrets Demo

This workflow demonstrates how to use external secret managers with marktoflow.

## Supported Secret Providers

- **Vault**: HashiCorp Vault (KV v1/v2)
- **AWS**: AWS Secrets Manager
- **Azure**: Azure Key Vault
- **Env**: Environment Variables (for local development)

## Secret Reference Syntax

```yaml
auth:
  token: '${secret:vault://path/to/secret}'
  api_key: '${secret:aws://secret-name}'
  password: '${secret:azure://my-secret}'
  dev_token: '${secret:env://MY_TOKEN}'
```

### With JSON Key Extraction

```yaml
auth:
  # Extract specific key from JSON secret
  token: '${secret:vault://path/to/secret#access_token}'
  client_id: '${secret:vault://path/to/secret#client_id}'
```

## Step 1: Post to Slack

```yaml
action: slack.chat.postMessage
inputs:
  channel: '#general'
  text: '{{ inputs.message }}'
output_variable: slack_result
```

## Step 2: Create GitHub Issue

```yaml
action: github.rest.issues.create
inputs:
  owner: 'marktoflow'
  repo: 'marktoflow'
  title: 'Notification from Slack'
  body: 'Message posted: {{ inputs.message }}'
output_variable: github_result
```

## Usage

### 1. Set Environment Variables

```bash
export SLACK_BOT_TOKEN="xoxb-your-slack-token"
export GITHUB_TOKEN="ghp_your_github_token"
```

### 2. Run Workflow

```bash
./marktoflow run examples/secrets-example/workflow.md --input message="Hello from secrets!"
```

### 3. Use HashiCorp Vault

```yaml
secrets:
  providers:
    - type: vault
      config:
        address: 'https://vault.example.com'
        token: '${VAULT_TOKEN}'
        kvVersion: 2
        mountPath: 'secret'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${secret:vault://app/slack#bot_token}'
```

### 4. Use AWS Secrets Manager

```yaml
secrets:
  providers:
    - type: aws
      config:
        region: 'us-east-1'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${secret:aws://prod/slack/bot-token}'
```

### 5. Use Azure Key Vault

```yaml
secrets:
  providers:
    - type: azure
      config:
        vaultUrl: 'https://myvault.vault.azure.net'
        tenantId: '${AZURE_TENANT_ID}'
        clientId: '${AZURE_CLIENT_ID}'
        clientSecret: '${AZURE_CLIENT_SECRET}'

tools:
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${secret:azure://slack-bot-token}'
```

## Benefits

- ✅ **Centralized Secret Management**: Store secrets in secure external systems
- ✅ **No Hardcoded Credentials**: Never commit secrets to version control
- ✅ **Automatic Rotation**: Secrets can be rotated without workflow changes
- ✅ **Caching**: Configurable TTL reduces secret manager API calls
- ✅ **Multiple Providers**: Use different secret managers for different environments
- ✅ **JSON Key Extraction**: Extract specific keys from complex JSON secrets
