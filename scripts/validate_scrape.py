"""Sanity-check a fresh scrape before it replaces the published data.

The scraper already fails loudly when chess-results.com's Excel export loses
its essential columns. This catches the quieter breakages: the export still
parses but comes back much smaller than yesterday, or a column (time control,
link) goes empty. Either way the site keeps serving yesterday's good data and
the workflow fails, which opens the "data update failed" issue.

Thresholds (current as of 2026-09-26; tune here as the data changes):
- at least 10 tournaments (unchanged from the original inline check)
- at least 70% of the previous run's count, when that run had 100+
- at least 60% of rows with a time-control value (typically ~96%)
- at least 95% of rows with a chess-results link (typically 100%)

Set ALLOW_DATA_DROP=1 to skip the comparison with the previous run, e.g. for a
manual run after a known, genuine drop.

Usage:
    python3 scripts/validate_scrape.py tournaments_data.json [previous.json]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

MIN_COUNT = 10
MIN_RATIO_VS_PREVIOUS = 0.70
PREVIOUS_MIN_FOR_RATIO = 100
MIN_TIME_CONTROL_SHARE = 0.60
MIN_URL_SHARE = 0.95
NEW_ARG, PREVIOUS_ARG = 1, 2


def _say(line: str) -> None:
    sys.stdout.write(line + "\n")


def _share(rows: list[dict], field: str) -> float:
    filled = sum(1 for row in rows if str(row.get(field) or "").strip())
    return filled / len(rows) if rows else 0.0


def check(rows: list[dict], previous: list[dict] | None, allow_drop: bool = False) -> list[str]:
    """Return a list of problems (empty when the scrape looks healthy)."""
    problems: list[str] = []
    count = len(rows)
    if count < MIN_COUNT:
        return [f"only {count} tournaments parsed (minimum {MIN_COUNT})"]

    if previous and not allow_drop and len(previous) >= PREVIOUS_MIN_FOR_RATIO:
        ratio = count / len(previous)
        if ratio < MIN_RATIO_VS_PREVIOUS:
            problems.append(
                f"{count} tournaments vs {len(previous)} last run "
                f"({ratio:.0%}, minimum {MIN_RATIO_VS_PREVIOUS:.0%})"
            )

    tc_share = _share(rows, "timeControl")
    if tc_share < MIN_TIME_CONTROL_SHARE:
        problems.append(
            f"only {tc_share:.0%} of rows have a time control (minimum {MIN_TIME_CONTROL_SHARE:.0%})"
        )

    url_share = _share(rows, "url")
    if url_share < MIN_URL_SHARE:
        problems.append(f"only {url_share:.0%} of rows have a link (minimum {MIN_URL_SHARE:.0%})")

    return problems


def _load(path: str) -> list[dict] | None:
    p = Path(path)
    if not p.is_file() or p.stat().st_size == 0:
        return None
    data = json.loads(p.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else None


def main(argv: list[str]) -> int:
    if len(argv) <= NEW_ARG:
        _say(__doc__ or "")
        return 2
    rows = _load(argv[1])
    if rows is None:
        _say(f"::error::{argv[1]} is missing or not a list")
        return 1
    previous = _load(argv[PREVIOUS_ARG]) if len(argv) > PREVIOUS_ARG else None
    allow_drop = os.environ.get("ALLOW_DATA_DROP") == "1"

    problems = check(rows, previous, allow_drop)
    _say(f"Scraper produced {len(rows)} tournaments (previous run: {len(previous) if previous else 'n/a'})")
    for problem in problems:
        _say(f"::error::Refusing to publish: {problem}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
