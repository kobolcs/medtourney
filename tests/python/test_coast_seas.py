"""Which sea a place is by: data/southern_coast.json + geocoding.coast (real data)."""

import json
from pathlib import Path

import pytest

from geocoding.coast import COAST_FILE, Coast, seaside_coast

COAST = Coast.load()


def sea(lat: float, lng: float, fed: str) -> str | None:
    return seaside_coast({"lat": lat, "lng": lng, "location": f"Somewhere, {fed}"}, COAST)


def test_coast_file_has_the_four_seas():
    points = json.loads(Path(COAST_FILE).read_text(encoding="utf-8"))
    assert set(points) == {"med", "atlantic", "black", "caspian"}
    assert all(len(pts) > 1000 for pts in points.values())


@pytest.mark.parametrize(
    ("place", "lat", "lng", "fed", "expected"),
    [
        # Mediterranean
        ("Nice", 43.70, 7.26, "FRA", "med"),
        ("Barcelona", 41.39, 2.17, "ESP", "med"),
        ("Neum", 42.92, 17.62, "BIH", "med"),
        ("Aegean, Gulf of Saros", 40.62, 26.75, "TUR", "med"),
        # Atlantic: Spain, Portugal, islands, and now France's Atlantic coast
        ("A Coruña", 43.37, -8.40, "ESP", "atlantic"),
        ("Las Palmas", 28.12, -15.43, "ESP", "atlantic"),
        ("Ponta Delgada", 37.74, -25.67, "POR", "atlantic"),
        ("Biarritz", 43.48, -1.56, "FRA", "atlantic"),
        ("La Rochelle", 46.16, -1.15, "FRA", "atlantic"),
        ("Brest", 48.39, -4.49, "FRA", "atlantic"),
        # Black Sea (incl. Marmara / Bosphorus) and Caspian
        ("Varna", 43.20, 27.92, "BUL", "black"),
        ("Batumi", 41.64, 41.63, "GEO", "black"),
        ("Istanbul", 41.01, 28.98, "TUR", "black"),
        ("Constanța", 44.17, 28.64, "ROU", "black"),
        ("Baku", 40.41, 49.87, "AZE", "caspian"),
        ("Aktau", 43.65, 51.17, "KAZ", "caspian"),
    ],
)
def test_sea_of_coastal_places(place, lat, lng, fed, expected):
    assert sea(lat, lng, fed) == expected, place


@pytest.mark.parametrize(
    ("place", "lat", "lng", "fed"),
    [
        ("Roscoff (Channel, not Atlantic)", 48.72, -3.98, "FRA"),
        ("Niort (inland)", 46.32, -0.46, "FRA"),
        ("Madrid", 40.42, -3.70, "ESP"),
        ("Tbilisi", 41.72, 44.79, "GEO"),
        ("Ankara", 39.93, 32.86, "TUR"),
        # A non-Iberian/French federation's event placed on the Biscay coast
        ("Biarritz, English federation", 43.48, -1.56, "ENG"),
    ],
)
def test_not_seaside(place, lat, lng, fed):
    assert sea(lat, lng, fed) is None, place
