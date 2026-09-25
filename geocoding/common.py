"""Shared settings for the geocoder: Nominatim etiquette, retry policy, logger."""

from __future__ import annotations

import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import TypeVar

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "MedTourney/3.0 (+https://github.com/kobolcs/medtourney)"
REQUEST_INTERVAL_S = 1.1
MISS_RETRY_DAYS = 30
logger = logging.getLogger("geocode")
T = TypeVar("T")
NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, OSError, ValueError)

DEFAULT_MAX_LOOKUPS = 300
SAVE_EVERY = 25
