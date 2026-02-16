---
metadata:
  name: rss-feed-monitor
  description: Monitor an RSS feed for new articles and log them
  version: "1.0"
  tags: [rss, event-driven, monitoring, feeds]
mode: daemon
sources:
  - kind: rss
    id: tech-feed
    options:
      url: "https://hnrss.org/newest?points=100"
      interval: "5m"
      immediate: true
---

# RSS Feed Monitor

Continuously monitors an RSS feed and logs new articles as they appear.

## Wait for New Article

```yaml
action: event.wait
inputs:
  source: tech-feed
  type: new_item
output: article
```

## Extract Article Data

```yaml
action: core.set
inputs:
  title: "{{ article.data.title }}"
  link: "{{ article.data.link }}"
  published: "{{ article.data.pubDate }}"
  summary: "{{ article.data.description }}"
output: post
```

## Log New Article

```yaml
action: core.log
inputs:
  message: "📰 New article: {{ post.title }} — {{ post.link }}"
```
