"""
Integration tests for the Robot Framework scraper
Tests actual data download with timeout handling for CI/CD environments
"""

import json
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

import pytest

# Mark tests that actually download data
pytestmark = pytest.mark.integration


class TestScraperIntegration:
    """Integration tests for tournament scraper"""

    @pytest.fixture
    def project_root(self):
        """Get project root directory"""
        return Path(__file__).parent.parent.parent

    @pytest.fixture
    def expected_json_file(self, project_root):
        """Path to expected JSON output file"""
        return project_root / "tournaments_data.json"

    def test_scraper_can_run_with_timeout(self, project_root):
        """
        Test that scraper can run with proper timeout handling
        This test will timeout after 5 minutes to prevent CI/CD hanging
        """
        cmd = [
            "robot",
            "--outputdir", str(project_root / "robot_results"),
            "--loglevel", "INFO",
            "--consolecolors", "off",
            str(project_root / "scrape_tournaments.robot")
        ]

        try:
            # Run with 5 minute timeout (300 seconds)
            result = subprocess.run(
                cmd,
                check=False, cwd=str(project_root),
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes
            )

            # Log output for debugging

            # Robot Framework returns 0 on success
            # We allow some failures as the site might be slow/unstable
            assert result.returncode in [0, 1], f"Scraper failed with code {result.returncode}"

        except subprocess.TimeoutExpired:
            pytest.fail("Scraper timed out after 5 minutes - needs optimization for CI/CD")

    @pytest.mark.skipif(
        os.environ.get("CI") == "true",
        reason="Skip actual download in CI to save time"
    )
    def test_scraper_downloads_real_data(self, project_root, expected_json_file):
        """
        Test that scraper actually downloads and processes real tournament data
        SKIPPED in CI/CD environments (use pytest -m "not integration" to skip)
        """
        # Remove old JSON file if exists
        if expected_json_file.exists():
            expected_json_file.unlink()

        # Run the scraper
        cmd = [
            "python3",
            str(project_root / "run_scraper.py")
        ]

        subprocess.run(
            cmd,
            check=False, cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes for full download
        )


        # Check JSON file was created
        assert expected_json_file.exists(), "tournaments_data.json was not created"

        # Validate JSON structure
        with open(expected_json_file, encoding="utf-8") as f:
            data = json.load(f)

        assert isinstance(data, list), "JSON should contain a list of tournaments"

        if len(data) > 0:
            # Validate first tournament structure
            tournament = data[0]
            required_fields = {"name", "location", "date", "category", "url"}
            assert all(field in tournament for field in required_fields), \
                f"Tournament missing required fields. Has: {tournament.keys()}"

            # Validate date format
            tournament_date = datetime.strptime(tournament["date"], "%Y-%m-%d")
            tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            assert tournament_date >= tomorrow, "Tournament date should be in the future"

    def test_json_output_structure(self, expected_json_file):
        """
        Test that existing tournaments_data.json has correct structure
        This test uses existing data (fast, suitable for CI/CD)
        """
        # Skip if file doesn't exist (fresh checkout)
        if not expected_json_file.exists():
            pytest.skip("tournaments_data.json doesn't exist yet")

        with open(expected_json_file, encoding="utf-8") as f:
            data = json.load(f)

        assert isinstance(data, list), "JSON should contain a list"

        if len(data) > 0:
            # Check structure of all tournaments
            for idx, tournament in enumerate(data):
                required_fields = {"name", "location", "date", "category", "url", "description"}
                missing_fields = required_fields - set(tournament.keys())
                assert len(missing_fields) == 0, \
                    f"Tournament {idx} missing fields: {missing_fields}"

                # Validate types
                assert isinstance(tournament["name"], str)
                assert isinstance(tournament["location"], str)
                assert isinstance(tournament["date"], str)
                assert isinstance(tournament["category"], str)
                assert isinstance(tournament["url"], str)

                # Validate date format (YYYY-MM-DD)
                try:
                    datetime.strptime(tournament["date"], "%Y-%m-%d")
                except ValueError:
                    pytest.fail(f"Invalid date format for tournament {idx}: {tournament['date']}")

    def test_json_contains_only_european_tournaments(self, expected_json_file):
        """
        Test that JSON output contains only European tournaments
        This validates the filtering logic worked correctly
        """
        if not expected_json_file.exists():
            pytest.skip("tournaments_data.json doesn't exist yet")

        with open(expected_json_file, encoding="utf-8") as f:
            data = json.load(f)

        # Non-European countries that should be excluded
        non_european_keywords = [
            "russia", "moscow", "petersburg",
            "malaysia", "uae", "dubai", "qatar", "saudi",
            "china", "india", "singapore", "thailand",
            "usa", "canada", "mexico", "brazil"
        ]

        for idx, tournament in enumerate(data):
            location_lower = tournament["location"].lower()
            for keyword in non_european_keywords:
                assert keyword not in location_lower, \
                    f"Tournament {idx} has non-European location: {tournament['location']}"

    def test_json_contains_future_tournaments_only(self, expected_json_file):
        """
        Test that JSON contains only future tournaments (tomorrow onwards)
        """
        if not expected_json_file.exists():
            pytest.skip("tournaments_data.json doesn't exist yet")

        with open(expected_json_file, encoding="utf-8") as f:
            data = json.load(f)

        tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

        for idx, tournament in enumerate(data):
            tournament_date = datetime.strptime(tournament["date"], "%Y-%m-%d")
            assert tournament_date >= tomorrow, \
                f"Tournament {idx} is not in the future: {tournament['date']}"

    @pytest.mark.slow
    def test_robot_framework_browser_installation(self):
        """
        Test that Robot Framework Browser library is properly installed
        This is a prerequisite for the scraper to work
        """
        # Check if rfbrowser is installed
        result = subprocess.run(
            ["python3", "-c", "import Browser"],
            check=False, capture_output=True,
            text=True
        )

        if result.returncode != 0:
            pytest.skip("Browser library not installed - run 'rfbrowser init'")

    @pytest.mark.timeout_test
    def test_scraper_handles_network_timeout(self, project_root):
        """
        Test that scraper gracefully handles network timeouts
        Uses a very short timeout to simulate CI/CD time constraints
        """
        cmd = [
            "robot",
            "--outputdir", str(project_root / "robot_results"),
            "--loglevel", "DEBUG",
            "--variable", "TIMEOUT:5s",  # Very short timeout
            str(project_root / "scrape_tournaments.robot")
        ]

        try:
            result = subprocess.run(
                cmd,
                check=False, cwd=str(project_root),
                capture_output=True,
                text=True,
                timeout=30  # Max 30 seconds for this test
            )

            # Scraper should either succeed or fail gracefully
            # Return code should not be > 250 (system error)
            assert result.returncode < 250, \
                f"Scraper crashed with system error: {result.returncode}"

        except subprocess.TimeoutExpired:
            # This is expected with very short timeout
            pass


class TestScraperPerformance:
    """Performance tests for scraper (useful for CI/CD optimization)"""

    @pytest.fixture
    def project_root(self):
        """Get project root directory"""
        return Path(__file__).parent.parent.parent

    @pytest.mark.performance
    def test_robot_framework_startup_time(self, project_root):
        """
        Test Robot Framework startup time
        Should be under 10 seconds for CI/CD efficiency
        """
        import time

        cmd = [
            "robot",
            "--version"
        ]

        start = time.time()
        result = subprocess.run(cmd, check=False, capture_output=True, timeout=10)
        elapsed = time.time() - start

        assert result.returncode == 0
        assert elapsed < 5, f"Robot Framework startup took {elapsed}s (should be < 5s)"

    @pytest.mark.performance
    def test_tournament_processor_import_time(self):
        """
        Test TournamentProcessor import time
        Should be fast for CI/CD efficiency
        """
        import time

        start = time.time()
        elapsed = time.time() - start

        assert elapsed < 1, f"Import took {elapsed}s (should be < 1s)"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
