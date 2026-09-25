"""Tests for geocode_tournaments.py - no network: Nominatim is a fake."""

import importlib.util
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
            "barnbach": (47.0714, 15.1279, 4178, "p"),
            "graz": (47.0673, 15.442, 303270, "p"),
            "haus": (47.4094, 13.7672, 2500, "p"),
            "bad schwanberg": (46.76, 15.21, 1363, "p"),
            "schwanberg": (46.75, 15.20, 900, "p"),
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
        places = {"ie": {"sligo": (54.2766, -8.4761, 17568, "p")}}
        t = {"name": "Sligo Chess and Culture Festival", "location": "The Radisson Blu Hotel & Spa, IRL"}
        assert gt.town_from_name(t, places) == (54.2766, -8.4761)

    def test_town_from_name_ignores_league_and_school_words(self) -> None:
        places = {"lv": {"liga": (56.9, 24.1, 5000, "p")}}
        t = {"name": "Latvijas jaunatnes saha liga", "location": "Aspazijas bulvaris 32, LAT"}
        assert gt.town_from_name(t, places) is None

    def test_load_geonames_reads_the_dump_format(self, tmp_path: Path) -> None:
        row = ["1", "Bärnbach", "Barnbach", "Baernbach,Bä", "47.0714", "15.1279", "P", "PPL",
               "AT", "", "", "", "", "", "4178", "", "", "Europe/Vienna", "2024-01-01"]
        f = tmp_path / "cities.txt"
        f.write_text("\t".join(row) + "\n", encoding="utf-8")
        index = gt.load_geonames(f, {"at"})
        assert index["at"]["barnbach"] == (47.0714, 15.1279, 4178, "p")
        assert index["at"]["baernbach"] == (47.0714, 15.1279, 4178, "")
        assert "ba" not in index["at"]  # alternate names under 4 chars are skipped


