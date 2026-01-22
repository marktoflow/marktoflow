#!/usr/bin/env python3
"""
NPM tool for dependency update workflows.

This script provides NPM operations for the dependency-update bundle.

Usage:
    ./npm.py outdated --path=/tmp/repo --format=json
    ./npm.py audit --path=/tmp/repo --format=json
    ./npm.py update --path=/tmp/repo --packages='["pkg1", "pkg2"]'
"""

import argparse
import json
import sys


def outdated(path: str, output_format: str = "json") -> dict:
    """List outdated dependencies."""
    return {
        "dependencies": [
            {
                "name": "express",
                "current": "4.17.1",
                "wanted": "4.18.2",
                "latest": "4.18.2",
                "type": "dependencies",
            },
            {
                "name": "lodash",
                "current": "4.17.20",
                "wanted": "4.17.21",
                "latest": "4.17.21",
                "type": "dependencies",
            },
            {
                "name": "jest",
                "current": "27.0.0",
                "wanted": "29.7.0",
                "latest": "29.7.0",
                "type": "devDependencies",
            },
        ],
        "total": 3,
    }


def audit(path: str, output_format: str = "json") -> dict:
    """Run security audit."""
    return {
        "vulnerabilities": {
            "critical": 0,
            "high": 1,
            "moderate": 2,
            "low": 3,
            "info": 0,
        },
        "advisories": [
            {
                "id": 1234,
                "module": "minimist",
                "severity": "high",
                "title": "Prototype Pollution",
                "url": "https://npmjs.com/advisories/1234",
                "recommendation": "Upgrade to version 1.2.6 or later",
            },
            {
                "id": 1235,
                "module": "glob-parent",
                "severity": "moderate",
                "title": "Regular Expression Denial of Service",
                "url": "https://npmjs.com/advisories/1235",
                "recommendation": "Upgrade to version 5.1.2 or later",
            },
        ],
    }


def update(path: str, packages: list) -> dict:
    """Update specified packages."""
    updated = []
    for pkg in packages:
        updated.append(
            {
                "name": pkg,
                "previous": "1.0.0",
                "updated": "2.0.0",
            }
        )

    return {
        "success": True,
        "updated": updated,
        "total": len(updated),
    }


def main():
    parser = argparse.ArgumentParser(description="NPM tool")
    parser.add_argument("operation", choices=["outdated", "audit", "update"])
    parser.add_argument("--path", required=True, help="Repository path")
    parser.add_argument("--format", default="json", help="Output format")
    parser.add_argument("--packages", help="JSON array of packages to update")

    args = parser.parse_args()

    if args.operation == "outdated":
        result = outdated(args.path, args.format)
    elif args.operation == "audit":
        result = audit(args.path, args.format)
    elif args.operation == "update":
        packages = json.loads(args.packages) if args.packages else []
        result = update(args.path, packages)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
