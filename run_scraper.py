#!/usr/bin/env python3
"""Run the Robot Framework tournament scraper.

This script executes the Robot Framework test suite that scrapes
chess tournament data from chess-results.com and processes it into
a JSON file for the web application.

Typical usage example:

    $ python3 run_scraper.py
"""

import sys
import subprocess
from pathlib import Path
from typing import List


def main() -> int:
    """Run the Robot Framework test suite.

    Executes the scrape_tournaments.robot file using the robot command,
    which automates the following process:
    1. Opens chess-results.com search page
    2. Fills in the search form (next 3 months)
    3. Downloads up to 2000 tournament results as Excel
    4. Processes and filters for European tournaments only
    5. Exports to tournaments_data.json

    Returns:
        Exit code: 0 for success, non-zero for failure.

    Example:
        >>> exit_code = main()
        ========================================================
        Chess Tournament Scraper - Robot Framework
        ========================================================
        ...
        ✓ Success! Tournament data saved to tournaments_data.json
    """
    script_dir: Path = Path(__file__).parent

    print("=" * 80)
    print("Chess Tournament Scraper - Robot Framework")
    print("=" * 80)
    print()
    print("This will:")
    print("1. Open chess-results.com search page")
    print("2. Fill in the search form (next 3 months)")
    print("3. Download up to 2000 tournament results as Excel")
    print("4. Process and filter for European tournaments only")
    print("5. Export to tournaments_data.json")
    print()
    print("=" * 80)
    print()

    # Run robot framework
    robot_file: Path = script_dir / "scrape_tournaments.robot"

    cmd: List[str] = [
        "robot",
        "--outputdir", str(script_dir / "robot_results"),
        "--loglevel", "INFO",
        str(robot_file)
    ]

    print(f"Running: {' '.join(cmd)}")
    print()

    result: subprocess.CompletedProcess[bytes] = subprocess.run(cmd)

    if result.returncode == 0:
        print()
        print("=" * 80)
        print("✓ Success! Tournament data saved to tournaments_data.json")
        print("=" * 80)
    else:
        print()
        print("=" * 80)
        print("✗ Error occurred. Check robot_results/log.html for details")
        print("=" * 80)

    return result.returncode


if __name__ == '__main__':
    sys.exit(main())
