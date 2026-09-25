"""Nearest airport with scheduled flights (travel context on the cards)."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from geocoding.beachfront import km_between

# --- Nearest airport (travel context on the cards) ---------------------------
#
# Straight-line distance to the nearest airport with passenger airline routes,
# from data/airports.json (OurAirports, public domain, checked against a weekly
# airline-route list; built by scripts/build_airports.py). Offline, recomputed
# every run. Rows: [IATA, name, lat, lng, large (1/0), city].

AIRPORTS_FILE = Path(__file__).parent.parent / "data" / "airports.json"


AIRPORT_SEARCH_DEG = 3  # grid cells searched around a point (~300 km)
# Prefer a large (international) airport over a nearer small one when it is
# at most this much further: Hvar -> Split, not the seasonal Brac strip;
# Reykjavik -> Keflavik, not the domestic airport
LARGE_AIRPORT_DETOUR_KM = 40
# Beyond this, "nearest airport" isn't useful travel context (e.g. Ukraine,
# with no civilian flights since 2022) - no pill rather than a misleading one
MAX_AIRPORT_KM = 150


class Airports:
    def __init__(self, rows: list[list[Any]]) -> None:
        self.grid: dict[tuple[int, int], list[tuple[str, str, float, float, bool, str]]] = {}
        for iata, name, lat, lng, large, *rest in rows:
            cell = (math.floor(lat), math.floor(lng))
            city = rest[0] if rest else ""
            self.grid.setdefault(cell, []).append((iata, name, lat, lng, bool(large), city))

    @classmethod
    def load(cls, path: Path = AIRPORTS_FILE) -> Airports:
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def nearest(self, lat: float, lng: float) -> dict[str, Any] | None:
        """{"iata", "name", "city", "km"} of the airport to show (within ~300 km), or None."""
        found: list[tuple[float, str, str, bool, str]] = []
        row, col = math.floor(lat), math.floor(lng)
        for dr in range(-AIRPORT_SEARCH_DEG, AIRPORT_SEARCH_DEG + 1):
            for dc in range(-AIRPORT_SEARCH_DEG, AIRPORT_SEARCH_DEG + 1):
                for iata, name, alat, alng, large, city in self.grid.get((row + dr, col + dc), ()):
                    found.append((km_between((lat, lng), (alat, alng)), iata, name, large, city))
        if not found:
            return None
        found.sort()
        nearest = found[0]
        hub = next((a for a in found if a[3]), None)
        pick = hub if hub and hub[0] - nearest[0] <= LARGE_AIRPORT_DETOUR_KM else nearest
        if pick[0] > MAX_AIRPORT_KM:
            return None
        airport: dict[str, Any] = {"iata": pick[1], "name": pick[2], "km": max(1, round(pick[0]))}
        if pick[4]:
            airport["city"] = pick[4]
        return airport
