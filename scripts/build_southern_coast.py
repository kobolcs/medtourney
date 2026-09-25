"""Build data/southern_coast.json - the coastline points "Seaside" is measured against.

"Seaside" on MedTourney means: within a few km of one of four seas, each
point tagged with its sea so the site can offer a sea picker:
- "med": the Mediterranean (incl. Adriatic, Aegean, Tyrrhenian, Balearic...)
- "atlantic": the Atlantic coasts of Spain, Portugal and France (Galicia,
  Cantabria, Algarve, Bay of Biscay up to western Brittany; Canaries,
  Madeira, Azores) - not the Channel, not northern seas
- "black": the Black Sea, incl. the Sea of Marmara / Bosphorus and the Sea
  of Azov
- "caspian": the Caspian Sea (Baku, Aktau...)

Source: Natural Earth 1:10m coastline (public domain),
https://github.com/nvkelso/natural-earth-vector (geojson/ne_10m_coastline.geojson).
Points are clipped to the regions below and thinned to >= 0.5 km apart.

Usage:
    curl -sSfLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson
    python3 scripts/build_southern_coast.py ne_10m_coastline.geojson
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

OUT = Path(__file__).parent.parent / "data" / "southern_coast.json"
MIN_SPACING_KM = 0.5


# Coast regions as (kind, west, east, south, north) boxes in degrees, checked
# in order - the first box containing a point decides (None = not seaside).
REGIONS: list[tuple[str | None, float, float, float, float]] = [
    # Gulf of Saros (Aegean, north of the Gallipoli peninsula) - before the
    # Black Sea box, whose south-west corner overlaps it; the Sea of Marmara
    # starts east of it (Şarköy, 27.1°E)
    ("med", 26.0, 27.0, 40.45, 40.8),
    # Sea of Marmara / Black Sea / Sea of Azov: north-east of the Dardanelles,
    # east to Batumi
    ("black", 26.6, 42.0, 40.25, 47.5),
    # Caspian Sea
    ("caspian", 46.5, 55.0, 36.5, 47.5),
    # Bay of Biscay: west of 0°, north of 41°N the Spanish Mediterranean
    # coast has ended (Castellón is ~40°N) - Spain's Cantabrian / Basque
    # coast and France's Biscay coast are Atlantic
    ("atlantic", -5.6, 0.0, 41.0, 46.0),
    # France's Atlantic coast north of the Gironde up to western Brittany
    # (Brest); the Channel coast (north Brittany, ~48.6°N+) is not included
    ("atlantic", -5.6, -1.0, 46.0, 48.55),
    # Mediterranean basin (incl. Adriatic, Aegean, Tyrrhenian, Balearic...)
    ("med", -5.6, 36.5, 30.0, 46.0),
    # Atlantic Iberia: Gulf of Cadiz, Algarve, Portugal, Galicia
    ("atlantic", -10.0, -5.6, 36.0, 43.95),
    # Canary Islands, Madeira, Azores
    ("atlantic", -18.5, -13.2, 27.5, 29.5),
    ("atlantic", -17.4, -16.2, 32.3, 33.2),
    ("atlantic", -31.5, -24.9, 36.8, 39.9),
]


def region(lon: float, lat: float) -> str | None:
    """'med', 'atlantic', 'black', 'caspian' or None for a coastline point."""
    for kind, west, east, south, north in REGIONS:
        if west <= lon <= east and south <= lat <= north:
            return kind
    return None


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    dlat, dlon = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlon / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def main() -> int:
    geojson = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out: dict[str, list[list[float]]] = {"med": [], "atlantic": [], "black": [], "caspian": []}
    last: dict[str, tuple[float, float]] = {}
    for feature in geojson["features"]:
        geom = feature["geometry"]
        lines = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        for line in lines:
            for lon, lat in line:
                kind = region(lon, lat)
                if kind is None:
                    continue
                point = (round(lat, 3), round(lon, 3))
                if kind in last and km(last[kind], point) < MIN_SPACING_KM:
                    continue
                last[kind] = point
                out[kind].append([point[0], point[1]])
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    counts = ", ".join(f"{kind} {len(points)}" for kind, points in out.items())
    print(f"Wrote {OUT}: {counts} coastline points")  # noqa: T201
    return 0


if __name__ == "__main__":
    sys.exit(main())
