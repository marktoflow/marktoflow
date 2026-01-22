#!/usr/bin/env python3
"""
GitHub tool for dependency update workflows.

Usage:
    ./github.py create_pull_request --repo=owner/repo --title="..." --body="..." --head=branch --base=main
    ./github.py enable_auto_merge --repo=owner/repo --pr_number=123 --merge_method=squash
"""

import argparse
import json
import sys
from datetime import datetime


def create_pull_request(
    repo: str, title: str, body: str, head: str, base: str, labels: list = None, draft: bool = False
) -> dict:
    """Create a pull request."""
    return {
        "number": 42,
        "title": title,
        "body": body,
        "head": {"ref": head},
        "base": {"ref": base},
        "html_url": f"https://github.com/{repo}/pull/42",
        "state": "open",
        "draft": draft,
        "labels": labels or [],
        "created_at": datetime.now().isoformat(),
    }


def enable_auto_merge(repo: str, pr_number: int, merge_method: str = "squash") -> dict:
    """Enable auto-merge for a pull request."""
    return {
        "success": True,
        "pr_number": pr_number,
        "merge_method": merge_method,
        "message": f"Auto-merge enabled for PR #{pr_number}",
    }


def main():
    parser = argparse.ArgumentParser(description="GitHub API tool")
    parser.add_argument("operation", choices=["create_pull_request", "enable_auto_merge"])
    parser.add_argument("--repo", required=True, help="Repository in owner/repo format")
    parser.add_argument("--title", help="PR title")
    parser.add_argument("--body", help="PR body")
    parser.add_argument("--head", help="Head branch")
    parser.add_argument("--base", default="main", help="Base branch")
    parser.add_argument("--labels", help="JSON array of labels")
    parser.add_argument("--draft", action="store_true", help="Create as draft")
    parser.add_argument("--pr_number", type=int, help="PR number")
    parser.add_argument("--merge_method", default="squash", help="Merge method")

    args = parser.parse_args()

    if args.operation == "create_pull_request":
        labels = json.loads(args.labels) if args.labels else None
        result = create_pull_request(
            args.repo, args.title, args.body, args.head, args.base, labels, args.draft
        )
    elif args.operation == "enable_auto_merge":
        result = enable_auto_merge(args.repo, args.pr_number, args.merge_method)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
