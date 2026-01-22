#!/usr/bin/env python3
"""
Slack tool for incident response workflows.

Usage:
    ./slack.py create_channel --name=inc-20240101 --private=false --description="..."
    ./slack.py post_message --channel=inc-20240101 --blocks='[...]'
    ./slack.py invite_users --channel=inc-20240101 --users='["U123", "U456"]'
"""

import argparse
import json
import sys
from datetime import datetime


def create_channel(name: str, private: bool = False, description: str = "") -> dict:
    """Create a Slack channel."""
    return {
        "ok": True,
        "id": f"C{name.upper().replace('-', '')}",
        "name": name,
        "is_private": private,
        "topic": description,
        "created": datetime.now().isoformat(),
    }


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


def invite_users(channel: str, users: list) -> dict:
    """Invite users to a channel."""
    return {
        "ok": True,
        "channel": channel,
        "invited_users": users,
    }


def main():
    parser = argparse.ArgumentParser(description="Slack API tool")
    parser.add_argument("operation", choices=["create_channel", "post_message", "invite_users"])
    parser.add_argument("--name", help="Channel name")
    parser.add_argument("--channel", help="Channel ID or name")
    parser.add_argument("--private", action="store_true", help="Create private channel")
    parser.add_argument("--description", default="", help="Channel description")
    parser.add_argument("--text", help="Message text")
    parser.add_argument("--blocks", help="JSON array of message blocks")
    parser.add_argument("--users", help="JSON array of user IDs")

    args = parser.parse_args()

    if args.operation == "create_channel":
        result = create_channel(args.name, args.private, args.description)
    elif args.operation == "post_message":
        blocks = json.loads(args.blocks) if args.blocks else None
        result = post_message(args.channel, args.text, blocks)
    elif args.operation == "invite_users":
        users = json.loads(args.users) if args.users else []
        result = invite_users(args.channel, users)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
