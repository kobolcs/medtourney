"""Tests for geocode_tournaments.py - no network: Nominatim is a fake."""

import json
import re
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, ClassVar, Dict, List, Optional

import geocode_tournaments as gt

ROOT = Path(__file__).parent.parent.parent
NOW = datetime(2026, 9, 24, tzinfo=timezone.utc)
ATLAS = "Hotel Atlas \u2013 Novi Pazar"  # organisers separate venue and town with an en dash


class FakeNominatim:
    """Records queries; answers from a {(query, iso2): hit} table."""

    def __init__(self, answers: Optional[Dict[tuple, Dict[str, Any]]] = None) -> None:
        self.answers = answers or {}
        self.queries: List[tuple] = []

    def __call__(self, query: str, iso2: str) -> Optional[Dict[str, Any]]:
        self.queries.append((query, iso2))
        return self.answers.get((query, iso2))


def hit(lat: float, lon: float, kind: str = "city") -> Dict[str, Any]:
    return {"lat": str(lat), "lon": str(lon), "addresstype": kind}


def make(cache=None, answers=None, geonames=None):
    fake = FakeNominatim(answers)
    geocoder = gt.Geocoder(cache if cache is not None else {}, search=fake,
                           sleep=lambda _s: None, now=NOW, geonames=geonames)
    return geocoder, fake


class TestQueryCascade:
    def test_split_location_maps_fide_to_iso(self) -> None:
        assert gt.split_location(f"{ATLAS}, SRB") == (ATLAS, "rs")
        assert gt.split_location("Graz, AUT") == ("Graz", "at")
        assert gt.split_location("UKR") == ("", "ua")

    def test_drops_leading_segments(self) -> None:
        assert gt.candidate_queries(ATLAS) == [ATLAS, "Novi Pazar"]

    def test_spanish_street_slash_is_not_a_separator(self) -> None:
        q = gt.candidate_queries("Club Social C/ Ajo S/N")
        assert q == ["Club Social C/ Ajo S/N"]

    def test_pipe_is_a_separator(self) -> None:
        q = gt.candidate_queries("Hotel Royal Belvedere | Hersonissos Crete")
        assert q[-1] == "Hersonissos Crete"

    def test_numbers_only_is_unplaceable(self) -> None:
        assert gt.candidate_queries("42.1381") == []


class TestGeocoder:
    def test_falls_back_to_town_when_full_string_misses(self) -> None:
        geocoder, fake = make(answers={("Novi Pazar", "rs"): hit(43.1407, 20.518)})
        assert geocoder.geocode(f"{ATLAS}, SRB", 10) == (43.1407, 20.518)
        assert fake.queries == [(ATLAS, "rs"), ("Novi Pazar", "rs")]

    def test_single_word_building_hit_is_rejected(self) -> None:
        # "Church Hall, ENG" -> some church hall in Oxford: not trustworthy
        geocoder, _ = make(answers={("Church Hall", "gb"): hit(51.76, -1.19, "construction")})
        assert geocoder.geocode("Church Hall, ENG", 10) is None
        assert geocoder.cache["Church Hall, ENG"]["miss"] == "no match"

    def test_multi_part_building_hit_is_accepted(self) -> None:
        geocoder, _ = make(answers={(ATLAS, "rs"): hit(43.14, 20.51, "building")})
        assert geocoder.geocode(f"{ATLAS}, SRB", 10) == (43.14, 20.51)

    def test_country_level_hit_is_too_coarse(self) -> None:
        geocoder, _ = make(answers={("Tirol", "at"): hit(47.2, 11.4, "state")})
        assert geocoder.geocode("Tirol, AUT", 10) is None

    def test_hits_come_from_cache_without_lookups(self) -> None:
        geocoder, fake = make(cache={"Graz, AUT": {"lat": 47.07, "lng": 15.44, "q": "Graz"}})
        assert geocoder.geocode("Graz, AUT", 10) == (47.07, 15.44)
        assert fake.queries == []

    def test_recent_miss_is_not_retried(self) -> None:
        cache = {"Pfarrheim, AUT": {"miss": "no match", "tried": (NOW - timedelta(days=3)).isoformat()}}
        geocoder, fake = make(cache=cache)
        assert geocoder.geocode("Pfarrheim, AUT", 10) is None
        assert fake.queries == []

    def test_old_miss_is_retried(self) -> None:
        cache = {"Pfarrheim, AUT": {"miss": "no match", "tried": (NOW - timedelta(days=40)).isoformat()}}
        geocoder, fake = make(cache=cache)
        geocoder.geocode("Pfarrheim, AUT", 10)
        assert fake.queries == [("Pfarrheim", "at")]

    def test_lookup_budget_leaves_location_uncached(self) -> None:
        geocoder, fake = make()
        assert geocoder.geocode("Graz, AUT", 0) is None
        assert fake.queries == []
        assert "Graz, AUT" not in geocoder.cache


