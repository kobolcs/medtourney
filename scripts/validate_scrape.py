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
    python3 scripts/validate_scrape.py tournaments_data.json [previous.json] [metadata.json]
"""

from __future__ import annotations

import json
import math
import os
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

MIN_COUNT = 10
MIN_RATIO_VS_PREVIOUS = 0.70
PREVIOUS_MIN_FOR_RATIO = 100
MIN_TIME_CONTROL_SHARE = 0.60
MIN_URL_SHARE = 0.95
NEW_ARG, PREVIOUS_ARG, METADATA_ARG = 1, 2, 3
TOWN_MAX_LENGTH, AIRPORT_CITY_MAX_LENGTH = 120, 60
AIRPORT_MAX_KM, IATA_LENGTH = 150, 3


def _say(line: str) -> None:
    sys.stdout.write(line + "\n")


def _share(rows: list[dict], field: str) -> float:
    filled = sum(1 for row in rows if str(row.get(field) or "").strip())
    return filled / len(rows) if rows else 0.0


def _valid_date(value: object) -> bool:
    try:
        return isinstance(value, str) and date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def _row_problem(row: object) -> str | None:
    if not isinstance(row, dict):
        return "row is not an object"
    for field in ("name", "location", "category", "description", "url", "date"):
        if not isinstance(row.get(field), str):
            return f"{field} is missing or not a string"
    if not row["name"].strip() or not row["location"].strip():
        return "name or location is empty"
    return _dates_and_url_problem(row) or _enrichment_problem(row)


def _dates_and_url_problem(row: dict) -> str | None:
    if not _valid_date(row["date"]):
        return "invalid start date"
    end = row.get("dateTo")
    if "dateTo" in row and not isinstance(end, str):
        return "invalid end date"
    if end and (not _valid_date(end) or end < row["date"]):
        return "invalid end date"
    try:
        parsed = urlparse(row["url"])
    except ValueError:
        return "invalid URL"
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return "invalid URL"
    return None


def _enrichment_problem(row: dict) -> str | None:
    for field, lower, upper in (("lat", -90, 90), ("lng", -180, 180), ("seaM", 0, 500)):
        if field in row:
            value = row[field]
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return f"invalid {field}"
            if not math.isfinite(value) or not lower <= value <= upper:
                return f"invalid {field}"
    if "seaM" in row and not isinstance(row["seaM"], int):
        return "invalid seaM"
    return _place_problem(row)


def _place_problem(row: dict) -> str | None:
    if "coast" in row and row["coast"] not in ("med", "atlantic", "black", "caspian"):
        return "invalid coast"
    if "timeControl" in row and not isinstance(row["timeControl"], str):
        return "invalid time control"
    if "town" in row and (not isinstance(row["town"], str) or not 1 <= len(row["town"]) <= TOWN_MAX_LENGTH):
        return "invalid town"
    if "airport" in row:
        return _airport_problem(row["airport"])
    return None


def _airport_problem(airport: object) -> str | None:
    if not isinstance(airport, dict):
        return "invalid airport"
    iata, name, km = airport.get("iata"), airport.get("name"), airport.get("km")
    if not isinstance(iata, str) or len(iata) != IATA_LENGTH or not iata.isascii() or not iata.isalnum() or iata != iata.upper():
        return "invalid airport code"
    if not isinstance(name, str) or isinstance(km, bool) or not isinstance(km, int) or not 1 <= km <= AIRPORT_MAX_KM:
        return "invalid airport name or distance"
    if "city" in airport and (not isinstance(airport["city"], str) or not 1 <= len(airport["city"]) <= AIRPORT_CITY_MAX_LENGTH):
        return "invalid airport city"
    return None


def check(rows: list[dict], previous: list[dict] | None, allow_drop: bool = False) -> list[str]:
    """Return a list of problems (empty when the scrape looks healthy)."""
    problems: list[str] = []
    for index, row in enumerate(rows):
        problem = _row_problem(row)
        if problem:
            return [f"row {index + 1}: {problem}"]
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
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, list) else None


def _metadata_problems(path: str, count: int) -> list[str]:
    try:
        meta = json.loads(Path(path).read_text(encoding="utf-8"))
        generated = datetime.fromisoformat(meta["generatedAt"].replace("Z", "+00:00"))
        if generated.tzinfo is None or meta["keptRows"] != count:
            return ["metadata timestamp or keptRows does not match the snapshot"]
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return ["metadata is missing or malformed"]
    return []


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
    if len(argv) > METADATA_ARG:
        problems.extend(_metadata_problems(argv[METADATA_ARG], len(rows)))
    _say(f"Scraper produced {len(rows)} tournaments (previous run: {len(previous) if previous else 'n/a'})")
    for problem in problems:
        _say(f"::error::Refusing to publish: {problem}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
