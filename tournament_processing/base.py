"""Shared declarations for the TournamentProcessor mixins.

Annotations only: the values are set in TournamentProcessor (class
constants) and TournamentProcessor.__init__ (instance state). Declaring
them here lets each mixin type-check on its own.
"""

import logging
from re import Pattern
from typing import Any, ClassVar


class ProcessorBase:
    REGEX_PATTERNS: ClassVar[dict[str, Pattern[str]]]
    MINIMUM_SENIOR_AGE: ClassVar[int]
    RANGE_MONTHS: ClassVar[int]
    _BLITZ_MAX_MINUTES: ClassVar[int]
    _RAPID_MAX_MINUTES: ClassVar[int]

    logger: logging.Logger
    tournaments: list[dict[str, Any]]
    european_countries: set[str]
    non_european_countries: set[str]
    mediterranean_locations: set[str]
