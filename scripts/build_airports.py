"""Build data/airports.json - airports for the cards' "nearest airport" pill.

Sources:
- OurAirports (public domain), https://ourairports.com/data/ - the airports:
  large and medium airports marked as having scheduled service, with an
  IATA code, in a box around Europe (incl. the Canaries, Azores, Cyprus,
  Turkey).
- Jonty/airline-route-data (updated weekly; no license stated),
  https://github.com/Jonty/airline-route-data - used only as a yes/no check
  that an airport has at least one passenger airline route right now.
  OurAirports' "scheduled_service" flag is often stale (Lugano closed in
  2020), and some IATA codes that look like rail stations (X.., Q.., Z..)
  are real airports (XRY Jerez) - this check keeps only airports people
  can actually fly to. Nothing else is copied from it.

City: OurAirports' "municipality", unless data/airport_cities.json overrides
it (the municipality is sometimes a suburb nobody knows: RMU -> "Corvera").

Output rows: [IATA, airport name, lat, lng, large (1/0), city].

Usage:
    curl -sSfLO https://davidmegginson.github.io/ourairports-data/airports.csv
    curl -sSfLO https://raw.githubusercontent.com/Jonty/airline-route-data/main/airline_routes.json
    python3 scripts/build_airports.py airports.csv airline_routes.json
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"
OUT = DATA / "airports.json"
CITY_OVERRIDES = DATA / "airport_cities.json"
TYPES = {"large_airport", "medium_airport"}
SOUTH, NORTH, WEST, EAST = 26.0, 72.0, -32.0, 50.0
# Airspace closed to most European carriers - never suggest these
EXCLUDED_COUNTRIES = {"RU", "BY"}


def served_airports(routes_path: Path) -> set[str]:
    """IATA codes with at least one passenger airline route."""
    routes = json.loads(routes_path.read_text(encoding="utf-8"))
    return {code for code, airport in routes.items() if airport.get("routes")}


def clean_municipality(text: str) -> str:
    """ "Pisa (PI)" -> "Pisa", "London, Essex" -> "London", "Kuopio / Siilinjärvi" -> "Kuopio"."""
    return re.split(r"\s*[,(/]", text, maxsplit=1)[0].strip()


def main() -> int:
    if len(sys.argv) != 3:  # noqa: PLR2004
        sys.stderr.write(__doc__ or "")
        return 2
    served = served_airports(Path(sys.argv[2]))
    overrides: dict[str, str] = json.loads(CITY_OVERRIDES.read_text(encoding="utf-8"))
    rows = []
    unserved = []
    with Path(sys.argv[1]).open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["type"] not in TYPES or r["scheduled_service"] != "yes" or not r["iata_code"]:
                continue
            if r["iso_country"] in EXCLUDED_COUNTRIES:
                continue
            lat, lng = float(r["latitude_deg"]), float(r["longitude_deg"])
            if not (SOUTH <= lat <= NORTH and WEST <= lng <= EAST):
                continue
            if r["iata_code"] not in served:
                unserved.append(r["iata_code"])
                continue
            # The airport's own name ("Region of Murcia International Airport") -
            # the municipality field is often an unfamiliar suburb ("Corvera")
            large = 1 if r["type"] == "large_airport" else 0
            city = overrides.get(r["iata_code"]) or clean_municipality(r["municipality"])
            rows.append([r["iata_code"], r["name"], round(lat, 4), round(lng, 4), large, city])
    rows.sort()
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sys.stdout.write(f"Wrote {OUT}: {len(rows)} airports; left out {len(unserved)} "
                     f"with no airline routes: {' '.join(sorted(unserved))}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
