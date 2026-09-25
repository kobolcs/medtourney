"""TournamentProcessor mixin: Tournament predicates: youth/school, team, senior, European, plus location and URL clean-up."""

import re
from typing import Any

from tournament_processing.base import ProcessorBase


class ClassifyMixin(ProcessorBase):
    """Tournament predicates: youth/school, team, senior, European, plus location and URL clean-up."""

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

    def _build_tournament_url(self, db_key: Any, event_id: Any) -> str:
        """Build tournament URL from DB-Key or EventID."""
        if db_key and str(db_key).strip() and str(db_key).strip() != "0":
            return f"https://chess-results.com/tnr{db_key}.aspx?lan=1"
        if event_id and str(event_id).strip() and str(event_id).strip() != "0":
            return f"https://chess-results.com/tnr{event_id}.aspx?lan=1"
        return "https://chess-results.com"

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
                # Malformed age indicator; treat as not youth/school.
                return False

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
