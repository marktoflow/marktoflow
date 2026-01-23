#!/usr/bin/env python3
"""
Discover components in a codebase based on directory pattern.

This script scans a codebase to identify components (directories) and their documentation files.
"""

import sys
import json
from pathlib import Path
from typing import Any
import os


def find_components(
    codebase_path: str,
    pattern: str,
    exclude: list[str],
    doc_files: list[str] = None,
) -> dict[str, Any]:
    """
    Find all components matching the pattern in the codebase.

    Args:
        codebase_path: Root path of codebase
        pattern: Glob pattern for components (e.g., "src/*/")
        exclude: List of patterns to exclude
        doc_files: List of documentation filenames to look for

    Returns:
        Dictionary with component information
    """
    if doc_files is None:
        doc_files = ["README.md", "DOCS.md", "API.md"]

    base_path = Path(codebase_path).resolve()

    if not base_path.exists():
        return {
            "success": False,
            "error": f"Codebase path does not exist: {codebase_path}",
            "components": [],
            "total": 0,
        }

    components = []

    # Find directories matching the pattern
    for component_dir in base_path.glob(pattern):
        if not component_dir.is_dir():
            continue

        # Check if should be excluded
        should_exclude = False
        for exclude_pattern in exclude:
            if exclude_pattern in str(component_dir.relative_to(base_path)):
                should_exclude = True
                break

        if should_exclude:
            continue

        # Find documentation files in this component
        docs = []
        for doc_file in doc_files:
            doc_path = component_dir / doc_file
            if doc_path.exists():
                docs.append({
                    "filename": doc_file,
                    "path": str(doc_path),
                    "size": doc_path.stat().st_size,
                    "modified": doc_path.stat().st_mtime,
                    "content": doc_path.read_text(encoding="utf-8", errors="ignore")[:10000],  # First 10KB
                })

        # Find code files in this component
        code_files = []
        code_extensions = {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".cpp", ".c", ".h"}

        for code_file in component_dir.rglob("*"):
            if code_file.is_file() and code_file.suffix in code_extensions:
                # Skip excluded directories
                should_skip = False
                for exclude_pattern in exclude:
                    if exclude_pattern in str(code_file.relative_to(base_path)):
                        should_skip = True
                        break

                if not should_skip:
                    code_files.append({
                        "path": str(code_file.relative_to(component_dir)),
                        "extension": code_file.suffix,
                        "size": code_file.stat().st_size,
                    })

        # Only include components that have at least one doc file or code files
        if docs or code_files:
            components.append({
                "name": component_dir.name,
                "path": str(component_dir),
                "relative_path": str(component_dir.relative_to(base_path)),
                "docs": docs,
                "code_files": code_files[:100],  # Limit to first 100 files
                "total_code_files": len(code_files),
                "has_documentation": len(docs) > 0,
            })

    # Sort by name for consistent processing
    components.sort(key=lambda x: x["name"])

    return {
        "success": True,
        "components": components,
        "total": len(components),
        "codebase_path": str(base_path),
        "pattern": pattern,
    }


def main():
    """Main entry point for script execution."""
    import argparse

    parser = argparse.ArgumentParser(description="Discover components in a codebase")
    parser.add_argument("--codebase_path", required=True, help="Root path of codebase")
    parser.add_argument("--pattern", default="src/*/", help="Glob pattern for components")
    parser.add_argument("--exclude", default="node_modules,dist,build", help="Comma-separated exclude patterns")
    parser.add_argument("--doc_files", default="README.md,DOCS.md,API.md", help="Comma-separated doc filenames")

    args = parser.parse_args()

    exclude_list = [p.strip() for p in args.exclude.split(",") if p.strip()]
    doc_files_list = [f.strip() for f in args.doc_files.split(",") if f.strip()]

    result = find_components(
        args.codebase_path,
        args.pattern,
        exclude_list,
        doc_files_list,
    )

    print(json.dumps(result, indent=2))

    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
