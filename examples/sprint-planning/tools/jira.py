#!/usr/bin/env python3
"""
JIRA tool for sprint planning workflows.

Usage:
    ./jira.py search --jql="..." --fields='[...]' --max_results=50
    ./jira.py get_sprints --project=PROJ --state=closed --max_results=3
    ./jira.py get_sprint_report --sprint_ids='[1, 2, 3]'
    ./jira.py create_sprint --project=PROJ --name="Sprint 2024.01.01" --goal="..."
    ./jira.py move_issues_to_sprint --sprint_id=123 --issues='["PROJ-1", "PROJ-2"]'
"""

import argparse
import json
import sys
from datetime import datetime, timedelta


def search(jql: str, fields: list = None, max_results: int = 50) -> dict:
    """Search for JIRA issues."""
    issues = [
        {
            "key": "PROJ-101",
            "summary": "Implement user dashboard",
            "description": "Create a user dashboard with activity feed",
            "issuetype": {"name": "Story"},
            "priority": {"name": "High"},
            "customfield_10016": 8,  # Story Points
            "labels": ["frontend", "priority"],
            "components": [{"name": "UI"}],
            "assignee": {"displayName": "Alice"},
            "status": {"name": "Ready for Development"},
        },
        {
            "key": "PROJ-102",
            "summary": "API rate limiting",
            "description": "Implement rate limiting for public APIs",
            "issuetype": {"name": "Story"},
            "priority": {"name": "High"},
            "customfield_10016": 5,
            "labels": ["backend", "security"],
            "components": [{"name": "API"}],
            "assignee": {"displayName": "Bob"},
            "status": {"name": "Ready for Development"},
        },
        {
            "key": "PROJ-103",
            "summary": "Fix login redirect bug",
            "description": "Users not redirected properly after login",
            "issuetype": {"name": "Bug"},
            "priority": {"name": "Critical"},
            "customfield_10016": 3,
            "labels": ["bug", "auth"],
            "components": [{"name": "Auth"}],
            "assignee": None,
            "status": {"name": "Ready for Development"},
        },
    ]

    return {
        "total": len(issues),
        "issues": issues[:max_results],
    }


def get_sprints(project: str, state: str = "closed", max_results: int = 3) -> list:
    """Get sprints for a project."""
    sprints = []
    for i in range(max_results):
        sprint_start = datetime.now() - timedelta(weeks=(i + 1) * 2)
        sprint_end = sprint_start + timedelta(weeks=2)
        sprints.append(
            {
                "id": 100 + i,
                "name": f"Sprint {sprint_start.strftime('%Y.%m.%d')}",
                "state": state,
                "startDate": sprint_start.isoformat(),
                "endDate": sprint_end.isoformat(),
                "goal": f"Complete feature set {i + 1}",
            }
        )
    return sprints


def get_sprint_report(sprint_ids: list) -> list:
    """Get sprint reports."""
    reports = []
    for sprint_id in sprint_ids:
        reports.append(
            {
                "sprint_id": sprint_id,
                "completed_points": 21 + (sprint_id % 5),
                "committed_points": 24,
                "incomplete_points": 3 - (sprint_id % 3),
                "added_points": 2,
                "removed_points": 1,
                "issues_completed": 8,
                "issues_incomplete": 1,
                "velocity": 21 + (sprint_id % 5),
            }
        )
    return reports


def create_sprint(
    project: str, name: str, goal: str, start_date: str = None, end_date: str = None
) -> dict:
    """Create a new sprint."""
    return {
        "id": 999,
        "name": name,
        "goal": goal,
        "state": "future",
        "startDate": start_date or datetime.now().isoformat(),
        "endDate": end_date or (datetime.now() + timedelta(weeks=2)).isoformat(),
        "originBoardId": 1,
    }


def move_issues_to_sprint(sprint_id: int, issues: list) -> dict:
    """Move issues to a sprint."""
    return {
        "success": True,
        "sprint_id": sprint_id,
        "moved_issues": issues,
        "count": len(issues),
    }


def main():
    parser = argparse.ArgumentParser(description="JIRA API tool")
    parser.add_argument(
        "operation",
        choices=[
            "search",
            "get_sprints",
            "get_sprint_report",
            "create_sprint",
            "move_issues_to_sprint",
        ],
    )
    parser.add_argument("--jql", help="JQL query string")
    parser.add_argument("--fields", help="JSON array of fields to return")
    parser.add_argument("--max_results", type=int, default=50)
    parser.add_argument("--project", help="Project key")
    parser.add_argument("--state", default="closed", help="Sprint state")
    parser.add_argument("--sprint_ids", help="JSON array of sprint IDs")
    parser.add_argument("--name", help="Sprint name")
    parser.add_argument("--goal", help="Sprint goal")
    parser.add_argument("--start_date", help="Sprint start date")
    parser.add_argument("--end_date", help="Sprint end date")
    parser.add_argument("--sprint_id", type=int, help="Sprint ID")
    parser.add_argument("--issues", help="JSON array of issue keys")

    args = parser.parse_args()

    if args.operation == "search":
        fields = json.loads(args.fields) if args.fields else None
        result = search(args.jql, fields, args.max_results)
    elif args.operation == "get_sprints":
        result = get_sprints(args.project, args.state, args.max_results)
    elif args.operation == "get_sprint_report":
        sprint_ids = json.loads(args.sprint_ids) if args.sprint_ids else []
        result = get_sprint_report(sprint_ids)
    elif args.operation == "create_sprint":
        result = create_sprint(args.project, args.name, args.goal, args.start_date, args.end_date)
    elif args.operation == "move_issues_to_sprint":
        issues = json.loads(args.issues) if args.issues else []
        result = move_issues_to_sprint(args.sprint_id, issues)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