class TestGeoNamesRecheck2:
    """Inland events the word match once put on the coast (design review, recheck 2)."""

    ES: ClassVar[dict] = {
        "puerto": (36.5939, -6.233, 88364, ""),  # alternate name of El Puerto de Santa María
        "puerto de la cruz": (28.4169, -16.5509, 32219, "p"),
        "san francisco": (38.7057, 1.4289, 2656, ""),  # alternate of Sant Francesc de Formentera
        "navas": (41.418, 2.186, 22059, "p"),
        "los palacios y villafranca": (37.1618, -5.9243, 36824, "p"),
        "huelva": (37.2664, -6.94, 144258, "ap"),
        "corteconcepcion": (37.9, -6.5, 0, "p"),
        "campillo": (41.1265, -1.8439, 169, ""),  # alternate of Campillo de Aragón
    }

    def test_generic_words_never_match_alone(self) -> None:
        assert gt.geonames_match("I Open de Ajedrez Puerto Moral", self.ES) is None

    def test_generic_led_names_must_be_the_places_own_name(self) -> None:
        assert gt.geonames_match("Convento de San Francisco", self.ES) is None
        place = "Pabellón Municipal de Deportes de Puerto de la Cruz Miguel Ángel Díaz Molina."
        assert gt.geonames_match(place, self.ES)[0] == "puerto de la cruz"

    def test_long_town_names_beat_a_venue_word(self) -> None:
        match = gt.geonames_match("Los Palacios y Villafranca (Pabellon Jesus Navas)", self.ES)
        assert match[0] == "los palacios y villafranca"

    def test_town_right_before_its_province_wins(self) -> None:
        place = "Avda. Juan Ramón Jiménez S/N Plaza del Ayuntamiento Corteconcepción Huelva"
        assert gt.geonames_match(place, self.ES)[0] == "corteconcepcion"

    def test_unknown_village_before_its_province_places_nothing(self) -> None:
        assert gt.geonames_match("PABELLÓN CUBIERTO EL CAMPILLO HUELVA", self.ES) is None

    def test_province_seat_after_a_venue_still_matches(self) -> None:
        places = {"banjaluka": (44.7788, 17.2063, 185042, "ap")}
        assert gt.geonames_match('Hotel "Bosna" Banjaluka', places)[0] == "banjaluka"

    def test_numbers_separate_a_street_from_the_town(self) -> None:
        places = {"rabelais": (48.81, 2.23, 100, "p"), "perpignan": (42.6976, 2.8954, 119344, "ap")}
        place = "Couvent des Minimes 24 rue Francois Rabelais 66000 Perpignan"
        assert gt.geonames_match(place, places)[0] == "perpignan"

    def test_cached_guesses_are_redone_with_the_current_rules(self) -> None:
        location = "Convento de San Francisco, ESP"
        cache = {location: {"lat": 38.7057, "lng": 1.4289, "q": "san francisco", "src": "geonames"}}
        geocoder, fake = make(cache=cache, geonames={"es": self.ES})
        assert geocoder.geocode(location, 10) is None
        assert fake.queries == []
        assert geocoder.cache[location]["miss"] == "no match"

    def test_redone_guess_keeps_its_beachfront_result(self) -> None:
        location = "Hotel X Puerto de la Cruz, ESP"
        front = {"venue": None, "seaM": None, "tried": NOW.isoformat()}
        cache = {location: {"lat": 28.4169, "lng": -16.5509, "q": "puerto de la cruz", "src": "geonames",
                            "seafront": front}}
        geocoder, _ = make(cache=cache, geonames={"es": self.ES})
        assert geocoder.geocode(location, 10) == (28.4169, -16.5509)
        assert geocoder.cache[location]["seafront"] == front

    def test_load_geonames_flags_own_names_and_province_seats(self, tmp_path: Path) -> None:
        row = ["1", "Huelva", "Huelva", "Onuba", "37.26638", "-6.94004", "P", "PPLA2",
               "ES", "", "", "", "", "", "144258", "", "", "Europe/Madrid", "2024-01-01"]
        f = tmp_path / "cities.txt"
        f.write_text("\t".join(row) + "\n", encoding="utf-8")
        index = gt.load_geonames(f, {"es"})
        assert index["es"]["huelva"] == (37.2664, -6.94, 144258, "ap")
        assert index["es"]["onuba"] == (37.2664, -6.94, 144258, "a")


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

        stats = gt.geocode_file(data, cache, max_lookups=10, search=offline, reverse=offline)

        out = json.loads(data.read_text(encoding="utf-8"))
        assert out[0]["lat"] == 47.07
        assert "lat" not in out[1]
        assert stats == {"tournaments": 2, "placed": 1, "lookups": 1, "seaside": 0, "beachfront": 0}


def test_fed_to_iso2_matches_frontend_countries_ts() -> None:
    """The geocoder's FIDE->ISO map must agree with src/utils/countries.ts."""
    ts = (ROOT / "src" / "utils" / "countries.ts").read_text(encoding="utf-8")
    frontend = {fed: iso.lower() for fed, iso in re.findall(r"(\w{3}): \{ name: '[^']*', iso2: '(\w\w)' \}", ts)}
    assert len(frontend) == 55
    assert frontend == gt.FED_TO_ISO2


class TestSeaside:
    COAST = gt.Coast({"med": [[38.53, -0.13]], "atlantic": [[43.32, -1.98]]})

    def test_within_10_km_of_the_coast(self) -> None:
        assert self.COAST.coast_of(38.54, -0.12) == "med"  # ~1.4 km
        assert self.COAST.coast_of(38.70, -0.13) is None  # ~19 km inland

    def test_atlantic_only_counts_for_spain_and_portugal(self) -> None:
        spain = {"lat": 43.32, "lng": -1.97, "location": "Donostia, ESP"}
        france = {"lat": 43.32, "lng": -1.97, "location": "Hendaye, FRA"}
        assert gt.seaside_coast(spain, self.COAST) == "atlantic"
        assert gt.seaside_coast(france, self.COAST) is None

    def test_coast_regions(self) -> None:
        spec = importlib.util.spec_from_file_location("bsc", ROOT / "scripts" / "build_southern_coast.py")
        bsc = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bsc)
        assert bsc.region(-0.13, 38.53) == "med"        # Benidorm
        assert bsc.region(-1.98, 43.32) == "atlantic"   # San Sebastián
        assert bsc.region(-8.63, 41.16) == "atlantic"   # Porto
        assert bsc.region(-15.43, 28.12) == "atlantic"  # Las Palmas
        assert bsc.region(28.98, 41.01) is None         # Istanbul (Bosphorus / Black Sea)
        assert bsc.region(-1.56, 43.48) is None         # Biarritz (France's Atlantic)
        assert bsc.region(10.0, 54.0) is None           # Baltic


