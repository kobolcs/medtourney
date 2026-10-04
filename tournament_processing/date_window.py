"""Strict source-date parsing and overlap with the frontend's default window."""

from datetime import UTC, date, datetime, timedelta
from typing import Any

LOOKBACK_DAYS = 7


def parse_source_date(value: Any) -> date:
    """Reject malformed dates rather than replacing them with today's date."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y%m%d", "%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC).date()
        except ValueError:
            continue
    message = f"Invalid tournament date: {value!r}"
    raise ValueError(message)


def publication_dates(start: Any, end: Any, today: date) -> tuple[str, str, bool]:
    """Keep tournaments ending on or after seven days ago; invalid ends are absent."""
    start_date = parse_source_date(start)
    try:
        end_date = parse_source_date(end)
    except ValueError:
        end_date = None
    if end_date is not None and end_date < start_date:
        end_date = None
    effective_end = end_date or start_date
    return (start_date.isoformat(), end_date.isoformat() if end_date else "",
            effective_end >= today - timedelta(days=LOOKBACK_DAYS))
