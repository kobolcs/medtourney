"""
Custom Robot Framework Library for processing chess tournament data
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import openpyxl
from robot.api.deco import keyword


class TournamentProcessor:
    """Library for processing chess tournament Excel files"""

    # European countries (Russia excluded per user request)
    EUROPEAN_COUNTRIES = {
        'albania', 'andorra', 'austria', 'belarus', 'belgium', 'bosnia',
        'bulgaria', 'croatia', 'cyprus', 'czech', 'denmark', 'estonia',
        'finland', 'france', 'germany', 'greece', 'hungary', 'iceland',
        'ireland', 'italy', 'kosovo', 'latvia', 'liechtenstein', 'lithuania',
        'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands',
        'north macedonia', 'norway', 'poland', 'portugal', 'romania',
        'san marino', 'serbia', 'slovakia', 'slovenia', 'spain', 'sweden',
        'switzerland', 'ukraine', 'united kingdom', 'england', 'scotland',
        'wales', 'northern ireland', 'gbr', 'ger', 'fra', 'esp', 'ita', 'ned',
        'aut', 'cze', 'hun', 'pol', 'cro', 'gre', 'srb', 'rou', 'ukr',
        'svk', 'slo', 'den', 'nor', 'swe', 'fin', 'bel', 'ned', 'sui', 'por'
    }

    # Non-European countries to explicitly exclude
    NON_EUROPEAN_COUNTRIES = {
        'russia', 'moscow', 'petersburg', 'malaysia', 'uae', 'dubai', 'qatar',
        'saudi', 'china', 'india', 'indonesia', 'singapore', 'thailand',
        'vietnam', 'philippines', 'japan', 'korea', 'australia', 'new zealand',
        'usa', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru',
        'colombia', 'egypt', 'morocco', 'tunisia', 'algeria', 'south africa',
        'israel', 'jordan', 'lebanon', 'iran', 'iraq', 'turkey', 'kazakhstan',
        'uzbekistan', 'rus', 'mas', 'tur'
    }

    # Mediterranean locations
    MEDITERRANEAN_LOCATIONS = {
        'barcelona', 'valencia', 'alicante', 'malaga', 'marbella',
        'nice', 'cannes', 'monaco', 'marseille', 'montpellier',
        'genoa', 'genova', 'naples', 'napoli', 'sicily', 'sicilia', 'rome', 'roma',
        'athens', 'thessaloniki', 'split', 'dubrovnik', 'rijeka',
        'malta', 'valletta', 'sliema', 'limassol', 'larnaca', 'cyprus'
    }

    ROBOT_LIBRARY_SCOPE = 'GLOBAL'

    def __init__(self):
        self.tournaments = []

    @keyword("Load And Filter Tournaments")
    def load_and_filter_tournaments(self, excel_file: str) -> List[Dict[str, Any]]:
        """
        Load tournaments from Excel file and filter for European tournaments only.

        Args:
            excel_file: Path to the Excel file downloaded from chess-results.com

        Returns:
            List of tournament dictionaries
        """
        print(f"Loading tournaments from: {excel_file}")

        try:
            # Load Excel file
            workbook = openpyxl.load_workbook(excel_file, data_only=True)
            sheet = workbook.active

            # Get headers from first row
            headers = []
            for cell in sheet[1]:
                if cell.value:
                    headers.append(str(cell.value).strip().lower())

            print(f"Found columns: {headers}")

            # Find column indices
            name_col = self._find_column(headers, ['name', 'tournament', 'turnier'])
            location_col = self._find_column(headers, ['location', 'place', 'ort', 'city', 'country'])
            date_col = self._find_column(headers, ['date', 'datum', 'start', 'begin'])
            url_col = self._find_column(headers, ['url', 'link', 'website'])

            tournaments = []

            # Process each row
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                try:
                    # Extract data
                    name = str(row[name_col]).strip() if name_col is not None and row[name_col] else f"Tournament {row_idx}"
                    location = str(row[location_col]).strip() if location_col is not None and row[location_col] else "Unknown"
                    date_value = row[date_col] if date_col is not None else None
                    url = str(row[url_col]).strip() if url_col is not None and row[url_col] else "https://chess-results.com"

                    # Skip empty rows
                    if not name or name == "None":
                        continue

                    # Parse date
                    date_str = self._parse_date(date_value)

                    # Extract category
                    category = self._extract_category(name + " " + location)

                    # Filter: only European tournaments
                    if not self._is_european(location):
                        continue

                    # Build tournament dict
                    tournament = {
                        'name': name,
                        'location': location,
                        'date': date_str,
                        'category': category,
                        'url': url,
                        'description': name
                    }

                    tournaments.append(tournament)

                except Exception as e:
                    print(f"Error processing row {row_idx}: {e}")
                    continue

            workbook.close()

            print(f"Loaded {len(tournaments)} European tournaments")
            self.tournaments = tournaments
            return tournaments

        except Exception as e:
            print(f"Error loading Excel file: {e}")
            raise

    @keyword("Export To JSON")
    def export_to_json(self, tournaments: List[Dict], output_file: str):
        """
        Export tournaments to JSON file.

        Args:
            tournaments: List of tournament dictionaries
            output_file: Path to output JSON file
        """
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(tournaments, f, indent=2, ensure_ascii=False)
            print(f"Exported {len(tournaments)} tournaments to {output_file}")
        except Exception as e:
            print(f"Error exporting to JSON: {e}")
            raise

    @keyword("Filter Tournaments By Criteria")
    def filter_tournaments_by_criteria(
        self,
        tournaments: List[Dict],
        open_only: bool = True,
        exclude_youth: bool = True,
        mediterranean_only: bool = False,
        senior_only: bool = False
    ) -> List[Dict]:
        """
        Filter tournaments by various criteria.

        Args:
            tournaments: List of tournament dictionaries
            open_only: Only include Open category tournaments
            exclude_youth: Exclude youth-only tournaments
            mediterranean_only: Only include Mediterranean locations
            senior_only: Only include S50+ tournaments

        Returns:
            Filtered list of tournaments
        """
        filtered = []

        for t in tournaments:
            category_lower = t['category'].lower()
            location_lower = t['location'].lower()

            # Open filter
            if open_only and 'open' not in category_lower:
                continue

            # Youth filter
            if exclude_youth and 'youth' in category_lower and 'open' not in category_lower:
                continue

            # Mediterranean filter
            if mediterranean_only:
                if not any(place in location_lower for place in self.MEDITERRANEAN_LOCATIONS):
                    continue

            # Senior filter
            if senior_only and 's50' not in category_lower and 'senior' not in category_lower:
                continue

            filtered.append(t)

        print(f"Filtered to {len(filtered)} tournaments")
        return filtered

    def _find_column(self, headers: List[str], possible_names: List[str]) -> int:
        """Find column index by matching possible header names"""
        for idx, header in enumerate(headers):
            for name in possible_names:
                if name in header:
                    return idx
        return None

    def _parse_date(self, date_value) -> str:
        """Parse date from various formats"""
        if date_value is None:
            return datetime.now().strftime('%Y-%m-%d')

        # If already a datetime object
        if isinstance(date_value, datetime):
            return date_value.strftime('%Y-%m-%d')

        # Try to parse string
        date_str = str(date_value).strip()

        # Try various date patterns
        patterns = [
            (r'(\d{1,2})\.(\d{1,2})\.(\d{4})', '%d.%m.%Y'),  # DD.MM.YYYY
            (r'(\d{4})-(\d{1,2})-(\d{1,2})', '%Y-%m-%d'),    # YYYY-MM-DD
            (r'(\d{1,2})/(\d{1,2})/(\d{4})', '%d/%m/%Y'),    # DD/MM/YYYY
        ]

        for pattern, date_format in patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    if pattern == patterns[0] or pattern == patterns[2]:  # DD.MM.YYYY or DD/MM/YYYY
                        dt = datetime(int(match[3]), int(match[2]), int(match[1]))
                    else:  # YYYY-MM-DD
                        dt = datetime(int(match[1]), int(match[2]), int(match[3]))
                    return dt.strftime('%Y-%m-%d')
                except:
                    continue

        return datetime.now().strftime('%Y-%m-%d')

    def _extract_category(self, text: str) -> str:
        """Extract tournament category from text"""
        categories = []
        text_lower = text.lower()

        if re.search(r'\bopen\b', text_lower):
            categories.append('Open')
        if re.search(r'\bs50\+|s50|senior|veteran|50\+', text_lower):
            categories.append('S50+')
        if re.search(r'\bu\d+|youth|junior|u18|under', text_lower):
            categories.append('Youth')
        if re.search(r'\bwomen|ladies|female', text_lower):
            categories.append('Women')
        if re.search(r'\bblitz', text_lower):
            categories.append('Blitz')
        if re.search(r'\brapid', text_lower):
            categories.append('Rapid')

        return ', '.join(categories) if categories else 'Open'

    def _is_european(self, location: str) -> bool:
        """Check if location is in Europe (excluding Russia)"""
        location_lower = location.lower()

        # First check if it's explicitly non-European
        if any(country in location_lower for country in self.NON_EUROPEAN_COUNTRIES):
            return False

        # Then check if it matches European countries
        return any(country in location_lower for country in self.EUROPEAN_COUNTRIES)
