#!/bin/bash
# Test runner script for medtourney
# Provides multiple test modes for local development and CI/CD

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "======================================================================"
echo "                   MedTourney Test Suite Runner                      "
echo "======================================================================"
echo ""

# Parse command line arguments
TEST_MODE="${1:-all}"

case "$TEST_MODE" in
    unit)
        echo -e "${GREEN}Running UNIT tests only (fast)${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/python/ -v -m "unit or not integration" --cov=TournamentProcessor --cov-report=term-missing --cov-report=html
        ;;

    integration)
        echo -e "${YELLOW}Running INTEGRATION tests (may download data)${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/integration/ -v -m "integration" --timeout=600
        ;;

    fast)
        echo -e "${GREEN}Running FAST tests only (skip slow and integration)${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/python/ -v -m "not slow and not integration" --cov=TournamentProcessor --cov-report=term-missing
        ;;

    ci)
        echo -e "${YELLOW}Running CI/CD test suite (timeout-safe)${NC}"
        echo "----------------------------------------------------------------------"
        # Skip tests marked as ci_skip, use shorter timeouts
        pytest tests/ -v -m "not ci_skip" --timeout=300 --cov=. --cov-report=xml --cov-report=term-missing
        ;;

    coverage)
        echo -e "${GREEN}Running tests with detailed coverage report${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/python/ -v --cov=. --cov-report=html --cov-report=term-missing --cov-report=xml
        echo ""
        echo -e "${GREEN}Coverage report generated at: htmlcov/index.html${NC}"
        ;;

    parallel)
        echo -e "${GREEN}Running tests in PARALLEL (faster)${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/python/ -v -n auto --cov=TournamentProcessor --cov-report=term-missing
        ;;

    all)
        echo -e "${GREEN}Running ALL tests${NC}"
        echo "----------------------------------------------------------------------"
        pytest tests/ -v --cov=. --cov-report=html --cov-report=term-missing --timeout=600
        ;;

    help|--help|-h)
        echo "Usage: ./run_tests.sh [MODE]"
        echo ""
        echo "Available modes:"
        echo "  unit         - Run unit tests only (fast, no external dependencies)"
        echo "  integration  - Run integration tests (may download actual data)"
        echo "  fast         - Run fast tests only (skip slow and integration)"
        echo "  ci           - Run CI/CD test suite (timeout-safe, skip ci_skip tests)"
        echo "  coverage     - Run tests with detailed coverage report"
        echo "  parallel     - Run tests in parallel (faster on multi-core systems)"
        echo "  all          - Run all tests (default)"
        echo "  help         - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./run_tests.sh                  # Run all tests"
        echo "  ./run_tests.sh unit             # Run unit tests only"
        echo "  ./run_tests.sh ci               # Run CI/CD safe tests"
        echo "  ./run_tests.sh fast             # Run fast tests"
        echo ""
        exit 0
        ;;

    *)
        echo -e "${RED}Unknown test mode: $TEST_MODE${NC}"
        echo "Use './run_tests.sh help' for usage information"
        exit 1
        ;;
esac

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "======================================================================"
    echo -e "${GREEN}✓ All tests passed successfully!${NC}"
    echo "======================================================================"
    exit 0
else
    echo ""
    echo "======================================================================"
    echo -e "${RED}✗ Some tests failed!${NC}"
    echo "======================================================================"
    exit 1
fi
