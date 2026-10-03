"""Tests for the address fallback in geocoding/pipeline.py - no network: Nominatim is a fake."""

from datetime import UTC, datetime
from typing import Any

import geocoding as gt
from geocoding.pipeline import address_query, annotate_tournament, locate

NOW = datetime(2026, 9, 30, tzinfo=UTC)
WIEN = {("1020 Wien", "at"): {"lat": "48.2167", "lon": "16.3953", "addresstype": "city_district"}}


class FakeNominatim:
    """Records queries; answers from a {(query, iso2): hit} table."""

    def __init__(self, answers: dict[tuple, dict[str, Any]] | None = None) -> None:
        self.answers = answers or {}
        self.queries: list[tuple] = []

    def __call__(self, query: str, iso2: str) -> dict[str, Any] | None:
        self.queries.append((query, iso2))
        return self.answers.get((query, iso2))


def make(answers=None, cache=None):
    fake = FakeNominatim(answers)
    geocoder = gt.Geocoder(cache if cache is not None else {}, search=fake, sleep=lambda _s: None,
                           now=NOW, overrides={}, reverse=lambda _lat, _lng: "Wien")
    return geocoder, fake


def schachhaus(address: str | None = "Haus des Schachsports, Spielmannplatz 1, 1020 Wien") -> dict[str, Any]:
    t: dict[str, Any] = {"name": "Herbst-Cup", "location": "Haus des Schachsports, AUT"}
    if address is not None:
        t["details"] = {"address": address}
    return t


class TestAddressQuery:
    def test_adds_the_location_fed(self) -> None:
        assert address_query(schachhaus()) == "Haus des Schachsports, Spielmannplatz 1, 1020 Wien, AUT"

    def test_country_only_location(self) -> None:
        t = {"location": "AUT", "details": {"address": "Hotel Ibis, 8010 Graz"}}
        assert address_query(t) == "Hotel Ibis, 8010 Graz, AUT"

    def test_none_without_an_address(self) -> None:
        assert address_query(schachhaus(address=None)) is None
        assert address_query(schachhaus(address="  ")) is None


class TestLocate:
    def test_address_places_what_the_location_cannot(self) -> None:
        geocoder, fake = make(WIEN)
        coords, key = locate(schachhaus(), geocoder, None, max_lookups=20)
        assert coords == (48.2167, 16.3953)
        assert key == "Haus des Schachsports, Spielmannplatz 1, 1020 Wien, AUT"
        assert ("1020 Wien", "at") in fake.queries
        assert geocoder.cache["Haus des Schachsports, AUT"]["miss"] == "no match"
        assert geocoder.cache[key]["q"] == "1020 Wien"

    def test_location_hit_never_looks_at_the_address(self) -> None:
        t = {"location": "Graz, AUT", "details": {"address": "Hotel Ibis, 8010 Graz"}}
        geocoder, fake = make({("Graz", "at"): {"lat": "47.07", "lon": "15.44", "addresstype": "city"}})
        coords, key = locate(t, geocoder, None, max_lookups=20)
        assert coords == (47.07, 15.44)
        assert key == "Graz, AUT"
        assert fake.queries == [("Graz", "at")]

    def test_address_same_as_location_is_not_looked_up_twice(self) -> None:
        geocoder, fake = make()
        coords, key = locate(schachhaus(address="Haus des Schachsports"), geocoder, None, max_lookups=20)
        assert coords is None
        assert key == "Haus des Schachsports, AUT"
        assert fake.queries == [("Haus des Schachsports", "at")]

    def test_no_address_and_no_geonames_leaves_it_unplaced(self) -> None:
        geocoder, _ = make(WIEN)
        assert locate(schachhaus(address=None), geocoder, None, max_lookups=20) == (None, "Haus des Schachsports, AUT")


def test_annotate_places_by_address_and_sets_town() -> None:
    geocoder, _ = make(WIEN)
    t = schachhaus()
    placed, seaside, beachfront = annotate_tournament(t, geocoder, None, None, max_lookups=20)
    assert (placed, seaside, beachfront) == (True, False, False)
    assert (t["lat"], t["lng"]) == (48.2167, 16.3953)
    assert t["town"] == "Wien"
