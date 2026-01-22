#!/usr/bin/env python3
"""
GitHub tool for incident response workflows.

Usage:
    ./github.py list_deployments --repo=owner/repo --environment=production --per_page=5
"""

import argparse
import json
import sys
from datetime import datetime, timedelta


def list_deployments(repo: str, environment: str = "production", per_page: int = 5) -> list:
    """List recent deployments."""
    deployments = []
    for i in range(per_page):
        deployments.append(
            {
                "id": 1000 + i,
                "sha": f"abc{i}234567890",
                "ref": "main",
                "environment": environment,
                "creator": ["alice", "bob", "carol"][i % 3],
                "created_at": (datetime.now() - timedelta(hours=i * 24)).isoformat(),
                "status": "success",
            }
        )
    return deployments


def main():
    parser = argparse.ArgumentParser(description="GitHub API tool")
    parser.add_argument("operation", choices=["list_deployments"])
    parser.add_argument("--repo", required=True, help="Repository in owner/repo format")
    parser.add_argument("--environment", default="production", help="Environment name")
    parser.add_argument("--per_page", type=int, default=5, help="Number of results")

    args = parser.parse_args()

    if args.operation == "list_deployments":
        result = list_deployments(args.repo, args.environment, args.per_page)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
