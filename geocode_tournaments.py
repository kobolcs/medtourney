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
import json
import logging
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Tuple

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "MedTourney/3.0 (+https://github.com/kobolcs/medtourney)"
REQUEST_INTERVAL_S = 1.1
MISS_RETRY_DAYS = 30
logger = logging.getLogger("geocode")

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
    segments = [s for s in SEGMENT_SPLIT.split(head) if letters(s) >= MIN_SEGMENT_LETTERS]
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
    ) -> None:
        self.geonames = geonames
        self.cache = cache
        self.search = search
        self.sleep = sleep
        self.now = now or datetime.now(timezone.utc)
        self.on_progress = on_progress
        self.lookups = 0

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

    geocoder = Geocoder(cache, search=search, on_progress=save_cache, geonames=geonames)
    placed = 0
    network_error = False

    for t in tournaments:
        coords = None
        if not network_error:
            try:
                coords = geocoder.geocode(t.get("location", ""), max_lookups)
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
                logger.warning("Geocoding stopped after a network error: %s", e)
                network_error = True
        if coords is None and network_error:
            entry = cache.get(t.get("location", ""), {})
            coords = (entry["lat"], entry["lng"]) if "lat" in entry else None
        if coords is None and geonames:
            coords = town_from_name(t, geonames)
        if coords:
            t["lat"], t["lng"] = coords
            placed += 1
        else:
            t.pop("lat", None)
            t.pop("lng", None)

    data_path.write_text(json.dumps(tournaments, indent=2, ensure_ascii=False), encoding="utf-8")
    save_cache()
    return {"tournaments": len(tournaments), "placed": placed, "lookups": geocoder.lookups}


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
        "Geocoded %d/%d tournaments (%d Nominatim lookups)",
        stats["placed"], stats["tournaments"], stats["lookups"],
    )
    return 0  # never fail the data update


if __name__ == "__main__":
    sys.exit(main())
