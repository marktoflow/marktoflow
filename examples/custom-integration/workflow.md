---
workflow:
  id: custom-integration-demo
  name: 'Custom Integration Demo'
  description: 'Demonstrates using a user-defined SDK integration'
  version: '1.0.0'

tools:
  weather:
    sdk: 'weather-api'

  core:
    sdk: 'core'

steps:
  - id: get-weather
    action: weather-api.getCurrent
    inputs:
      city: 'San Francisco'

  - id: format-report
    action: core.template
    inputs:
      template: |
        Weather Report for {{ steps.get-weather.city }}:
        Temperature: {{ steps.get-weather.temperature_c }}°C ({{ steps.get-weather.temperature_f }}°F)
        Feels like: {{ steps.get-weather.feels_like_c }}°C
        Humidity: {{ steps.get-weather.humidity }}%
        Wind: {{ steps.get-weather.wind_speed_kmph }} km/h
        Conditions: {{ steps.get-weather.description }}

  - id: show-result
    action: core.log
    inputs:
      message: '{{ steps.format-report }}'

outputs:
  weather:
    value: '{{ steps.get-weather }}'
  report:
    value: '{{ steps.format-report }}'
---

# Custom Integration Demo

This workflow demonstrates a **user-defined SDK integration** — the `weather-api`
integration is loaded automatically from the `./integrations/` directory.

## How It Works

1. marktoflow discovers `integrations/weather-api.ts` on startup
2. The integration is registered with the SDK registry
3. The workflow uses `weather-api.getCurrent` just like any built-in integration

## Running

```bash
marktoflow run workflow.md
```
