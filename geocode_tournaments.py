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
import functools
import json
import logging
import math
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Tuple, TypeVar

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "MedTourney/3.0 (+https://github.com/kobolcs/medtourney)"
REQUEST_INTERVAL_S = 1.1
MISS_RETRY_DAYS = 30
logger = logging.getLogger("geocode")
T = TypeVar("T")
NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, OSError, ValueError)

DEFAULT_MAX_LOOKUPS = 300
SAVE_EVERY = 25

# FIDE federation code -> ISO 3166-1 alpha-2 (lower case, as Nominatim's
# countrycodes parameter expects). Must match src/utils/countries.ts -
# tests/python/test_geocode.py checks the two stay in sync.
FED_TO_ISO2: dict[str, str] = {
    "ALB": "al", "AND": "ad", "ARM": "am", "AUT": "at", "AZE": "az",
    "BEL": "be", "BIH": "ba", "BUL": "bg", "CRO": "hr", "CYP": "cy",
    "CZE": "cz", "DEN": "dk", "ENG": "gb", "EST": "ee", "FAI": "fo",
    "FIN": "fi", "FRA": "fr", "GEO": "ge", "GER": "de", "GCI": "gg",
    "GIB": "gi", "GBR": "gb", "GRE": "gr", "HUN": "hu", "IRL": "ie",
    "ISL": "is", "IOM": "im", "ITA": "it", "JCI": "je", "KOS": "xk",
    "LAT": "lv", "LIE": "li", "LTU": "lt", "LUX": "lu", "MLT": "mt",
    "MDA": "md", "MNC": "mc", "MNE": "me", "NED": "nl", "MKD": "mk",
    "NOR": "no", "POL": "pl", "POR": "pt", "ROU": "ro", "SMR": "sm",
    "SCO": "gb", "SRB": "rs", "SVK": "sk", "SLO": "si", "ESP": "es",
    "SWE": "se", "SUI": "ch", "TUR": "tr", "UKR": "ua", "WLS": "gb",
}

# Nominatim addresstype values too coarse to pin a tournament on.
TOO_COARSE = {"country", "state", "region", "province", "county", "state_district"}

# Settlement-level hits. A one-part query ("Church Hall") is only trusted when
# it resolves to one of these - otherwise it's some random building of that
# name elsewhere in the country. Multi-part queries ("Hotel Atlas - Novi
# Pazar") may also match a building, since the town in them anchors the hit.
PLACE_TYPES = {
    "city", "town", "village", "hamlet", "suburb", "municipality", "borough",
    "city_district", "district", "quarter", "neighbourhood", "locality",
    "isolated_dwelling", "island",
}

# Separators organisers use between venue / street / town. Not "/", which
# appears inside Spanish street notation ("C/ Ajo S/N").
SEGMENT_SPLIT = re.compile("\\s*(?:,|\\||\\s[\u2013\u2014-]\\s|\\(|\\))\\s*")  # , | ( ) or spaced dash
MIN_SEGMENT_LETTERS = 3


def split_location(location: str) -> tuple[str, str | None]:
    """'Hotel Atlas - Novi Pazar, SRB' -> ('Hotel Atlas - Novi Pazar', 'rs')."""
    head, _, fed = location.rpartition(",")
    iso2 = FED_TO_ISO2.get(fed.strip().upper())
    if not head:  # bare "UKR"
        return "", FED_TO_ISO2.get(location.strip().upper())
    return head.strip(), iso2


def candidate_queries(head: str) -> list[str]:
    """Full text first, then with leading segments (venue, street) dropped.

    'Hotel Atlas - Novi Pazar' -> ['Hotel Atlas - Novi Pazar', 'Novi Pazar']
    Segments with no letters ('42.1381', postcodes) are never queried alone.
    """
    def letters(s: str) -> int:
        return len(re.findall(r"[^\W\d_]", s))

    if letters(head) < MIN_SEGMENT_LETTERS:
        return []
    # ...and never a bare country code ("Arco- Trentino (ITA)" once matched a place called Ita)
    segments = [s for s in SEGMENT_SPLIT.split(head)
                if letters(s) >= MIN_SEGMENT_LETTERS and s.strip().upper() not in FED_TO_ISO2]
    queries = [head]
    for i in range(1, len(segments)):
        q = " ".join(segments[i:])
        if q not in queries:
            queries.append(q)
    return queries


