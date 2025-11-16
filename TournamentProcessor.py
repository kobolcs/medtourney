"""Custom Robot Framework Library for processing chess tournament data.

This module provides a Robot Framework keyword library for processing
chess tournament data from Excel files downloaded from chess-results.com.
It filters tournaments by location (European only), date (future only),
and various categories.

Typical usage example:

    from TournamentProcessor import TournamentProcessor

    processor = TournamentProcessor()
    tournaments = processor.load_and_filter_tournaments('tournaments.xlsx')
    processor.export_to_json(tournaments, 'output.json')
"""

import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Pattern, Set, Union

import openpyxl
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from robot.api.deco import keyword


class TournamentProcessor:
    """Library for processing chess tournament Excel files.

    This class provides methods to load, filter, and export chess tournament
    data. It's designed to work both as a standalone Python library and as
    a Robot Framework keyword library.

    Attributes:
        REGEX_PATTERNS: Precompiled regex patterns for date and category parsing.
        ROBOT_LIBRARY_SCOPE: Robot Framework library scope setting.
        tournaments: List of currently loaded tournaments.
        european_countries: Set of European country keywords for filtering.
        non_european_countries: Set of non-European country keywords.
        mediterranean_locations: Set of Mediterranean location keywords.
    """

    # Precompiled regex patterns for performance
    REGEX_PATTERNS: Dict[str, Pattern[str]] = {
        'date_yyyymmdd': re.compile(r'^(\d{8})$'),
        'date_ddmmyyyy_dot': re.compile(r'(\d{1,2})\.(\d{1,2})\.(\d{4})'),
        'date_yyyymmdd_dash': re.compile(r'(\d{4})-(\d{1,2})-(\d{1,2})'),
        'date_ddmmyyyy_slash': re.compile(r'(\d{1,2})/(\d{1,2})/(\d{4})'),
        'open': re.compile(r'\bopen\b', re.IGNORECASE),
        's50': re.compile(r'\bs50\+|s50|senior|veteran|50\+', re.IGNORECASE),
        # International youth keywords: English, Polish, Czech, Slovak, Hungarian, German, French, Spanish, Italian
        'youth': re.compile(
            r'\bu\d+|youth|junior|u18|under|'  # English
            r'żiak|młodzie[żz]|juniorzy|juniorów|'  # Polish (żiak, młodzież, juniorzy, juniorów)
            r'ml[áa]de[žz]|'  # Czech/Slovak (mládež)
            r'ifjúság|junior|'  # Hungarian
            r'jugend|'  # German
            r'jeune|junior|'  # French
            r'juvenil|joven|'  # Spanish
            r'giovani|giovanile',  # Italian
            re.IGNORECASE
        ),
        'women': re.compile(r'\bwomen|ladies|female', re.IGNORECASE),
        'blitz': re.compile(r'\bblitz\b', re.IGNORECASE),
        'rapid': re.compile(r'\brapid\b', re.IGNORECASE),
        'classical': re.compile(r'\bclassic|classical|standard\b', re.IGNORECASE),
    }

    ROBOT_LIBRARY_SCOPE: str = 'GLOBAL'

    def __init__(self) -> None:
        """Initialize the TournamentProcessor with empty tournament list."""
        self.tournaments: List[Dict[str, Any]] = []
        self.european_countries: Set[str] = set()
        self.non_european_countries: Set[str] = set()
        self.mediterranean_locations: Set[str] = set()
        # Load configuration from config.json
        self._load_config()

    def _load_config(self) -> None:
        """Load country and location data from config.json.

        Loads European countries, non-European countries, and Mediterranean
        locations from the config.json file. Falls back to default config
        if file is missing or invalid.

        Raises:
            No exceptions raised - falls back to defaults on any error.
        """
        config_path: Path = Path(__file__).parent / 'config.json'
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config: Dict[str, List[str]] = json.load(f)

            # Convert lists to sets for O(1) lookup performance
            self.european_countries = set(config['europeanCountries'])
            self.non_european_countries = set(config['nonEuropeanCountries'])
            self.mediterranean_locations = set(config['mediterraneanLocations'])

            print(f"Loaded config: {len(self.european_countries)} European countries, "
                  f"{len(self.non_european_countries)} non-European countries, "
                  f"{len(self.mediterranean_locations)} Mediterranean locations")
        except FileNotFoundError:
            print(f"Warning: config.json not found at {config_path}, using defaults")
            self._load_default_config()
        except json.JSONDecodeError as e:
            print(f"Error parsing config.json: {e}, using defaults")
            self._load_default_config()
        except KeyError as e:
            print(f"Missing key in config.json: {e}, using defaults")
            self._load_default_config()

    def _load_default_config(self) -> None:
        """Load fallback configuration if config.json is missing or invalid.

        Provides hardcoded sets of European countries, non-European countries,
        and Mediterranean locations as a fallback.
        """
        self.european_countries = {
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
            'svk', 'slo', 'den', 'nor', 'swe', 'fin', 'bel', 'sui', 'por'
        }
        self.non_european_countries = {
            'russia', 'moscow', 'petersburg', 'malaysia', 'uae', 'dubai', 'qatar',
            'saudi', 'china', 'india', 'indonesia', 'singapore', 'thailand',
            'vietnam', 'philippines', 'japan', 'korea', 'australia', 'new zealand',
            'usa', 'canada', 'mexico', 'brazil', 'argentina', 'chile', 'peru',
            'colombia', 'egypt', 'morocco', 'tunisia', 'algeria', 'south africa',
            'israel', 'jordan', 'lebanon', 'iran', 'iraq', 'turkey', 'kazakhstan',
            'uzbekistan', 'rus', 'mas', 'tur'
        }
        self.mediterranean_locations = {
            'barcelona', 'valencia', 'alicante', 'malaga', 'marbella',
            'nice', 'cannes', 'monaco', 'marseille', 'montpellier',
            'genoa', 'genova', 'naples', 'napoli', 'sicily', 'sicilia', 'rome', 'roma',
            'athens', 'thessaloniki', 'split', 'dubrovnik', 'rijeka',
            'malta', 'valletta', 'sliema', 'limassol', 'larnaca', 'cyprus'
        }

    @keyword("Load And Filter Tournaments")
    def load_and_filter_tournaments(self, excel_file: str) -> List[Dict[str, Any]]:
        """Load tournaments from Excel file and filter for European tournaments.

        Loads tournament data from an Excel file downloaded from chess-results.com,
        filters for European tournaments only (excluding Russia), and returns only
        tournaments starting tomorrow or later.

        Args:
            excel_file: Path to the Excel file downloaded from chess-results.com.
                Expected columns: Name, Location, Date, URL.

        Returns:
            List of tournament dictionaries, each containing:
                - name (str): Tournament name
                - location (str): Tournament location
                - date (str): Tournament start date in YYYY-MM-DD format
                - category (str): Tournament category (e.g., "Open, Classical")
                - url (str): Tournament URL
                - description (str): Tournament description (same as name)

        Raises:
            Exception: If Excel file cannot be loaded or parsed.

        Example:
            >>> processor = TournamentProcessor()
            >>> tournaments = processor.load_and_filter_tournaments('data.xlsx')
            >>> print(f"Found {len(tournaments)} tournaments")
            Found 42 tournaments
        """
        print(f"Loading tournaments from: {excel_file}")

        try:
            # Load Excel file
            workbook: Workbook = openpyxl.load_workbook(excel_file, data_only=True)
            sheet: Worksheet = workbook.active

            # Get headers from first row
            headers: List[str] = []
            for cell in sheet[1]:
                if cell.value:
                    headers.append(str(cell.value).strip().lower())

            print(f"Found columns: {headers}")

            # Find column indices
            name_col: Optional[int] = self._find_column(headers, ['name', 'tournament', 'turnier'])
            location_col: Optional[int] = self._find_column(headers, ['location', 'place', 'ort', 'city', 'country'])
            date_col: Optional[int] = self._find_column(headers, ['date', 'datum', 'start', 'begin'])
            url_col: Optional[int] = self._find_column(headers, ['url', 'link', 'website'])

            tournaments: List[Dict[str, Any]] = []

            # Calculate tomorrow once (not in loop) - PERFORMANCE FIX
            tomorrow: datetime = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

            # Process each row
            for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                try:
                    # Extract data
                    name: str = (str(row[name_col]).strip()
                               if name_col is not None and row[name_col]
                               else f"Tournament {row_idx}")
                    location: str = (str(row[location_col]).strip()
                                   if location_col is not None and row[location_col]
                                   else "Unknown")
                    date_value: Any = row[date_col] if date_col is not None else None
                    url: str = (str(row[url_col]).strip()
                              if url_col is not None and row[url_col]
                              else "https://chess-results.com")

                    # Skip empty rows
                    if not name or name == "None":
                        continue

                    # Parse date
                    parsed_date: datetime = self._parse_date(date_value)

                    # Filter: only tournaments starting tomorrow or later (not today or past)
                    if parsed_date < tomorrow:
                        continue  # Skip tournaments that already started or start today

                    # Extract category
                    category: str = self._extract_category(name + " " + location)

                    # Filter: only European tournaments
                    if not self._is_european(location):
                        continue

                    # Build tournament dict
                    tournament: Dict[str, Any] = {
                        'name': name,
                        'location': location,
                        'date': parsed_date.strftime('%Y-%m-%d'),  # Convert to string for JSON
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
    def export_to_json(self, tournaments: List[Dict[str, Any]], output_file: str) -> None:
        """Export tournaments to JSON file.

        Validates tournament data structure and exports to JSON file with
        UTF-8 encoding and proper formatting.

        Args:
            tournaments: List of tournament dictionaries. Each dictionary must
                contain keys: name, location, date, category, url.
            output_file: Path to output JSON file.

        Raises:
            ValueError: If tournaments is not a list or tournaments are missing
                required fields.
            IOError: If file cannot be written.
            OSError: If file path is invalid.

        Example:
            >>> processor = TournamentProcessor()
            >>> tournaments = [{'name': 'Test', 'location': 'ESP', ...}]
            >>> processor.export_to_json(tournaments, 'output.json')
            Exported 1 tournaments to output.json
        """
        try:
            # Validate tournament data structure
            if not isinstance(tournaments, list):
                raise ValueError(f"Expected list of tournaments, got {type(tournaments)}")

            # Validate each tournament has required fields
            required_fields: Set[str] = {'name', 'location', 'date', 'category', 'url'}
            valid_tournaments: List[Dict[str, Any]] = []

            for idx, tournament in enumerate(tournaments):
                if not isinstance(tournament, dict):
                    print(f"Warning: Tournament at index {idx} is not a dict, skipping")
                    continue

                missing_fields: Set[str] = required_fields - set(tournament.keys())
                if missing_fields:
                    print(f"Warning: Tournament at index {idx} missing fields {missing_fields}, skipping")
                    continue

                valid_tournaments.append(tournament)

            skipped_count: int = len(tournaments) - len(valid_tournaments)
            print(f"Validated {len(valid_tournaments)} tournaments (skipped {skipped_count})")

            # Export validated tournaments
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(valid_tournaments, f, indent=2, ensure_ascii=False)
            print(f"Exported {len(valid_tournaments)} tournaments to {output_file}")
        except (IOError, OSError) as e:
            print(f"Error writing to file {output_file}: {e}")
            raise
        except ValueError as e:
            print(f"Validation error: {e}")
            raise
        except Exception as e:
            print(f"Unexpected error exporting to JSON: {e}")
            raise

    @keyword("Filter Tournaments By Criteria")
    def filter_tournaments_by_criteria(
        self,
        tournaments: List[Dict[str, Any]],
        open_only: bool = True,
        exclude_youth: bool = True,
        mediterranean_only: bool = False,
        senior_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Filter tournaments by various criteria.

        Applies multiple filters to tournament list including category filters
        (Open, Youth, Senior) and location filter (Mediterranean).

        Args:
            tournaments: List of tournament dictionaries to filter.
            open_only: If True, only include Open category tournaments.
                Default is True.
            exclude_youth: If True, exclude youth-only tournaments (tournaments
                with Youth category but not Open). Default is True.
            mediterranean_only: If True, only include Mediterranean seaside
                locations. Default is False.
            senior_only: If True, only include S50+ tournaments. Default is False.

        Returns:
            Filtered list of tournaments matching all specified criteria.

        Example:
            >>> processor = TournamentProcessor()
            >>> filtered = processor.filter_tournaments_by_criteria(
            ...     tournaments,
            ...     open_only=True,
            ...     mediterranean_only=True
            ... )
            Filtered to 15 tournaments
        """
        filtered: List[Dict[str, Any]] = []

        for tournament in tournaments:
            category_lower: str = tournament['category'].lower()
            location_lower: str = tournament['location'].lower()

            # Open filter
            if open_only and 'open' not in category_lower:
                continue

            # Youth filter
            if exclude_youth and 'youth' in category_lower and 'open' not in category_lower:
                continue

            # Mediterranean filter
            if mediterranean_only:
                if not any(place in location_lower for place in self.mediterranean_locations):
                    continue

            # Senior filter
            if senior_only and 's50' not in category_lower and 'senior' not in category_lower:
                continue

            filtered.append(tournament)

        print(f"Filtered to {len(filtered)} tournaments")
        return filtered

    def _find_column(self, headers: List[str], possible_names: List[str]) -> Optional[int]:
        """Find column index by matching possible header names.

        Searches for column index where header contains any of the possible names.
        Search is case-sensitive as headers are pre-lowercased.

        Args:
            headers: List of column header names (lowercase).
            possible_names: List of possible names to search for in headers.

        Returns:
            Index of first matching column, or None if not found.

        Example:
            >>> headers = ['name', 'location', 'date']
            >>> processor._find_column(headers, ['name', 'tournament'])
            0
        """
        for idx, header in enumerate(headers):
            for name in possible_names:
                if name in header:
                    return idx
        return None

    def _parse_date(self, date_value: Union[str, datetime, int, None]) -> datetime:
        """Parse date from various formats and return datetime object.

        Supports multiple date formats:
        - YYYYMMDD (20251128)
        - DD.MM.YYYY (28.11.2025)
        - YYYY-MM-DD (2025-11-28)
        - DD/MM/YYYY (28/11/2025)
        - datetime objects (passthrough)

        Args:
            date_value: Date in any supported format, or None.

        Returns:
            Parsed datetime object. Returns current datetime if parsing fails
            or date_value is None.

        Example:
            >>> processor._parse_date('20251128')
            datetime(2025, 11, 28, 0, 0)
            >>> processor._parse_date('28.11.2025')
            datetime(2025, 11, 28, 0, 0)
        """
        if date_value is None:
            return datetime.now()

        # If already a datetime object
        if isinstance(date_value, datetime):
            return date_value

        # Try to parse string
        date_str: str = str(date_value).strip()

        # Try YYYYMMDD format (chess-results.com format: 20251128)
        match = self.REGEX_PATTERNS['date_yyyymmdd'].search(date_str)
        if match:
            try:
                year: int = int(date_str[0:4])
                month: int = int(date_str[4:6])
                day: int = int(date_str[6:8])
                return datetime(year, month, day)
            except (ValueError, IndexError) as e:
                print(f"Failed to parse YYYYMMDD date '{date_str}': {e}")

        # Try DD.MM.YYYY format
        match = self.REGEX_PATTERNS['date_ddmmyyyy_dot'].search(date_str)
        if match:
            try:
                return datetime(int(match[3]), int(match[2]), int(match[1]))
            except (ValueError, IndexError) as e:
                print(f"Failed to parse DD.MM.YYYY date '{date_str}': {e}")

        # Try YYYY-MM-DD format
        match = self.REGEX_PATTERNS['date_yyyymmdd_dash'].search(date_str)
        if match:
            try:
                return datetime(int(match[1]), int(match[2]), int(match[3]))
            except (ValueError, IndexError) as e:
                print(f"Failed to parse YYYY-MM-DD date '{date_str}': {e}")

        # Try DD/MM/YYYY format
        match = self.REGEX_PATTERNS['date_ddmmyyyy_slash'].search(date_str)
        if match:
            try:
                return datetime(int(match[3]), int(match[2]), int(match[1]))
            except (ValueError, IndexError) as e:
                print(f"Failed to parse DD/MM/YYYY date '{date_str}': {e}")

        # Default to today if no pattern matched
        print(f"Warning: Could not parse date '{date_str}', defaulting to today")
        return datetime.now()

    def _extract_category(self, text: str) -> str:
        """Extract tournament category from text using precompiled patterns.

        Identifies tournament type (Open, S50+, Youth, Women) and time control
        (Blitz, Rapid, Classical) from tournament name and location text.

        Args:
            text: Tournament name and location text to analyze.

        Returns:
            Comma-separated string of detected categories. Returns 'Open, Classical'
            if no categories detected.

        Example:
            >>> processor._extract_category('Barcelona Open S50+ Rapid')
            'Open, S50+, Rapid'
            >>> processor._extract_category('Generic Tournament')
            'Open, Classical'
        """
        categories: List[str] = []

        # Tournament type - use precompiled patterns
        if self.REGEX_PATTERNS['open'].search(text):
            categories.append('Open')
        if self.REGEX_PATTERNS['s50'].search(text):
            categories.append('S50+')
        if self.REGEX_PATTERNS['youth'].search(text):
            categories.append('Youth')
        if self.REGEX_PATTERNS['women'].search(text):
            categories.append('Women')

        # Time control (important for filtering) - use precompiled patterns
        if self.REGEX_PATTERNS['blitz'].search(text):
            categories.append('Blitz')
        elif self.REGEX_PATTERNS['rapid'].search(text):
            categories.append('Rapid')
        elif self.REGEX_PATTERNS['classical'].search(text):
            categories.append('Classical')
        # If no time control specified, assume Classical
        elif not any(pattern.search(text) for pattern in [
            self.REGEX_PATTERNS['blitz'],
            self.REGEX_PATTERNS['rapid'],
            self.REGEX_PATTERNS['classical']
        ]):
            categories.append('Classical')

        return ', '.join(categories) if categories else 'Open, Classical'

    def _is_european(self, location: str) -> bool:
        """Check if location is in Europe, excluding Russia.

        First checks if location matches non-European countries (including Russia),
        then checks if it matches European countries.

        Args:
            location: Location string to check (city, country code, or country name).

        Returns:
            True if location is in Europe (excluding Russia), False otherwise.

        Example:
            >>> processor._is_european('Barcelona, ESP')
            True
            >>> processor._is_european('Moscow, Russia')
            False
            >>> processor._is_european('Dubai, UAE')
            False
        """
        location_lower: str = location.lower()

        # First check if it's explicitly non-European
        if any(country in location_lower for country in self.non_european_countries):
            return False

        # Then check if it matches European countries
        return any(country in location_lower for country in self.european_countries)
