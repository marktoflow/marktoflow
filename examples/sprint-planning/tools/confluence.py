#!/usr/bin/env python3
"""
Confluence tool for sprint planning workflows.

Usage:
    ./confluence.py create_page --space=PROJ --parent_title="Sprint Planning" --title="..." --content="..."
"""

import argparse
import json
import sys
from datetime import datetime


def create_page(space: str, parent_title: str, title: str, content: str) -> dict:
    """Create a Confluence page."""
    page_id = datetime.now().strftime("%Y%m%d%H%M%S")
    return {
        "id": page_id,
        "title": title,
        "space": {"key": space},
        "version": {"number": 1},
        "body": {
            "storage": {
                "value": content,
                "representation": "storage",
            }
        },
        "url": f"https://confluence.example.com/display/{space}/{page_id}",
        "_links": {
            "webui": f"/display/{space}/{page_id}",
            "self": f"/rest/api/content/{page_id}",
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Confluence API tool")
    parser.add_argument("operation", choices=["create_page"])
    parser.add_argument("--space", required=True, help="Space key")
    parser.add_argument("--parent_title", help="Parent page title")
    parser.add_argument("--title", required=True, help="Page title")
    parser.add_argument("--content", required=True, help="Page content (HTML)")

    args = parser.parse_args()

    if args.operation == "create_page":
        result = create_page(args.space, args.parent_title, args.title, args.content)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
