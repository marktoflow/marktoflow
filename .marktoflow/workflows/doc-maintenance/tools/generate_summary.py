#!/usr/bin/env python3
"""
Generate summary report for documentation maintenance workflow.
"""

import sys
import json
from pathlib import Path
from datetime import datetime


TRACKING_FILE = Path(".marktoflow/state/doc-maintenance-tracking.json")


def generate_summary(
    codebase_path: str,
    total_processed: int,
    dry_run: bool = False,
) -> dict:
    """
    Generate summary report from tracking data.

    Args:
        codebase_path: Path to codebase
        total_processed: Total components processed
        dry_run: Whether this was a dry run

    Returns:
        Summary dictionary
    """
    # Load tracking data
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

    summary = {
        "codebase_path": codebase_path,
        "total_processed": tracking.get("processed", 0),
        "total_updated": tracking.get("updated", 0),
        "total_valid": tracking.get("valid", 0),
        "dry_run": dry_run,
        "completed_at": datetime.now().isoformat(),
        "updated": tracking.get("components_updated", []),
        "valid": tracking.get("components_valid", []),
    }

    # Calculate statistics
    if summary["total_processed"] > 0:
        summary["update_rate"] = (summary["total_updated"] / summary["total_processed"]) * 100
        summary["validity_rate"] = (summary["total_valid"] / summary["total_processed"]) * 100
    else:
        summary["update_rate"] = 0
        summary["validity_rate"] = 0

    # Generate markdown report
    report_lines = [
        "# Documentation Maintenance Report",
        "",
        f"**Codebase:** {codebase_path}",
        f"**Completed:** {summary['completed_at']}",
        f"**Dry Run:** {'Yes' if dry_run else 'No'}",
        "",
        "## Summary",
        "",
        f"- **Total Components Processed:** {summary['total_processed']}",
        f"- **Documentation Updated:** {summary['total_updated']} ({summary['update_rate']:.1f}%)",
        f"- **Documentation Valid:** {summary['total_valid']} ({summary['validity_rate']:.1f}%)",
        "",
    ]

    if summary["updated"]:
        report_lines.extend([
            "## Updated Components",
            "",
        ])
        for comp in summary["updated"]:
            report_lines.append(f"- **{comp['name']}** - {comp['issues']} issues (confidence: {comp['confidence']})")
        report_lines.append("")

    if summary["valid"]:
        report_lines.extend([
            "## Valid Components (No Updates Needed)",
            "",
        ])
        for comp in summary["valid"][:10]:  # Show first 10
            report_lines.append(f"- {comp['name']}")
        if len(summary["valid"]) > 10:
            report_lines.append(f"- ... and {len(summary['valid']) - 10} more")
        report_lines.append("")

    summary["report_markdown"] = "\n".join(report_lines)

    # Save report
    report_path = Path(".marktoflow/state/doc-maintenance-report.md")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(summary["report_markdown"])
    summary["report_path"] = str(report_path)

    return summary


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate summary report")
    parser.add_argument("--codebase_path", required=True)
    parser.add_argument("--total_processed", type=int, required=True)
    parser.add_argument("--dry_run", default="false")

    args = parser.parse_args()

    dry_run = args.dry_run.lower() in ("true", "1", "yes")

    result = generate_summary(
        args.codebase_path,
        args.total_processed,
        dry_run,
    )

    print(json.dumps(result, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())
