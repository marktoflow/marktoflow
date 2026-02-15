---
metadata:
  name: websocket-price-monitor
  description: Monitor cryptocurrency prices via WebSocket and alert on big moves
  version: "1.0"
  tags: [websocket, event-driven, monitoring, crypto]
mode: daemon
sources:
  - kind: websocket
    id: binance
    options:
      url: "wss://stream.binance.com:9443/ws/btcusdt@ticker"
---

# Crypto Price Monitor (WebSocket)

Connects to Binance WebSocket stream and alerts when Bitcoin
price changes more than 2% in a tick.

## Connect to Price Feed

```yaml
action: event.connect
inputs:
  kind: websocket
  id: binance
  options:
    url: "wss://stream.binance.com:9443/ws/btcusdt@ticker"
```

## Wait for Price Update

```yaml
action: event.wait
inputs:
  source: binance
output: ticker
```

## Check for Significant Move

```yaml
action: core.set
inputs:
  price_change_pct: "{{ ticker.data.P | float }}"
  current_price: "{{ ticker.data.c }}"
  symbol: "{{ ticker.data.s }}"
  is_significant: "{{ ticker.data.P | float | abs > 2.0 }}"
output: analysis
```

## Alert on Big Moves

```yaml
if: "{{ analysis.is_significant }}"
action: core.set
inputs:
  alert: "🚨 {{ analysis.symbol }} moved {{ analysis.price_change_pct }}% — now ${{ analysis.current_price }}"
output: _alert
```
