#!/usr/bin/env python3
"""
PagerDuty tool for incident response workflows.

Usage:
    ./pagerduty.py get_oncall --service=api-service --escalation_levels='[1, 2]'
    ./pagerduty.py notify --users='["U123"]' --message="..." --urgency=high
"""

import argparse
import json
import sys


def get_oncall(service: str, escalation_levels: list = None) -> list:
    """Get on-call responders for a service."""
    responders = [
        {
            "id": "P123ABC",
            "name": "Alice Smith",
            "email": "alice@example.com",
            "slack_id": "U123ABC",
            "escalation_level": 1,
        },
        {
            "id": "P456DEF",
            "name": "Bob Jones",
            "email": "bob@example.com",
            "slack_id": "U456DEF",
            "escalation_level": 2,
        },
    ]

    if escalation_levels:
        responders = [r for r in responders if r["escalation_level"] in escalation_levels]

    return responders


def notify(users: list, message: str, urgency: str = "low") -> dict:
    """Notify users via PagerDuty."""
    return {
        "success": True,
        "notified_users": users,
        "message": message,
        "urgency": urgency,
    }


def main():
    parser = argparse.ArgumentParser(description="PagerDuty API tool")
    parser.add_argument("operation", choices=["get_oncall", "notify"])
    parser.add_argument("--service", help="Service name")
    parser.add_argument("--escalation_levels", help="JSON array of escalation levels")
    parser.add_argument("--users", help="JSON array of user IDs")
    parser.add_argument("--message", help="Notification message")
    parser.add_argument("--urgency", default="low", choices=["low", "high"])

    args = parser.parse_args()

    if args.operation == "get_oncall":
        levels = json.loads(args.escalation_levels) if args.escalation_levels else None
        result = get_oncall(args.service, levels)
    elif args.operation == "notify":
        users = json.loads(args.users) if args.users else []
        result = notify(users, args.message, args.urgency)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
