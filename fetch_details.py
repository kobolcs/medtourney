"""Add chess-results.com tournament details to tournaments_data.json.

Runs after the scraper and the geocoder, as its own step: a problem here
must never block the daily data update, so every failure degrades to "no
details" for the affected tournaments rather than an error. See
details/pipeline.py for the fetch policy (rate, cap, cache, refresh).

Usage:
    python3 fetch_details.py [--max-fetches N] [--data FILE] [--cache FILE]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from details.pipeline import DEFAULT_MAX_FETCHES, logger, update_file


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--data", default="tournaments_data.json")
    parser.add_argument("--cache", default="details_cache.json")
    parser.add_argument("--max-fetches", type=int, default=DEFAULT_MAX_FETCHES)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    stats = update_file(Path(args.data), Path(args.cache), max_fetches=args.max_fetches)
    logger.info(
        "Fetched %d pages (%d with details, %d errors); %d tournaments now have details",
        stats["fetched"], stats["found"], stats["errors"], stats["with_details"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
