#!/usr/bin/env python3
"""Lightweight giant-file guard for AlphaNexus.

Run manually or from CI:
    python tools_check_file_sizes.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOTS = [Path("app/src"), Path("tests")]

SOFT = {
    "service": 500,
    "route": 300,
    "model": 300,
    "component": 300,
    "style": 400,
    "test": 400,
}
HARD = {
    "service": 800,
    "route": 500,
    "model": 450,
    "component": 500,
    "style": 700,
    "test": 700,
}
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"}


def classify(path: Path) -> str:
    full = str(path).replace("\\", "/").lower()
    name = path.name.lower()
    if full.startswith("tests/") or "/tests/" in full:
        return "test"
    if path.suffix.lower() == ".css" or "/styles/" in full:
        return "style"
    if "model" in name or "/models/" in full or "schema" in name or "dto" in name:
        return "model"
    if "route" in name or "ipc" in name or "preload" in name or "controller" in name:
        return "route"
    if path.suffix.lower() in {".tsx", ".jsx"} or "component" in name or "/components/" in full:
        return "component"
    return "service"


def line_count(path: Path) -> int:
    try:
        return path.read_text(encoding="utf-8").count("\n") + 1
    except Exception:
        return 0


def main() -> int:
    hard_failures: list[tuple[str, int, int]] = []
    soft_warnings: list[tuple[str, int, int]] = []

    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
                continue
            kind = classify(path)
            lines = line_count(path)
            if lines > HARD[kind]:
                hard_failures.append((str(path), lines, HARD[kind]))
            elif lines > SOFT[kind]:
                soft_warnings.append((str(path), lines, SOFT[kind]))

    if soft_warnings:
        print("Soft-limit warnings:")
        for path, lines, limit in sorted(soft_warnings, key=lambda x: x[1], reverse=True):
            print(f"  WARN {path}: {lines} lines (soft limit {limit})")

    if hard_failures:
        print("\nHard-limit failures:")
        for path, lines, limit in sorted(hard_failures, key=lambda x: x[1], reverse=True):
            print(f"  FAIL {path}: {lines} lines (hard limit {limit})")
        return 1

    print("No hard-limit violations detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
