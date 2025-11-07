#!/usr/bin/env python3
"""
Chess Tournament Search Tool for chess-results.com
Searches for European tournaments with advanced filtering capabilities.
"""

import argparse
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser


class TournamentFilter:
    """Filters for tournament search"""
    
    # European countries (list of common European country names and codes)
    EUROPEAN_COUNTRIES = {
        'albania', 'andorra', 'austria', 'belarus', 'belgium', 'bosnia', 
        'bulgaria', 'croatia', 'cyprus', 'czech', 'denmark', 'estonia', 
        'finland', 'france', 'germany', 'greece', 'hungary', 'iceland', 
        'ireland', 'italy', 'kosovo', 'latvia', 'liechtenstein', 'lithuania', 
        'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands', 
        'north macedonia', 'norway', 'poland', 'portugal', 'romania', 'russia', 
        'san marino', 'serbia', 'slovakia', 'slovenia', 'spain', 'sweden', 
        'switzerland', 'ukraine', 'united kingdom', 'england', 'scotland', 
        'wales', 'northern ireland', 'gbr', 'ger', 'fra', 'esp', 'ita', 'ned'
    }
    
    # Mediterranean seaside countries/regions
    MEDITERRANEAN_SEASIDE = {
        'spain', 'france', 'italy', 'greece', 'croatia', 'malta', 'cyprus',
        'monaco', 'albania', 'montenegro', 'slovenia', 'bosnia',
        # Specific cities/regions
        'barcelona', 'nice', 'cannes', 'monaco', 'genoa', 'naples', 'sicily',
        'athens', 'thessaloniki', 'split', 'dubrovnik', 'valletta', 'limassol'
    }
    
    def __init__(self):
        self.start_date = datetime.now()
        self.end_date = self.start_date + timedelta(days=90)  # 3 months
    
    def is_european(self, location: str) -> bool:
        """Check if tournament is in Europe"""
        location_lower = location.lower()
        return any(country in location_lower for country in self.EUROPEAN_COUNTRIES)
    
    def is_mediterranean_seaside(self, location: str) -> bool:
        """Check if tournament is in Mediterranean seaside location"""
        location_lower = location.lower()
        return any(place in location_lower for place in self.MEDITERRANEAN_SEASIDE)
    
    def is_in_date_range(self, tournament_date: datetime) -> bool:
        """Check if tournament is within next 3 months"""
        return self.start_date <= tournament_date <= self.end_date
    
    def is_open_category(self, category: str) -> bool:
        """Check if tournament is open category"""
        category_lower = category.lower()
        return 'open' in category_lower
    
    def has_senior_category(self, category: str) -> bool:
        """Check if tournament has S50+ category"""
        category_lower = category.lower()
        return 's50' in category_lower or 'senior' in category_lower or 'veteran' in category_lower
    
    def has_adult_players(self, description: str) -> bool:
        """Check if tournament has adult players (not all below 18)"""
        desc_lower = description.lower()
        # If it explicitly mentions youth/junior/u18 only, exclude it
        youth_only_keywords = ['youth only', 'junior only', 'u18 only', 'under 18 only']
        return not any(keyword in desc_lower for keyword in youth_only_keywords)


