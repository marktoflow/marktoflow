#!/usr/bin/env python3
"""
Performance benchmark for OpenCode adapter.

Compares CLI mode vs Server mode performance across different scenarios.

Usage:
    python benchmark_opencode.py [options]

Options:
    --iterations N    Number of iterations per test (default: 5)
    --warmup N       Number of warmup iterations (default: 1)
    --mode MODE      Test only specific mode: cli, server, or both (default: both)
"""

import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path
from typing import List

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from marktoflow.agents.opencode import OpenCodeAdapter
from marktoflow.agents.base import AgentConfig
from marktoflow.core.models import ExecutionContext, Workflow, WorkflowMetadata


class BenchmarkResult:
    """Results from a benchmark run."""

    def __init__(self, name: str, times: List[float], mode: str):
        self.name = name
        self.times = times
        self.mode = mode

    @property
    def mean(self) -> float:
        return statistics.mean(self.times)

    @property
    def median(self) -> float:
        return statistics.median(self.times)

    @property
    def stdev(self) -> float:
        return statistics.stdev(self.times) if len(self.times) > 1 else 0.0

    @property
    def min_time(self) -> float:
        return min(self.times)

    @property
    def max_time(self) -> float:
        return max(self.times)

    def __str__(self) -> str:
        return (
            f"{self.name} ({self.mode})\n"
            f"  Mean:   {self.mean:.3f}s\n"
            f"  Median: {self.median:.3f}s\n"
            f"  StdDev: {self.stdev:.3f}s\n"
            f"  Min:    {self.min_time:.3f}s\n"
            f"  Max:    {self.max_time:.3f}s"
        )


async def benchmark_initialization(mode: str, iterations: int) -> BenchmarkResult:
    """Benchmark adapter initialization time."""
    times = []

    for i in range(iterations):
        config = AgentConfig(
            name="opencode",
            provider="opencode",
            extra={
                "opencode_mode": mode,
                "opencode_server_url": "http://localhost:4096",
            },
        )

        adapter = OpenCodeAdapter(config)

        start = time.perf_counter()
        try:
            await adapter.initialize()
            end = time.perf_counter()
            times.append(end - start)
        except Exception as e:
            print(f"  ✗ Initialization failed in {mode} mode: {e}")
            return BenchmarkResult(f"Initialization", [], mode)
        finally:
            await adapter.cleanup()

    return BenchmarkResult(f"Initialization", times, mode)


