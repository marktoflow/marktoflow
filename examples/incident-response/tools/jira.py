#!/usr/bin/env python3
"""
JIRA tool for incident response workflows.

Usage:
    ./jira.py create_issue --project=OPS --issue_type=Incident --summary="..." --description="..."
"""

import argparse
import json
import sys
from datetime import datetime


def create_issue(
    project: str,
    issue_type: str,
    summary: str,
    description: str,
    labels: list = None,
    priority: str = "Medium",
) -> dict:
    """Create a JIRA issue."""
    return {
        "key": f"{project}-{datetime.now().strftime('%H%M')}",
        "id": "12345",
        "self": f"https://jira.example.com/rest/api/2/issue/12345",
        "fields": {
            "project": {"key": project},
            "issuetype": {"name": issue_type},
            "summary": summary,
            "description": description,
            "labels": labels or [],
            "priority": {"name": priority},
        },
    }


def main():
    parser = argparse.ArgumentParser(description="JIRA API tool")
    parser.add_argument("operation", choices=["create_issue"])
    parser.add_argument("--project", required=True, help="Project key")
    parser.add_argument("--issue_type", required=True, help="Issue type")
    parser.add_argument("--summary", required=True, help="Issue summary")
    parser.add_argument("--description", default="", help="Issue description")
    parser.add_argument("--labels", help="JSON array of labels")
    parser.add_argument("--priority", default="Medium", help="Priority")

    args = parser.parse_args()

    labels = json.loads(args.labels) if args.labels else None

    if args.operation == "create_issue":
        result = create_issue(
            args.project, args.issue_type, args.summary, args.description, labels, args.priority
        )
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
