"""Beachfront: venue-level distance to OpenStreetMap's coastline."""

from __future__ import annotations

import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from itertools import pairwise

from geocoding.coast import EARTH_DIAMETER_KM
from geocoding.common import NETWORK_ERRORS, USER_AGENT
from geocoding.geonames import VENUE_WORDS, normalise

# --- Beachfront: venue-level distance to OpenStreetMap's coastline -----------
#
# "Featured seaside" = the venue itself is at most BEACHFRONT_M from the sea.
# Town-centre coordinates can't support a 500 m claim (Barcelona's centre is
# ~2 km inland), so only tournaments near the coast (coast set) get a venue
# lookup - Nominatim, accepting a real venue (hotel, hall, club...) only -
# and then one Overpass query for OSM's natural=coastline around it. Results
# are cached on the location's cache entry like everything else.

BEACHFRONT_M = 500
COASTLINE_SEARCH_M = 600
# Public Overpass instances; the second is tried when the first is overloaded
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
OVERPASS_RETRY_WAIT_S = (5, 20)
VENUE_CATEGORIES = {
    "tourism", "amenity", "building", "leisure", "club", "sport", "office", "shop", "historic",
}
M_PER_DEG_LAT = 110540
M_PER_DEG_LNG_EQUATOR = 111320


VENUE_MAX_KM = 5.0  # hotels sit on the edge of town: Gran Hotel Bali is 3.1 km from Benidorm centre
VENUE_NAME_MIN_LEN = 3


def km_between(a: tuple[float, float], b: tuple[float, float]) -> float:
    dlat, dlng = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2)
    return EARTH_DIAMETER_KM * math.asin(math.sqrt(h))


def names_match(location_part: str, venue_name: str) -> bool:
    """True if the venue's name shares a distinctive word with the location text."""
    def words(text: str) -> set[str]:
        found = re.findall("[^\\W\\d_]+", normalise(text))
        return {w for w in found if len(w) >= VENUE_NAME_MIN_LEN and w not in VENUE_WORDS}
    return bool(words(location_part) & words(venue_name))


def metres_to_segment(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance from point p to segment a-b (lat, lng), flat-earth metres (fine at <1 km)."""
    kx = M_PER_DEG_LNG_EQUATOR * math.cos(math.radians(p[0]))
    ax, ay = (a[1] - p[1]) * kx, (a[0] - p[0]) * M_PER_DEG_LAT
    bx, by = (b[1] - p[1]) * kx, (b[0] - p[0]) * M_PER_DEG_LAT
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = 0.0 if length2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length2))
    return math.hypot(ax + t * dx, ay + t * dy)


def overpass_coastline(
    lat: float, lng: float, sleep: Callable[[float], None] = time.sleep
) -> list[list[tuple[float, float]]]:
    """OSM natural=coastline ways within COASTLINE_SEARCH_M, as lists of (lat, lng).

    Public Overpass servers often answer 429/504 under load: retry with a
    growing wait, alternating instances, before giving up (raises).
    """
    query = (f"[out:json][timeout:25];way(around:{COASTLINE_SEARCH_M},{lat},{lng})"
             f'["natural"="coastline"];out geom;')
    body = urllib.parse.urlencode({"data": query}).encode()
    waits = (0, *OVERPASS_RETRY_WAIT_S)
    for attempt, wait in enumerate(waits):
        if wait:
            sleep(wait)
        url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
        req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                elements = json.load(res).get("elements", [])
            return [[(g["lat"], g["lon"]) for g in way.get("geometry", [])] for way in elements]
        except NETWORK_ERRORS:
            if attempt == len(waits) - 1:
                raise
    return []  # unreachable


def sea_distance_m(lat: float, lng: float, ways: list[list[tuple[float, float]]]) -> int | None:
    """Metres to the nearest coastline segment, or None if none within the search radius."""
    best = min(
        (metres_to_segment((lat, lng), a, b) for way in ways for a, b in pairwise(way)),
        default=None,
    )
    return round(best) if best is not None and best <= COASTLINE_SEARCH_M else None