class TournamentSearcher:
    """Main class for searching tournaments on chess-results.com"""
    
    BASE_URL = "https://chess-results.com"
    
    def __init__(self):
        self.filter = TournamentFilter()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def search_tournaments(
        self,
        require_open: bool = True,
        require_adult_players: bool = True,
        filter_mediterranean: bool = False,
        filter_senior: bool = False
    ) -> List[Dict]:
        """
        Search for tournaments matching criteria
        
        Args:
            require_open: Filter for open category tournaments
            require_adult_players: Filter out youth-only tournaments
            filter_mediterranean: Only show Mediterranean seaside tournaments
            filter_senior: Only show tournaments with S50+ category
        
        Returns:
            List of tournament dictionaries
        """
        tournaments = []
        
        # Note: This is a mock implementation since chess-results.com 
        # doesn't have a public API. In production, this would scrape
        # the actual website or use an API if available.
        
        # For demonstration, we'll create sample data structure
        sample_tournaments = self._get_sample_tournaments()
        
        for tournament in sample_tournaments:
            # Apply filters
            if not self.filter.is_european(tournament['location']):
                continue
            
            if not self.filter.is_in_date_range(tournament['date']):
                continue
            
            if require_open and not self.filter.is_open_category(tournament['category']):
                continue
            
            if require_adult_players and not self.filter.has_adult_players(tournament['description']):
                continue
            
            if filter_mediterranean and not self.filter.is_mediterranean_seaside(tournament['location']):
                continue
            
            if filter_senior and not self.filter.has_senior_category(tournament['category']):
                continue
            
            tournaments.append(tournament)
        
        return tournaments
    
    def _get_sample_tournaments(self) -> List[Dict]:
        """
        Get sample tournament data for demonstration.
        In production, this would fetch from chess-results.com
        """
        now = datetime.now()
        
        return [
            {
                'name': 'Barcelona Open Chess Championship 2025',
                'location': 'Barcelona, Spain',
                'date': now + timedelta(days=15),
                'category': 'Open',
                'description': 'International open tournament with players of all ages',
                'url': 'https://chess-results.com/tournament1'
            },
            {
                'name': 'Athens Senior Open',
                'location': 'Athens, Greece',
                'date': now + timedelta(days=30),
                'category': 'Open, S50+',
                'description': 'Open tournament with special S50+ category',
                'url': 'https://chess-results.com/tournament2'
            },
            {
                'name': 'Youth Championship U18',
                'location': 'Berlin, Germany',
                'date': now + timedelta(days=20),
                'category': 'Youth',
                'description': 'Youth only tournament for under 18 players',
                'url': 'https://chess-results.com/tournament3'
            },
            {
                'name': 'Croatian Coast Open',
                'location': 'Split, Croatia',
                'date': now + timedelta(days=45),
                'category': 'Open, S50+',
                'description': 'Mediterranean chess festival with multiple categories',
                'url': 'https://chess-results.com/tournament4'
            },
            {
                'name': 'Prague Chess Festival',
                'location': 'Prague, Czech Republic',
                'date': now + timedelta(days=60),
                'category': 'Open',
                'description': 'International open tournament',
                'url': 'https://chess-results.com/tournament5'
            },
            {
                'name': 'Nice Riviera Open',
                'location': 'Nice, France',
                'date': now + timedelta(days=75),
                'category': 'Open, S50+',
                'description': 'Mediterranean seaside tournament with veteran section',
                'url': 'https://chess-results.com/tournament6'
            },
            {
                'name': 'Moscow Blitz Tournament',
                'location': 'Moscow, Russia',
                'date': now + timedelta(days=100),  # Outside 3-month range
                'category': 'Open',
                'description': 'Fast chess tournament',
                'url': 'https://chess-results.com/tournament7'
            },
        ]
    
    def format_tournament(self, tournament: Dict) -> str:
        """Format tournament information for display"""
        date_str = tournament['date'].strftime('%Y-%m-%d')
        return f"""
Name: {tournament['name']}
Location: {tournament['location']}
Date: {date_str}
Category: {tournament['category']}
Description: {tournament['description']}
URL: {tournament['url']}
{'-' * 80}"""


def main():
    """Main entry point for the tournament search tool"""
    parser = argparse.ArgumentParser(
        description='Search for European chess tournaments on chess-results.com',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic search - European open tournaments in next 3 months
  %(prog)s
  
  # Include youth-only tournaments
  %(prog)s --include-youth
  
  # Filter for Mediterranean seaside locations only
  %(prog)s --mediterranean
  
  # Filter for tournaments with S50+ category
  %(prog)s --senior
  
  # Combine filters
  %(prog)s --mediterranean --senior
        """
    )
    
    parser.add_argument(
        '--include-youth',
        action='store_true',
        help='Include youth-only tournaments (default: exclude)'
    )
    
    parser.add_argument(
        '--allow-closed',
        action='store_true',
        help='Include closed/invitation tournaments (default: open only)'
    )
    
    parser.add_argument(
        '--mediterranean',
        action='store_true',
        help='Filter for Mediterranean seaside locations only'
    )
    
    parser.add_argument(
        '--senior',
        action='store_true',
        help='Filter for tournaments with S50+ category'
    )
    
    args = parser.parse_args()
    
    # Create searcher and search for tournaments
    searcher = TournamentSearcher()
    
    print("Searching for European chess tournaments...")
    print(f"Date range: next 3 months ({searcher.filter.start_date.strftime('%Y-%m-%d')} to {searcher.filter.end_date.strftime('%Y-%m-%d')})")
    print()
    
    tournaments = searcher.search_tournaments(
        require_open=not args.allow_closed,
        require_adult_players=not args.include_youth,
        filter_mediterranean=args.mediterranean,
        filter_senior=args.senior
    )
    
    if not tournaments:
        print("No tournaments found matching the criteria.")
        return 0
    
    print(f"Found {len(tournaments)} tournament(s):\n")
    print("=" * 80)
    
    for tournament in tournaments:
        print(searcher.format_tournament(tournament))
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
