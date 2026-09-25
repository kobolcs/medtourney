"""Add map coordinates (lat/lng) to tournaments_data.json.

Runs after the scraper, as its own step: a geocoding problem must never
block the daily data update, so every failure here degrades to "no
coordinates" rather than an error.

Coordinates come from OpenStreetMap's Nominatim service, used within its
usage policy (https://operations.osmfoundation.org/policies/nominatim/):
at most one request per second, an identifying User-Agent, and a
persistent cache (geocode_cache.json, committed alongside the data) so each
location string is looked up once, not on every run. Misses are cached too
and only retried after MISS_RETRY_DAYS.

Location strings are free text typed by organisers ("Hotel Atlas - Novi
Pazar, SRB", "Church Hall, ENG", "42.1381, BUL"), so each is tried as a
cascade of progressively shorter queries, always restricted to the
tournament's country. Country- or region-level hits are rejected as too
coarse - an unplaced tournament is better than a pin in the middle of a
country.

Usage:
    python3 geocode_tournaments.py [--max-lookups N] [--data FILE] [--cache FILE]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from geocoding.beachfront import BEACHFRONT_M
from geocoding.common import DEFAULT_MAX_LOOKUPS, logger
from geocoding.pipeline import geocode_file


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", default="tournaments_data.json")
    parser.add_argument("--cache", default="geocode_cache.json")
    parser.add_argument("--max-lookups", type=int, default=DEFAULT_MAX_LOOKUPS)
    parser.add_argument(
        "--geonames", default=None,
        help="GeoNames cities1000.txt for the offline fallback (optional)",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    stats = geocode_file(
        Path(args.data), Path(args.cache), args.max_lookups,
        Path(args.geonames) if args.geonames else None,
    )
    logger.info(
        "Geocoded %d/%d tournaments (%d lookups), %d by the sea, %d within %d m of it",
        stats["placed"], stats["tournaments"], stats["lookups"], stats["seaside"],
        stats["beachfront"], BEACHFRONT_M,
    )
    return 0  # never fail the data update


if __name__ == "__main__":
    sys.exit(main())
