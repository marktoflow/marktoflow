---
metadata:
  name: discord-event-bot
  description: Listen for Discord messages and respond with AI
  version: "1.0"
  tags: [discord, event-driven, bot, daemon]
mode: daemon
sources:
  - kind: discord
    id: discord-bot
    options:
      token: "{{ env.DISCORD_BOT_TOKEN }}"
      intents: 33281  # GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT
    filter:
      - MESSAGE_CREATE
---

# Discord AI Bot (Event-Driven)

A continuously running workflow that listens for Discord messages
and responds using AI. Only processes messages that mention the bot.

## Connect to Discord

```yaml
action: event.connect
inputs:
  kind: discord
  id: discord-bot
  options:
    token: "{{ env.DISCORD_BOT_TOKEN }}"
    intents: 33281
  filter:
    - MESSAGE_CREATE
```

## Wait for Message

Wait for the next Discord message event.

```yaml
action: event.wait
inputs:
  source: discord-bot
  type: MESSAGE_CREATE
output: message_event
```

## Check if Bot was Mentioned

```yaml
action: core.set
inputs:
  is_mentioned: "{{ message_event.data.mentions | selectattr('bot') | list | length > 0 }}"
  message_content: "{{ message_event.data.content }}"
  channel_id: "{{ message_event.data.channel_id }}"
  author: "{{ message_event.data.author.username }}"
output: parsed
```

## Respond with AI

Only respond if the bot was mentioned.

```yaml
if: "{{ parsed.is_mentioned }}"
action: copilot
inputs:
  prompt: |
    You are a helpful Discord bot. A user named {{ parsed.author }} said:
    "{{ parsed.message_content }}"

    Respond helpfully and concisely.
  model: gpt-4o-mini
output: ai_response
```

## Log the interaction

```yaml
action: core.set
inputs:
  log: "Processed message from {{ parsed.author }}: {{ parsed.message_content | truncate(50) }}"
output: _log
```
