# MedTourney Test Suite

Comprehensive test suite for the MedTourney chess tournament scraper and filtering system.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [CI/CD Integration](#cicd-integration)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)

## 🚀 Quick Start

### Installation

```bash
# Install all dependencies including test frameworks
pip install -r requirements.txt

# For integration tests, initialize Playwright browsers
rfbrowser init
```

### Run All Tests

```bash
# Using the test runner script (recommended)
./run_tests.sh

# Or using pytest directly
pytest tests/ -v
```

### Run Fast Tests Only

```bash
# Skip slow integration tests (good for development)
./run_tests.sh fast

# Or
pytest tests/python/ -v -m "not slow and not integration"
```

## 📁 Test Structure

```
tests/
├── python/
│   └── test_tournament_processor.py    # Unit tests for TournamentProcessor
├── integration/
│   └── test_scraper_integration.py     # Integration tests for scraper
├── fixtures/
│   └── (Generated Excel files for testing)
└── README.md                           # This file
```

### Test Categories

Tests are organized with pytest markers:

- **`unit`** - Fast, isolated unit tests
- **`integration`** - Integration tests that may download actual data
- **`slow`** - Tests that take minutes to complete
- **`timeout_test`** - Tests that validate timeout handling
- **`performance`** - Performance benchmarks
- **`ci_skip`** - Tests to skip in CI/CD environments

## 🏃 Running Tests

### Using the Test Runner Script

The `run_tests.sh` script provides multiple test modes:

```bash
# Fast unit tests only (recommended for development)
./run_tests.sh unit

# Integration tests (may download actual data)
./run_tests.sh integration

# Fast tests (skip slow and integration)
./run_tests.sh fast

# CI/CD mode (timeout-safe, skips problematic tests)
./run_tests.sh ci

# Coverage report
./run_tests.sh coverage

# Parallel execution (faster on multi-core)
./run_tests.sh parallel

# All tests
./run_tests.sh all
```

### Using Pytest Directly

```bash
# Run all tests
pytest tests/ -v

# Run unit tests only
pytest tests/python/ -v

# Run integration tests only
pytest tests/integration/ -v

# Run tests with coverage
pytest tests/ -v --cov=TournamentProcessor --cov-report=html

# Run tests in parallel
pytest tests/ -v -n auto

# Run specific test file
pytest tests/python/test_tournament_processor.py -v

# Run specific test function
pytest tests/python/test_tournament_processor.py::TestTournamentProcessor::test_parse_date_yyyymmdd -v
```

### Test Markers

```bash
# Run only unit tests
pytest -m "unit"

# Run only integration tests
pytest -m "integration"

# Exclude slow tests
pytest -m "not slow"

# Exclude integration tests
pytest -m "not integration"

# Run only fast tests
pytest -m "not slow and not integration"
```

## 🔄 CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main`, `develop`, or `claude/*` branches
- Pull requests to `main` or `develop`
- Manual workflow trigger

**Workflow includes:**
1. **Unit Tests** (always runs, 10 min timeout)
   - Fast, isolated tests
   - Coverage reporting
   - Codecov integration

2. **Integration Tests** (only on main/develop)
   - Actual scraper tests with timeout protection
   - Robot Framework logs uploaded as artifacts
   - Continues on error (doesn't fail CI)

### Timeout Protection

All tests have timeout protection to prevent CI/CD hanging:

- Unit tests: 120 seconds per test
- Integration tests: 300 seconds (5 minutes) per test
- Full test suite: Configured in `pytest.ini`

**Why timeout protection?**

The scraper downloads data from chess-results.com, which can be slow or unresponsive. Timeout protection ensures:
- ✅ CI/CD jobs don't hang indefinitely
- ✅ Tests fail fast on network issues
- ✅ Predictable CI/CD runtime

### Skipping Tests in CI

Tests marked with `@pytest.mark.ci_skip` are automatically skipped in CI environments:

```python
@pytest.mark.skipif(
    os.environ.get('CI') == 'true',
    reason="Skip actual download in CI to save time"
)
def test_scraper_downloads_real_data(self):
    # This test only runs locally
    pass
```

## 📊 Test Coverage

### Viewing Coverage

```bash
# Generate HTML coverage report
./run_tests.sh coverage

# Open in browser
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

### Coverage Reports

- **Terminal**: Shows coverage summary with missing lines
- **HTML**: Interactive report at `htmlcov/index.html`
- **XML**: For Codecov integration at `coverage.xml`

### Coverage Configuration

Coverage settings are in `.coveragerc`:
- Source files: All `.py` files in project root
- Excluded: Tests, virtual environments, site-packages
- Branch coverage: Enabled
- Threshold: Aim for 80%+ coverage

## 🧪 Test Details

### Unit Tests (test_tournament_processor.py)

**Date Parsing Tests** (Lines 39-110)
- ✅ YYYYMMDD format (20251128)
- ✅ DD.MM.YYYY format (28.11.2025)
- ✅ YYYY-MM-DD format (2025-11-28)
- ✅ DD/MM/YYYY format (28/11/2025)
- ✅ DateTime objects
- ✅ Invalid dates (fallback to today)
- ✅ None values (fallback to today)

**European Location Detection** (Lines 112-160)
- ✅ Spanish locations (Barcelona, Madrid, ESP)
- ✅ French locations (Paris, Nice, FRA)
- ✅ German locations (Berlin, Munich, GER)
- ✅ Greek locations (Athens, GRE)
- ✅ Case insensitivity
- ✅ Russia exclusion (Moscow, Petersburg)
- ✅ Asian countries exclusion (Dubai, Singapore, Malaysia)
- ✅ American countries exclusion (USA, Canada, Mexico)
- ✅ Unknown locations return False

**Category Extraction** (Lines 162-228)
- ✅ Open category detection
- ✅ S50+/Senior detection
- ✅ Youth/Junior detection
- ✅ Women's tournaments
- ✅ Blitz time control
- ✅ Rapid time control
- ✅ Classical time control
- ✅ Default category (Classical)
- ✅ Multiple categories combined

**Tournament Filtering** (Lines 230-290)
- ✅ Open category filter
- ✅ Youth exclusion filter
- ✅ Mediterranean location filter
- ✅ Senior category filter
- ✅ Combined filters

**Excel Loading** (Lines 292-330)
- ✅ Load tournaments from Excel
- ✅ European filter applied
- ✅ Future dates only (tomorrow onwards)
- ✅ Non-existent file handling
- ✅ Non-European location filtering

**JSON Export** (Lines 332-390)
- ✅ Export tournaments to JSON
- ✅ Data validation (required fields)
- ✅ Unicode handling (España, etc.)
- ✅ Empty list handling

**Configuration** (Lines 392-415)
- ✅ Config loaded correctly
- ✅ Sets used for O(1) lookup

**Edge Cases** (Lines 417-440)
- ✅ Empty tournament lists
- ✅ Missing columns
- ✅ Column finding logic

### Integration Tests (test_scraper_integration.py)

**Scraper Execution** (Lines 25-82)
- ✅ Scraper runs with timeout protection (5 min)
- ✅ Actual data download (skipped in CI)
- ✅ JSON output structure validation

**Data Validation** (Lines 84-150)
- ✅ JSON structure correctness
- ✅ European tournaments only
- ✅ Future tournaments only (tomorrow onwards)

**Timeout Handling** (Lines 152-200)
- ✅ Browser library installation check
- ✅ Network timeout handling
- ✅ Graceful failure on timeout

**Performance** (Lines 202-240)
- ✅ Robot Framework startup time < 5s
- ✅ TournamentProcessor import time < 1s

## ✍️ Writing Tests

### Test Template

```python
import pytest
from TournamentProcessor import TournamentProcessor

class TestMyFeature:
    """Test suite for my new feature"""

    @pytest.fixture
    def processor(self):
        """Create processor instance"""
        return TournamentProcessor()

    def test_my_feature(self, processor):
        """Test description"""
        # Arrange
        input_data = "test"

        # Act
        result = processor.my_method(input_data)

        # Assert
        assert result == expected
```

### Best Practices

1. **Use Descriptive Names**: `test_parse_date_yyyymmdd` not `test_date1`
2. **One Assert Per Test**: Focus on one behavior
3. **Use Fixtures**: Share setup code with `@pytest.fixture`
4. **Mark Slow Tests**: Use `@pytest.mark.slow` for tests > 5 seconds
5. **Use Parametrize**: Test multiple inputs with `@pytest.mark.parametrize`
6. **Mock External Calls**: Don't rely on network in unit tests

### Example: Parametrized Test

```python
@pytest.mark.parametrize("date_str,expected_year,expected_month,expected_day", [
    ("20251128", 2025, 11, 28),
    ("20260115", 2026, 1, 15),
    ("20241231", 2024, 12, 31),
])
def test_parse_date_multiple(self, processor, date_str, expected_year, expected_month, expected_day):
    """Test date parsing with multiple inputs"""
    date = processor._parse_date(date_str)
    assert date.year == expected_year
    assert date.month == expected_month
    assert date.day == expected_day
```

## 🐛 Troubleshooting

### Common Issues

**Issue**: `ImportError: cannot import name 'TournamentProcessor'`
- **Solution**: Run pytest from project root: `pytest tests/`

**Issue**: `Browser library not found`
- **Solution**: Install Playwright browsers: `rfbrowser init`

**Issue**: Tests timeout in CI/CD
- **Solution**: Tests marked with timeout protection. Check Robot Framework logs in artifacts.

**Issue**: Coverage report not generated
- **Solution**: Run with coverage flag: `pytest --cov=TournamentProcessor`

**Issue**: Integration tests fail locally
- **Solution**: Check internet connection, chess-results.com may be slow/down

### Debug Tips

```bash
# Run with verbose output
pytest -vv

# Run with print statements visible
pytest -s

# Run with full traceback
pytest --tb=long

# Run specific test with debugging
pytest tests/python/test_tournament_processor.py::TestTournamentProcessor::test_my_test -vv -s
```

## 📈 Continuous Improvement

### Adding New Tests

1. Identify untested code with coverage report
2. Write test in appropriate file
3. Run test locally: `pytest tests/python/test_*.py -v`
4. Check coverage: `./run_tests.sh coverage`
5. Commit and push (CI will run tests)

### Test Checklist

- [ ] Test passes locally
- [ ] Test has descriptive name
- [ ] Test is focused (one behavior)
- [ ] Test is fast (< 5s) or marked as `@pytest.mark.slow`
- [ ] Test uses fixtures for setup
- [ ] Test doesn't depend on external state
- [ ] Test is marked appropriately (`unit`, `integration`, etc.)

## 📚 Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Robot Framework](https://robotframework.org/)
- [Coverage.py](https://coverage.readthedocs.io/)
- [GitHub Actions](https://docs.github.com/en/actions)

## 🆘 Getting Help

- Check test output carefully
- Review test logs in `robot_results/`
- Check GitHub Actions artifacts for CI failures
- Look at existing tests for examples
