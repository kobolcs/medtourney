"""The Geocoder: overrides, cache, Nominatim cascade, GeoNames fallback, beachfront, town."""

from __future__ import annotations

import functools
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from geocoding.beachfront import (
    VENUE_CATEGORIES,
    VENUE_MAX_KM,
    km_between,
    names_match,
    overpass_coastline,
    sea_distance_m,
)
from geocoding.common import (
    MISS_RETRY_DAYS,
    NETWORK_ERRORS,
    REQUEST_INTERVAL_S,
    SAVE_EVERY,
    T,
    logger,
)
from geocoding.geonames import Place, geonames_match
from geocoding.nominatim import nominatim_reverse_town, nominatim_search, town_cache_key
from geocoding.places import (
    PLACE_TYPES,
    SEGMENT_SPLIT,
    TOO_COARSE,
    candidate_queries,
    split_location,
)

# Hand-checked fixes for locations the rules get wrong: {"location": [lat, lng] or null}.
# null = leave unplaced. Applied before the cache and any lookup.
OVERRIDES_FILE = Path(__file__).parent.parent / "data" / "geocode_overrides.json"


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
        reverse: Callable[[float, float], str | None] = nominatim_reverse_town,
    ) -> None:
        self.reverse = reverse
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
        """GeoNames word match for a Nominatim miss (offline, so free to retry).

        Redone on every run, so a better matcher corrects earlier guesses; a
        beachfront result is kept while the coordinates stay the same.
        """
        head, iso2 = split_location(location)
        entry = self.cache.get(location, {})
        if not self.geonames or not iso2 or not head:
            return (entry["lat"], entry["lng"]) if "lat" in entry else None
        match = geonames_match(head, self.geonames.get(iso2, {}))
        if not match:
            if "lat" in entry:  # an earlier guess no longer holds
                self.cache[location] = {"miss": "no match", "tried": self.now.isoformat()}
            return None
        name, (lat, lng, *_rest) = match
        new: dict[str, Any] = {"lat": lat, "lng": lng, "q": name, "src": "geonames"}
        if (entry.get("lat"), entry.get("lng")) == (lat, lng) and "seafront" in entry:
            new["seafront"] = entry["seafront"]
        self.cache[location] = new
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

    def town(self, lat: float, lng: float, max_lookups: int) -> str | None:
        """Town name at these coordinates (cached; misses retried after MISS_RETRY_DAYS)."""
        key = town_cache_key(lat, lng)
        entry = self.cache.get(key)
        if entry and (entry.get("town") or self._recent(entry.get("tried"))):
            return entry.get("town")
        if self.offline or self.lookups >= max_lookups:
            return entry.get("town") if entry else None
        try:
            name = self._throttled(functools.partial(self.reverse, lat, lng))
        except NETWORK_ERRORS as e:
            logger.warning("Lookups stopped after a network error: %s", e)
            self.offline = True
            return None
        self.cache[key] = {"town": name, "tried": self.now.isoformat()}
        return name

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
            if "lat" in entry and entry.get("src") != "geonames":
                return entry["lat"], entry["lng"]
            redo = entry.get("src") == "geonames" or entry.get("miss") == "no match"
            return self._fallback(location) if redo else None

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
