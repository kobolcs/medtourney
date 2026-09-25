"""Nominatim search and reverse (town name) requests."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from geocoding.common import NOMINATIM_URL, USER_AGENT

# --- Town name for display (reverse geocoding) -------------------------------
#
# Location text is often a street or venue ("Fragkopoulou 29", "Centro Agora -
# C/ Lepanto 55"). The card shows the town instead: Nominatim reverse at city
# level (zoom 10), in English ("Vienna", "Seville"), once per coordinate and
# cached under a "@town:lat,lng" key in the same cache file.

NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
TOWN_ADDRESS_KEYS = ("city", "town", "village", "municipality", "hamlet", "suburb")


def nominatim_reverse_town(lat: float, lng: float) -> str | None:
    """The city/town/village at these coordinates, or None. Raises on network errors."""
    params = urllib.parse.urlencode({
        "lat": lat, "lon": lng, "zoom": 10, "format": "jsonv2",
        "addressdetails": 1, "accept-language": "en",
    })
    req = urllib.request.Request(f"{NOMINATIM_REVERSE_URL}?{params}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as res:
        result = json.load(res)
    address = result.get("address", {}) if isinstance(result, dict) else {}
    for key in TOWN_ADDRESS_KEYS:
        if address.get(key):
            return clean_town(str(address[key]))
    return None


# OSM's administrative wording around a town name: "City of Zagreb",
# "Khatay Raion" (a Baku district) - show the name people use
TOWN_PREFIX = re.compile(r"^(city|municipality|town|comune|commune|gmina|municipio) of\s+", re.IGNORECASE)
TOWN_SUFFIX = re.compile(r"\s+(raion|rayon|district|municipality|urban hromada)$", re.IGNORECASE)


def clean_town(name: str) -> str:
    return TOWN_SUFFIX.sub("", TOWN_PREFIX.sub("", name.strip())).strip() or name


def town_cache_key(lat: float, lng: float) -> str:
    return f"@town:{lat:.3f},{lng:.3f}"


def nominatim_search(query: str, iso2: str) -> dict[str, Any] | None:
    """One Nominatim lookup. Returns the top hit or None; raises on network errors."""
    params = urllib.parse.urlencode({
        "q": query, "countrycodes": iso2, "format": "jsonv2", "limit": 1,
    })
    req = urllib.request.Request(f"{NOMINATIM_URL}?{params}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as res:
        results = json.load(res)
    return results[0] if results else None
