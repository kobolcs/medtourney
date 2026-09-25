"""Offline fallback: match a town named in the text against GeoNames."""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Any, Tuple

from geocoding.places import split_location

# --- Offline fallback: GeoNames (https://www.geonames.org, CC BY 4.0) -------
#
# Organisers often bury the town inside venue text with no separator
# ("Volkshaus Bärnbach", "8010 Graz Fachhochschule ...", "BG Gmunden"), which
# Nominatim's free-text search can't pick apart. For those, match the words
# of the location against the country's towns in GeoNames' cities1000 dump
# (places with 1,000+ inhabitants). Longest word-group wins, then biggest
# town. Common venue words are never matched on their own - there *is* an
# Austrian town called Haus, but "Haus des Schachsports" isn't in it.

VENUE_WORDS = {
    "haus", "hotel", "hall", "halle", "club", "klub", "chess", "schach", "sala",
    "centre", "center", "centro", "school", "schule", "church", "kirche",
    "house", "casa", "dom", "park", "stadium", "library", "grand", "open",
    "cafe", "restaurant", "sport", "sports", "saal", "castle", "palace",
    "town", "city", "village", "main", "street", "road", "strasse", "plaza",
    "diverse", "online", "various", "feld", "wirt",
    # common in tournament names, and also real town names somewhere
    "liga", "league", "scoala", "skola", "escola", "cup", "rapid", "blitz",
    "junior", "senior", "memorial", "festival", "turnir", "torneo", "turnaj",
}
# The first word of many place names, never one alone: "Puerto" is an alternate
# name of El Puerto de Santa María, and a Puerto de la Cruz pavilion landed
# there. A longer name starting with one only counts as the place's own name,
# not an alternate ("Convento de San Francisco" is not Sant Francesc de Formentera).
GENERIC_PLACE_WORDS = {
    "puerto", "porto", "port", "san", "sant", "santa", "santo", "sao", "saint", "st",
    "villa", "vila", "nova", "novo", "bad",
}
# Joining words between a venue and its town ("Clube de Xadrez de Sintra")
CONNECTORS = {
    "de", "del", "da", "do", "dos", "das", "di", "du", "des", "la", "el", "los", "las",
    "le", "les", "von", "am", "an", "im", "in", "y", "e", "i",
}
# Words that may sit between a town and its province ("Tasnad-judetul Satu Mare")
ADMIN_WORDS = {
    "judetul", "judet", "provincia", "province", "prov", "county", "okres", "kraj", "comarca",
    "region", "regione", "distrito", "district", "municipio", "concelho",
}
# Articles that start a place name ("El Campillo", "La Línea", "Il Ciocco")
ARTICLES = {"el", "la", "los", "las", "il", "lo", "le", "les"}
# Seats of a province or region share its name, and a location often ends in
# the province ("... Corteconcepción Huelva"): the town right before it wins.
PROVINCE_SEATS = {"PPLA", "PPLA2"}
MAX_NGRAM = 5  # "Los Palacios y Villafranca"
MIN_NAME_LEN = 4  # shorter alternate names / single words are too ambiguous
GEONAMES_COLUMNS = 15  # up to the population column of the dump format


def normalise(text: str) -> str:
    """Case- and accent-insensitive form: 'Bärnbach' -> 'barnbach'."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


# (lat, lng, population, flags): flags has "p" when the key is the place's own
# name (not an alternate) and "a" for a province/region seat
Place = Tuple[float, float, int, str]


def flags(place: Place) -> str:
    return place[3]


def load_geonames(path: Path, iso2s: set[str]) -> dict[str, dict[str, Place]]:
    """{iso2: {normalised name: (lat, lng, population)}} for the given countries."""
    index: dict[str, dict[str, Place]] = {c: {} for c in iso2s}
    with path.open(encoding="utf-8") as f:
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < GEONAMES_COLUMNS:
                continue
            country = cols[8].lower()
            if country not in index:
                continue
            lat, lng, pop = round(float(cols[4]), 4), round(float(cols[5]), 4), int(cols[14] or 0)
            seat = "a" if cols[7] in PROVINCE_SEATS else ""
            own = {normalise(cols[1]).strip(), normalise(cols[2]).strip()}
            alternates = {normalise(a).strip() for a in cols[3].split(",") if len(a) >= MIN_NAME_LEN}
            by_name = index[country]
            for key in own | alternates:
                if key and (key not in by_name or by_name[key][2] < pop):
                    by_name[key] = (lat, lng, pop, seat + ("p" if key in own else ""))
    return index


def geonames_match(head: str, places: dict[str, Place]) -> tuple[str, Place] | None:
    """Best town named in the location text, or None.

    Longest name wins, then biggest town - except that a province/region seat
    gives way to a town named right before it ("Corteconcepción Huelva"), and
    one ending the text after an unknown article-led name ("Pabellón El
    Campillo Huelva": a village GeoNames doesn't list, in Huelva province)
    places nothing rather than the capital.
    """
    # Numbers stay in as tokens, so "rue Rabelais 66000 Perpignan" never
    # reads "Rabelais" as the town right before Perpignan
    words = re.findall("[^\\W_]+(?:['\u2019-][^\\W_]+)*", normalise(head))
    found: list[tuple[int, int, str, Place]] = []  # (start, length, key, place)
    for n in range(MAX_NGRAM, 0, -1):
        for i in range(len(words) - n + 1):
            gram = words[i:i + n]
            if n == 1 and (len(gram[0]) < MIN_NAME_LEN or gram[0] in VENUE_WORDS
                           or gram[0] in GENERIC_PLACE_WORDS):
                continue
            key = " ".join(gram)
            if any(c.isdigit() for c in key):
                continue
            place = places.get(key)
            if not place or (gram[0] in GENERIC_PLACE_WORDS and "p" not in flags(place)):
                continue
            found.append((i, n, key, place))
    if not found:
        return None

    def rank(c: tuple[int, int, str, Place]) -> tuple[int, int]:
        return c[1], c[3][2]

    best = max(found, key=rank)
    if "a" not in flags(best[3]):
        return best[2], best[3]
    # Right before the seat, skipping "de", "judetul"...
    prev = best[0] - 1
    while prev >= 0 and words[prev] in CONNECTORS | ADMIN_WORDS:
        prev -= 1
    # ...by its own name ("Campillo" is only an alternate of Campillo de Aragón)
    town = [c for c in found if c[0] + c[1] - 1 == prev and flags(c[3]) == "p"]
    if town:
        best = max(town, key=rank)
    elif (best[0] + best[1] == len(words) and prev >= 1 and prev == best[0] - 1
          and words[prev - 1] in ARTICLES and words[prev] not in VENUE_WORDS
          and not any(c[0] <= prev < c[0] + c[1] and "p" in flags(c[3]) for c in found)):
        return None
    return best[2], best[3]


def town_from_name(
    tournament: dict[str, Any], geonames: dict[str, dict[str, Place]]
) -> tuple[float, float] | None:
    """Last resort when the location has no recognisable town: many
    tournament names carry it ("Sligo Chess Festival", "Hradec Kralove Open")
    - matched against the tournament's own country only. Offline, per
    tournament (names vary), so not cached."""
    _, iso2 = split_location(tournament.get("location", ""))
    if not iso2:
        return None
    match = geonames_match(tournament.get("name", ""), geonames.get(iso2, {}))
    return (match[1][0], match[1][1]) if match else None
