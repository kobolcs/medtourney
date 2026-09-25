"""Nearest-airport hint: data/airports.json build rules and the city on each tournament."""

import importlib.util
import json
from pathlib import Path

import pytest

from geocoding.airports import Airports

ROOT = Path(__file__).parent.parent.parent
AIRPORT_ROWS = json.loads((ROOT / "data" / "airports.json").read_text(encoding="utf-8"))


def load_build_script():
    spec = importlib.util.spec_from_file_location("build_airports", ROOT / "scripts" / "build_airports.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("raw", "city"),
    [
        ("Pisa (PI)", "Pisa"),
        ("London, Essex", "London"),
        ("Kuopio / Siilinjärvi", "Kuopio"),
        ("Perpignan/Rivesaltes", "Perpignan"),
        ("Osijek(Klisa)", "Osijek"),
        ("Jerez de la Frontera", "Jerez de la Frontera"),
    ],
)
def test_clean_municipality(raw, city):
    assert load_build_script().clean_municipality(raw) == city


def test_served_airports_needs_at_least_one_route(tmp_path):
    routes = tmp_path / "routes.json"
    routes.write_text(json.dumps({"XRY": {"routes": [{"iata": "LGW"}]}, "LUG": {"routes": []}}))
    assert load_build_script().served_airports(routes) == {"XRY"}


def test_airports_json_rows_have_a_city():
    assert AIRPORT_ROWS, "data/airports.json is empty"
    for iata, _name, _lat, _lng, large, city in AIRPORT_ROWS:
        assert len(iata) == 3
        assert large in (0, 1)
        assert city, f"{iata} has no city"
        assert not any(c in city for c in ",(/"), f"{iata}: uncleaned city {city!r}"


def test_airports_without_routes_are_left_out():
    codes = {row[0] for row in AIRPORT_ROWS}
    # Lugano closed to scheduled flights in 2020; Jerez is a real airport
    # despite its X.. code, which usually means a rail station
    assert "LUG" not in codes
    assert "XRY" in codes


def test_city_overrides_replace_suburbs():
    cities = {row[0]: row[5] for row in AIRPORT_ROWS}
    assert cities["RMU"] == "Murcia"
    assert cities["ZAG"] == "Zagreb"
    assert cities["MXP"] == "Milan"


def test_nearest_includes_city_when_known():
    airports = Airports([["XRY", "Jerez Airport", 36.7446, -6.0601, 0, "Jerez de la Frontera"]])
    assert airports.nearest(36.53, -6.29) == {
        "iata": "XRY", "name": "Jerez Airport", "km": 31, "city": "Jerez de la Frontera",
    }


def test_nearest_without_city_column_still_works():
    # Old 5-column rows (before the city was added) keep working
    airports = Airports([["ALC", "Alicante-Elche Airport", 38.2822, -0.5582, 1]])
    assert "city" not in airports.nearest(38.54, -0.13)
