"""Simple meta-tests for Robot Framework scraper.

These tests validate the scraper script itself to catch basic issues
like missing keywords, invalid syntax, or broken references.

These are "meta-tests" - tests that test the test/scraper infrastructure.
Kept intentionally simple and fast.
"""

import re
from pathlib import Path
import pytest


class TestScraperMeta:
    """Simple smoke tests for scrape_tournaments.robot"""

    @pytest.fixture
    def robot_file(self) -> Path:
        """Path to the Robot Framework scraper file."""
        return Path(__file__).parent.parent.parent / 'scrape_tournaments.robot'

    @pytest.fixture
    def robot_content(self, robot_file: Path) -> str:
        """Content of the Robot Framework scraper file."""
        return robot_file.read_text(encoding='utf-8')

    def test_robot_file_exists(self, robot_file: Path):
        """Test that scraper file exists"""
        assert robot_file.exists(), f"Scraper file not found: {robot_file}"

    def test_robot_file_has_valid_syntax(self, robot_content: str):
        """Test basic Robot Framework syntax validity"""
        # Check for required sections
        assert '*** Settings ***' in robot_content, "Missing Settings section"
        assert '*** Variables ***' in robot_content, "Missing Variables section"
        assert '*** Test Cases ***' in robot_content, "Missing Test Cases section"
        assert '*** Keywords ***' in robot_content, "Missing Keywords section"

    def test_robot_file_imports_required_libraries(self, robot_content: str):
        """Test that all required libraries are imported"""
        required_libraries = [
            'Browser',
            'OperatingSystem',
            'DateTime',
            'TournamentProcessor.py'
        ]

        for library in required_libraries:
            assert f'Library' in robot_content and library in robot_content, \
                f"Missing required library: {library}"

    def test_robot_file_defines_main_test_case(self, robot_content: str):
        """Test that main test case exists"""
        assert 'Scrape European Chess Tournaments' in robot_content, \
            "Main test case 'Scrape European Chess Tournaments' not found"

    def test_robot_file_no_invalid_keywords(self, robot_content: str):
        """Test that known invalid keywords are not used"""
        # List of keywords that don't exist but might be confused with real ones
        invalid_keywords = [
            'Get File Name',  # This was the bug - doesn't exist in standard libraries
        ]

        for keyword in invalid_keywords:
            # Only flag if it's being called (has ${} before it)
            pattern = rf'\$\{{[^}}]+\}}\s*=\s*{re.escape(keyword)}'
            matches = re.findall(pattern, robot_content)
            assert not matches, \
                f"Invalid keyword '{keyword}' found at: {matches}"

    def test_robot_keywords_are_defined(self, robot_content: str):
        """Test that all called keywords are defined"""
        # Extract keyword definitions (lines in *** Keywords *** section)
        keywords_section_match = re.search(
            r'\*\*\* Keywords \*\*\*(.*?)(?:\*\*\*|$)',
            robot_content,
            re.DOTALL
        )

        if not keywords_section_match:
            pytest.skip("No Keywords section found")

        keywords_section = keywords_section_match.group(1)

        # Find all defined keywords (lines that don't start with whitespace and aren't comments)
        defined_keywords = set()
        for line in keywords_section.split('\n'):
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('['):
                # This is a keyword definition
                defined_keywords.add(line)

        # Check that custom keywords are defined
        custom_keywords_used = [
            'Setup Browser And Download Directory',
            'Navigate To Search Page',
            'Fill Search Form',
            'Download Tournament Data',
            'Process Downloaded Excel',
            'Export Tournaments To JSON',
        ]

        for keyword in custom_keywords_used:
            assert keyword in defined_keywords, \
                f"Keyword '{keyword}' is used but not defined"

    def test_robot_variables_are_defined(self, robot_content: str):
        """Test that required variables are defined"""
        required_variables = [
            'SEARCH_URL',
            'DOWNLOAD_DIR',
            'MAX_RESULTS',
        ]

        for variable in required_variables:
            assert f'${{{variable}}}' in robot_content or f'${variable}' in robot_content, \
                f"Required variable ${{{variable}}} not defined"

    def test_robot_file_uses_correct_browser_keywords(self, robot_content: str):
        """Test that Browser library keywords are used correctly"""
        # Check for known correct Browser library keywords
        correct_keywords = [
            'New Browser',
            'New Context',
            'New Page',
            'Go To',
            'Click',
            'Fill Text',
            'Wait For Load State',
            'Promise To Wait For Download',
            'Wait For',
            'Close Browser',
        ]

        # At least some of these should be present
        found_keywords = [kw for kw in correct_keywords if kw in robot_content]
        assert len(found_keywords) >= 5, \
            f"Expected at least 5 Browser keywords, found {len(found_keywords)}"

    def test_download_uses_saveAs_parameter(self, robot_content: str):
        """Test that download uses saveAs parameter (not the old broken method)"""
        # Check that Promise To Wait For Download uses saveAs
        download_section = re.search(
            r'Promise To Wait For Download.*?saveAs=',
            robot_content,
            re.DOTALL
        )
        assert download_section, \
            "Download should use 'saveAs=' parameter in Promise To Wait For Download"

        # Make sure the old broken pattern is NOT present
        assert 'Get File Name' not in robot_content, \
            "Old broken 'Get File Name' keyword should not be used"

        assert 'Move File' not in robot_content, \
            "Move File is unnecessary when using saveAs parameter"

    def test_robot_file_has_teardown(self, robot_content: str):
        """Test that test case has proper teardown"""
        assert '[Teardown]' in robot_content, "Test case should have [Teardown]"
        assert 'Close Browser' in robot_content, "Teardown should close browser"

    def test_robot_uses_tournament_processor_keywords(self, robot_content: str):
        """Test that TournamentProcessor keywords are used"""
        processor_keywords = [
            'Load And Filter Tournaments',
            'Export To JSON',
        ]

        for keyword in processor_keywords:
            assert keyword in robot_content, \
                f"TournamentProcessor keyword '{keyword}' not found"

    def test_robot_file_no_hardcoded_paths(self, robot_content: str):
        """Test that file uses ${CURDIR} instead of hardcoded paths"""
        # Should use ${CURDIR} for relative paths
        assert '${CURDIR}' in robot_content, \
            "Should use ${CURDIR} for relative paths"

        # Should NOT have absolute paths like /home/user/...
        bad_patterns = [
            r'/home/\w+/',
            r'C:\\Users\\',
        ]

        for pattern in bad_patterns:
            matches = re.findall(pattern, robot_content)
            assert not matches, \
                f"Found hardcoded path: {matches}"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