class TestBeachfront:
    def venue_hit(self, lat: float = 38.5315, lon: float = -0.1635, name: str = "Gran Hotel Bali") -> Dict[str, Any]:
        return {"lat": str(lat), "lon": str(lon), "category": "tourism", "addresstype": "tourism", "name": name}

    def make(self, answers, coastline) -> gt.Geocoder:
        cache = {"Gran Hotel Bali (Benidorm), ESP": {"lat": 38.54, "lng": -0.13, "q": "Benidorm"}}
        return gt.Geocoder(cache, search=FakeNominatim(answers), sleep=lambda _s: None,
                           now=NOW, coastline=coastline)

    def test_metres_to_segment(self) -> None:
        # a point 0.001 deg (~111 m) north of an east-west segment
        d = gt.metres_to_segment((38.001, 0.0005), (38.0, 0.0), (38.0, 0.001))
        assert 105 < d < 116

    def test_venue_near_the_sea_gets_sea_metres(self) -> None:
        shore = [[(38.5285, -0.17), (38.5285, -0.16)]]  # ~330 m south of the hotel
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): self.venue_hit()}, lambda _lat, _lng: shore)
        front = g.seafront("Gran Hotel Bali (Benidorm), ESP", 10)
        assert front["venue"] == [38.5315, -0.1635]
        assert 300 < front["seaM"] < 360

    def test_town_level_hit_is_not_a_venue(self) -> None:
        town = {"lat": "38.54", "lon": "-0.13", "category": "place", "addresstype": "town"}
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): town}, lambda _lat, _lng: [])
        front = g.seafront("Gran Hotel Bali (Benidorm), ESP", 10)
        assert front["venue"] is None
        assert front["seaM"] is None

    def test_venue_with_an_unrelated_name_is_rejected(self) -> None:
        # "Calvia (Mallorca)" once matched a hotel called "Mallorca"
        hit = self.venue_hit(name="Hotel Mallorca")
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): hit}, lambda _lat, _lng: [])
        assert g.seafront("Gran Hotel Bali (Benidorm), ESP", 10)["venue"] is None

    def test_same_name_venue_far_away_is_rejected(self) -> None:
        # Spain has many a "Convento de San Francisco" - one 700 km away isn't ours
        far = self.venue_hit(lat=42.43, lon=-8.64)
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): far}, lambda _lat, _lng: [])
        assert g.seafront("Gran Hotel Bali (Benidorm), ESP", 10)["venue"] is None

    def test_overpass_down_is_not_cached_and_skips_the_rest(self) -> None:
        def down(_lat: float, _lng: float) -> None:
            msg = "504"
            raise urllib.error.URLError(msg)
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): self.venue_hit()}, down)
        assert g.seafront("Gran Hotel Bali (Benidorm), ESP", 10) is None
        assert "seafront" not in g.cache["Gran Hotel Bali (Benidorm), ESP"]
        assert g.overpass_down

    def test_annotate_marks_beachfront_and_moves_pin_to_venue(self) -> None:
        shore = [[(38.5285, -0.17), (38.5285, -0.16)]]
        g = self.make({("Gran Hotel Bali (Benidorm)", "es"): self.venue_hit()}, lambda _lat, _lng: shore)
        t = {"name": "Benidorm Open", "location": "Gran Hotel Bali (Benidorm), ESP"}
        coast = gt.Coast({"med": [[38.53, -0.13]]})
        assert gt.annotate_tournament(t, g, None, coast, 10) == (True, True, True)
        assert (t["lat"], t["lng"]) == (38.5315, -0.1635)
        assert t["coast"] == "med"
        assert t["seaM"] <= gt.BEACHFRONT_M