class TestGeoNamesFallback:
    PLACES: ClassVar[dict] = {
        "at": {
            "barnbach": (47.0714, 15.1279, 4178),
            "graz": (47.0673, 15.442, 303270),
            "haus": (47.4094, 13.7672, 2500),
            "bad schwanberg": (46.76, 15.21, 1363),
            "schwanberg": (46.75, 15.20, 900),
        }
    }

    def test_finds_town_buried_in_venue_text(self) -> None:
        assert gt.geonames_match("Volkshaus Bärnbach", self.PLACES["at"])[0] == "barnbach"
        assert gt.geonames_match("8010 Graz Fachhochschule der Wirtschaft", self.PLACES["at"])[0] == "graz"

    def test_venue_words_never_match_alone(self) -> None:
        assert gt.geonames_match("Haus des Schachsports", self.PLACES["at"]) is None

    def test_longest_name_wins(self) -> None:
        assert gt.geonames_match("Bad Schwanberg im Heilmoorbad", self.PLACES["at"])[0] == "bad schwanberg"

    def test_used_after_a_nominatim_miss_and_cached(self) -> None:
        geocoder, _ = make(geonames=self.PLACES)
        assert geocoder.geocode("Volkshaus Bärnbach, AUT", 10) == (47.0714, 15.1279)
        assert geocoder.cache["Volkshaus Bärnbach, AUT"]["src"] == "geonames"

    def test_town_from_tournament_name_when_location_has_none(self) -> None:
        places = {"ie": {"sligo": (54.2766, -8.4761, 17568)}}
        t = {"name": "Sligo Chess and Culture Festival", "location": "The Radisson Blu Hotel & Spa, IRL"}
        assert gt.town_from_name(t, places) == (54.2766, -8.4761)

    def test_town_from_name_ignores_league_and_school_words(self) -> None:
        places = {"lv": {"liga": (56.9, 24.1, 5000)}}
        t = {"name": "Latvijas jaunatnes saha liga", "location": "Aspazijas bulvaris 32, LAT"}
        assert gt.town_from_name(t, places) is None

    def test_load_geonames_reads_the_dump_format(self, tmp_path: Path) -> None:
        row = ["1", "Bärnbach", "Barnbach", "Baernbach,Bä", "47.0714", "15.1279", "P", "PPL",
               "AT", "", "", "", "", "", "4178", "", "", "Europe/Vienna", "2024-01-01"]
        f = tmp_path / "cities.txt"
        f.write_text("\t".join(row) + "\n", encoding="utf-8")
        index = gt.load_geonames(f, {"at"})
        assert index["at"]["barnbach"] == (47.0714, 15.1279, 4178)
        assert index["at"]["baernbach"] == (47.0714, 15.1279, 4178)
        assert "ba" not in index["at"]  # alternate names under 4 chars are skipped


class TestGeocodeFile:
    def test_adds_coordinates_and_never_raises_on_network_errors(self, tmp_path: Path) -> None:
        data = tmp_path / "t.json"
        cache = tmp_path / "c.json"
        data.write_text(json.dumps([
            {"name": "A", "location": "Graz, AUT"},
            {"name": "B", "location": "Linz, AUT"},
        ]), encoding="utf-8")
        cache.write_text(json.dumps({"Graz, AUT": {"lat": 47.07, "lng": 15.44, "q": "Graz"}}), encoding="utf-8")

        def offline(_q: str, _c: str) -> None:
            msg = "offline"
            raise urllib.error.URLError(msg)

        stats = gt.geocode_file(data, cache, max_lookups=10, search=offline)

        out = json.loads(data.read_text(encoding="utf-8"))
        assert out[0]["lat"] == 47.07
        assert "lat" not in out[1]
        assert stats == {"tournaments": 2, "placed": 1, "lookups": 1}


def test_fed_to_iso2_matches_frontend_countries_ts() -> None:
    """The geocoder's FIDE->ISO map must agree with src/utils/countries.ts."""
    ts = (ROOT / "src" / "utils" / "countries.ts").read_text(encoding="utf-8")
    frontend = {fed: iso.lower() for fed, iso in re.findall(r"(\w{3}): \{ name: '[^']*', iso2: '(\w\w)' \}", ts)}
    assert len(frontend) == 55
    assert frontend == gt.FED_TO_ISO2
