#!/usr/bin/env python3
"""
Write updated documentation to a file.
"""

import sys
import json
from pathlib import Path
from datetime import datetime


def write_documentation(
    component_path: str,
    doc_file: str,
    content: str,
    dry_run: bool = False,
) -> dict:
    """
    Write updated documentation content to file.

    Args:
        component_path: Path to component directory
        doc_file: Name of documentation file
        content: Updated content to write
        dry_run: If True, don't actually write the file

    Returns:
        Result dictionary
    """
    doc_path = Path(component_path) / doc_file

    if not doc_path.exists():
        return {
            "success": False,
            "error": f"Documentation file does not exist: {doc_path}",
            "written": False,
        }

    # Backup original content
    original_content = doc_path.read_text(encoding="utf-8")

    if dry_run:
        return {
            "success": True,
            "written": False,
            "dry_run": True,
            "file": str(doc_path),
            "original_size": len(original_content),
            "new_size": len(content),
            "size_change": len(content) - len(original_content),
        }

    # Create backup
    backup_path = doc_path.with_suffix(doc_path.suffix + f".backup.{int(datetime.now().timestamp())}")
    backup_path.write_text(original_content, encoding="utf-8")

    # Write new content
    doc_path.write_text(content, encoding="utf-8")

    return {
        "success": True,
        "written": True,
        "file": str(doc_path),
        "backup": str(backup_path),
        "original_size": len(original_content),
        "new_size": len(content),
        "size_change": len(content) - len(original_content),
    }


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Write documentation file")
    parser.add_argument("--component_path", required=True)
    parser.add_argument("--doc_file", required=True)
    parser.add_argument("--content", required=True)
    parser.add_argument("--dry_run", default="false")

    args = parser.parse_args()

    dry_run = args.dry_run.lower() in ("true", "1", "yes")

    result = write_documentation(
        args.component_path,
        args.doc_file,
        args.content,
        dry_run,
    )

    print(json.dumps(result, indent=2))

    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
