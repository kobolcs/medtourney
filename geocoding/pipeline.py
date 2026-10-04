"""Annotate each tournament (lat/lng, airport, town, coast, beachfront) and the whole data file."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from geocoding.airports import AIRPORTS_FILE, Airports
from geocoding.beachfront import BEACHFRONT_M
from geocoding.coast import COAST_FILE, Coast, seaside_coast
from geocoding.common import logger
from geocoding.geocoder import Geocoder
from geocoding.geonames import Place, load_geonames, town_from_name
from geocoding.nominatim import nominatim_reverse_town, nominatim_search
from geocoding.places import FED_TO_ISO2


def set_town(t: dict[str, Any], geocoder: Geocoder, max_lookups: int) -> None:
    """Display town for the card (\"Benidorm\" for \"Gran Hotel Bali (Benidorm)\")."""
    name = geocoder.town(t["lat"], t["lng"], max_lookups)
    if name:
        t["town"] = name
    else:
        t.pop("town", None)


def address_query(t: dict[str, Any]) -> str | None:
    """The scraped venue address in the location's "text, FED" form.

    "Haus des Schachsports, AUT" + address "Haus des Schachsports, Spielmannplatz 1,
    1020 Wien" -> "Haus des Schachsports, Spielmannplatz 1, 1020 Wien, AUT".
    """
    address = str(t.get("details", {}).get("address") or "").strip()
    if not address:
        return None
    fed = str(t.get("location", "")).rsplit(",", 1)[-1].strip()
    return f"{address}, {fed}"


def locate(
    t: dict[str, Any],
    geocoder: Geocoder,
    geonames: dict[str, dict[str, Place]] | None,
    max_lookups: int,
) -> tuple[tuple[float, float] | None, str]:
    """Coordinates and the cache key they came from.

    The location first; then the details page's address, which often names
    the town the location leaves out; then a town named in the tournament name.
    """
    location = t.get("location", "")
    coords = geocoder.place(location, max_lookups)
    if coords is not None:
        return coords, location
    address = address_query(t)
    if address and address != location:
        coords = geocoder.place(address, max_lookups)
        if coords is not None:
            return coords, address
    if geonames:
        return town_from_name(t, geonames), location
    return None, location


def annotate_tournament(
    t: dict[str, Any],
    geocoder: Geocoder,
    geonames: dict[str, dict[str, Place]] | None,
    coast: Coast | None,
    max_lookups: int,
    airports: Airports | None = None,
) -> tuple[bool, bool, bool]:
    """Set lat/lng, airport, coast and seaM on one tournament.

    Returns (placed, seaside, beachfront) for the run's summary.
    """
    for key in ("lat", "lng", "coast", "seaM", "airport", "town"):
        t.pop(key, None)

    coords, location = locate(t, geocoder, geonames, max_lookups)
    if coords is None:
        return False, False, False
    t["lat"], t["lng"] = coords
    nearest = airports.nearest(*coords) if airports else None
    if nearest:
        t["airport"] = nearest

    set_town(t, geocoder, max_lookups)
    kind = seaside_coast(t, coast) if coast else None
    if not kind:
        return True, False, False
    t["coast"] = kind

    front = geocoder.place_seafront(location, max_lookups)
    if not front or not front.get("venue"):
        return True, True, False
    t["lat"], t["lng"] = front["venue"]  # the venue itself, not the town centre
    set_town(t, geocoder, max_lookups)
    sea_m = front.get("seaM")
    if sea_m is None or sea_m > BEACHFRONT_M:
        return True, True, False
    t["seaM"] = sea_m
    return True, True, True


def geocode_file(
    data_path: Path,
    cache_path: Path,
    max_lookups: int,
    geonames_path: Path | None = None,
    search: Callable[[str, str], dict[str, Any] | None] = nominatim_search,
    reverse: Callable[[float, float], str | None] = nominatim_reverse_town,
) -> dict[str, int]:
    tournaments: list[dict[str, Any]] = json.loads(data_path.read_text(encoding="utf-8"))
    cache: dict[str, dict[str, Any]] = (
        json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    )
    def save_cache() -> None:
        cache_path.write_text(
            json.dumps(dict(sorted(cache.items())), indent=1, ensure_ascii=False), encoding="utf-8"
        )

    geonames = None
    if geonames_path and geonames_path.exists():
        geonames = load_geonames(geonames_path, set(FED_TO_ISO2.values()))
    elif geonames_path:
        logger.warning("GeoNames file %s not found - fallback disabled", geonames_path)

    airports = Airports.load() if AIRPORTS_FILE.exists() else None
    coast = Coast.load() if COAST_FILE.exists() else None
    if coast is None:
        logger.warning("%s not found - seaside flags not computed", COAST_FILE)

    geocoder = Geocoder(cache, search=search, on_progress=save_cache, geonames=geonames, reverse=reverse)
    counts = {"placed": 0, "seaside": 0, "beachfront": 0}
    for t in tournaments:
        for key, hit in zip(counts, annotate_tournament(t, geocoder, geonames, coast, max_lookups, airports), strict=True):
            counts[key] += hit

    data_path.write_text(json.dumps(tournaments, indent=2, ensure_ascii=False), encoding="utf-8")
    save_cache()
    return {"tournaments": len(tournaments), "lookups": geocoder.lookups, **counts}
