"""Load source exports and retain European events overlapping the visible window."""

from datetime import UTC, datetime
from typing import Any

import openpyxl
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from robot.api.deco import keyword

from tournament_processing.classify import ClassifyMixin
from tournament_processing.date_window import publication_dates
from tournament_processing.excel import ExcelMixin
from tournament_processing.time_control import TimeControlMixin


class LoadingMixin(ExcelMixin, TimeControlMixin, ClassifyMixin):
    """Publication selection and per-run filtering statistics."""

    last_run_stats: dict[str, int]

    @keyword("Load And Filter Tournaments")
    def load_and_filter_tournaments(self, excel_file: str) -> list[dict[str, Any]]:
        """Load tournaments from Excel file and filter for European tournaments.

        Loads tournament data from an Excel file downloaded from chess-results.com,
        filters for European tournaments only (excluding Russia), and returns only
        recent, ongoing, and future tournaments overlapping the default lookback.

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

        today = datetime.now(UTC).date()

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

                # Validate both dates before testing overlap with the visible window.
                start_str, date_to_str, overlaps = publication_dates(
                    row_data["date_value"], row_data["date_to_value"], today
                )
                if not overlaps:
                    excluded_past += 1
                    continue

                # Filter: only European tournaments
                if not self._is_european(location):
                    excluded_non_european += 1
                    continue

                # Determine category and build URL
                category = self._determine_category(name, location, row_data["time_control"])
                url = self._build_tournament_url(row_data["db_key"], row_data["event_id"])

                # Build tournament dict
                tournament: dict[str, Any] = {
                    "name": name,
                    "location": location,
                    "date": start_str,
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

