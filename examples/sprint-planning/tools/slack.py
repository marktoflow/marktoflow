#!/usr/bin/env python3
"""
Slack tool for sprint planning workflows.

Usage:
    ./slack.py post_message --channel=#sprint-planning --blocks='[...]'
"""

import argparse
import json
import sys
from datetime import datetime


def post_message(channel: str, text: str = None, blocks: list = None) -> dict:
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
    parser.add_argument("operation", choices=["post_message"])
    parser.add_argument("--channel", required=True, help="Slack channel")
    parser.add_argument("--text", help="Message text")
    parser.add_argument("--blocks", help="JSON array of message blocks")

    args = parser.parse_args()

    blocks = json.loads(args.blocks) if args.blocks else None

    if args.operation == "post_message":
        result = post_message(args.channel, args.text, blocks)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
