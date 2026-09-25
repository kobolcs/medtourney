"""Check tracked files against the line limits in CLAUDE.md ("File size guidelines").

Limits are total lines (like `wc -l`) per extension. Files that were already
over their limit when the rule came in are listed in KNOWN with their line
count at that time: they are reported as warnings, and fail only if they grow
past that count. Any other file over its limit fails.

Keep LIMITS and KNOWN in step with the CLAUDE.md section.

Usage:
    python3 scripts/check_file_lengths.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

LIMITS = {".py": 400, ".ts": 300, ".robot": 400, ".md": 500}

# Over the limit on 2026-09-25 - split when next touched, then remove here.
KNOWN = {
    "TournamentProcessor.py": 506,
    "tests/python/test_geocode.py": 420,
    "src/services/FilterService.ts": 433,
    "src/app.ts": 420,
    "tests/e2e/dark-mode-and-ui.spec.ts": 390,
    "src/services/ExportService.ts": 330,
    "tests/e2e/keyboard-navigation.spec.ts": 329,
    "src/services/DataService.ts": 319,
    "src/services/UIManager.ts": 306,
    "TESTING.md": 724,
    "ARCHITECTURE.md": 611,
}


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", *(f"*{ext}" for ext in LIMITS)],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout
    return out.splitlines()


def main() -> int:
    failed = False
    for name in tracked_files():
        path = ROOT / name
        if not path.is_file():
            continue
        limit = LIMITS[path.suffix]
        with path.open(encoding="utf-8", errors="replace") as f:
            lines = sum(1 for _ in f)
        if lines <= limit:
            continue
        known = KNOWN.get(name)
        if known is not None and lines <= known:
            sys.stdout.write(f"warning: {name}: {lines} lines (limit {limit}; known, split when next touched)\n")
        elif known is not None:
            sys.stdout.write(f"error: {name}: grew from {known} to {lines} lines (limit {limit}) - split it first\n")
            failed = True
        else:
            sys.stdout.write(f"error: {name}: {lines} lines (limit {limit}) - split it, see CLAUDE.md\n")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
