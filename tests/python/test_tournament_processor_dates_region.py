"""Unit tests for TournamentProcessor.py: date parsing and European location detection.

Shared fixtures (processor, sample_tournaments, sample_excel_file) are in
tests/python/conftest.py.
"""

from datetime import UTC, datetime

import pytest


class TestTournamentProcessor:
    """Test suite for TournamentProcessor class.

    Provides comprehensive testing of all TournamentProcessor methods including:
    - Date parsing from multiple formats
    - European location detection and filtering
    - Tournament category extraction
    - Excel file loading and processing
    - JSON export with validation
    - Configuration loading
    """

    # ========== Date Parsing Tests ==========

    def test_parse_date_yyyymmdd(self, processor):
        """Test YYYYMMDD format (chess-results.com format)"""
        date = processor._parse_date("20251128")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_dot(self, processor):
        """Test DD.MM.YYYY format"""
        date = processor._parse_date("28.11.2025")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_yyyymmdd_dash(self, processor):
        """Test YYYY-MM-DD format"""
        date = processor._parse_date("2025-11-28")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_slash(self, processor):
        """Test DD/MM/YYYY format"""
        date = processor._parse_date("28/11/2025")
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_datetime_object(self, processor):
        """Test passing a datetime object - naive datetimes get UTC timezone added"""
        dt = datetime(2025, 11, 28)
        date = processor._parse_date(dt)
        # Naive datetime should get UTC timezone added
        expected = datetime(2025, 11, 28, tzinfo=UTC)
        assert date == expected

    def test_parse_date_invalid(self, processor):
        """Test invalid date returns current date"""
        date = processor._parse_date("invalid-date")
        today = datetime.now(UTC)  # _parse_date's fallback is UTC "now"
        assert date.date() == today.date()

    def test_parse_date_none(self, processor):
        """Test None returns current date"""
        date = processor._parse_date(None)
        today = datetime.now(UTC)  # _parse_date's fallback is UTC "now"
        assert date.date() == today.date()


    # ========== European Location Detection Tests ==========

    def test_is_european_spain(self, processor):
        """Test Spanish location detection"""
        assert processor._is_european("Barcelona, ESP") is True
        assert processor._is_european("Madrid, Spain") is True
        assert processor._is_european("españa") is True

    def test_is_european_france(self, processor):
        """Test French location detection"""
        assert processor._is_european("Paris, FRA") is True
        assert processor._is_european("Nice, France") is True

    def test_is_european_germany(self, processor):
        """Test German location detection"""
        assert processor._is_european("Berlin, GER") is True
        assert processor._is_european("Munich, Germany") is True

    def test_is_european_greece(self, processor):
        """Test Greek location detection"""
        assert processor._is_european("Athens, Greece") is True
        assert processor._is_european("GRE") is True

    def test_is_european_case_insensitive(self, processor):
        """Test case insensitivity"""
        assert processor._is_european("SPAIN") is True
        assert processor._is_european("spain") is True
        assert processor._is_european("Spain") is True

    def test_is_not_european_russia(self, processor):
        """Test Russia is excluded"""
        assert processor._is_european("Moscow, Russia") is False
        assert processor._is_european("Petersburg, RUS") is False

    def test_is_not_european_asia(self, processor):
        """Test Asian countries are excluded"""
        assert processor._is_european("Dubai, UAE") is False
        assert processor._is_european("Singapore") is False
        assert processor._is_european("Malaysia") is False
        assert processor._is_european("China") is False

    def test_is_not_european_americas(self, processor):
        """Test American countries are excluded"""
        assert processor._is_european("New York, USA") is False
        assert processor._is_european("Toronto, Canada") is False
        assert processor._is_european("Mexico City, Mexico") is False

    def test_is_not_european_unknown(self, processor):
        """Test unknown location returns False"""
        assert processor._is_european("Unknown") is False
        assert processor._is_european("") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
