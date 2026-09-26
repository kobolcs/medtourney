"""Fetch chess-results.com tournament details pages and add them to the data.

Polite by design: an identifying User-Agent, at most one request per
second, a per-run cap (the first backfill spreads over several nights), a
persistent cache (details_cache.json, committed with the data) so each
tournament is fetched once and only refreshed after REFRESH_DAYS, and it
stops at the first sign of being blocked (HTTP 403/429) or after several
errors in a row. chess-results.com's robots.txt allows crawling.
"""

from __future__ import annotations

import json
import logging
import re
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from details.parse import parse_details

logger = logging.getLogger("details")

USER_AGENT = "MedTourney/3.0 (+https://github.com/kobolcs/medtourney)"
DETAILS_URL = "https://chess-results.com/tnr{}.aspx?lan=1&turdet=YES"
DEFAULT_MAX_FETCHES = 300
REQUEST_INTERVAL_S = 1.0
REFRESH_DAYS = 14
MISS_RETRY_DAYS = 3
MAX_CONSECUTIVE_ERRORS = 5
BLOCKED_STATUSES = {403, 429}

Fetcher = Callable[[str], str]


class Blocked(Exception):  # noqa: N818 - a condition, not a programming error
    """The site refused us (403/429): stop for this run."""


def tournament_id(url: str) -> str | None:
    match = re.search(r"tnr(\d+)\.aspx", url)
    return match.group(1) if match else None


def http_fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body: bytes = response.read()
            return body.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        if err.code in BLOCKED_STATUSES:
            raise Blocked(str(err.code)) from err
        raise


def _age_days(entry: dict[str, Any], now: datetime) -> float:
    try:
        fetched = datetime.fromisoformat(entry["fetched"])
    except (KeyError, ValueError):
        return float("inf")
    return (now - fetched).total_seconds() / 86400


def due(entry: dict[str, Any] | None, now: datetime) -> bool:
    """Never fetched, a miss older than MISS_RETRY_DAYS, or details older than REFRESH_DAYS."""
    if entry is None:
        return True
    limit = REFRESH_DAYS if entry.get("details") else MISS_RETRY_DAYS
    return _age_days(entry, now) > limit


def fetch_due(
    tournaments: list[dict[str, Any]],
    cache: dict[str, dict[str, Any]],
    fetch: Fetcher = http_fetch,
    max_fetches: int = DEFAULT_MAX_FETCHES,
    sleep: Callable[[float], None] = time.sleep,
    now: datetime | None = None,
) -> dict[str, int]:
    """Fetch the due pages into `cache`: never-fetched first, soonest events first."""
    now = now or datetime.now(UTC)
    ids = {}
    for t in sorted(tournaments, key=lambda t: str(t.get("date", ""))):
        tid = tournament_id(str(t.get("url", "")))
        if tid and tid not in ids:
            ids[tid] = cache.get(tid)
    queue = [tid for tid, entry in ids.items() if entry is None]
    queue += [tid for tid, entry in ids.items() if entry is not None and due(entry, now)]

    stats = {"fetched": 0, "found": 0, "errors": 0}
    consecutive_errors = 0
    for tid in queue[:max_fetches]:
        if stats["fetched"]:
            sleep(REQUEST_INTERVAL_S)
        stats["fetched"] += 1
        try:
            found = parse_details(fetch(DETAILS_URL.format(tid)))
        except Blocked as err:
            logger.warning("chess-results.com refused the request (%s) - stopping this run", err)
            stats["errors"] += 1
            break
        except (urllib.error.URLError, TimeoutError, OSError) as err:
            stats["errors"] += 1
            consecutive_errors += 1
            logger.warning("details %s: %s", tid, err)
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.warning("%d errors in a row - stopping this run", consecutive_errors)
                break
            continue
        consecutive_errors = 0
        cache[tid] = {"fetched": now.isoformat(timespec="seconds"), "details": found}
        if found:
            stats["found"] += 1
    return stats


def annotate(tournaments: list[dict[str, Any]], cache: dict[str, dict[str, Any]]) -> int:
    """Set each tournament's "details" from the cache (removed when there are none)."""
    count = 0
    for t in tournaments:
        tid = tournament_id(str(t.get("url", "")))
        found = cache.get(tid, {}).get("details") if tid else None
        if found:
            t["details"] = found
            count += 1
        else:
            t.pop("details", None)
    return count


def update_file(
    data_path: Path,
    cache_path: Path,
    fetch: Fetcher = http_fetch,
    max_fetches: int = DEFAULT_MAX_FETCHES,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, int]:
    """Fetch due details, save the cache, write "details" into the data file."""
    tournaments: list[dict[str, Any]] = json.loads(data_path.read_text(encoding="utf-8"))
    cache: dict[str, dict[str, Any]] = (
        json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    )
    stats = fetch_due(tournaments, cache, fetch, max_fetches, sleep)
    cache_path.write_text(json.dumps(dict(sorted(cache.items())), indent=1, ensure_ascii=False), encoding="utf-8")
    stats["with_details"] = annotate(tournaments, cache)
    # Same format as geocoding/pipeline.py writes, so the nightly diff stays small
    data_path.write_text(json.dumps(tournaments, indent=2, ensure_ascii=False), encoding="utf-8")
    return stats

