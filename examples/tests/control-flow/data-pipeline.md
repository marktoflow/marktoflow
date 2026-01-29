---
workflow:
  id: data-pipeline
  name: 'E-commerce Data Pipeline'
  description: 'Demonstrates map/filter/reduce transformations on order data'
  version: '1.0.0'

tools:
  http:
    sdk: 'axios'
  slack:
    sdk: '@slack/web-api'
    auth:
      token: '${SLACK_BOT_TOKEN}'

inputs:
  api_url:
    type: string
    required: true
    default: 'https://api.example.com/orders'
  threshold:
    type: number
    required: false
    default: 1000

triggers:
  - type: schedule
    config:
      cron: '0 9 * * 1'  # Every Monday at 9am
---

# E-commerce Data Pipeline

This workflow demonstrates the power of map/filter/reduce transformations for data processing.

## Step 1: Fetch Orders

```yaml
action: http.get
inputs:
  url: "{{ inputs.api_url }}"
output_variable: orders_response
```

## Step 2: Extract Order Data

```yaml
type: map
items: "{{ orders_response.data.orders }}"
item_variable: order
expression: "{{ order }}"
output_variable: orders
```

## Step 3: Filter High-Value Orders

Filter orders with amount >= threshold (default $1000)

```yaml
type: filter
items: "{{ orders }}"
item_variable: order
condition: "order.amount >= inputs.threshold"
output_variable: high_value_orders
```

## Step 4: Transform to Summary Format

```yaml
type: map
items: "{{ high_value_orders }}"
item_variable: order
expression: "Order #{{ order.id }}: ${{ order.amount }} from {{ order.customer }}"
output_variable: order_summaries
```

## Step 5: Calculate Total Revenue

```yaml
type: reduce
items: "{{ high_value_orders }}"
item_variable: order
accumulator_variable: total
initial_value: 0
expression: "{{ total }} + {{ order.amount }}"
output_variable: total_revenue
```

## Step 6: Post Report to Slack

```yaml
action: slack.chat.postMessage
inputs:
  channel: "#sales"
  text: |
    📊 Weekly High-Value Orders Report

    Found {{ high_value_orders.length }} orders >= ${{ inputs.threshold }}

    Orders:
    {{ order_summaries }}

    💰 Total Revenue: ${{ total_revenue }}
output_variable: slack_result
```

## Benefits

- **Type-Safe**: Each transformation step is validated
- **Efficient**: No intermediate copies, streaming transformations
- **Readable**: Declarative syntax makes data flow clear
- **Reusable**: Can be composed into larger workflows
