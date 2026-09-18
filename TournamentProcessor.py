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
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, ClassVar, Dict, List, Optional, Pattern, Set, Tuple, Union

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
    REGEX_PATTERNS: ClassVar[Dict[str, Pattern[str]]] = {
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
        "blitz": re.compile(r"\bblitz\b", re.IGNORECASE),
        "rapid": re.compile(r"\brapid\b", re.IGNORECASE),
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
        self.tournaments: List[Dict[str, Any]] = []
        self.european_countries: Set[str] = set()
        self.non_european_countries: Set[str] = set()
        self.mediterranean_locations: Set[str] = set()
        # Stats from the most recent load_and_filter_tournaments() run, used to
        # emit a metadata sidecar file for data-freshness/observability.
        self.last_run_stats: Dict[str, int] = {
            "rawRows": 0,
            "keptRows": 0,
            "excludedPast": 0,
            "excludedNonEuropean": 0,
            "excludedInvalid": 0,
        }
        # Multi-federation accumulator — populated by Accumulate Fed Tournaments,
        # finalised by Finalize Accumulated.
        self._accumulated: List[Dict[str, Any]] = []
        self._seen_urls: Set[str] = set()
        self._accum_stats: Dict[str, int] = {
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
                config: Dict[str, List[str]] = json.load(f)

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

    def _load_default_config(self) -> None:
        """Load fallback configuration if config.json is missing or invalid.

        Provides hardcoded sets of European countries, non-European countries,
        and Mediterranean locations as a fallback.
        """
        self.european_countries = {
            "albania", "andorra", "austria", "belarus", "belgium", "bosnia",
            "bulgaria", "croatia", "cyprus", "czech", "denmark", "estonia",
            "faroe islands", "finland", "france", "germany", "greece", "guernsey",
            "hungary", "iceland", "ireland", "isle of man", "italy", "jersey",
            "kosovo", "latvia", "liechtenstein", "lithuania",
            "luxembourg", "malta", "moldova", "monaco", "montenegro", "netherlands",
            "north macedonia", "norway", "poland", "portugal", "romania",
            "san marino", "serbia", "slovakia", "slovenia", "spain", "sweden",
            "switzerland", "turkey", "ukraine", "united kingdom", "england",
            "scotland", "wales", "northern ireland",
            "gbr", "ger", "fra", "esp", "ita", "ned",
            "aut", "cze", "hun", "pol", "cro", "gre", "srb", "rou", "ukr",
            "svk", "slo", "den", "nor", "swe", "fin", "bel", "sui", "por",
            "mne", "alb", "bih", "mlt", "cyp", "bul", "mkd", "kos",
            "eng", "sco", "wls", "irl", "isl", "ltu", "lva", "lat", "est",
            "arm", "geo", "aze", "mon", "mnc", "and", "lux", "lie", "fid",
            "gib", "gibraltar", "mda", "smr", "fai", "gci", "iom", "jci", "tur",
        }
        self.non_european_countries = {
            "russia", "moscow", "petersburg", "malaysia", "uae", "dubai", "qatar",
            "saudi", "china", "india", "indonesia", "singapore", "thailand",
            "vietnam", "philippines", "japan", "korea", "australia", "new zealand",
            "usa", "canada", "mexico", "brazil", "argentina", "chile", "peru",
            "colombia", "egypt", "morocco", "tunisia", "algeria", "south africa",
            "israel", "jordan", "lebanon", "iran", "iraq", "kazakhstan",
            "uzbekistan", "uruguay", "costa rica", "venezuela",
            "rus", "mas",
            "ind", "uzb", "kaz", "isr", "jpn", "chn", "can", "mex",
            "bra", "arg", "aus", "nzl", "sgp", "tha", "vnm", "phl",
            "kor", "egy", "mar", "tun", "dza", "zaf", "jor", "lbn",
            "irn", "irq", "qat", "are", "sau",
            "uru", "crc", "ven", "bol", "par", "ecu", "col", "chi",
            "jam", "cub", "pur", "dom", "gua", "hnd", "pan", "slv",
            "pak", "ban", "sri", "nep", "afg", "tpe", "hkg", "mgl",
        }
        self.mediterranean_locations = {
            "barcelona", "valencia", "alicante", "malaga", "marbella",
            "nice", "cannes", "monaco", "marseille", "montpellier",
            "genoa", "genova", "naples", "napoli", "sicily", "sicilia", "rome", "roma",
            "athens", "thessaloniki", "patras", "heraklion", "chania",
            "rhodes", "corfu", "crete", "kavala", "volos", "kalamata",
            "split", "dubrovnik", "rijeka", "zadar", "sibenik", "pula",
            "kotor", "budva", "tivat", "bar", "herceg novi", "ulcinj",
            "durres", "vlore", "saranda",
            "trieste", "venezia", "venice", "taranto", "lecce",
            "koper", "piran", "izola", "portoroz", "lucija",
            "malta", "valletta", "sliema", "limassol", "larnaca",
            "paphos", "cyprus", "neum",
            "sitges", "badalona", "formentera", "gibraltar",
            "bastia", "corsica", "agde", "sanremo",
            "porto san giorgio", "cattolica", "palau", "opatija",
            "hvar", "hersonissos", "ikaria", "paleochora", "agria",
            "neos marmaras", "petrovac", "monte carlo"
        }

    def _extract_row_data(
        self,
        row: Tuple[Any, ...],
        name_col: Optional[int],
        location_col: Optional[int],
        fed_col: Optional[int],
        date_from_col: Optional[int],
        date_to_col: Optional[int],
        time_control_col: Optional[int],
        db_key_col: Optional[int],
        event_id_col: Optional[int],
        row_idx: int
    ) -> Dict[str, Any]:
        """Extract data from Excel row."""
        return {
            "name": (str(row[name_col]).strip()
                    if name_col is not None and row[name_col]
                    else f"Tournament {row_idx}"),
            "city": (str(row[location_col]).strip()
                    if location_col is not None and row[location_col]
                    else ""),
            "fed": (str(row[fed_col]).strip().upper()
                   if fed_col is not None and row[fed_col]
                   else ""),
            "date_value": row[date_from_col] if date_from_col is not None else None,
            "date_to_value": row[date_to_col] if date_to_col is not None else None,
            "time_control": (str(row[time_control_col]).strip()
                           if time_control_col is not None and row[time_control_col]
                           else ""),
            "db_key": row[db_key_col] if db_key_col is not None else None,
            "event_id": row[event_id_col] if event_id_col is not None else None,
        }

    def _process_location(self, city: str, fed: str) -> str:
        """Process city and federation into location string."""
        # Clean up city name (remove country name if already in city field)
        if city and "," in city:
            city = city.split(",", 1)[0].strip()

        # Combine into "City, COUNTRY" format
        if city and fed:
            return f"{city}, {fed}"
        if fed:
            return fed
        if city:
            return city
        return "Unknown"

    def _total_to_class(self, total: int) -> str:
        """Map a total-minutes value to Blitz / Rapid / Classical."""
        if total <= self._BLITZ_MAX_MINUTES:
            return "Blitz"
        if total < self._RAPID_MAX_MINUTES:
            return "Rapid"
        return "Classical"

    def _classify_by_fide_formula(self, tc_lower: str) -> Optional[str]:
        """Classify time control using the official FIDE 60-move formula.

        FIDE formula: total = base_minutes + increment_seconds
        (60 moves x inc_sec / 60 sec = inc_sec minutes contribution)
        Blitz: <= 10 min; Rapid: 10 < total < 60; Classical: >= 60.
        """
        # N+M bare format: "8+3", "90+30", "10+5'" etc.
        m = re.search(r"(\d+)\s*\+\s*(\d+)", tc_lower)
        if m:
            return self._total_to_class(int(m.group(1)) + int(m.group(2)))

        # "N unit [+ M sec-unit]" format: "10min plus 3sec", "90 minutes + 30 seconds"
        m = re.search(r"(\d+)\s*(h(?:our)?s?|min(?:ute)?s?|')", tc_lower)
        if m:
            val = int(m.group(1))
            base = val * 60 if m.group(2).startswith("h") else val
            # Look for increment in seconds (handles "+" or "plus" as separator)
            m2 = re.search(r"(?:\+|plus)\s*(\d+)\s*s(?:ec|ek|eg|ekunde|econds?|ekundy)?", tc_lower)
            inc = int(m2.group(1)) if m2 else 0
            return self._total_to_class(base + inc)

        return None

    def _determine_category(self, name: str, location: str, time_control: str) -> str:
        """Determine tournament category from time control and name."""
        time_classes = {"Classical", "Rapid", "Blitz"}
        category_parts: List[str] = []
        tc_class: Optional[str] = None

        if time_control:
            tc_lower = time_control.lower()
            # Keyword shortcuts
            if "blitz" in tc_lower:
                tc_class = "Blitz"
            elif "rapid" in tc_lower:
                tc_class = "Rapid"
            elif "classical" in tc_lower or "standard" in tc_lower:
                tc_class = "Classical"
            else:
                # FIDE 60-move formula: total = base_minutes + increment_seconds
                # Blitz: total <= 10 min; Rapid: 10 < total < 60; Classical: >= 60
                tc_class = self._classify_by_fide_formula(tc_lower)

        if tc_class:
            category_parts.append(tc_class)

        # Extract format labels from name; skip time-class labels when tc_class is authoritative
        name_category: str = self._extract_category(name + " " + location)
        for cat in name_category.split(", "):
            if cat in time_classes:
                if tc_class is None and cat not in category_parts:
                    category_parts.append(cat)
            elif cat not in category_parts:
                category_parts.append(cat)

        return ", ".join(category_parts) if category_parts else "Open"

    def _safe_date_to_str(self, date_value: Any) -> str:
        """Parse an end-date cell value to YYYY-MM-DD string; returns '' on any failure."""
        try:
            if date_value:
                return self._parse_date(date_value).strftime("%Y-%m-%d")
        except Exception:
            pass
        return ""

    def _build_tournament_url(self, db_key: Any, event_id: Any) -> str:
        """Build tournament URL from DB-Key or EventID."""
        if db_key and str(db_key).strip() and str(db_key).strip() != "0":
            return f"https://chess-results.com/tnr{db_key}.aspx?lan=1"
        if event_id and str(event_id).strip() and str(event_id).strip() != "0":
            return f"https://chess-results.com/tnr{event_id}.aspx?lan=1"
        return "https://chess-results.com"

    @keyword("Load And Filter Tournaments")
    def load_and_filter_tournaments(self, excel_file: str) -> List[Dict[str, Any]]:
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

        tournaments: List[Dict[str, Any]] = []

        # Reset per-run stats.
        raw_rows = 0
        excluded_past = 0
        excluded_non_european = 0
        excluded_invalid = 0

        # Calculate tomorrow once (not in loop) - PERFORMANCE FIX
        tomorrow: datetime = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

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

                # Parse end date (best-effort, non-blocking)
                date_to_str = self._safe_date_to_str(row_data["date_to_value"])

                # Build tournament dict
                tournament: Dict[str, Any] = {
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
    def export_metadata(self, output_file: str) -> Dict[str, Any]:
        """Write a metadata sidecar describing the most recent scrape run.

        Captures provenance and filtering stats so consumers can reason about
        data freshness and coverage. Call after load_and_filter_tournaments().

        Args:
            output_file: Path to the metadata JSON file to write
                (e.g. tournaments_data_meta.json).

        Returns:
            The metadata dictionary that was written.
        """
        metadata: Dict[str, Any] = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
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
    def finalize_accumulated(self) -> List[Dict[str, Any]]:
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
        required_fields: Set[str] = {"name", "location", "date", "category", "url"}
        valid_tournaments: List[Dict[str, Any]] = []

        for _idx, tournament in enumerate(tournaments):
            if not isinstance(tournament, dict):
                continue

            missing_fields: Set[str] = required_fields - set(tournament.keys())
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
        tournaments: List[Dict[str, Any]],
        open_only: bool = True,
        exclude_youth: bool = True,
        mediterranean_only: bool = False,
        senior_only: bool = False
    ) -> List[Dict[str, Any]]:
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
        filtered: List[Dict[str, Any]] = []

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

    def _is_youth_or_school_tournament(self, full_text: str) -> bool:
        """Check if tournament is for youth/school/juniors.

        IMPROVED: More comprehensive detection of youth and school tournaments.

        Args:
            full_text: Combined tournament name and category in lowercase.

        Returns:
            True if tournament is for youth/school/juniors, False otherwise.
        """
        # Youth keywords (international) - expanded
        youth_pattern = re.compile(
            r"\bu\d+|u-\d+|youth|junior|junioren|u18|u16|u14|u12|u10|u8|under|"
            r"żiak|młodzie[żz]|juniorzy|juniorów|ml[áa]de[žz]|ifjúság|jugend|"
            r"jeune|juvenil|joven|giovani|giovanile",
            re.IGNORECASE
        )

        # School keywords (international)
        school_pattern = re.compile(
            r"\bschool|schule|école|escuela|scuola|szkoł|škol",
            re.IGNORECASE
        )

        # Age restriction patterns (under/u/bis + number less than 50)
        age_pattern = re.compile(r"\b(under|u|bis)\s*(\d{1,2})\b", re.IGNORECASE)

        # Check for youth/school indicators
        if youth_pattern.search(full_text):
            return True
        if school_pattern.search(full_text):
            return True

        # Check age restrictions
        age_match = age_pattern.search(full_text)
        if age_match:
            try:
                age = int(age_match.group(2))
                if age < self.MINIMUM_SENIOR_AGE:
                    return True
            except ValueError:
                pass

        return False

    def _is_team_tournament(self, full_text: str) -> bool:
        """Check if tournament is a team tournament.

        Team tournaments are not suitable for individual vacation planning.

        Args:
            full_text: Combined tournament name and category in lowercase.

        Returns:
            True if tournament is a team tournament, False otherwise.
        """
        # Team keywords (international)
        team_pattern = re.compile(
            r"\bteam|mannschaft|équipe|equipo|squadra|drużyn|družstv",
            re.IGNORECASE
        )

        return bool(team_pattern.search(full_text))

    def _has_senior_category(self, category: str, name: str) -> bool:
        """Check if tournament has senior (50+) category.

        IMPROVED: More comprehensive senior/veteran detection.

        Args:
            category: Tournament category in lowercase.
            name: Tournament name in lowercase.

        Returns:
            True if tournament has senior category, False otherwise.
        """
        # Senior/veteran keywords (expanded)
        senior_pattern = re.compile(
            r"\bs50\+|s\s*50\+|s50|senior|senioren|veteran|veteranen|"
            r"vétéran|veterano|weteran|50\+|50\s*\+|over\s*50|o50",
            re.IGNORECASE
        )

        return bool(senior_pattern.search(category) or senior_pattern.search(name))

    def _detect_header_row(
        self, sheet: Worksheet, max_scan_rows: int = 15
    ) -> Tuple[int, List[str]]:
        """Locate the header row in a chess-results.com export.

        The export usually keeps headers in row 4, but the leading metadata rows
        change occasionally. Scans the first ``max_scan_rows`` rows and returns the
        first one that looks like a header (contains a tournament/name column and a
        date column). Falls back to row 4 if nothing matches so existing behaviour
        is preserved.

        Args:
            sheet: The active worksheet to scan.
            max_scan_rows: Maximum number of leading rows to inspect.

        Returns:
            A ``(row_number, headers)`` tuple where ``row_number`` is 1-based and
            ``headers`` is the lower-cased cell values for that row.
        """
        fallback_row = 4
        fallback_headers: List[str] = []

        for row_idx in range(1, max_scan_rows + 1):
            headers = [
                str(cell.value).strip().lower() if cell.value is not None else ""
                for cell in sheet[row_idx]
            ]
            if row_idx == fallback_row:
                fallback_headers = headers

            name_idx = self._find_column(headers, ["tournament", "name", "turnier"])
            date_idx = self._find_column(headers, ["from", "start", "datum"])
            _MAX_HEADER_LEN = 35  # noqa: N806
            if (
                name_idx is not None
                and date_idx is not None
                # Reject rows where matching cells are long sentences rather than short
                # column labels (e.g. the URL preamble row from chess-results.com starts
                # with "from the tournament-database of chess-results …" which contains
                # both "tournament" and "from" but is clearly not a header).
                and len(headers[name_idx]) <= _MAX_HEADER_LEN
                and len(headers[date_idx]) <= _MAX_HEADER_LEN
            ):
                return row_idx, headers

        # Nothing matched - return the historical default so _find_columns can run
        # and the explicit missing-column check can produce a clear error.
        if not fallback_headers:
            fallback_headers = [
                str(cell.value).strip().lower() if cell.value is not None else ""
                for cell in sheet[fallback_row]
            ]
        return fallback_row, fallback_headers

    def _find_columns(
        self, headers: List[str]
    ) -> Tuple[Optional[int], Optional[int], Optional[int], Optional[int],
               Optional[int], Optional[int], Optional[int], Optional[int]]:
        """Resolve the chess-results.com column indices used during parsing.

        Returns:
            (name, location, date_from, date_to, fed, time_control, db_key, event_id)
            column indices, each None if the column was not found.
        """
        return (
            self._find_column(headers, ["tournament", "name", "turnier"]),
            self._find_column(headers, ["location", "place", "ort"]),
            self._find_column(headers, ["from", "start", "datum"]),
            self._find_column(headers, ["to", "end", "bis"]),
            self._find_column(headers, ["fed", "federation", "country"]),
            self._find_column(headers, ["time control", "timecontrol"]),
            self._find_column(headers, ["db-key", "dbkey", "key"]),
            self._find_column(headers, ["eventid", "event id"]),
        )

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
            return datetime.now(timezone.utc)

        # If already a datetime object
        if isinstance(date_value, datetime):
            # Ensure datetime is timezone-aware
            return date_value if date_value.tzinfo else date_value.replace(tzinfo=timezone.utc)

        # Try to parse string
        date_str: str = str(date_value).strip()

        # Define date format parsers
        parsers: List[Tuple[str, Callable[[Any, str], datetime]]] = [
            # YYYYMMDD format (chess-results.com format: 20251128)
            ("date_yyyymmdd", lambda _m, s: datetime(
                int(s[0:4]), int(s[4:6]), int(s[6:8]), tzinfo=timezone.utc
            )),
            # DD.MM.YYYY format
            ("date_ddmmyyyy_dot", lambda m, _s: datetime(
                int(m[3]), int(m[2]), int(m[1]), tzinfo=timezone.utc
            )),
            # YYYY-MM-DD format
            ("date_yyyymmdd_dash", lambda m, _s: datetime(
                int(m[1]), int(m[2]), int(m[3]), tzinfo=timezone.utc
            )),
            # DD/MM/YYYY format
            ("date_ddmmyyyy_slash", lambda m, _s: datetime(
                int(m[3]), int(m[2]), int(m[1]), tzinfo=timezone.utc
            )),
        ]

        # Try each parser
        for pattern_name, parser in parsers:
            match = self.REGEX_PATTERNS[pattern_name].search(date_str)
            if match:
                try:
                    return parser(match, date_str)
                except (ValueError, IndexError):
                    continue

        # Default to today if no pattern matched
        return datetime.now(timezone.utc)

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
        if self.REGEX_PATTERNS["open"].search(text):
            categories.append("Open")
        if self.REGEX_PATTERNS["s50"].search(text):
            categories.append("S50+")
        if self.REGEX_PATTERNS["youth"].search(text):
            categories.append("Youth")
        if self.REGEX_PATTERNS["women"].search(text):
            categories.append("Women")

        # Time control (important for filtering) - use precompiled patterns
        if self.REGEX_PATTERNS["blitz"].search(text):
            categories.append("Blitz")
        elif self.REGEX_PATTERNS["rapid"].search(text):
            categories.append("Rapid")
        elif self.REGEX_PATTERNS["classical"].search(text) or not any(pattern.search(text) for pattern in [
            self.REGEX_PATTERNS["blitz"],
            self.REGEX_PATTERNS["rapid"],
            self.REGEX_PATTERNS["classical"]
        ]):
            categories.append("Classical")

        return ", ".join(categories) if categories else "Open, Classical"

    def _is_european(self, location: str) -> bool:
        """Check if location is in Europe, excluding Russia.

        Extracts the FED code from "City, FED" format and uses exact matching to
        avoid substring false positives (e.g. "Deportivo" containing "por" which is
        Portugal's FIDE code, or "Especiales" containing "esp" = Spain's code).

        Args:
            location: Location string to check ("City, COUNTRYCODE" or just
                "COUNTRYCODE").

        Returns:
            True if location is in Europe (excluding Russia), False otherwise.

        Example:
            >>> processor._is_european('Barcelona, ESP')
            True
            >>> processor._is_european('Moscow, Russia')
            False
            >>> processor._is_european('Club Deportivo Artigas, URU')
            False
            >>> processor._is_european('Gimnasio de Olimpiadas Especiales, CRC')
            False
        """
        location_lower: str = location.lower()

        # Extract the FED code from "City, COUNTRYCODE" format.
        # When a comma is present, use exact matching on the country code only
        # to avoid substring false positives from city names (e.g. "Deportivo"
        # contains "por" = Portugal's code).
        parts = location_lower.rsplit(",", 1)
        if len(parts) > 1:
            fed_code = parts[-1].strip()
            if fed_code in self.non_european_countries:
                return False
            return fed_code in self.european_countries

        # No comma — just a country code or full country name; substring is OK.
        if any(country in location_lower for country in self.non_european_countries):
            return False
        return any(country in location_lower for country in self.european_countries)
