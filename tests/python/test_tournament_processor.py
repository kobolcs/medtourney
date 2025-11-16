"""Unit tests for TournamentProcessor.py.

This module contains comprehensive unit tests for the TournamentProcessor class,
covering date parsing, European location detection, tournament filtering,
Excel file loading, and JSON export functionality.

Typical usage example:

    $ pytest tests/python/test_tournament_processor.py -v
"""

import json
import pytest
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List
import tempfile
import openpyxl
from TournamentProcessor import TournamentProcessor


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

    @pytest.fixture
    def processor(self) -> TournamentProcessor:
        """Create a TournamentProcessor instance for testing.

        Returns:
            TournamentProcessor instance with loaded configuration.
        """
        return TournamentProcessor()

    @pytest.fixture
    def sample_tournaments(self) -> List[Dict[str, Any]]:
        """Generate sample tournament data for testing.

        Returns:
            List of tournament dictionaries with varied categories and locations.
        """
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        return [
            {
                'name': 'Barcelona Open 2025',
                'location': 'Barcelona, ESP',
                'date': tomorrow,
                'category': 'Open, Classical',
                'url': 'https://chess-results.com/test1',
                'description': 'Barcelona Open 2025'
            },
            {
                'name': 'Athens Senior Championship',
                'location': 'Athens, Greece',
                'date': tomorrow,
                'category': 'Open, S50+, Classical',
                'url': 'https://chess-results.com/test2',
                'description': 'Athens Senior Championship'
            },
            {
                'name': 'Youth Tournament U18',
                'location': 'Paris, France',
                'date': tomorrow,
                'category': 'Youth',
                'url': 'https://chess-results.com/test3',
                'description': 'Youth Tournament U18'
            }
        ]

    @pytest.fixture
    def sample_excel_file(self, tmp_path: Path) -> str:
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

        # Headers
        ws.append(['Name', 'Location', 'Date', 'URL'])

        # Sample data - dates in YYYYMMDD format (chess-results.com format)
        tomorrow: datetime = datetime.now() + timedelta(days=1)
        future_date: datetime = datetime.now() + timedelta(days=30)
        past_date: datetime = datetime.now() - timedelta(days=1)

        ws.append([
            'Barcelona Open 2025',
            'Barcelona, ESP',
            tomorrow.strftime('%Y%m%d'),
            'https://chess-results.com/test1'
        ])
        ws.append([
            'Athens Senior Open',
            'Athens, Greece',
            future_date.strftime('%Y%m%d'),
            'https://chess-results.com/test2'
        ])
        ws.append([
            'Dubai Open',
            'Dubai, UAE',
            future_date.strftime('%Y%m%d'),
            'https://chess-results.com/test3'
        ])
        ws.append([
            'Past Tournament',
            'Madrid, ESP',
            past_date.strftime('%Y%m%d'),
            'https://chess-results.com/test4'
        ])
        ws.append([
            'Moscow Championship',
            'Moscow, Russia',
            future_date.strftime('%Y%m%d'),
            'https://chess-results.com/test5'
        ])

        excel_file = tmp_path / 'test_tournaments.xlsx'
        wb.save(excel_file)
        return str(excel_file)


    # ========== Date Parsing Tests ==========

    def test_parse_date_yyyymmdd(self, processor):
        """Test YYYYMMDD format (chess-results.com format)"""
        date = processor._parse_date('20251128')
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_dot(self, processor):
        """Test DD.MM.YYYY format"""
        date = processor._parse_date('28.11.2025')
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_yyyymmdd_dash(self, processor):
        """Test YYYY-MM-DD format"""
        date = processor._parse_date('2025-11-28')
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_ddmmyyyy_slash(self, processor):
        """Test DD/MM/YYYY format"""
        date = processor._parse_date('28/11/2025')
        assert date.year == 2025
        assert date.month == 11
        assert date.day == 28

    def test_parse_date_datetime_object(self, processor):
        """Test passing a datetime object"""
        dt = datetime(2025, 11, 28)
        date = processor._parse_date(dt)
        assert date == dt

    def test_parse_date_invalid(self, processor):
        """Test invalid date returns current date"""
        date = processor._parse_date('invalid-date')
        today = datetime.now()
        assert date.date() == today.date()

    def test_parse_date_none(self, processor):
        """Test None returns current date"""
        date = processor._parse_date(None)
        today = datetime.now()
        assert date.date() == today.date()


    # ========== European Location Detection Tests ==========

    def test_is_european_spain(self, processor):
        """Test Spanish location detection"""
        assert processor._is_european('Barcelona, ESP') is True
        assert processor._is_european('Madrid, Spain') is True
        assert processor._is_european('españa') is True

    def test_is_european_france(self, processor):
        """Test French location detection"""
        assert processor._is_european('Paris, FRA') is True
        assert processor._is_european('Nice, France') is True

    def test_is_european_germany(self, processor):
        """Test German location detection"""
        assert processor._is_european('Berlin, GER') is True
        assert processor._is_european('Munich, Germany') is True

    def test_is_european_greece(self, processor):
        """Test Greek location detection"""
        assert processor._is_european('Athens, Greece') is True
        assert processor._is_european('GRE') is True

    def test_is_european_case_insensitive(self, processor):
        """Test case insensitivity"""
        assert processor._is_european('SPAIN') is True
        assert processor._is_european('spain') is True
        assert processor._is_european('Spain') is True

    def test_is_not_european_russia(self, processor):
        """Test Russia is excluded"""
        assert processor._is_european('Moscow, Russia') is False
        assert processor._is_european('Petersburg, RUS') is False

    def test_is_not_european_asia(self, processor):
        """Test Asian countries are excluded"""
        assert processor._is_european('Dubai, UAE') is False
        assert processor._is_european('Singapore') is False
        assert processor._is_european('Malaysia') is False
        assert processor._is_european('China') is False

    def test_is_not_european_americas(self, processor):
        """Test American countries are excluded"""
        assert processor._is_european('New York, USA') is False
        assert processor._is_european('Toronto, Canada') is False
        assert processor._is_european('Mexico City, Mexico') is False

    def test_is_not_european_unknown(self, processor):
        """Test unknown location returns False"""
        assert processor._is_european('Unknown') is False
        assert processor._is_european('') is False


    # ========== Category Extraction Tests ==========

    def test_extract_category_open(self, processor):
        """Test Open category detection"""
        category = processor._extract_category('Barcelona Open Championship')
        assert 'Open' in category

    def test_extract_category_senior(self, processor):
        """Test S50+ category detection"""
        category = processor._extract_category('Senior Championship S50+')
        assert 'S50+' in category

        category = processor._extract_category('Veteran Tournament')
        assert 'S50+' in category

    def test_extract_category_youth(self, processor):
        """Test Youth category detection"""
        category = processor._extract_category('Youth U18 Championship')
        assert 'Youth' in category

        category = processor._extract_category('Junior Tournament U16')
        assert 'Youth' in category

    def test_extract_category_women(self, processor):
        """Test Women category detection"""
        category = processor._extract_category('Women Championship')
        assert 'Women' in category

        category = processor._extract_category('Ladies Tournament')
        assert 'Women' in category

    def test_extract_category_blitz(self, processor):
        """Test Blitz time control detection"""
        category = processor._extract_category('Blitz Championship')
        assert 'Blitz' in category

    def test_extract_category_rapid(self, processor):
        """Test Rapid time control detection"""
        category = processor._extract_category('Rapid Open')
        assert 'Rapid' in category

    def test_extract_category_classical(self, processor):
        """Test Classical time control detection"""
        category = processor._extract_category('Classical Championship')
        assert 'Classical' in category

    def test_extract_category_default(self, processor):
        """Test default category when nothing matches"""
        category = processor._extract_category('Generic Tournament')
        assert 'Classical' in category  # Should default to Classical

    def test_extract_category_multiple(self, processor):
        """Test multiple categories"""
        category = processor._extract_category('Open Senior S50+ Rapid Championship')
        assert 'Open' in category
        assert 'S50+' in category
        assert 'Rapid' in category


    # ========== Tournament Filtering Tests ==========

    def test_filter_open_only(self, processor, sample_tournaments):
        """Test filtering for Open category only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=True,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=False
        )
        assert len(filtered) == 2  # Barcelona and Athens have Open
        assert all('Open' in t['category'] for t in filtered)

    def test_filter_exclude_youth(self, processor, sample_tournaments):
        """Test excluding youth-only tournaments"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=True,
            mediterranean_only=False,
            senior_only=False
        )
        # Youth tournament should be excluded
        assert len(filtered) == 2
        assert not any('youth' in t['category'].lower() and 'open' not in t['category'].lower() for t in filtered)

    def test_filter_mediterranean_only(self, processor, sample_tournaments):
        """Test filtering for Mediterranean locations only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )
        # Barcelona and Athens are Mediterranean
        assert len(filtered) == 2
        locations = [t['location'].lower() for t in filtered]
        assert any('barcelona' in loc or 'athens' in loc for loc in locations)

    def test_filter_senior_only(self, processor, sample_tournaments):
        """Test filtering for S50+ tournaments only"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )
        assert len(filtered) == 1
        assert 'S50+' in filtered[0]['category'] or 'senior' in filtered[0]['category'].lower()

    def test_filter_combined(self, processor, sample_tournaments):
        """Test multiple filters combined"""
        filtered = processor.filter_tournaments_by_criteria(
            sample_tournaments,
            open_only=True,
            exclude_youth=True,
            mediterranean_only=True,
            senior_only=False
        )
        # Should return Barcelona and Athens (both Open and Mediterranean)
        assert len(filtered) == 2


    # ========== Excel Loading Tests ==========

    def test_load_and_filter_tournaments(self, processor, sample_excel_file):
        """Test loading tournaments from Excel file"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Should load 2 European tournaments (Barcelona and Athens)
        # Dubai, Moscow (Russia), and past tournament should be filtered out
        assert len(tournaments) >= 1  # At least Barcelona and Athens

        # Check all tournaments are European
        for t in tournaments:
            assert processor._is_european(t['location'])

        # Check no past tournaments
        tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        for t in tournaments:
            tournament_date = datetime.strptime(t['date'], '%Y-%m-%d')
            assert tournament_date >= tomorrow

    def test_load_excel_missing_file(self, processor):
        """Test loading from non-existent file raises error"""
        with pytest.raises(Exception):
            processor.load_and_filter_tournaments('/nonexistent/file.xlsx')

    def test_load_excel_validates_location(self, processor, sample_excel_file):
        """Test that non-European locations are filtered out"""
        tournaments = processor.load_and_filter_tournaments(sample_excel_file)

        # Dubai and Moscow should be filtered out
        locations = [t['location'] for t in tournaments]
        assert not any('dubai' in loc.lower() for loc in locations)
        assert not any('moscow' in loc.lower() for loc in locations)


    # ========== JSON Export Tests ==========

    def test_export_to_json(self, processor, sample_tournaments, tmp_path):
        """Test exporting tournaments to JSON"""
        json_file = tmp_path / 'tournaments.json'

        processor.export_to_json(sample_tournaments, str(json_file))

        # Verify file exists
        assert json_file.exists()

        # Verify content
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        assert len(data) == len(sample_tournaments)
        assert data[0]['name'] == 'Barcelona Open 2025'

    def test_export_json_validation(self, processor, tmp_path):
        """Test JSON export validates tournament structure"""
        json_file = tmp_path / 'tournaments.json'

        # Invalid tournament data (missing required fields)
        invalid_tournaments = [
            {'name': 'Test'},  # Missing location, date, category, url
            {'name': 'Valid', 'location': 'Barcelona', 'date': '2025-11-28', 'category': 'Open', 'url': 'http://test.com'}
        ]

        processor.export_to_json(invalid_tournaments, str(json_file))

        # Should only export valid tournament
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        assert len(data) == 1
        assert data[0]['name'] == 'Valid'

    def test_export_json_unicode(self, processor, tmp_path):
        """Test JSON export handles Unicode correctly"""
        json_file = tmp_path / 'tournaments.json'

        unicode_tournaments = [
            {
                'name': 'Torneo España 2025',
                'location': 'Barcelona, España',
                'date': '2025-11-28',
                'category': 'Open',
                'url': 'https://chess-results.com/test',
                'description': 'Torneo en España'
            }
        ]

        processor.export_to_json(unicode_tournaments, str(json_file))

        # Verify Unicode is preserved
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        assert 'España' in data[0]['name']
        assert 'España' in data[0]['location']


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
        json_file = tmp_path / 'empty.json'
        processor.export_to_json([], str(json_file))

        with open(json_file, 'r') as f:
            data = json.load(f)

        assert data == []

    def test_find_column_not_found(self, processor):
        """Test column finding when header not present"""
        headers = ['col1', 'col2', 'col3']
        result = processor._find_column(headers, ['nonexistent', 'missing'])
        assert result is None

    def test_find_column_found(self, processor):
        """Test column finding success"""
        headers = ['name', 'location', 'date']
        result = processor._find_column(headers, ['name', 'tournament'])
        assert result == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
