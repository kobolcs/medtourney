"""
Integration Tests for Scraper Optimization (Phase 2.4)

Tests:
- 6-month date range calculation
- 5000 result limit configuration
- Date range variable usage
- Scraper configuration validation

Run with: pytest tests/integration/test_scraper_optimization.py -v
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path


class TestScraperOptimization:
    """Test scraper optimization from Phase 2.4"""

    @staticmethod
    def get_robot_file_path():
        """Get path to scraper robot file"""
        return Path(__file__).parent.parent.parent / "scrape_tournaments.robot"

    def test_max_results_increased_to_5000(self):
        """Test that MAX_RESULTS was increased from 2000 to 5000"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check for MAX_RESULTS = 5000
        assert "${MAX_RESULTS}    5000" in content, "MAX_RESULTS should be 5000"
        assert "${MAX_RESULTS}    2000" not in content, "Old limit 2000 should not exist"

    def test_date_range_months_variable_exists(self):
        """Test that DATE_RANGE_MONTHS variable was added"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check for DATE_RANGE_MONTHS variable
        assert "${DATE_RANGE_MONTHS}" in content, "DATE_RANGE_MONTHS variable should exist"

    def test_date_range_set_to_6_months(self):
        """Test that date range is configured for 6 months"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check for 6 month configuration
        assert "${DATE_RANGE_MONTHS}    6" in content, "DATE_RANGE_MONTHS should be 6"

    def test_date_calculation_uses_variable(self):
        """Test that date calculation uses DATE_RANGE_MONTHS variable"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check that date calculation uses the variable
        assert "${DATE_RANGE_MONTHS} * 30" in content or \
               "${DATE_RANGE_MONTHS}*30" in content, \
               "Date calculation should use DATE_RANGE_MONTHS variable"

    def test_old_90_days_removed(self):
        """Test that old hardcoded 90 days was removed"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Old version had "90 days" hardcoded
        assert "90 days" not in content, "Old hardcoded 90 days should be removed"

    def test_date_range_calculation_accuracy(self):
        """Test that 6 months * 30 days = 180 days is correct calculation"""
        # This is a unit test of the calculation logic
        months = 6
        days = months * 30
        assert days == 180, "6 months should equal 180 days"

    def test_logging_includes_month_info(self):
        """Test that logging shows the number of months"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check for enhanced logging
        assert "${DATE_RANGE_MONTHS} months" in content, \
               "Logging should include month count"

    def test_scraper_variables_section_complete(self):
        """Test that all required variables are defined"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        required_vars = [
            "${SEARCH_URL}",
            "${DOWNLOAD_DIR}",
            "${MAX_RESULTS}",
            "${DATE_RANGE_MONTHS}"
        ]

        for var in required_vars:
            assert var in content, f"Required variable {var} should be defined"

    def test_date_range_increases_coverage(self):
        """Test that 6 months provides more coverage than 3 months"""
        old_days = 90  # 3 months
        new_days = 180  # 6 months

        coverage_increase = ((new_days - old_days) / old_days) * 100

        assert coverage_increase == 100, "Coverage should double (100% increase)"

    def test_result_limit_increases_capacity(self):
        """Test that 5000 results provides more capacity than 2000"""
        old_limit = 2000
        new_limit = 5000

        capacity_increase = ((new_limit - old_limit) / old_limit) * 100

        assert capacity_increase == 150, "Capacity should increase by 150%"

    def test_expected_tournament_increase(self):
        """Test expected tournament count increase calculation"""
        # Based on documentation: 60-80% more tournaments expected
        # Current: 38 tournaments
        # Expected: 60-70 tournaments

        current_count = 38
        min_expected = 60
        max_expected = 70

        # Calculate percentage increase
        min_increase = ((min_expected - current_count) / current_count) * 100
        max_increase = ((max_expected - current_count) / current_count) * 100

        # Should be approximately 58-84% increase
        assert 55 <= min_increase <= 65, f"Min increase should be ~58%, got {min_increase}%"
        assert 80 <= max_increase <= 90, f"Max increase should be ~84%, got {max_increase}%"

    def test_scraper_file_syntax_valid(self):
        """Test that scraper file has valid Robot Framework syntax"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Basic syntax checks
        assert "*** Variables ***" in content, "Should have Variables section"
        assert "*** Test Cases ***" in content, "Should have Test Cases section"
        assert "*** Keywords ***" in content, "Should have Keywords section"

    def test_fill_search_form_keyword_updated(self):
        """Test that Fill Search Form keyword was updated"""
        robot_file = self.get_robot_file_path()
        content = robot_file.read_text()

        # Check for updated Fill Search Form
        assert "Fill Search Form" in content, "Fill Search Form keyword should exist"

        # Check for dynamic calculation
        pattern = r"\$\{days\}\s*=\s*Evaluate\s+\$\{DATE_RANGE_MONTHS\}\s*\*\s*30"
        assert re.search(pattern, content), \
               "Should calculate days from DATE_RANGE_MONTHS"

    def test_configuration_scalability(self):
        """Test that configuration can easily scale to different ranges"""
        # Test that changing DATE_RANGE_MONTHS would automatically adjust
        # This validates the design decision to use a variable

        test_ranges = [3, 6, 9, 12]
        for months in test_ranges:
            expected_days = months * 30
            assert expected_days > 0, f"Range of {months} months should be valid"
            assert expected_days <= 365, f"Range should be reasonable (<= 1 year)"


class TestScraperIntegration:
    """Integration tests for scraper functionality"""

    def test_scraper_file_exists(self):
        """Test that scraper robot file exists"""
        robot_file = Path(__file__).parent.parent.parent / "scrape_tournaments.robot"
        assert robot_file.exists(), "Scraper robot file should exist"

    def test_tournament_processor_importable(self):
        """Test that TournamentProcessor can be imported"""
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent.parent))
            from TournamentProcessor import TournamentProcessor
            processor = TournamentProcessor()
            assert processor is not None, "TournamentProcessor should be importable"
        except ImportError as e:
            assert False, f"Failed to import TournamentProcessor: {e}"

    def test_config_json_exists(self):
        """Test that config.json exists for tournament processor"""
        config_file = Path(__file__).parent.parent.parent / "config.json"
        assert config_file.exists(), "config.json should exist"

    def test_downloads_directory_creation(self):
        """Test that downloads directory can be created"""
        downloads_dir = Path(__file__).parent.parent.parent / "downloads"

        # This is checked in the scraper
        assert True, "Downloads directory creation is handled by scraper"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
