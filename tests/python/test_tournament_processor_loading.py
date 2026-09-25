"""Unit tests for TournamentProcessor.py: Excel loading, scrape metadata, JSON export, configuration and edge cases.

Shared fixtures (processor, sample_tournaments, sample_excel_file) are in
tests/python/conftest.py.
"""

import json
from datetime import datetime, timedelta

import openpyxl
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

    # ========== Excel Loading Tests ==========

    def test_load_and_filter_tournaments(self, processor, sample_excel_file):
        """Test loading tournaments from Excel file"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Should load 2 European tournaments (Barcelona and Athens)
        # Dubai, Moscow (Russia), and past tournament should be filtered out
        assert len(tournaments) >= 1  # At least Barcelona and Athens

        # Check all tournaments are European
        for t in tournaments:
            assert processor._is_european(t["location"])

        # Check no past tournaments
        tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        for t in tournaments:
            tournament_date = datetime.strptime(t["date"], "%Y-%m-%d")
            assert tournament_date >= tomorrow

    def test_load_excel_missing_file(self, processor):
        """Test loading from non-existent file raises error"""
        with pytest.raises(FileNotFoundError):
            processor.load_and_filter_tournaments("/nonexistent/file.xlsx")

    def test_load_detects_shifted_header_row(self, processor, tmp_path):
        """Headers not in the usual row 4 are still found (no silent zero results).

        Regression test: chess-results.com occasionally changes the number of
        leading metadata rows. Previously the parser hard-coded row 4 and would
        silently return zero tournaments when the layout shifted.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Headers in row 1 (no metadata preamble at all).
        ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])
        future = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        ws.append(["Valencia Open", "Valencia", future, "ESP", "55501"])
        ws.append(["Lisbon Open", "Lisbon", future, "POR", "55502"])
        excel_file = tmp_path / "shifted.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 2

    def test_load_raises_when_columns_missing(self, processor, tmp_path):
        """An unrecognisable export fails loudly instead of exporting empty data.

        Regression test: missing essential columns must raise rather than silently
        produce an empty tournament list that overwrites good data.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["foo", "bar", "baz"])
        ws.append([1, 2, 3])
        excel_file = tmp_path / "junk.xlsx"
        wb.save(excel_file)

        with pytest.raises(ValueError, match="Could not locate"):
            processor.load_and_filter_tournaments(str(excel_file))

    def test_load_skips_url_preamble_row(self, processor, tmp_path):
        """URL preamble row added by chess-results.com is not mistaken for the header.

        Regression test: row 1 of the chess-results.com Excel export now contains
        "from the tournament-database of chess-results https://chess-results.com".
        Both "tournament" and "from" appear in that single cell, which used to fool
        _detect_header_row into treating it as the header row and then failing to
        find any real columns.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Row 1: the URL preamble chess-results.com now prepends
        ws.append(["from the tournament-database of chess-results https://chess-results.com"])
        # Row 2: real column headers
        ws.append(["Tournament", "Location", "from", "FED", "DB-Key"])
        future = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        ws.append(["Valencia Open", "Valencia", future, "ESP", "55501"])
        excel_file = tmp_path / "preamble.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 1
        assert tournaments[0]["name"] == "Valencia Open"

    def test_load_excel_validates_location(self, processor, sample_excel_file):
        """Test that non-European locations are filtered out"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Dubai and Moscow should be filtered out
        locations = [t["location"] for t in tournaments]
        assert not any("dubai" in loc.lower() for loc in locations)
        assert not any("moscow" in loc.lower() for loc in locations)


    # ========== Scrape Metadata Tests ==========

    def test_load_populates_run_stats(self, processor, sample_excel_file):
        """load_and_filter_tournaments records per-run filtering stats."""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)
        stats = processor.last_run_stats

        # kept matches the returned list
        assert stats["keptRows"] == len(tournaments)
        # rawRows accounts for every processed row (kept + all exclusions)
        assert stats["rawRows"] >= stats["keptRows"]
        assert stats["rawRows"] == (
            stats["keptRows"]
            + stats["excludedPast"]
            + stats["excludedNonEuropean"]
            + stats["excludedInvalid"]
        )
        # The sample sheet contains past and non-European rows that get excluded.
        assert stats["excludedPast"] >= 1
        assert stats["excludedNonEuropean"] >= 1

    def test_export_metadata_writes_expected_fields(self, processor, sample_excel_file, tmp_path):
        """export_metadata writes a sidecar with the documented schema."""
        processor.load_and_filter_tournaments(sample_excel_file)

        meta_file = tmp_path / "tournaments_data_meta.json"
        returned = processor.export_metadata(str(meta_file))

        assert meta_file.exists()
        with meta_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert data == returned
        for key in (
            "generatedAt", "source", "rangeMonths", "rawRows", "keptRows",
            "excludedPast", "excludedNonEuropean", "excludedInvalid",
        ):
            assert key in data, f"metadata missing key: {key}"

        assert data["source"] == "chess-results.com"
        assert data["rangeMonths"] == processor.RANGE_MONTHS
        assert data["keptRows"] == processor.last_run_stats["keptRows"]


    # ========== JSON Export Tests ==========

    def test_export_to_json(self, processor, sample_tournaments, tmp_path):
        """Test exporting tournaments to JSON"""
        json_file = tmp_path / "tournaments.json"

        processor.export_to_json(sample_tournaments, str(json_file))

        # Verify file exists
        assert json_file.exists()

        # Verify content
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert len(data) == len(sample_tournaments)
        assert data[0]["name"] == "Barcelona Open 2025"

    def test_export_json_validation(self, processor, tmp_path):
        """Test JSON export validates tournament structure"""
        json_file = tmp_path / "tournaments.json"

        # Invalid tournament data (missing required fields)
        invalid_tournaments = [
            {"name": "Test"},  # Missing location, date, category, url
            {"name": "Valid", "location": "Barcelona", "date": "2025-11-28", "category": "Open", "url": "http://test.com"}
        ]

        processor.export_to_json(invalid_tournaments, str(json_file))

        # Should only export valid tournament
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert len(data) == 1
        assert data[0]["name"] == "Valid"

    def test_export_json_unicode(self, processor, tmp_path):
        """Test JSON export handles Unicode correctly"""
        json_file = tmp_path / "tournaments.json"

        unicode_tournaments = [
            {
                "name": "Torneo España 2025",
                "location": "Barcelona, España",
                "date": "2025-11-28",
                "category": "Open",
                "url": "https://chess-results.com/test",
                "description": "Torneo en España"
            }
        ]

        processor.export_to_json(unicode_tournaments, str(json_file))

        # Verify Unicode is preserved
        with json_file.open(encoding="utf-8") as f:
            data = json.load(f)

        assert "España" in data[0]["name"]
        assert "España" in data[0]["location"]


    # ========== Configuration Loading Tests ==========

    def test_config_loaded(self, processor):
        """Test that configuration is loaded correctly"""
        assert processor.european_countries is not None
        assert processor.non_european_countries is not None
        assert processor.mediterranean_locations is not None

        assert len(processor.european_countries) > 0
        assert len(processor.non_european_countries) > 0
        assert len(processor.mediterranean_locations) > 0

    def test_config_sets_type(self, processor):
        """Test that configuration uses Sets for O(1) lookup"""
        assert isinstance(processor.european_countries, set)
        assert isinstance(processor.non_european_countries, set)
        assert isinstance(processor.mediterranean_locations, set)


    # ========== Edge Cases and Error Handling ==========

    def test_empty_tournament_list(self, processor, tmp_path):
        """Test handling empty tournament list"""
        json_file = tmp_path / "empty.json"
        processor.export_to_json([], str(json_file))

        with json_file.open() as f:
            data = json.load(f)

        assert data == []

    def test_find_column_not_found(self, processor):
        """Test column finding when header not present"""
        headers = ["col1", "col2", "col3"]
        result = processor._find_column(headers, ["nonexistent", "missing"])
        assert result is None

    def test_find_column_found(self, processor):
        """Test column finding success"""
        headers = ["name", "location", "date"]
        result = processor._find_column(headers, ["name", "tournament"])
        assert result == 0

    def test_find_column_exact_match_precedes_substring(self, processor):
        """Exact header matches win over substrings.

        Regression test: "to" is a substring of "tournament", so a pure
        substring search resolved the end-date column to the tournament name
        column whenever "tournament" appeared earlier in the header row.
        """
        headers = ["tournament", "from", "to", "fed"]
        result = processor._find_column(headers, ["to", "end", "bis"])
        assert result == 2

    def test_find_columns_matches_real_chess_results_headers(self, processor):
        """The live chess-results.com header row resolves date_to correctly.

        Regression test: with the real export headers, date_to_col used to
        collapse onto name_col (both resolved to 0) because "to" matched
        inside "tournament" first.
        """
        headers = [
            "tournament", "from", "to", "eventid", "organizer(s)",
            "tournament director", "chief arbiter", "deputy chief arbiter",
            "arbiter", "location", "time control", "fed", "state",
            "last update ", "teams", "n", "rd", "rd-akt", "db-key", "system",
        ]
        name_col, _location_col, _date_from_col, date_to_col, *_ = processor._find_columns(headers)
        assert date_to_col == 2
        assert date_to_col != name_col

    def test_load_drops_end_date_before_start_date(self, processor, tmp_path):
        """A bogus end date earlier than the start date is dropped, not published.

        Regression test: `_parse_date` falls back to "now" on any parse
        failure, so a misidentified end-date column used to silently publish
        today's date as a plausible-looking dateTo for every row. Dropping any
        end date earlier than the start date keeps that garbage out of
        tournaments_data.json even if a column is misidentified again.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        # Headers in row 1 - no metadata preamble above them, since the header
        # detector would latch onto any earlier row containing "tournament".
        ws.append(["Tournament", "from", "to", "Location", "FED"])
        future_start = (datetime.now() + timedelta(days=30)).strftime("%Y%m%d")
        earlier_end = (datetime.now() + timedelta(days=10)).strftime("%Y%m%d")
        ws.append(["Valencia Open", future_start, earlier_end, "Valencia", "ESP"])
        excel_file = tmp_path / "bad_end_date.xlsx"
        wb.save(excel_file)

        tournaments = processor.load_and_filter_tournaments(str(excel_file))
        assert len(tournaments) == 1
        assert tournaments[0]["dateTo"] == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
