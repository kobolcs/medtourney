"""Location text -> (head, country) and the cascade of Nominatim queries to try."""

from __future__ import annotations

import re

# FIDE federation code -> ISO 3166-1 alpha-2 (lower case, as Nominatim's
# countrycodes parameter expects). Must match src/utils/countries.ts -
# tests/python/test_geocode.py checks the two stay in sync.
FED_TO_ISO2: dict[str, str] = {
    "ALB": "al", "AND": "ad", "ARM": "am", "AUT": "at", "AZE": "az",
    "BEL": "be", "BIH": "ba", "BUL": "bg", "CRO": "hr", "CYP": "cy",
    "CZE": "cz", "DEN": "dk", "ENG": "gb", "EST": "ee", "FAI": "fo",
    "FIN": "fi", "FRA": "fr", "GEO": "ge", "GER": "de", "GCI": "gg",
    "GIB": "gi", "GBR": "gb", "GRE": "gr", "HUN": "hu", "IRL": "ie",
    "ISL": "is", "IOM": "im", "ITA": "it", "JCI": "je", "KOS": "xk",
    "LAT": "lv", "LIE": "li", "LTU": "lt", "LUX": "lu", "MLT": "mt",
    "MDA": "md", "MNC": "mc", "MNE": "me", "NED": "nl", "MKD": "mk",
    "NOR": "no", "POL": "pl", "POR": "pt", "ROU": "ro", "SMR": "sm",
    "SCO": "gb", "SRB": "rs", "SVK": "sk", "SLO": "si", "ESP": "es",
    "SWE": "se", "SUI": "ch", "TUR": "tr", "UKR": "ua", "WLS": "gb",
}

# Nominatim addresstype values too coarse to pin a tournament on.
TOO_COARSE = {"country", "state", "region", "province", "county", "state_district"}

# Settlement-level hits. A one-part query ("Church Hall") is only trusted when
# it resolves to one of these - otherwise it's some random building of that
# name elsewhere in the country. Multi-part queries ("Hotel Atlas - Novi
# Pazar") may also match a building, since the town in them anchors the hit.
PLACE_TYPES = {
    "city", "town", "village", "hamlet", "suburb", "municipality", "borough",
    "city_district", "district", "quarter", "neighbourhood", "locality",
    "isolated_dwelling", "island",
}

# Separators organisers use between venue / street / town. Not "/", which
# appears inside Spanish street notation ("C/ Ajo S/N").
SEGMENT_SPLIT = re.compile("\\s*(?:,|\\||\\s[\u2013\u2014-]\\s|\\(|\\))\\s*")  # , | ( ) or spaced dash
MIN_SEGMENT_LETTERS = 3


def split_location(location: str) -> tuple[str, str | None]:
    """'Hotel Atlas - Novi Pazar, SRB' -> ('Hotel Atlas - Novi Pazar', 'rs')."""
    head, _, fed = location.rpartition(",")
    iso2 = FED_TO_ISO2.get(fed.strip().upper())
    if not head:  # bare "UKR"
        return "", FED_TO_ISO2.get(location.strip().upper())
    return head.strip(), iso2


def candidate_queries(head: str) -> list[str]:
    """Full text first, then with leading segments (venue, street) dropped.

    'Hotel Atlas - Novi Pazar' -> ['Hotel Atlas - Novi Pazar', 'Novi Pazar']
    Segments with no letters ('42.1381', postcodes) are never queried alone.
    """
    def letters(s: str) -> int:
        return len(re.findall(r"[^\W\d_]", s))

    if letters(head) < MIN_SEGMENT_LETTERS:
        return []
    # ...and never a bare country code ("Arco- Trentino (ITA)" once matched a place called Ita)
    segments = [s for s in SEGMENT_SPLIT.split(head)
                if letters(s) >= MIN_SEGMENT_LETTERS and s.strip().upper() not in FED_TO_ISO2]
    queries = [head]
    for i in range(1, len(segments)):
        q = " ".join(segments[i:])
        if q not in queries:
            queries.append(q)
    return queries
