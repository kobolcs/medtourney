"""Fixtures shared by the TournamentProcessor unit tests (test_tournament_processor_*.py)."""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import openpyxl
import pytest

from TournamentProcessor import TournamentProcessor


@pytest.fixture
def processor() -> TournamentProcessor:
    """Create a TournamentProcessor instance for testing.

    Returns:
        TournamentProcessor instance with loaded configuration.
    """
    return TournamentProcessor()

@pytest.fixture
def sample_tournaments() -> list[dict[str, Any]]:
    """Generate sample tournament data for testing.

    Returns:
        List of tournament dictionaries with varied categories and locations.
    """
    tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    return [
        {
            "name": "Barcelona Open 2025",
            "location": "Barcelona, ESP",
            "date": tomorrow,
            "category": "Open, Classical",
            "url": "https://chess-results.com/test1",
            "description": "Barcelona Open 2025"
        },
        {
            "name": "Athens Senior Championship",
            "location": "Athens, Greece",
            "date": tomorrow,
            "category": "Open, S50+, Classical",
            "url": "https://chess-results.com/test2",
            "description": "Athens Senior Championship"
        },
        {
            "name": "Youth Tournament U18",
            "location": "Paris, France",
            "date": tomorrow,
            "category": "Youth",
            "url": "https://chess-results.com/test3",
            "description": "Youth Tournament U18"
        }
    ]

@pytest.fixture
def sample_excel_file(tmp_path: Path) -> str:
    """Create a sample Excel file for testing.

    Creates an Excel file with tournament data including European tournaments,
    non-European tournaments (Dubai, Moscow), and past tournaments for testing
    the filtering logic.

    Args:
        tmp_path: Pytest fixture providing temporary directory path.

    Returns:
        String path to the created Excel file.
    """
    wb: openpyxl.Workbook = openpyxl.Workbook()
    ws = wb.active

    # Chess-results.com format: rows 1-3 are metadata, row 4 is headers
    ws.append(["Chess-results.com Tournament Export"])  # Row 1: metadata
    ws.append(["Export Date: 2025-01-01"])  # Row 2: metadata
    ws.append([])  # Row 3: empty

    # Row 4: Headers (chess-results.com format)
    ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])

    # Sample data - dates in YYYYMMDD format (chess-results.com format)
    tomorrow: datetime = datetime.now() + timedelta(days=1)
    future_date: datetime = datetime.now() + timedelta(days=30)
    past_date: datetime = datetime.now() - timedelta(days=1)

    # Row 5+: Tournament data
    ws.append([
        "Barcelona Open 2025",
        "Barcelona",
        tomorrow.strftime("%Y%m%d"),
        "ESP",
        "12345"
    ])
    ws.append([
        "Athens Senior Open",
        "Athens",
        future_date.strftime("%Y%m%d"),
        "GRE",
        "12346"
    ])
    ws.append([
        "Dubai Open",
        "Dubai",
        future_date.strftime("%Y%m%d"),
        "UAE",
        "12347"
    ])
    ws.append([
        "Past Tournament",
        "Madrid",
        past_date.strftime("%Y%m%d"),
        "ESP",
        "12348"
    ])
    ws.append([
        "Moscow Championship",
        "Moscow",
        future_date.strftime("%Y%m%d"),
        "RUS",
        "12349"
    ])

    excel_file = tmp_path / "test_tournaments.xlsx"
    wb.save(excel_file)
    return str(excel_file)
