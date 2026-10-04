# ruff: noqa: RUF001  (Cyrillic time-control strings are real data)
"""Time-control units the FIDE formula used to miss (fixed 2026-09-26).

Each string below is a real chess-results.com value that was published as
"Classical" because nothing in it was recognised, so ?tc=classical still
showed 10-minute kids' events and Bulgarian/Serbian/Ukrainian rapids.

Shared fixtures (processor) are in conftest.py.
"""

import pytest


@pytest.mark.parametrize(
    ("time_control", "expected"),
    [
        # Cyrillic / Hungarian / Greek-style units
        ("5мин+5 сек", "Blitz"),
        ("10 мин. + 5 сек. на ход", "Rapid"),
        ("40 мин + 10 сек", "Rapid"),
        ("10хв + 5сек", "Rapid"),
        ("5 хв = 3 сек на хід", "Blitz"),
        ("10 perc + 3mp / lépés", "Rapid"),
        ("10 минута по играчу за целу партију + 5 секунди", "Rapid"),
        # Bare "m" / "s"
        ("10 m + 5 s de acréscimo por cada lance", "Rapid"),
        ("5m+3s Bronstein", "Blitz"),
        # "2x" = per player, not a multiplier
        ("2x15", "Rapid"),
        ("2x15. min. / hráče", "Rapid"),
        ("2x5 perc + 3 sec", "Blitz"),
        ("2x10min. + 2s/ťah", "Rapid"),
        ("2x40min.+30s/tah", "Classical"),
        ("2x 1,5 h/40 + 30 min + 30 s/move", "Classical"),
    ],
)
def test_previously_unrecognised_units(processor, time_control, expected):
    assert processor._classify_time_control_field(time_control) == expected


@pytest.mark.parametrize(
    "time_control",
    [
        "40/90 Min, Rest 15 Min, 30 Sek. Increment ab 1. Zug",
        "40/90+30, 30+30",
        "90 minutes + 30 seconds increment",
    ],
)
def test_move_count_formats_stay_classical(processor, time_control):
    """The unit rewrite must not turn "40 moves in 90 min" into a 40-minute game."""
    assert processor._classify_time_control_field(time_control) == "Classical"


def test_bare_number_without_2x_is_left_alone(processor):
    """A lone "10" could be anything; only the "2x" prefix makes it minutes."""
    assert processor._classify_time_control_field("10") is None


@pytest.mark.parametrize(
    ("time_control", "expected"),
    [
        # C2 regression: acute accent (U+00B4) minute mark — EXCALIBUR 5+3
        ('5´ + 3"', "Blitz"),
        ('10´ + 3"', "Rapid"),
        # C2 regression: dotted unit abbreviations (German/Czech style)
        ("10.min.+ 5.sek.", "Rapid"),
        ("5.min.+ 3.sek.", "Blitz"),
        # Equal hyphen clocks are minutes per player, as in the frontend.
        ("10-10", "Blitz"),
        ("5-3", "Blitz"),
    ],
)
def test_c2_previously_falling_through_to_classical(processor, time_control, expected):
    """Formats confirmed as Classical due to unrecognised notation (fixed in C2)."""
    assert processor._classify_time_control_field(time_control) == expected


@pytest.mark.parametrize(
    ("time_control", "expected"),
    [
        ("Rapid: 5+3", "Blitz"),
        ("Rapid: 10+0", "Blitz"),
        ("Rapid: 10-10", "Blitz"),
        ("Rapid 10 minutes", "Blitz"),
        ("cinco minutos finish", "Blitz"),
        ("seis minutos finish", "Blitz"),
        ("siete minutos finish", "Blitz"),
        ("Ocho minutos finish", "Blitz"),
        ("15+10 / 3+2", "Rapid, Blitz"),
        ("Rapid: 15 min + 10 sec; Blitz: 3 min + 2 sec", "Rapid, Blitz"),
        ("Rapid 15+10 Blitz 3+2", "Rapid, Blitz"),
        ("Rapid and Blitz", "Rapid, Blitz"),
        ("60+0", "Classical"),
        ("59+0", "Rapid"),
        ("10+0", "Blitz"),
        ("10+1", "Rapid"),
        ("Rapid: 40/90+30, 30+30", "Rapid"),
        ("90 min; 30 min", "Classical"),
    ],
)
def test_verified_clock_accuracy(processor, time_control, expected):
    assert processor._classify_time_control_field(time_control) == expected


@pytest.mark.parametrize("time_control", ["", "10", "Fischer Kurz"])
def test_ambiguous_clock_does_not_default_to_classical(processor, time_control):
    assert processor._determine_category("Generic Tournament", "", time_control) == "Open, Unknown"
    assert processor._determine_category("Open Rapid", "", time_control) == "Open, Rapid"


def test_mixed_name_formats_are_preserved_as_fallback(processor):
    assert processor._determine_category("Open Rapid and Blitz", "", "") == "Open, Blitz, Rapid"
    assert processor._determine_category("Open Rapid and Blitz", "", "90+30") == "Classical, Open"
