#!/usr/bin/env python3
"""
Record result of processing a component.
"""

import sys
import json
from pathlib import Path


# Global tracking file (in workflow execution directory)
TRACKING_FILE = Path(".marktoflow/state/doc-maintenance-tracking.json")


def record_result(
    component: str,
    updated: bool,
    issues: int,
    confidence: str,
    dry_run: bool = False,
) -> dict:
    """
    Record the result of processing a component.

    Args:
        component: Component name
        updated: Whether documentation was updated
        issues: Number of issues found
        confidence: Confidence level of analysis
        dry_run: Whether this was a dry run

    Returns:
        Recording result
    """
    # Ensure tracking directory exists
    TRACKING_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Load existing tracking data
    if TRACKING_FILE.exists():
        tracking = json.loads(TRACKING_FILE.read_text())
    else:
        tracking = {
            "processed": 0,
            "updated": 0,
            "valid": 0,
            "components_updated": [],
            "components_valid": [],
        }

    # Update tracking
    tracking["processed"] += 1

    component_record = {
        "name": component,
        "issues": issues,
        "confidence": confidence,
        "dry_run": dry_run,
    }

    if updated:
        tracking["updated"] += 1
        tracking["components_updated"].append(component_record)
    else:
        tracking["valid"] += 1
        tracking["components_valid"].append(component_record)

    # Save tracking data
    TRACKING_FILE.write_text(json.dumps(tracking, indent=2))

    return {
        "success": True,
        "component": component,
        "updated": updated,
        "total_processed": tracking["processed"],
        "total_updated": tracking["updated"],
        "total_valid": tracking["valid"],
    }


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Record component result")
    parser.add_argument("--component", required=True)
    parser.add_argument("--updated", required=True)
    parser.add_argument("--issues", type=int, default=0)
    parser.add_argument("--confidence", default="medium")
    parser.add_argument("--dry_run", default="false")

    args = parser.parse_args()

    updated = args.updated.lower() in ("true", "1", "yes")
    dry_run = args.dry_run.lower() in ("true", "1", "yes")

    result = record_result(
        args.component,
        updated,
        args.issues,
        args.confidence,
        dry_run,
    )

    print(json.dumps(result, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
