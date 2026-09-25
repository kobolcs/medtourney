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
import logging
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar

import openpyxl
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from robot.api.deco import keyword

from tournament_processing.classify import ClassifyMixin
from tournament_processing.config import ConfigMixin
from tournament_processing.excel import ExcelMixin
from tournament_processing.time_control import TimeControlMixin


class TournamentProcessor(ExcelMixin, TimeControlMixin, ClassifyMixin, ConfigMixin):
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
    REGEX_PATTERNS: ClassVar[dict[str, re.Pattern[str]]] = {
        "date_yyyymmdd": re.compile(r"^(\d{8})$"),
        "date_ddmmyyyy_dot": re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})"),
        "date_yyyymmdd_dash": re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})"),
        "date_ddmmyyyy_slash": re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})"),
        "open": re.compile(r"\bopen\b", re.IGNORECASE),
        "s50": re.compile(r"\bs50\+|s50|senior|veteran|50\+", re.IGNORECASE),
        # International youth keywords: English, Polish, Czech, Slovak, Hungarian, German, French, Spanish, Italian
        "youth": re.compile(
            r"\bu\d+|youth|junior|u18|under|"  # English
            r"żiak|młodzie[żz]|juniorzy|juniorów|"  # Polish (żiak, młodzież, juniorzy, juniorów)
            r"ml[áa]de[žz]|"  # Czech/Slovak (mládež)
            r"ifjúság|junior|"  # Hungarian
            r"jugend|"  # German
            r"jeune|junior|"  # French
            r"juvenil|joven|"  # Spanish
            r"giovani|giovanile",  # Italian
            re.IGNORECASE
        ),
        "women": re.compile(r"\bwomen|ladies|female", re.IGNORECASE),
        # No trailing \b: real tournament names compound these in ways that
        # never end the word right there - German "Blitzschach"/
        # "Blitzturnier", English "RapidPlay"/"Rapidplay", and even the
        # plain French word "rapide" (still means "rapid", just spelled with
        # a trailing e). \brapid\b/\bblitz\b missed 67 real tournaments
        # across those languages, all defaulting to "Classical" instead.
        "blitz": re.compile(r"\bblitz", re.IGNORECASE),
        "rapid": re.compile(r"\brapid", re.IGNORECASE),
        "classical": re.compile(r"\bclassic|classical|standard\b", re.IGNORECASE),
    }

    ROBOT_LIBRARY_SCOPE: ClassVar[str] = "GLOBAL"
    MINIMUM_SENIOR_AGE: ClassVar[int] = 50  # Minimum age for senior tournaments

    # Number of months ahead the scraper searches (kept in sync with
    # scrape_tournaments.robot ${DATE_RANGE_MONTHS}).
    RANGE_MONTHS: ClassVar[int] = 6

    # FIDE 60-move formula thresholds (minutes)
    _BLITZ_MAX_MINUTES: ClassVar[int] = 10
    _RAPID_MAX_MINUTES: ClassVar[int] = 60

    def __init__(self) -> None:
        """Initialize the TournamentProcessor with empty tournament list."""
        self.logger = logging.getLogger(__name__)
        self.tournaments: list[dict[str, Any]] = []
        self.european_countries: set[str] = set()
        self.non_european_countries: set[str] = set()
        self.mediterranean_locations: set[str] = set()
        # Stats from the most recent load_and_filter_tournaments() run, used to
        # emit a metadata sidecar file for data-freshness/observability.
        self.last_run_stats: dict[str, int] = {
            "rawRows": 0,
            "keptRows": 0,
            "excludedPast": 0,
            "excludedNonEuropean": 0,
            "excludedInvalid": 0,
        }
        # Multi-federation accumulator — populated by Accumulate Fed Tournaments,
        # finalised by Finalize Accumulated.
        self._accumulated: list[dict[str, Any]] = []
        self._seen_urls: set[str] = set()
        self._accum_stats: dict[str, int] = {
            "rawRows": 0,
            "keptRows": 0,
            "excludedPast": 0,
            "excludedNonEuropean": 0,
            "excludedInvalid": 0,
        }
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
        config_path: Path = Path(__file__).parent / "config.json"
        try:
            with config_path.open(encoding="utf-8") as f:
                config: dict[str, list[str]] = json.load(f)

            # Convert lists to sets for O(1) lookup performance
            self.european_countries = set(config["europeanCountries"])
            self.non_european_countries = set(config["nonEuropeanCountries"])
            self.mediterranean_locations = set(config["mediterraneanLocations"])

        except FileNotFoundError:
            self._load_default_config()
        except json.JSONDecodeError:
            self._load_default_config()
        except KeyError:
            self._load_default_config()

    @keyword("Load And Filter Tournaments")
    def load_and_filter_tournaments(self, excel_file: str) -> list[dict[str, Any]]:
        """Load tournaments from Excel file and filter for European tournaments.

        Loads tournament data from an Excel file downloaded from chess-results.com,
        filters for European tournaments only (excluding Russia), and returns only
        tournaments starting tomorrow or later.

        Chess-results.com Excel format:
            - Rows 1-3: Metadata/header info
            - Row 4: Column headers (Tournament, from, to, Location, FED, teams, etc.)
            - Row 5+: Tournament data

        Args:
            excel_file: Path to the Excel file downloaded from chess-results.com.

        Returns:
            List of tournament dictionaries, each containing:
                - name (str): Tournament name
                - location (str): Tournament location (City, COUNTRY_CODE format)
                - date (str): Tournament start date in YYYY-MM-DD format
                - category (str): Tournament category (e.g., "Open, Blitz")
                - url (str): Tournament URL constructed from DB-Key
                - description (str): Tournament description (same as name)

        Raises:
            Exception: If Excel file cannot be loaded or parsed.

        Example:
            >>> processor = TournamentProcessor()
            >>> tournaments = processor.load_and_filter_tournaments('data.xlsx')
            >>> print(f"Found {len(tournaments)} tournaments")
            Found 42 tournaments
        """
        # Load Excel file
        workbook: Workbook = openpyxl.load_workbook(excel_file, data_only=True)
        sheet: Worksheet = workbook.active

        # Chess-results.com normally puts column headers in row 4 (rows 1-3 are
        # metadata), but the exact row drifts when the site tweaks its export.
        # Auto-detect the header row so a layout change does not silently produce
        # zero results.
        header_row, headers = self._detect_header_row(sheet)

        # Find column indices (chess-results.com column names)
        (name_col, location_col, date_from_col, date_to_col, fed_col,
         time_control_col, db_key_col, event_id_col) = self._find_columns(headers)

        # Essential columns must be present, otherwise every row would be dropped
        # and we would export an empty file with no indication of why. Fail loudly
        # so the workflow surfaces the problem instead of committing empty data.
        if name_col is None or date_from_col is None or (location_col is None and fed_col is None):
            msg = (
                "Could not locate the expected columns in the chess-results.com "
                f"export (detected header row {header_row}: {headers}). "
                "The site's Excel format may have changed."
            )
            raise ValueError(msg)

        # Data starts on the row after the headers.
        data_start_row = header_row + 1

        tournaments: list[dict[str, Any]] = []

        # Reset per-run stats.
        raw_rows = 0
        excluded_past = 0
        excluded_non_european = 0
        excluded_invalid = 0

        # Calculate tomorrow once (not in loop) - PERFORMANCE FIX
        tomorrow: datetime = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

        # Process each row (data starts just after the detected header row)
        for row_idx, row in enumerate(sheet.iter_rows(min_row=data_start_row, values_only=True), start=data_start_row):
            raw_rows += 1
            try:
                # Extract row data
                row_data = self._extract_row_data(
                    row, name_col, location_col, fed_col, date_from_col, date_to_col,
                    time_control_col, db_key_col, event_id_col, row_idx
                )

                name = row_data["name"]
                city = row_data["city"]
                fed = row_data["fed"]

                # Skip empty rows or non-European countries
                if not name or name in {"None", ""}:
                    excluded_invalid += 1
                    continue
                if fed and fed.lower() in self.non_european_countries:
                    excluded_non_european += 1
                    continue

                # Process location
                location = self._process_location(city, fed)

                # Parse and filter date
                parsed_date: datetime = self._parse_date(row_data["date_value"])
                if parsed_date < tomorrow:
                    excluded_past += 1
                    continue

                # Filter: only European tournaments
                if not self._is_european(location):
                    excluded_non_european += 1
                    continue

                # Determine category and build URL
                category = self._determine_category(name, location, row_data["time_control"])
                url = self._build_tournament_url(row_data["db_key"], row_data["event_id"])

                # Parse end date (best-effort, non-blocking). Discard values earlier
                # than the start date - a misidentified column or broken source cell
                # produces a bogus end date, which is worse than publishing none.
                date_to_str = self._safe_date_to_str(row_data["date_to_value"])
                if date_to_str and date_to_str < parsed_date.strftime("%Y-%m-%d"):
                    date_to_str = ""

                # Build tournament dict
                tournament: dict[str, Any] = {
                    "name": name,
                    "location": location,
                    "date": parsed_date.strftime("%Y-%m-%d"),
                    "dateTo": date_to_str,
                    "category": category,
                    "url": url,
                    "description": name,
                    "timeControl": row_data["time_control"] or ""
                }

                tournaments.append(tournament)

            except Exception as e:
                excluded_invalid += 1
                self.logger.debug("Error processing row %d: %s", row_idx, e)
                continue

        workbook.close()

        self.tournaments = tournaments
        self.last_run_stats = {
            "rawRows": raw_rows,
            "keptRows": len(tournaments),
            "excludedPast": excluded_past,
            "excludedNonEuropean": excluded_non_european,
            "excludedInvalid": excluded_invalid,
        }
        return tournaments

    @keyword("Export Metadata")
    def export_metadata(self, output_file: str) -> dict[str, Any]:
        """Write a metadata sidecar describing the most recent scrape run.

        Captures provenance and filtering stats so consumers can reason about
        data freshness and coverage. Call after load_and_filter_tournaments().

        Args:
            output_file: Path to the metadata JSON file to write
                (e.g. tournaments_data_meta.json).

        Returns:
            The metadata dictionary that was written.
        """
        metadata: dict[str, Any] = {
            "generatedAt": datetime.now(UTC).isoformat(),
            "source": "chess-results.com",
            "rangeMonths": self.RANGE_MONTHS,
            "rawRows": self.last_run_stats.get("rawRows", 0),
            "keptRows": self.last_run_stats.get("keptRows", 0),
            "excludedPast": self.last_run_stats.get("excludedPast", 0),
            "excludedNonEuropean": self.last_run_stats.get("excludedNonEuropean", 0),
            "excludedInvalid": self.last_run_stats.get("excludedInvalid", 0),
        }

        output_path = Path(output_file)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        return metadata

    @keyword("Initialize Accumulator")
    def initialize_accumulator(self) -> None:
        """Reset the multi-federation accumulator for a fresh collection run."""
        self._accumulated = []
        self._seen_urls = set()
        self._accum_stats = dict.fromkeys(self._accum_stats, 0)

    @keyword("Accumulate Fed Tournaments")
    def accumulate_fed_tournaments(self, excel_file: str) -> int:
        """Load a per-federation Excel and merge new entries into the pool.

        Calls load_and_filter_tournaments() then deduplicates by URL, keeping
        the first-seen entry when duplicates appear across federations.

        Args:
            excel_file: Path to the per-federation Excel file.

        Returns:
            Number of new (non-duplicate) tournaments added in this call.
        """
        tournaments = self.load_and_filter_tournaments(excel_file)
        new_count = 0
        for t in tournaments:
            url = t["url"]
            if url not in self._seen_urls:
                self._seen_urls.add(url)
                self._accumulated.append(t)
                new_count += 1
        for key in self._accum_stats:
            self._accum_stats[key] += self.last_run_stats.get(key, 0)
        return new_count

    @keyword("Finalize Accumulated")
    def finalize_accumulated(self) -> list[dict[str, Any]]:
        """Return the deduplicated multi-federation tournament list.

        Sets self.tournaments and self.last_run_stats to the aggregated totals
        so Export To JSON and Export Metadata work correctly after a multi-fed run.

        Returns:
            Deduplicated list of all accumulated tournaments.
        """
        result = list(self._accumulated)
        self.tournaments = result
        self.last_run_stats = {
            **self._accum_stats,
            "keptRows": len(result),
        }
        return result

    @keyword("Export To JSON")
    def export_to_json(self, tournaments: Any, output_file: str) -> None:
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
        # Validate tournament data structure
        if not isinstance(tournaments, list):
            msg = f"Expected list of tournaments, got {type(tournaments)}"
            raise TypeError(msg)

        # Validate each tournament has required fields
        required_fields: set[str] = {"name", "location", "date", "category", "url"}
        valid_tournaments: list[dict[str, Any]] = []

        for _idx, tournament in enumerate(tournaments):
            if not isinstance(tournament, dict):
                continue

            missing_fields: set[str] = required_fields - set(tournament.keys())
            if missing_fields:
                continue

            valid_tournaments.append(tournament)

        # Export validated tournaments
        output_path = Path(output_file)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(valid_tournaments, f, indent=2, ensure_ascii=False)

    @keyword("Filter Tournaments By Criteria")
    def filter_tournaments_by_criteria(
        self,
        tournaments: list[dict[str, Any]],
        open_only: bool = True,
        exclude_youth: bool = True,
        mediterranean_only: bool = False,
        senior_only: bool = False
    ) -> list[dict[str, Any]]:
        """Filter tournaments by various criteria.

        Applies multiple filters to tournament list including category filters
        (Open, Youth, Senior) and location filter (Mediterranean).

        IMPROVED v2.1: Stricter filtering for youth, school, and team tournaments.
        Now properly filters for adult/senior individual tournaments suitable for vacation.

        Args:
            tournaments: List of tournament dictionaries to filter.
            open_only: If True, only include Open category tournaments.
                Default is True.
            exclude_youth: If True, exclude youth/school tournaments (ANY tournament
                with youth, school, or age restriction keywords). Default is True.
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
            ...     mediterranean_only=True,
            ...     senior_only=True
            ... )
            Filtered to 15 senior tournaments in Mediterranean
        """
        filtered: list[dict[str, Any]] = []

        for tournament in tournaments:
            category_lower: str = tournament["category"].lower()
            location_lower: str = tournament["location"].lower()
            name_lower: str = tournament["name"].lower()
            full_text: str = f"{name_lower} {category_lower}"

            # Open filter
            if open_only and "open" not in category_lower:
                continue

            # IMPROVED Youth/School filter - STRICT: exclude ANY youth or school tournament
            if exclude_youth and self._is_youth_or_school_tournament(full_text):
                continue

            # ALWAYS exclude team tournaments (not suitable for individual vacation)
            if self._is_team_tournament(full_text):
                continue

            # Mediterranean filter
            if mediterranean_only and not any(place in location_lower for place in self.mediterranean_locations):
                continue

            # Senior filter - use regex pattern for robust matching of all variations
            # (s50+, s50, senior, veteran, 50+, over 50, o50)
            if senior_only:
                if not self._has_senior_category(category_lower, name_lower):
                    continue
                # Double-check: ensure it's not a youth tournament
                if self._is_youth_or_school_tournament(full_text):
                    continue

            filtered.append(tournament)

        return filtered
