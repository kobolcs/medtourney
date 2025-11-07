#!/usr/bin/env python3
"""
Unit tests for tournament search functionality
"""

import unittest
from datetime import datetime, timedelta
from tournament_search import TournamentFilter, TournamentSearcher


class TestTournamentFilter(unittest.TestCase):
    """Test cases for TournamentFilter class"""
    
    def setUp(self):
        self.filter = TournamentFilter()
    
    def test_is_european_positive(self):
        """Test European location detection - positive cases"""
        self.assertTrue(self.filter.is_european("Barcelona, Spain"))
        self.assertTrue(self.filter.is_european("Paris, France"))
        self.assertTrue(self.filter.is_european("Berlin, Germany"))
        self.assertTrue(self.filter.is_european("Prague, Czech Republic"))
        self.assertTrue(self.filter.is_european("Athens, Greece"))
    
    def test_is_european_negative(self):
        """Test European location detection - negative cases"""
        self.assertFalse(self.filter.is_european("New York, USA"))
        self.assertFalse(self.filter.is_european("Tokyo, Japan"))
        self.assertFalse(self.filter.is_european("Dubai, UAE"))
    
    def test_is_mediterranean_seaside_positive(self):
        """Test Mediterranean seaside location detection - positive cases"""
        self.assertTrue(self.filter.is_mediterranean_seaside("Barcelona, Spain"))
        self.assertTrue(self.filter.is_mediterranean_seaside("Nice, France"))
        self.assertTrue(self.filter.is_mediterranean_seaside("Split, Croatia"))
        self.assertTrue(self.filter.is_mediterranean_seaside("Athens, Greece"))
        self.assertTrue(self.filter.is_mediterranean_seaside("Valletta, Malta"))
    
    def test_is_mediterranean_seaside_negative(self):
        """Test Mediterranean seaside location detection - negative cases"""
        self.assertFalse(self.filter.is_mediterranean_seaside("Berlin, Germany"))
        self.assertFalse(self.filter.is_mediterranean_seaside("Prague, Czech Republic"))
        self.assertFalse(self.filter.is_mediterranean_seaside("Warsaw, Poland"))
    
    def test_is_in_date_range(self):
        """Test date range filtering"""
        now = datetime.now()
        
        # Within range
        self.assertTrue(self.filter.is_in_date_range(now + timedelta(days=10)))
        self.assertTrue(self.filter.is_in_date_range(now + timedelta(days=89)))
        
        # Outside range
        self.assertFalse(self.filter.is_in_date_range(now + timedelta(days=100)))
        self.assertFalse(self.filter.is_in_date_range(now - timedelta(days=1)))
    
    def test_is_open_category(self):
        """Test open category detection"""
        self.assertTrue(self.filter.is_open_category("Open"))
        self.assertTrue(self.filter.is_open_category("Open, S50+"))
        self.assertTrue(self.filter.is_open_category("International Open"))
        self.assertFalse(self.filter.is_open_category("Youth"))
        self.assertFalse(self.filter.is_open_category("Invitational"))
    
    def test_has_senior_category(self):
        """Test S50+ category detection"""
        self.assertTrue(self.filter.has_senior_category("Open, S50+"))
        self.assertTrue(self.filter.has_senior_category("Senior Championship"))
        self.assertTrue(self.filter.has_senior_category("Veteran Open"))
        self.assertFalse(self.filter.has_senior_category("Open"))
        self.assertFalse(self.filter.has_senior_category("Youth"))
    
    def test_has_adult_players(self):
        """Test adult players detection"""
        self.assertTrue(self.filter.has_adult_players("Open tournament for all ages"))
        self.assertTrue(self.filter.has_adult_players("International championship"))
        self.assertFalse(self.filter.has_adult_players("Youth only tournament"))
        self.assertFalse(self.filter.has_adult_players("Junior only event"))
        self.assertFalse(self.filter.has_adult_players("Under 18 only tournament"))


class TestTournamentSearcher(unittest.TestCase):
    """Test cases for TournamentSearcher class"""
    
    def setUp(self):
        self.searcher = TournamentSearcher()
    
    def test_search_tournaments_default(self):
        """Test default search (open, adult players, European, next 3 months)"""
        tournaments = self.searcher.search_tournaments()
        
        # Should find some tournaments
        self.assertGreater(len(tournaments), 0)
        
        # All should be European, open, and have adult players
        for tournament in tournaments:
            self.assertTrue(self.searcher.filter.is_european(tournament['location']))
            self.assertTrue(self.searcher.filter.is_open_category(tournament['category']))
            self.assertTrue(self.searcher.filter.has_adult_players(tournament['description']))
    
    def test_search_tournaments_mediterranean(self):
        """Test Mediterranean filter"""
        tournaments = self.searcher.search_tournaments(filter_mediterranean=True)
        
        # All should be Mediterranean
        for tournament in tournaments:
            self.assertTrue(self.searcher.filter.is_mediterranean_seaside(tournament['location']))
    
    def test_search_tournaments_senior(self):
        """Test S50+ filter"""
        tournaments = self.searcher.search_tournaments(filter_senior=True)
        
        # All should have senior category
        for tournament in tournaments:
            self.assertTrue(self.searcher.filter.has_senior_category(tournament['category']))
    
    def test_search_tournaments_combined_filters(self):
        """Test combined Mediterranean and Senior filters"""
        tournaments = self.searcher.search_tournaments(
            filter_mediterranean=True,
            filter_senior=True
        )
        
        # All should be both Mediterranean and have senior category
        for tournament in tournaments:
            self.assertTrue(self.searcher.filter.is_mediterranean_seaside(tournament['location']))
            self.assertTrue(self.searcher.filter.has_senior_category(tournament['category']))
    
    def test_search_tournaments_include_youth(self):
        """Test including youth tournaments"""
        tournaments_with_youth = self.searcher.search_tournaments(require_adult_players=False)
        tournaments_without_youth = self.searcher.search_tournaments(require_adult_players=True)
        
        # Should have more tournaments when including youth
        self.assertGreaterEqual(len(tournaments_with_youth), len(tournaments_without_youth))


if __name__ == '__main__':
    unittest.main()
