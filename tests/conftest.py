"""
Pytest configuration and shared fixtures
"""

import pytest
import sys
from pathlib import Path

# Add project root to Python path so tests can import modules
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


@pytest.fixture(scope="session")
def project_root_path():
    """Return the project root directory path"""
    return Path(__file__).parent.parent


@pytest.fixture(scope="session")
def test_data_dir():
    """Return the test data directory path"""
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_tournament_data():
    """Sample tournament data for testing"""
    from datetime import datetime, timedelta
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')

    return [
        {
            'name': 'Barcelona Open 2025',
            'location': 'Barcelona, ESP',
            'date': tomorrow,
            'category': 'Open, Classical',
            'url': 'https://chess-results.com/test1',
            'description': 'Barcelona Open 2025'
        },
        {
            'name': 'Athens Senior Championship',
            'location': 'Athens, Greece',
            'date': tomorrow,
            'category': 'Open, S50+, Classical',
            'url': 'https://chess-results.com/test2',
            'description': 'Athens Senior Championship'
        },
        {
            'name': 'Paris Youth U18',
            'location': 'Paris, France',
            'date': tomorrow,
            'category': 'Youth',
            'url': 'https://chess-results.com/test3',
            'description': 'Paris Youth U18'
        },
        {
            'name': 'Dubai Open',
            'location': 'Dubai, UAE',
            'date': tomorrow,
            'category': 'Open, Classical',
            'url': 'https://chess-results.com/test4',
            'description': 'Dubai Open'
        },
        {
            'name': 'Moscow Championship',
            'location': 'Moscow, Russia',
            'date': tomorrow,
            'category': 'Open, Classical',
            'url': 'https://chess-results.com/test5',
            'description': 'Moscow Championship'
        }
    ]


def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "unit: Unit tests (fast, isolated)"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests (may require external resources)"
    )
    config.addinivalue_line(
        "markers", "slow: Slow tests (may take minutes to complete)"
    )
    config.addinivalue_line(
        "markers", "timeout_test: Tests that validate timeout handling"
    )
    config.addinivalue_line(
        "markers", "performance: Performance tests"
    )
    config.addinivalue_line(
        "markers", "requires_browser: Tests that require Browser library installation"
    )
    config.addinivalue_line(
        "markers", "requires_network: Tests that require network access"
    )
    config.addinivalue_line(
        "markers", "ci_skip: Tests to skip in CI/CD environments"
    )
