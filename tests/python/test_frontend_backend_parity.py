"""Frontend/Backend parity tests.

Ensures that frontend (app.js) and backend (TournamentProcessor.py) use
the same configuration and produce consistent filtering results.
"""

import json
import re
from pathlib import Path

import pytest

from TournamentProcessor import TournamentProcessor


class TestFrontendBackendParity:
    """Test that frontend and backend filters are in sync"""

    @pytest.fixture
    def processor(self) -> TournamentProcessor:
        """Create a TournamentProcessor instance."""
        return TournamentProcessor()

    @pytest.fixture
    def config_json(self) -> dict:
        """Load config.json."""
        config_path = Path(__file__).parent.parent.parent / "config.json"
        with config_path.open(encoding="utf-8") as f:
            return json.load(f)

    @pytest.fixture
    def app_js_content(self) -> str:
        """Load app.js content."""
        app_js_path = Path(__file__).parent.parent.parent / "app.js"
        with app_js_path.open(encoding="utf-8") as f:
            return f.read()

    @pytest.fixture
    def filter_service_js_content(self) -> str:
        """Load FilterService source content."""
        filter_service_js_path = Path(__file__).parent.parent.parent / "src" / "services" / "FilterService.ts"
        with filter_service_js_path.open(encoding="utf-8") as f:
            return f.read()

    def test_mediterranean_cities_in_config(self, config_json: dict, processor: TournamentProcessor):
        """Test that config.json Mediterranean cities match processor"""
        config_cities = set(config_json["mediterraneanLocations"])
        processor_cities = processor.mediterranean_locations

        assert config_cities == processor_cities, \
            "Mediterranean cities in config.json don't match TournamentProcessor"

    def test_mediterranean_cities_in_frontend(self, app_js_content: str, _config_json: dict):
        """Test that app.js loads Mediterranean cities from config.json"""
        # In the refactored architecture, mediterraneanLocations is loaded from config.json
        # Look for: this.mediterraneanLocations = new Set(config.mediterraneanLocations)

        # Check that mediterraneanLocations is initialized
        init_pattern = r"this\.mediterraneanLocations\s*=\s*new Set\(\)"
        init_match = re.search(init_pattern, app_js_content)
        assert init_match, "Could not find mediterraneanLocations initialization in app.js"

        # Check that it's loaded from config
        load_pattern = r"this\.mediterraneanLocations\s*=\s*new Set\(config\.mediterraneanLocations\)"
        load_match = re.search(load_pattern, app_js_content)
        assert load_match, "Could not find mediterraneanLocations loading from config in app.js"

    def test_senior_regex_pattern_matches(self, processor: TournamentProcessor):
        """Test that senior regex pattern matches all expected variations"""
        pattern = processor.REGEX_PATTERNS["s50"]

        # Test cases that SHOULD match
        should_match = [
            "s50+",
            "S50+",
            "s50",
            "S50",
            "senior",
            "Senior",
            "SENIOR",
            "veteran",
            "Veteran",
            "50+",
            "Tournament S50+ Open",
            "Senior Championship",
            "Veteran Cup",
        ]

        for text in should_match:
            assert pattern.search(text), \
                f"Senior pattern should match '{text}'"

        # Test cases that should NOT match
        should_not_match = [
            "Open",
            "Youth",
            "U18",
            "Classical",
            "Rapid",
            "s49",  # Not 50+
        ]

        for text in should_not_match:
            assert not pattern.search(text), \
                f"Senior pattern should NOT match '{text}'"

    def test_senior_filter_consistency_frontend_backend(self, filter_service_js_content: str):
        """Test that frontend isSeniorCategory uses same regex as backend"""
        # In refactored architecture, senior logic is in FilterService.js
        # Find isSeniorCategory - look for seniorPattern variable assignment
        pattern = r"isSeniorCategory\([^)]+\)[^{]*\{[^}]*const\s+seniorPattern\s*=\s*(/[^/]+/[ig]*)"
        match = re.search(pattern, filter_service_js_content, re.DOTALL)

        assert match, "Could not find isSeniorCategory regex in FilterService.js"

        js_regex_str = match.group(1)

        # Check that it includes key patterns
        assert "s50" in js_regex_str.lower(), \
            "Frontend senior regex should include s50"
        assert "senior" in js_regex_str.lower(), \
            "Frontend senior regex should include senior"
        assert "veteran" in js_regex_str.lower(), \
            "Frontend senior regex should include veteran"
        assert "50" in js_regex_str, \
            "Frontend senior regex should include 50+"

    def test_config_structure_is_valid(self, config_json: dict):
        """Test that config.json has required structure"""
        required_keys = [
            "europeanCountries",
            "nonEuropeanCountries",
            "mediterraneanLocations",
            "countryCodes",
        ]

        for key in required_keys:
            assert key in config_json, \
                f"config.json missing required key: {key}"

        # Check types
        assert isinstance(config_json["europeanCountries"], list), \
            "europeanCountries should be a list"
        assert isinstance(config_json["mediterraneanLocations"], list), \
            "mediterraneanLocations should be a list"
        assert isinstance(config_json["countryCodes"], dict), \
            "countryCodes should be a dict"

        # Check that lists are not empty
        assert len(config_json["europeanCountries"]) > 0, \
            "europeanCountries should not be empty"
        assert len(config_json["mediterraneanLocations"]) > 0, \
            "mediterraneanLocations should not be empty"

    def test_mediterranean_cities_are_unique(self, config_json: dict):
        """Test that Mediterranean cities list has no duplicates"""
        cities = config_json["mediterraneanLocations"]
        unique_cities = set(cities)

        assert len(cities) == len(unique_cities), \
            f"Mediterranean cities has duplicates: {len(cities)} total, {len(unique_cities)} unique"

    def test_mediterranean_sample_coverage(self, processor: TournamentProcessor):
        """Test that Mediterranean filter covers key coastal cities"""
        # Key Mediterranean cities that MUST be included
        must_have_cities = [
            "barcelona",  # Spain
            "valencia",   # Spain
            "nice",       # France
            "monaco",     # Monaco
            "genoa",      # Italy
            "naples",     # Italy
            "rome",       # Italy
            "athens",     # Greece
            "split",      # Croatia
            "dubrovnik",  # Croatia
            "malta",      # Malta
        ]

        for city in must_have_cities:
            assert city in processor.mediterranean_locations, \
                f"Key Mediterranean city '{city}' is missing"

    def test_non_mediterranean_cities_excluded(self, processor: TournamentProcessor):
        """Test that non-coastal cities are NOT in Mediterranean list"""
        # Major European cities that are NOT Mediterranean
        should_not_be_mediterranean = [
            "madrid",     # Spain - inland
            "paris",      # France - inland
            "milan",      # Italy - inland
            "berlin",     # Germany - not Mediterranean
            "london",     # UK - not Mediterranean
            "vienna",     # Austria - landlocked
            "prague",     # Czech - landlocked
            "budapest",   # Hungary - landlocked
            "warsaw",     # Poland - Baltic, not Mediterranean
        ]

        for city in should_not_be_mediterranean:
            assert city not in processor.mediterranean_locations, \
                f"Non-Mediterranean city '{city}' should NOT be in the list"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
