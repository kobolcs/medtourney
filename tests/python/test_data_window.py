"""Regression tests for today, lookback, and valid ongoing source events."""

from datetime import UTC, date, datetime

import openpyxl
import pytest

from tournament_processing.date_window import publication_dates
from TournamentProcessor import TournamentProcessor

TODAY = date(2026, 10, 4)


@pytest.mark.parametrize(("start", "end", "keep", "published_end"), [
    ("2026-10-04", "", True, ""),
    ("2026-09-27", "", True, ""),
    ("2026-09-26", "", False, ""),
    ("2026-09-01", "2026-10-04", True, "2026-10-04"),
    ("2026-09-01", "2026-09-27", True, "2026-09-27"),
    ("2026-09-01", "2026-09-26", False, "2026-09-26"),
    ("2026-09-01", "broken", False, ""),
    ("2026-09-01", "2026-08-31", False, ""),
])
def test_overlap_dates(start, end, keep, published_end):
    assert publication_dates(start, end, TODAY) == (start, published_end, keep)


def test_invalid_start_cannot_become_today():
    with pytest.raises(ValueError, match="Invalid tournament date"):
        publication_dates("2026-02-30", "2026-10-04", TODAY)


def test_processor_validates_end_before_overlap(tmp_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Tournament", "Location", "from", "to", "FED", "DB-Key"])
    today = datetime.now(UTC).date().isoformat()
    ws.append(["Ongoing", "Barcelona", "2020-01-01", today, "ESP", "12345"])
    ws.append(["Invalid end", "Barcelona", "2020-01-01", "broken", "ESP", "12346"])
    ws.append(["Invalid start", "Barcelona", "broken", today, "ESP", "12347"])
    path = tmp_path / "window.xlsx"
    wb.save(path)
    processor = TournamentProcessor()
    result = processor.load_and_filter_tournaments(str(path))
    assert [row["name"] for row in result] == ["Ongoing"]
    assert result[0]["dateTo"] == today
    assert processor.last_run_stats["excludedPast"] == 1
    assert processor.last_run_stats["excludedInvalid"] == 1
