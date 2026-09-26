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
