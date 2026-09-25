"""Unit tests for TournamentProcessor.py: tournament filtering.

Shared fixtures (processor, sample_tournaments, sample_excel_file) are in
tests/python/conftest.py.
"""

from datetime import datetime, timedelta

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
        assert all("Open" in t["category"] for t in filtered)

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
        assert not any("youth" in t["category"].lower() and "open" not in t["category"].lower() for t in filtered)

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
        locations = [t["location"].lower() for t in filtered]
        assert any("barcelona" in loc or "athens" in loc for loc in locations)

    def test_filter_mediterranean_spanish_cities(self, processor):
        """Test Mediterranean filter with various Spanish coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Palma Open",
                "location": "Palma de Mallorca, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Palma Open"
            },
            {
                "name": "Ibiza Blitz",
                "location": "Ibiza, ESP",
                "date": tomorrow,
                "category": "Open, Blitz",
                "url": "https://chess-results.com/test2",
                "description": "Ibiza Blitz"
            },
            {
                "name": "Madrid Open",
                "location": "Madrid, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test3",
                "description": "Madrid Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Palma and Ibiza should match (Madrid is not Mediterranean)
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("palma" in loc or "mallorca" in loc for loc in locations)
        assert any("ibiza" in loc for loc in locations)
        assert not any("madrid" in loc for loc in locations)

    def test_filter_mediterranean_italian_cities(self, processor):
        """Test Mediterranean filter with various Italian coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Palermo Open",
                "location": "Palermo, ITA",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Palermo Open"
            },
            {
                "name": "Cagliari Championship",
                "location": "Cagliari, Sardinia",
                "date": tomorrow,
                "category": "Open, Rapid",
                "url": "https://chess-results.com/test2",
                "description": "Cagliari Championship"
            },
            {
                "name": "Milan Open",
                "location": "Milan, ITA",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test3",
                "description": "Milan Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Palermo and Cagliari should match (Milan is not Mediterranean)
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("palermo" in loc for loc in locations)
        assert any("cagliari" in loc for loc in locations)
        assert not any("milan" in loc for loc in locations)

    def test_filter_mediterranean_greek_cities(self, processor):
        """Test Mediterranean filter with various Greek coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Rhodes Open",
                "location": "Rhodes, GRE",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Rhodes Open"
            },
            {
                "name": "Heraklion Championship",
                "location": "Heraklion, Crete",
                "date": tomorrow,
                "category": "Open, Rapid",
                "url": "https://chess-results.com/test2",
                "description": "Heraklion Championship"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Both should match
        assert len(filtered) == 2
        locations = [t["location"].lower() for t in filtered]
        assert any("rhodes" in loc for loc in locations)
        assert any("heraklion" in loc or "crete" in loc for loc in locations)

    def test_filter_mediterranean_croatian_cities(self, processor):
        """Test Mediterranean filter with Croatian coastal cities"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Zadar Open",
                "location": "Zadar, CRO",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Zadar Open"
            },
            {
                "name": "Zagreb Open",
                "location": "Zagreb, CRO",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test2",
                "description": "Zagreb Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=True,
            senior_only=False
        )

        # Only Zadar should match (Zagreb is inland)
        assert len(filtered) == 1
        assert "zadar" in filtered[0]["location"].lower()

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
        assert "S50+" in filtered[0]["category"] or "senior" in filtered[0]["category"].lower()

    def test_filter_senior_with_veteran_keyword(self, processor):
        """Test senior filter matches 'veteran' keyword"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Veteran Championship",
                "location": "Madrid, ESP",
                "date": tomorrow,
                "category": "Open, S50+, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Veteran Championship"
            },
            {
                "name": "Regular Open",
                "location": "Barcelona, ESP",
                "date": tomorrow,
                "category": "Open, Classical",
                "url": "https://chess-results.com/test2",
                "description": "Regular Open"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )

        assert len(filtered) == 1
        assert "Veteran" in filtered[0]["name"]

    def test_filter_senior_with_50plus_keyword(self, processor):
        """Test senior filter matches '50+' keyword in category"""
        tomorrow: str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tournaments = [
            {
                "name": "Championship 50+",
                "location": "Athens, GRE",
                "date": tomorrow,
                "category": "S50+, Classical",
                "url": "https://chess-results.com/test1",
                "description": "Championship 50+"
            }
        ]

        filtered = processor.filter_tournaments_by_criteria(
            tournaments,
            open_only=False,
            exclude_youth=False,
            mediterranean_only=False,
            senior_only=True
        )

        assert len(filtered) == 1
        assert "50+" in filtered[0]["name"]

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
