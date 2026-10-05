"""Compare TourneyRadar's upcoming API feed with MedTourney's event IDs.

This is a read-only coverage diagnostic. It never adds API rows to the
published tournament snapshot; unmatched events are candidates for review.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

API_URL = "https://tourneyradar-api.vercel.app/v1/tournaments"
DEFAULT_COUNTRIES = ("AT", "CZ", "DE", "FR", "HU", "SK")
PAGE_SIZE = 100
MAX_REQUESTS = 90  # API documents an anonymous limit of 100 requests/minute.
REQUEST_INTERVAL_S = 0.7
EVENT_ID_RE = re.compile(r"(?:cr_|tnr)(\d+)", re.IGNORECASE)

FetchPage = Callable[[str], dict[str, Any]]


def event_id(row: dict[str, Any]) -> str | None:
    """Return the Chess-Results tournament number used to deduplicate records."""
    for value in (row.get("source_url"), row.get("id")):
        if isinstance(value, str):
            match = EVENT_ID_RE.search(value)
            if match:
                return match.group(1)
    return None


def source_url(value: Any) -> str | None:
    """Accept only HTTPS links back to a Chess-Results tournament page."""
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    allowed_hosts = {"chess-results.com", "www.chess-results.com", "s1.chess-results.com"}
    if parsed.scheme != "https" or parsed.hostname not in allowed_hosts:
        return None
    if not re.search(r"/tnr\d+\.aspx(?:$|\?)", parsed.path + (f"?{parsed.query}" if parsed.query else ""), re.I):
        return None
    return value


def _valid_row(row: Any, country: str) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    tournament_id = event_id(row)
    url = source_url(row.get("source_url"))
    name = row.get("name")
    city = row.get("city")
    date = row.get("date")
    end_date = row.get("end_date") or date
    country_code = row.get("country_code")
    try:
        start_date = datetime.strptime(str(date), "%Y-%m-%d")
        finish_date = datetime.strptime(str(end_date), "%Y-%m-%d")
    except ValueError:
        return None
    if finish_date < start_date:
        return None
    if not tournament_id or not url or not isinstance(name, str) or not name.strip():
        return None
    if not isinstance(city, str) or not city.strip() or country_code != country:
        return None
    return {
        "eventId": tournament_id,
        "name": name.strip(),
        "city": city.strip(),
        "country": row.get("country") if isinstance(row.get("country"), str) else "",
        "countryCode": country,
        "date": date,
        "dateTo": end_date,
        "category": row.get("category") if isinstance(row.get("category"), str) else "",
        "timeControl": row.get("time_control") if isinstance(row.get("time_control"), str) else "",
        "sourceUrl": url,
    }


def fetch_page(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "MedTourney/3.0 (coverage diagnostic)"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload: Any = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as err:
        raise RuntimeError(f"TourneyRadar request failed: {err}") from err
    valid_shape = (
        isinstance(payload, dict)
        and isinstance(payload.get("data"), list)
        and isinstance(payload.get("meta"), dict)
    )
    if not valid_shape:
        raise RuntimeError("TourneyRadar response did not match the documented data/meta shape")
    return payload


def build_report(
    countries: Iterable[str],
    existing_ids: set[str],
    get_page: FetchPage = fetch_page,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    """Fetch bounded pages, dedupe on provider ID and stage unmatched rows."""
    candidate_by_id: dict[str, dict[str, Any]] = {}
    overlap_ids: set[str] = set()
    country_stats: dict[str, dict[str, int]] = {}
    request_count = 0
    api_rows = rejected_rows = duplicate_rows = 0

    for country in countries:
        code = country.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", code):
            raise ValueError(f"Invalid country code: {country!r}")
        page = 1
        stats = {"apiRows": 0, "validRows": 0, "overlap": 0, "candidates": 0}
        while True:
            if request_count >= MAX_REQUESTS:
                raise RuntimeError(f"Request cap ({MAX_REQUESTS}) reached; report is incomplete")
            if request_count:
                sleep(REQUEST_INTERVAL_S)
            query = urllib.parse.urlencode({"country": code, "upcoming": "true", "limit": PAGE_SIZE, "page": page})
            payload = get_page(f"{API_URL}?{query}")
            request_count += 1
            rows = payload["data"]
            meta = payload["meta"]
            if not isinstance(rows, list) or not isinstance(meta.get("hasMore"), bool):
                raise RuntimeError("TourneyRadar response has invalid pagination fields")
            api_rows += len(rows)
            stats["apiRows"] += len(rows)
            for raw in rows:
                row = _valid_row(raw, code)
                if row is None:
                    rejected_rows += 1
                    continue
                stats["validRows"] += 1
                identifier = row["eventId"]
                if identifier in existing_ids:
                    overlap_ids.add(identifier)
                    stats["overlap"] += 1
                elif identifier in candidate_by_id:
                    duplicate_rows += 1
                else:
                    candidate_by_id[identifier] = row
                    stats["candidates"] += 1
            if not meta["hasMore"]:
                break
            page += 1
        country_stats[code] = stats

    candidates = sorted(candidate_by_id.values(), key=lambda row: (row["date"], row["countryCode"], row["eventId"]))
    return {
        "source": "TourneyRadar public API; candidates only, not approved for publication",
        "countries": sorted(country_stats),
        "requestCount": request_count,
        "totals": {
            "apiRows": api_rows,
            "validRows": sum(stats["validRows"] for stats in country_stats.values()),
            "existingEventIds": len(overlap_ids),
            "candidateCount": len(candidates),
            "duplicateRows": duplicate_rows,
            "rejectedRows": rejected_rows,
        },
        "byCountry": country_stats,
        "candidates": candidates,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("tournaments_data.json"), help="MedTourney JSON snapshot")
    parser.add_argument("--countries", default=",".join(DEFAULT_COUNTRIES), help="Comma-separated ISO-2 country codes")
    parser.add_argument("--output", type=Path, help="Write JSON report here; default is stdout")
    args = parser.parse_args()

    data: Any = json.loads(args.data.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        parser.error("--data must contain a JSON array")
    existing_ids = {
        match.group(1)
        for row in data
        if isinstance(row, dict) and isinstance(row.get("url"), str)
        if (match := re.search(r"tnr(\d+)\.aspx", row["url"], re.I))
    }
    report = build_report(args.countries.split(","), existing_ids)
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(output, encoding="utf-8")
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
