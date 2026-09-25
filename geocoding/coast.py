"""Seaside: distance to the Mediterranean / Iberian Atlantic coast."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

# --- Seaside: distance to the southern coasts ---------------------------------
#
# A placed tournament within SEASIDE_KM of the Mediterranean or of Spain's /
# Portugal's Atlantic coast gets "coast": "med" | "atlantic", which the site's
# Seaside filter uses alongside its town list (config.json). Coastline points
# come from Natural Earth (public domain), prebuilt by
# scripts/build_southern_coast.py into data/southern_coast.json.

SEASIDE_KM = 10.0
COAST_FILE = Path(__file__).parent.parent / "data" / "southern_coast.json"
GRID_DEG = 0.25  # grid cell size for the nearest-point lookup
EARTH_DIAMETER_KM = 12742


class Coast:
    def __init__(self, points: dict[str, list[list[float]]]) -> None:
        self.grid: dict[tuple[int, int], list[tuple[float, float, str]]] = {}
        for kind, pts in points.items():
            for lat, lng in pts:
                self.grid.setdefault(self._cell(lat, lng), []).append((lat, lng, kind))

    @staticmethod
    def _cell(lat: float, lng: float) -> tuple[int, int]:
        return math.floor(lat / GRID_DEG), math.floor(lng / GRID_DEG)

    @classmethod
    def load(cls, path: Path = COAST_FILE) -> Coast:
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def nearest(self, lat: float, lng: float) -> tuple[float, str | None]:
        """(km, 'med' | 'atlantic') to the nearest coast point in the 5x5 cells around."""
        best_km, best_kind = math.inf, None
        row, col = self._cell(lat, lng)
        for dr in range(-2, 3):
            for dc in range(-2, 3):
                for plat, plng, kind in self.grid.get((row + dr, col + dc), ()):
                    dlat, dlng = math.radians(plat - lat), math.radians(plng - lng)
                    h = (math.sin(dlat / 2) ** 2
                         + math.cos(math.radians(lat)) * math.cos(math.radians(plat)) * math.sin(dlng / 2) ** 2)
                    d = EARTH_DIAMETER_KM * math.asin(math.sqrt(h))
                    if d < best_km:
                        best_km, best_kind = d, kind
        return best_km, best_kind

    def coast_of(self, lat: float, lng: float) -> str | None:
        km, kind = self.nearest(lat, lng)
        return kind if km <= SEASIDE_KM else None


# Atlantic seaside is Spain's and Portugal's coast only (e.g. not Hendaye,
# France, 2 km from the Spanish border).
ATLANTIC_FEDS = {"ESP", "POR"}


def seaside_coast(tournament: dict[str, Any], coast: Coast) -> str | None:
    """'med' / 'atlantic' if the tournament's coordinates are by the sea."""
    kind = coast.coast_of(tournament["lat"], tournament["lng"])
    fed = tournament.get("location", "").rpartition(",")[2].strip().upper()
    if kind == "atlantic" and fed not in ATLANTIC_FEDS:
        return None
    return kind
