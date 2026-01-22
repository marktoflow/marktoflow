#!/usr/bin/env python3
"""
Datadog tool for incident response workflows.

Usage:
    ./datadog.py get_metrics --service=api-service --metrics='["system.cpu.user"]' --timeframe=1h
"""

import argparse
import json
import sys
from datetime import datetime, timedelta


def get_metrics(service: str, metrics: list, timeframe: str = "1h") -> dict:
    """Get metrics for a service."""
    # Parse timeframe
    hours = int(timeframe.replace("h", ""))
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=hours)

    results = {}
    for metric in metrics:
        results[metric] = {
            "avg": 45.2 if "cpu" in metric else 1024.5,
            "max": 85.0 if "cpu" in metric else 2048.0,
            "min": 10.0 if "cpu" in metric else 512.0,
            "latest": 52.3 if "cpu" in metric else 1536.0,
        }

    return {
        "service": service,
        "timeframe": {
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        },
        "metrics": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Datadog API tool")
    parser.add_argument("operation", choices=["get_metrics"])
    parser.add_argument("--service", required=True, help="Service name")
    parser.add_argument("--metrics", required=True, help="JSON array of metric names")
    parser.add_argument("--timeframe", default="1h", help="Timeframe (e.g., 1h, 24h)")

    args = parser.parse_args()

    metrics = json.loads(args.metrics) if args.metrics else []

    if args.operation == "get_metrics":
        result = get_metrics(args.service, metrics, args.timeframe)
    else:
        print(json.dumps({"error": f"Unknown operation: {args.operation}"}))
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
