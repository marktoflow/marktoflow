#!/usr/bin/env python3
"""
Slack tool for daily standup workflows.

This script provides Slack API operations for the daily-standup bundle.

Usage:
    ./slack.py get_messages --channel=#engineering --since_hours=24 --limit=50
    ./slack.py post_message --channel=#engineering --text="..." --blocks='[...]'
"""

import argparse
import json
import sys
from datetime import datetime, timedelta


def get_messages(channel: str, since_hours: int, limit: int) -> list:
    """Get recent messages from a channel."""
    # Simulate Slack messages
    return [
        {
            "user": "U123ABC",
            "user_name": "alice",
            "text": "Finished the authentication module yesterday. Starting on API integration today.",
            "ts": (datetime.now() - timedelta(hours=2)).isoformat(),
        },
        {
            "user": "U456DEF",
            "user_name": "bob",
            "text": "Still working on the database migration. Might need help with the schema changes.",
            "ts": (datetime.now() - timedelta(hours=4)).isoformat(),
        },
        {
            "user": "U789GHI",
            "user_name": "carol",
            "text": "PR #42 is ready for review. Also updated the documentation.",
            "ts": (datetime.now() - timedelta(hours=6)).isoformat(),
        },
    ][:limit]


def post_message(channel: str, text: str, blocks: list = None) -> dict:
    """Post a message to a channel."""
    return {
        "ok": True,
        "channel": channel,
        "ts": datetime.now().isoformat(),
        "message": {
            "text": text,
            "blocks": blocks,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Slack API tool")
    parser.add_argument("operation", choices=["get_messages", "post_message"])
    parser.add_argument("--channel", required=True, help="Slack channel")
    parser.add_argument("--since_hours", type=int, default=24, help="Hours to look back")
    parser.add_argument("--limit", type=int, default=50, help="Maximum messages to return")
    parser.add_argument("--text", help="Message text")
    parser.add_argument("--blocks", help="JSON array of message blocks")

    args = parser.parse_args()

    if args.operation == "get_messages":
        result = get_messages(args.channel, args.since_hours, args.limit)
    elif args.operation == "post_message":
        if not args.text:
            print(json.dumps({"error": "text is required for post_message"}))
            sys.exit(1)
        blocks = json.loads(args.blocks) if args.blocks else None
        result = post_message(args.channel, args.text, blocks)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