async def benchmark_simple_generation(
    mode: str, iterations: int
) -> BenchmarkResult:
    """Benchmark simple text generation."""
    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": mode,
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()

        times = []
        context = ExecutionContext(
            run_id="benchmark",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="bench",
                    name="bench",
                    description="benchmark",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        for i in range(iterations):
            start = time.perf_counter()
            try:
                await adapter.generate(
                    prompt="Say 'OK' and nothing else.",
                    context=context,
                )
                end = time.perf_counter()
                times.append(end - start)
            except Exception as e:
                print(f"  ✗ Generation failed: {e}")
                break

        return BenchmarkResult(f"Simple Generation", times, mode)

    finally:
        await adapter.cleanup()


async def benchmark_json_generation(mode: str, iterations: int) -> BenchmarkResult:
    """Benchmark structured JSON generation."""
    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": mode,
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()

        times = []
        context = ExecutionContext(
            run_id="benchmark",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="bench",
                    name="bench",
                    description="benchmark",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        schema = {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "count": {"type": "number"},
            },
        }

        for i in range(iterations):
            start = time.perf_counter()
            try:
                await adapter.analyze(
                    prompt="Return status='ok' and count=1",
                    context=context,
                    output_schema=schema,
                )
                end = time.perf_counter()
                times.append(end - start)
            except Exception as e:
                print(f"  ✗ JSON generation failed: {e}")
                break

        return BenchmarkResult(f"JSON Generation", times, mode)

    finally:
        await adapter.cleanup()


async def benchmark_multiple_requests(
    mode: str, iterations: int, requests_per_iteration: int = 3
) -> BenchmarkResult:
    """Benchmark multiple sequential requests (tests connection reuse)."""
    config = AgentConfig(
        name="opencode",
        provider="opencode",
        extra={
            "opencode_mode": mode,
            "opencode_server_url": "http://localhost:4096",
        },
    )

    adapter = OpenCodeAdapter(config)

    try:
        await adapter.initialize()

        times = []
        context = ExecutionContext(
            run_id="benchmark",
            workflow=Workflow(
                metadata=WorkflowMetadata(
                    id="bench",
                    name="bench",
                    description="benchmark",
                    version="1.0.0",
                ),
                steps=[],
            ),
            agent_name="opencode",
            agent_capabilities=adapter.capabilities,
        )

        for i in range(iterations):
            start = time.perf_counter()
            try:
                for j in range(requests_per_iteration):
                    await adapter.generate(
                        prompt=f"Say '{j}' and nothing else.",
                        context=context,
                    )
                end = time.perf_counter()
                times.append(end - start)
            except Exception as e:
                print(f"  ✗ Multiple requests failed: {e}")
                break

        return BenchmarkResult(
            f"Multiple Requests ({requests_per_iteration}x)", times, mode
        )

    finally:
        await adapter.cleanup()


async def run_benchmarks(mode: str, iterations: int, warmup: int) -> List[BenchmarkResult]:
    """Run all benchmarks for a specific mode."""
    results = []

    print(f"\n{'='*60}")
    print(f"Benchmarking {mode.upper()} Mode")
    print(f"{'='*60}")
    print(f"Iterations: {iterations}, Warmup: {warmup}\n")

    # Warmup
    if warmup > 0:
        print(f"Running {warmup} warmup iteration(s)...")
        config = AgentConfig(
            name="opencode",
            provider="opencode",
            extra={
                "opencode_mode": mode,
                "opencode_server_url": "http://localhost:4096",
            },
        )
        adapter = OpenCodeAdapter(config)
        try:
            await adapter.initialize()
            context = ExecutionContext(
                run_id="warmup",
                workflow=Workflow(
                    metadata=WorkflowMetadata(
                        id="warmup",
                        name="warmup",
                        description="warmup",
                        version="1.0.0",
                    ),
                    steps=[],
                ),
                agent_name="opencode",
                agent_capabilities=adapter.capabilities,
            )
            for _ in range(warmup):
                await adapter.generate(prompt="warmup", context=context)
        except Exception as e:
            print(f"  ⚠ Warmup failed: {e}")
        finally:
            await adapter.cleanup()
        print("✓ Warmup complete\n")

    # Run benchmarks
    benchmarks = [
        ("Initialization", benchmark_initialization),
        ("Simple Generation", benchmark_simple_generation),
        ("JSON Generation", benchmark_json_generation),
        ("Multiple Requests", benchmark_multiple_requests),
    ]

    for name, func in benchmarks:
        print(f"Running: {name}...")
        try:
            result = await func(mode, iterations)
            if result.times:
                results.append(result)
                print(f"✓ {name}: {result.mean:.3f}s (mean)")
            else:
                print(f"✗ {name}: No results")
        except Exception as e:
            print(f"✗ {name} failed: {e}")
            import traceback
            traceback.print_exc()

    return results


def print_comparison(cli_results: List[BenchmarkResult], server_results: List[BenchmarkResult]):
    """Print comparison table between CLI and Server modes."""
    print(f"\n{'='*60}")
    print("Performance Comparison")
    print(f"{'='*60}\n")

    print(f"{'Benchmark':<30} {'CLI (ms)':<15} {'Server (ms)':<15} {'Speedup':<10}")
    print("-" * 70)

    for cli_result in cli_results:
        # Find matching server result
        server_result = next(
            (r for r in server_results if r.name == cli_result.name), None
        )

        if server_result and cli_result.times and server_result.times:
            cli_ms = cli_result.mean * 1000
            server_ms = server_result.mean * 1000
            speedup = cli_ms / server_ms if server_ms > 0 else 0

            speedup_str = f"{speedup:.2f}x" if speedup > 1 else f"{1/speedup:.2f}x slower"

            print(
                f"{cli_result.name:<30} {cli_ms:>10.1f}     {server_ms:>10.1f}     {speedup_str}"
            )

    print()


async def main():
    """Run performance benchmarks."""
    parser = argparse.ArgumentParser(description="Benchmark OpenCode adapter performance")
    parser.add_argument(
        "--iterations", type=int, default=5, help="Number of iterations per test"
    )
    parser.add_argument(
        "--warmup", type=int, default=1, help="Number of warmup iterations"
    )
    parser.add_argument(
        "--mode",
        choices=["cli", "server", "both"],
        default="both",
        help="Mode to benchmark",
    )

    args = parser.parse_args()

    print("OpenCode Adapter Performance Benchmark")
    print(f"Iterations: {args.iterations}, Warmup: {args.warmup}")
    print()
    print("Prerequisites:")
    print("  - OpenCode CLI installed")
    print("  - OpenCode configured with a provider")
    print("  - For server mode: opencode serve --port 4096")
    print()

    cli_results = []
    server_results = []

    if args.mode in ("cli", "both"):
        cli_results = await run_benchmarks("cli", args.iterations, args.warmup)

    if args.mode in ("server", "both"):
        server_results = await run_benchmarks("server", args.iterations, args.warmup)

    # Detailed results
    print(f"\n{'='*60}")
    print("Detailed Results")
    print(f"{'='*60}\n")

    for result in cli_results + server_results:
        if result.times:
            print(result)
            print()

    # Comparison
    if cli_results and server_results:
        print_comparison(cli_results, server_results)

    # Recommendations
    print(f"{'='*60}")
    print("Recommendations")
    print(f"{'='*60}\n")

    if cli_results and server_results:
        init_cli = next((r for r in cli_results if "Initialization" in r.name), None)
        init_server = next(
            (r for r in server_results if "Initialization" in r.name), None
        )

        if init_cli and init_server and init_cli.times and init_server.times:
            if init_cli.mean < init_server.mean:
                print("• CLI mode has faster initialization")
                print("  → Use CLI for single-use scripts\n")
            else:
                print("• Server mode has faster initialization")
                print("  → Use Server for long-running processes\n")

        multi_cli = next(
            (r for r in cli_results if "Multiple Requests" in r.name), None
        )
        multi_server = next(
            (r for r in server_results if "Multiple Requests" in r.name), None
        )

        if multi_cli and multi_server and multi_cli.times and multi_server.times:
            speedup = multi_cli.mean / multi_server.mean
            if speedup > 1.2:
                print(f"• Server mode is {speedup:.1f}x faster for multiple requests")
                print("  → Use Server for workflows with many steps\n")
            elif speedup < 0.8:
                print(f"• CLI mode is {1/speedup:.1f}x faster for multiple requests")
                print("  → Use CLI for simple workflows\n")

    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
