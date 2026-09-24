"""Build data/airports.json - airports for the cards' "nearest airport" pill.

Source: OurAirports (public domain), https://ourairports.com/data/
Kept: large and medium airports with scheduled passenger service and an
IATA code, in a box around Europe (incl. the Canaries, Azores, Cyprus,
Turkey). Output rows: [IATA, airport name, lat, lng, large (1/0)].

Usage:
    curl -sSfLO https://davidmegginson.github.io/ourairports-data/airports.csv
    python3 scripts/build_airports.py airports.csv
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "airports.json"
TYPES = {"large_airport", "medium_airport"}
SOUTH, NORTH, WEST, EAST = 26.0, 72.0, -32.0, 50.0
# Airspace closed to most European carriers - never suggest these
EXCLUDED_COUNTRIES = {"RU", "BY"}


def main() -> int:
    rows = []
    with Path(sys.argv[1]).open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["type"] not in TYPES or r["scheduled_service"] != "yes" or not r["iata_code"]:
                continue
            if r["iso_country"] in EXCLUDED_COUNTRIES:
                continue
            lat, lng = float(r["latitude_deg"]), float(r["longitude_deg"])
            if not (SOUTH <= lat <= NORTH and WEST <= lng <= EAST):
                continue
            # The airport's own name ("Region of Murcia International Airport") -
            # the municipality field is often an unfamiliar suburb ("Corvera")
            large = 1 if r["type"] == "large_airport" else 0
            rows.append([r["iata_code"], r["name"], round(lat, 4), round(lng, 4), large])
    rows.sort()
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT}: {len(rows)} airports")  # noqa: T201
    return 0


if __name__ == "__main__":
    sys.exit(main())
