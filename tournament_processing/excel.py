"""TournamentProcessor mixin: Reading chess-results.com Excel exports: header row, columns, dates, row cells."""

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from openpyxl.worksheet.worksheet import Worksheet

from tournament_processing.base import ProcessorBase


class ExcelMixin(ProcessorBase):
    """Reading chess-results.com Excel exports: header row, columns, dates, row cells."""

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

    def _safe_date_to_str(self, date_value: Any) -> str:
        """Parse an end-date cell value to YYYY-MM-DD string; returns '' on any failure."""
        try:
            if date_value:
                return self._parse_date(date_value).strftime("%Y-%m-%d")
        except (TypeError, ValueError, AttributeError):
            return ""
        return ""

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
        # Exact matches first: a substring pass alone lets a short candidate like
        # "to" match inside an unrelated header like "tournament" before it ever
        # reaches the real "to" (end date) column.
        for idx, header in enumerate(headers):
            if header in possible_names:
                return idx

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
