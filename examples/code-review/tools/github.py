#!/usr/bin/env python3
"""
GitHub tool for code review workflows.

This script provides GitHub API operations for the code-review bundle.
In production, this would call the real GitHub API. For demonstration,
it returns mock data.

Usage:
    ./github.py get_pull_request --repo=owner/repo --pr_number=123
    ./github.py list_pr_files --repo=owner/repo --pr_number=123
    ./github.py create_review --repo=owner/repo --pr_number=123 --body="..." --event=APPROVE
"""

import argparse
import json
import sys
from datetime import datetime


def get_pull_request(repo: str, pr_number: int) -> dict:
    """Get pull request details."""
    owner, repo_name = repo.split("/")
    return {
        "number": pr_number,
        "title": f"Feature: Add new functionality",
        "author": "developer",
        "state": "open",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "base": {"ref": "main"},
        "head": {"ref": f"feature/pr-{pr_number}"},
        "changed_files_count": 5,
        "additions": 150,
        "deletions": 30,
        "html_url": f"https://github.com/{repo}/pull/{pr_number}",
    }


def list_pr_files(repo: str, pr_number: int) -> list:
    """List files changed in a pull request."""
    return [
        {
            "filename": "src/main.py",
            "status": "modified",
            "additions": 50,
            "deletions": 10,
            "changes": 60,
            "patch": "@@ -1,10 +1,50 @@\n+def new_function():\n+    pass",
        },
        {
            "filename": "src/utils.py",
            "status": "added",
            "additions": 80,
            "deletions": 0,
            "changes": 80,
            "patch": "@@ -0,0 +1,80 @@\n+# New utility module",
        },
        {
            "filename": "tests/test_main.py",
            "status": "modified",
            "additions": 20,
            "deletions": 5,
            "changes": 25,
            "patch": "@@ -10,5 +10,20 @@\n+def test_new_function():",
        },
    ]


def create_review(repo: str, pr_number: int, body: str, event: str) -> dict:
    """Create a review on a pull request."""
    return {
        "id": 12345,
        "state": event,
        "body": body,
        "html_url": f"https://github.com/{repo}/pull/{pr_number}#pullrequestreview-12345",
        "submitted_at": datetime.now().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description="GitHub API tool")
    parser.add_argument("operation", choices=["get_pull_request", "list_pr_files", "create_review"])
    parser.add_argument("--repo", required=True, help="Repository in owner/repo format")
    parser.add_argument("--pr_number", type=int, required=True, help="Pull request number")
    parser.add_argument("--body", help="Review body text")
    parser.add_argument(
        "--event", choices=["APPROVE", "REQUEST_CHANGES", "COMMENT"], help="Review event type"
    )

    args = parser.parse_args()

    if args.operation == "get_pull_request":
        result = get_pull_request(args.repo, args.pr_number)
    elif args.operation == "list_pr_files":
        result = list_pr_files(args.repo, args.pr_number)
    elif args.operation == "create_review":
        if not args.body or not args.event:
            print(json.dumps({"error": "body and event are required for create_review"}))
            sys.exit(1)
        result = create_review(args.repo, args.pr_number, args.body, args.event)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