class TestAirports:
    ROWS: ClassVar[list] = [
        ["BWK", "Brač Airport", 43.2857, 16.6797, 0],          # small, nearest to Hvar
        ["SPU", "Split Saint Jerome Airport", 43.5389, 16.2980, 1],
        ["RMU", "Region of Murcia International Airport", 37.8030, -1.1250, 0],
        ["ALC", "Alicante-Elche Miguel Hernández Airport", 38.2822, -0.5582, 1],
    ]

    def test_prefers_a_large_airport_within_the_detour(self) -> None:
        a = gt.Airports(self.ROWS)
        assert a.nearest(43.17, 16.44)["iata"] == "SPU"  # Hvar: Split, not the Brač strip

    def test_keeps_the_nearest_when_the_large_one_is_too_far(self) -> None:
        a = gt.Airports(self.ROWS)
        hit = a.nearest(38.04, -1.49)  # Mula: Murcia (41 km), not Alicante (~85 km)
        assert hit["iata"] == "RMU"
        assert 35 < hit["km"] < 50

    def test_nothing_beyond_the_cap(self) -> None:
        a = gt.Airports([["XXX", "Far Airport", 50.0, 30.0, 1]])
        assert a.nearest(48.0, 33.0) is None  # ~300 km away

    def test_build_skips_russia_and_belarus(self) -> None:
        spec = importlib.util.spec_from_file_location("ba", ROOT / "scripts" / "build_airports.py")
        ba = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ba)
        assert {"RU", "BY"} <= ba.EXCLUDED_COUNTRIES


class TestSeasideFixes:
    def test_country_code_segments_are_never_queried_alone(self) -> None:
        # "Arco- Trentino (ITA)" once matched a place called Ita
        assert "ITA" not in gt.candidate_queries("Arco- Trentino (ITA)")

    def test_overrides_win_over_cache_and_lookups(self) -> None:
        cache = {"Village Huelva, ESP": {"lat": 37.27, "lng": -6.94, "q": "huelva", "src": "geonames"},
                 "Rua Camilo Castelo Branco, POR": {"lat": 39.8, "lng": -7.5, "q": "castelo branco"}}
        overrides = {"Village Huelva, ESP": [37.9, -6.5], "Rua Camilo Castelo Branco, POR": None}
        g = gt.Geocoder(cache, search=FakeNominatim(), sleep=lambda _s: None, now=NOW, overrides=overrides)
        assert g.place("Village Huelva, ESP", 10) == (37.9, -6.5)
        assert g.place("Rua Camilo Castelo Branco, POR", 10) is None

    def test_overrides_file_is_valid(self) -> None:
        data = json.loads((ROOT / "data" / "geocode_overrides.json").read_text(encoding="utf-8"))
        for location, coords in data.items():
            assert location.rpartition(",")[2].strip() in gt.FED_TO_ISO2
            assert coords is None or (len(coords) == 2 and -90 <= coords[0] <= 90)


class TestTown:
    def make(self, cache=None, towns=None):
        calls = []

        def reverse(lat: float, lng: float) -> Optional[str]:
            calls.append((lat, lng))
            return (towns or {}).get((round(lat, 2), round(lng, 2)))

        g = gt.Geocoder(cache if cache is not None else {}, search=FakeNominatim(), sleep=lambda _s: None,
                        now=NOW, reverse=reverse)
        return g, calls

    def test_town_is_looked_up_once_per_coordinate(self) -> None:
        g, calls = self.make(towns={(38.53, -0.16): "Benidorm"})
        assert g.town(38.5315, -0.1635, 10) == "Benidorm"
        assert g.town(38.5315, -0.1635, 10) == "Benidorm"
        assert len(calls) == 1

    def test_a_miss_is_cached_and_not_retried_soon(self) -> None:
        g, calls = self.make()
        assert g.town(40.0, 20.0, 10) is None
        assert g.town(40.0, 20.0, 10) is None
        assert len(calls) == 1

    def test_set_town_on_a_tournament(self) -> None:
        g, _ = self.make(towns={(38.53, -0.16): "Benidorm"})
        t = {"lat": 38.5315, "lng": -0.1635}
        gt.set_town(t, g, 10)
        assert t["town"] == "Benidorm"

    def test_town_names_lose_administrative_wording(self) -> None:
        assert gt.clean_town("City of Zagreb") == "Zagreb"
        assert gt.clean_town("Khatay Raion") == "Khatay"
        assert gt.clean_town("Benidorm") == "Benidorm"
