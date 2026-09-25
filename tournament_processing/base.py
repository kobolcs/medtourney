"""Shared declarations for the TournamentProcessor mixins.

Annotations only: the values are set in TournamentProcessor (class
constants) and TournamentProcessor.__init__ (instance state). Declaring
them here lets each mixin type-check on its own.
"""

import logging
from typing import Any, ClassVar, Dict, List, Pattern, Set


class ProcessorBase:
    REGEX_PATTERNS: ClassVar[Dict[str, Pattern[str]]]
    MINIMUM_SENIOR_AGE: ClassVar[int]
    RANGE_MONTHS: ClassVar[int]
    _BLITZ_MAX_MINUTES: ClassVar[int]
    _RAPID_MAX_MINUTES: ClassVar[int]

    logger: logging.Logger
    tournaments: List[Dict[str, Any]]
    european_countries: Set[str]
    non_european_countries: Set[str]
    mediterranean_locations: Set[str]