# --- Offline fallback: GeoNames (https://www.geonames.org, CC BY 4.0) -------
#
# Organisers often bury the town inside venue text with no separator
# ("Volkshaus Bärnbach", "8010 Graz Fachhochschule ...", "BG Gmunden"), which
# Nominatim's free-text search can't pick apart. For those, match the words
# of the location against the country's towns in GeoNames' cities1000 dump
# (places with 1,000+ inhabitants). Longest word-group wins, then biggest
# town. Common venue words are never matched on their own - there *is* an
# Austrian town called Haus, but "Haus des Schachsports" isn't in it.

VENUE_WORDS = {
    "haus", "hotel", "hall", "halle", "club", "klub", "chess", "schach", "sala",
    "centre", "center", "centro", "school", "schule", "church", "kirche",
    "house", "casa", "dom", "park", "stadium", "library", "grand", "open",
    "cafe", "restaurant", "sport", "sports", "saal", "castle", "palace",
    "town", "city", "village", "main", "street", "road", "strasse", "plaza",
    "diverse", "online", "various", "feld", "wirt",
    # common in tournament names, and also real town names somewhere
    "liga", "league", "scoala", "skola", "escola", "cup", "rapid", "blitz",
    "junior", "senior", "memorial", "festival", "turnir", "torneo", "turnaj",
}
MAX_NGRAM = 3
MIN_NAME_LEN = 4  # shorter alternate names / single words are too ambiguous
GEONAMES_COLUMNS = 15  # up to the population column of the dump format


