---
workflow:
  id: hello-world
  name: "Hello World"
  version: "1.0.0"
  description: "A simple example workflow"

# Uncomment and configure to use Slack:
# tools:
#   slack:
#     sdk: "@slack/web-api"
#     auth:
#       token: "${SLACK_BOT_TOKEN}"

steps:
  - id: greet
    action: console.log
    inputs:
      message: "Hello from marktoflow!"
---

# Hello World Workflow

This is a simple example workflow.

## Step 1: Greet

Outputs a greeting message.
