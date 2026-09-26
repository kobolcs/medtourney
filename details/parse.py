"""Parse a chess-results.com tournament details page (tnrNNN.aspx?turdet=YES).

The page has a label/value table ("Organizer(s)" | "Double Rook", "Number of
rounds" | "7", ...). Only the facts a player looking for a tournament needs
are kept - who runs it, the format, whether it is FIDE-rated (and its FIDE
page), the venue address, the organizer's homepage. Labels are the page's
English ones (lan=1).
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Any

FIDE_EVENT_URL = "https://ratings.fide.com/tournament_information.phtml?event={}"


class _Rows(HTMLParser):
    """Collect table rows as lists of (text, [hrefs]) cells."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[tuple[str, list[str]]]] = []
        self._row: list[tuple[str, list[str]]] | None = None
        self._text: list[str] | None = None
        self._hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._row = []
        elif tag == "td" and self._row is not None:
            self._text, self._hrefs = [], []
        elif tag == "a" and self._text is not None:
            href = dict(attrs).get("href")
            if href:
                self._hrefs.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._row is not None and self._text is not None:
            self._row.append((re.sub(r"\s+", " ", "".join(self._text)).strip(), self._hrefs))
            self._text = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._text is not None:
            self._text.append(data)


def _table(html: str) -> dict[str, tuple[str, list[str]]]:
    """{label: (value text, value hrefs)} for every two-cell row."""
    parser = _Rows()
    parser.feed(html)
    table: dict[str, tuple[str, list[str]]] = {}
    for row in parser.rows:
        if len(row) == 2 and row[0][0]:  # noqa: PLR2004 - label + value
            table.setdefault(row[0][0], row[1])
    return table


def _value(table: dict[str, tuple[str, list[str]]], *prefixes: str) -> tuple[str, list[str]] | None:
    for label, value in table.items():
        if any(label.startswith(prefix) for prefix in prefixes):
            return value
    return None


def parse_details(html: str) -> dict[str, Any]:
    """The kept facts; keys are left out when the page doesn't have them."""
    table = _table(html)
    out: dict[str, Any] = {}

    organizer = _value(table, "Organizer")
    if organizer and organizer[0] not in ("", "-"):
        out["organizer"] = organizer[0][:120]

    rounds = _value(table, "Number of rounds")
    if rounds and rounds[0].isdigit() and 1 <= int(rounds[0]) <= 99:  # noqa: PLR2004 - schema range
        out["rounds"] = int(rounds[0])

    system = _value(table, "Tournament type")
    if system and system[0] not in ("", "-"):
        out["system"] = system[0][:60]

    rating = _value(table, "Rating calculation")
    if rating and rating[0] not in ("", "-"):
        out["rated"] = [part.strip()[:60] for part in rating[0].split(",") if part.strip()]

    fide = _value(table, "FIDE-Event-ID")
    if fide and fide[0].isdigit() and len(fide[0]) <= 10:  # noqa: PLR2004 - schema limit
        out["fideId"] = fide[0]

    address = _value(table, "Location")
    if address and address[0] not in ("", "-"):
        out["address"] = address[0][:160]

    links = _value(table, "Links")
    if links:
        for text, href in _link_texts(links):
            if text.startswith("Official Homepage") and href.startswith(("http://", "https://")):
                out["homepage"] = href
    return out


def _link_texts(value: tuple[str, list[str]]) -> list[tuple[str, str]]:
    """Pair the Links cell's comma-separated link texts with their hrefs, in order."""
    texts = [part.strip() for part in value[0].split(",")]
    return list(zip(texts, value[1], strict=False))


def fide_url(fide_id: str) -> str:
    return FIDE_EVENT_URL.format(fide_id)