def normalise(text: str) -> str:
    """Case- and accent-insensitive form: 'Bärnbach' -> 'barnbach'."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


Place = Tuple[float, float, int]  # (lat, lng, population)


def load_geonames(path: Path, iso2s: set[str]) -> dict[str, dict[str, Place]]:
    """{iso2: {normalised name: (lat, lng, population)}} for the given countries."""
    index: dict[str, dict[str, Place]] = {c: {} for c in iso2s}
    with path.open(encoding="utf-8") as f:
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < GEONAMES_COLUMNS:
                continue
            country = cols[8].lower()
            if country not in index:
                continue
            place: Place = (round(float(cols[4]), 4), round(float(cols[5]), 4), int(cols[14] or 0))
            names = {cols[1], cols[2]} | {a for a in cols[3].split(",") if len(a) >= MIN_NAME_LEN}
            by_name = index[country]
            for name in names:
                key = normalise(name).strip()
                if key and (key not in by_name or by_name[key][2] < place[2]):
                    by_name[key] = place
    return index


def geonames_match(head: str, places: dict[str, Place]) -> tuple[str, Place] | None:
    """Best town named in the location text, or None."""
    words = re.findall("[^\\W\\d_]+(?:['\u2019-][^\\W\\d_]+)*", normalise(head))
    best: tuple[int, int, str, Place] | None = None
    for n in range(MAX_NGRAM, 0, -1):
        for i in range(len(words) - n + 1):
            gram = words[i:i + n]
            if n == 1 and (len(gram[0]) < MIN_NAME_LEN or gram[0] in VENUE_WORDS):
                continue
            key = " ".join(gram)
            place = places.get(key)
            if place and (best is None or (n, place[2]) > (best[0], best[1])):
                best = (n, place[2], key, place)
    return (best[2], best[3]) if best else None


def town_from_name(
    tournament: dict[str, Any], geonames: dict[str, dict[str, Place]]
) -> tuple[float, float] | None:
    """Last resort when the location has no recognisable town: many
    tournament names carry it ("Sligo Chess Festival", "Hradec Kralove Open")
    - matched against the tournament's own country only. Offline, per
    tournament (names vary), so not cached."""
    _, iso2 = split_location(tournament.get("location", ""))
    if not iso2:
        return None
    match = geonames_match(tournament.get("name", ""), geonames.get(iso2, {}))
    return (match[1][0], match[1][1]) if match else None


# --- Seaside: distance to the southern coasts ---------------------------------
#
# A placed tournament within SEASIDE_KM of the Mediterranean or of Spain's /
# Portugal's Atlantic coast gets "coast": "med" | "atlantic", which the site's
# Seaside filter uses alongside its town list (config.json). Coastline points
# come from Natural Earth (public domain), prebuilt by
# scripts/build_southern_coast.py into data/southern_coast.json.

SEASIDE_KM = 10.0
COAST_FILE = Path(__file__).parent / "data" / "southern_coast.json"
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


# --- Nearest airport (travel context on the cards) ---------------------------
#
# Straight-line distance to the nearest airport with scheduled flights, from
# data/airports.json (OurAirports, public domain; built by
# scripts/build_airports.py). Offline, recomputed every run.

AIRPORTS_FILE = Path(__file__).parent / "data" / "airports.json"
# Hand-checked fixes for locations the rules get wrong: {"location": [lat, lng] or null}.
# null = leave unplaced. Applied before the cache and any lookup.
OVERRIDES_FILE = Path(__file__).parent / "data" / "geocode_overrides.json"
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
        self.grid: dict[tuple[int, int], list[tuple[str, str, float, float, bool]]] = {}
        for iata, name, lat, lng, large in rows:
            cell = (math.floor(lat), math.floor(lng))
            self.grid.setdefault(cell, []).append((iata, name, lat, lng, bool(large)))

    @classmethod
    def load(cls, path: Path = AIRPORTS_FILE) -> Airports:
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def nearest(self, lat: float, lng: float) -> dict[str, Any] | None:
        """{"iata", "name", "km"} of the airport to show (within ~300 km), or None."""
        found: list[tuple[float, str, str, bool]] = []
        row, col = math.floor(lat), math.floor(lng)
        for dr in range(-AIRPORT_SEARCH_DEG, AIRPORT_SEARCH_DEG + 1):
            for dc in range(-AIRPORT_SEARCH_DEG, AIRPORT_SEARCH_DEG + 1):
                for iata, name, alat, alng, large in self.grid.get((row + dr, col + dc), ()):
                    found.append((km_between((lat, lng), (alat, alng)), iata, name, large))
        if not found:
            return None
        found.sort()
        nearest = found[0]
        hub = next((a for a in found if a[3]), None)
        pick = hub if hub and hub[0] - nearest[0] <= LARGE_AIRPORT_DETOUR_KM else nearest
        if pick[0] > MAX_AIRPORT_KM:
            return None
        return {"iata": pick[1], "name": pick[2], "km": max(1, round(pick[0]))}


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
        (metres_to_segment((lat, lng), a, b) for way in ways for a, b in zip(way, way[1:])),
        default=None,
    )
    return round(best) if best is not None and best <= COASTLINE_SEARCH_M else None


def nominatim_search(query: str, iso2: str) -> dict[str, Any] | None:
    """One Nominatim lookup. Returns the top hit or None; raises on network errors."""
    params = urllib.parse.urlencode({
        "q": query, "countrycodes": iso2, "format": "jsonv2", "limit": 1,
    })
    req = urllib.request.Request(f"{NOMINATIM_URL}?{params}", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as res:
        results = json.load(res)
    return results[0] if results else None


class Geocoder:
    def __init__(
        self,
        cache: dict[str, dict[str, Any]],
        search: Callable[[str, str], dict[str, Any] | None] = nominatim_search,
        sleep: Callable[[float], None] = time.sleep,
        now: datetime | None = None,
        on_progress: Callable[[], None] | None = None,
        geonames: dict[str, dict[str, Place]] | None = None,
        coastline: Callable[[float, float], list[list[tuple[float, float]]]] = overpass_coastline,
        overrides: dict[str, list[float] | None] | None = None,
    ) -> None:
        self.geonames = geonames
        self.coastline = coastline
        self.cache = cache
        self.search = search
        self.sleep = sleep
        self.now = now or datetime.now(timezone.utc)
        self.on_progress = on_progress
        self.lookups = 0
        self.overrides: dict[str, list[float] | None] = (
            overrides if overrides is not None
            else json.loads(OVERRIDES_FILE.read_text(encoding="utf-8")) if OVERRIDES_FILE.exists()
            else {}
        )
        self.offline = False
        self.overpass_down = False

    def _cache_usable(self, entry: dict[str, Any]) -> bool:
        if "lat" in entry:
            return True
        tried = entry.get("tried")
        if not tried:
            return False
        return self.now - datetime.fromisoformat(tried) < timedelta(days=MISS_RETRY_DAYS)

    @staticmethod
    def _acceptable(query: str, hit: dict[str, Any]) -> bool:
        kind = hit.get("addresstype")
        if kind in TOO_COARSE:
            return False
        single_part = len(SEGMENT_SPLIT.split(query)) == 1
        return kind in PLACE_TYPES or not single_part

    def _fallback(self, location: str) -> tuple[float, float] | None:
        """GeoNames word match for a Nominatim miss (offline, so free to retry)."""
        head, iso2 = split_location(location)
        if not self.geonames or not iso2 or not head:
            return None
        match = geonames_match(head, self.geonames.get(iso2, {}))
        if not match:
            return None
        name, (lat, lng, _pop) = match
        self.cache[location] = {"lat": lat, "lng": lng, "q": name, "src": "geonames"}
        return lat, lng

    def _recent(self, tried: str | None) -> bool:
        if not tried:
            return False
        return self.now - datetime.fromisoformat(tried) < timedelta(days=MISS_RETRY_DAYS)

    def _throttled(self, call: Callable[[], T]) -> T:
        """One request to OSM's services, at most one per REQUEST_INTERVAL_S."""
        if self.lookups:
            self.sleep(REQUEST_INTERVAL_S)
        self.lookups += 1
        if self.on_progress and self.lookups % SAVE_EVERY == 0:
            self.on_progress()
        return call()

    def seafront(self, location: str, max_lookups: int) -> dict[str, Any] | None:
        """Venue coordinates + metres to the sea for a near-coast location.

        Returns {"venue": [lat, lng] | None, "seaM": int | None}, from the
        cache when fresh; None when the lookup budget is spent or Overpass is
        down (then nothing is cached, so the next run retries). Nominatim
        network errors propagate to the caller.
        """
        entry = self.cache.get(location)
        if not entry or "lat" not in entry:
            return None
        front: dict[str, Any] | None = entry.get("seafront")
        if front and (front.get("venue") or self._recent(front.get("tried"))):
            return front
        # Up to two venue queries plus one coastline query
        if self.overpass_down or self.lookups + 3 > max_lookups:
            return None
        front = self._lookup_seafront(location, entry.get("q", ""))
        if front is not None:
            entry["seafront"] = front
        return front

    def _lookup_seafront(self, location: str, town: str) -> dict[str, Any] | None:
        head, iso2 = split_location(location)
        entry = self.cache[location]
        venue = self._find_venue(head, iso2, town, (entry["lat"], entry["lng"]))
        sea_m = None
        if venue:
            try:
                ways = self._throttled(functools.partial(self.coastline, venue[0], venue[1]))
            except NETWORK_ERRORS as e:
                # Overpass overloaded even after retries: skip beachfront checks
                # for the rest of this run (not cached - next run tries again)
                logger.warning("Overpass unavailable, skipping beachfront checks: %s", e)
                self.overpass_down = True
                return None
            sea_m = sea_distance_m(venue[0], venue[1], ways)
        return {"venue": venue, "seaM": sea_m, "tried": self.now.isoformat()}

    def _find_venue(
        self, head: str, iso2: str | None, town: str, near: tuple[float, float]
    ) -> list[float] | None:
        """The venue itself (hotel, hall, club...) - never a town - or None.

        Only trusted when it is the venue the location names (shares a real
        word with the location's first part: "Gran Hotel Bali" yes, a hotel
        called "Mallorca" for "Calvia (Mallorca)" no) and lies within
        VENUE_MAX_KM of where the location was placed (Spain has many a
        "Convento de San Francisco").
        """
        if not head or not iso2:
            return None
        first = SEGMENT_SPLIT.split(head)[0]
        queries = [head]
        if town and town.lower() not in head.lower():
            queries.append(f"{first} {town}")
        for query in queries:
            hit = self._throttled(functools.partial(self.search, query, iso2))
            if (hit and hit.get("category") in VENUE_CATEGORIES
                    and names_match(first, hit.get("name") or "")):
                venue = (round(float(hit["lat"]), 5), round(float(hit["lon"]), 5))
                if km_between(venue, near) <= VENUE_MAX_KM:
                    return [venue[0], venue[1]]
        return None

    def place(self, location: str, max_lookups: int) -> tuple[float, float] | None:
        """geocode(), but hand-checked overrides first, and after a network
        error keep going from the cache only."""
        if location in self.overrides:
            fixed = self.overrides[location]
            return (fixed[0], fixed[1]) if fixed else None
        if not self.offline:
            try:
                return self.geocode(location, max_lookups)
            except NETWORK_ERRORS as e:
                logger.warning("Lookups stopped after a network error: %s", e)
                self.offline = True
        entry = self.cache.get(location, {})
        return (entry["lat"], entry["lng"]) if "lat" in entry else None

    def place_seafront(self, location: str, max_lookups: int) -> dict[str, Any] | None:
        """seafront(), falling back to the cache when offline or out of budget."""
        if not self.offline:
            try:
                front = self.seafront(location, max_lookups)
                if front is not None:
                    return front
            except NETWORK_ERRORS as e:
                logger.warning("Lookups stopped after a network error: %s", e)
                self.offline = True
        front = self.cache.get(location, {}).get("seafront")
        return front if isinstance(front, dict) else None

    def geocode(self, location: str, max_lookups: int) -> tuple[float, float] | None:
        entry = self.cache.get(location)
        if entry and self._cache_usable(entry):
            if "lat" in entry:
                return entry["lat"], entry["lng"]
            return self._fallback(location) if entry.get("miss") == "no match" else None

        head, iso2 = split_location(location)
        queries = candidate_queries(head) if iso2 else []
        if not queries or iso2 is None:
            self.cache[location] = {"miss": "unplaceable", "tried": self.now.isoformat()}
            return None

        for query in queries:
            if self.lookups >= max_lookups:
                return None  # budget spent - leave uncached, try next run
            if self.lookups:
                self.sleep(REQUEST_INTERVAL_S)
            self.lookups += 1
            if self.on_progress and self.lookups % SAVE_EVERY == 0:
                self.on_progress()  # checkpoint, so a long first run can resume
            hit = self.search(query, iso2)  # network errors propagate to caller
            if hit and self._acceptable(query, hit):
                lat, lng = round(float(hit["lat"]), 4), round(float(hit["lon"]), 4)
                self.cache[location] = {"lat": lat, "lng": lng, "q": query}
                return lat, lng

        self.cache[location] = {"miss": "no match", "tried": self.now.isoformat()}
        return self._fallback(location)


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
    location = t.get("location", "")
    for key in ("lat", "lng", "coast", "seaM", "airport"):
        t.pop(key, None)

    coords = geocoder.place(location, max_lookups)
    if coords is None and geonames:
        coords = town_from_name(t, geonames)
    if coords is None:
        return False, False, False
    t["lat"], t["lng"] = coords
    nearest = airports.nearest(*coords) if airports else None
    if nearest:
        t["airport"] = nearest

    kind = seaside_coast(t, coast) if coast else None
    if not kind:
        return True, False, False
    t["coast"] = kind

    front = geocoder.place_seafront(location, max_lookups)
    if not front or not front.get("venue"):
        return True, True, False
    t["lat"], t["lng"] = front["venue"]  # the venue itself, not the town centre
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

    geocoder = Geocoder(cache, search=search, on_progress=save_cache, geonames=geonames)
    counts = {"placed": 0, "seaside": 0, "beachfront": 0}
    for t in tournaments:
        for key, hit in zip(counts, annotate_tournament(t, geocoder, geonames, coast, max_lookups, airports)):
            counts[key] += hit

    data_path.write_text(json.dumps(tournaments, indent=2, ensure_ascii=False), encoding="utf-8")
    save_cache()
    return {"tournaments": len(tournaments), "lookups": geocoder.lookups, **counts}


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
