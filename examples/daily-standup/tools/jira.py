#!/usr/bin/env python3
"""
JIRA tool for daily standup workflows.

This script provides JIRA API operations for the daily-standup bundle.

Usage:
    ./jira.py search --jql="project = PROJ AND updated >= -24h" --fields='[...]'
"""

import argparse
import json
import sys
from datetime import datetime


def search(jql: str, fields: list = None) -> dict:
    """Search for JIRA issues."""
    # Simulate JIRA search results
    issues = [
        {
            "key": "PROJ-123",
            "summary": "Implement user authentication",
            "status": "In Progress",
            "assignee": "alice",
            "updated": datetime.now().isoformat(),
            "priority": "High",
        },
        {
            "key": "PROJ-124",
            "summary": "Database migration script",
            "status": "In Progress",
            "assignee": "bob",
            "updated": datetime.now().isoformat(),
            "priority": "Medium",
        },
        {
            "key": "PROJ-125",
            "summary": "Update API documentation",
            "status": "Done",
            "assignee": "carol",
            "updated": datetime.now().isoformat(),
            "priority": "Low",
        },
    ]

    return {
        "total": len(issues),
        "issues": issues,
    }


def main():
    parser = argparse.ArgumentParser(description="JIRA API tool")
    parser.add_argument("operation", choices=["search"])
    parser.add_argument("--jql", required=True, help="JQL query string")
    parser.add_argument("--fields", help="JSON array of fields to return")

    args = parser.parse_args()

    fields = json.loads(args.fields) if args.fields else None

    if args.operation == "search":
        result = search(args.jql, fields)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
