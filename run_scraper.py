#!/usr/bin/env python3
"""Run the Robot Framework tournament scraper.

This script executes the Robot Framework test suite that scrapes
chess tournament data from chess-results.com and processes it into
a JSON file for the web application.

Typical usage example:

    $ python3 run_scraper.py
"""

import subprocess
import sys
from pathlib import Path
from typing import List


def main() -> int:
    """Run the Robot Framework test suite.

    Executes the scrape_tournaments.robot file using the robot command,
    which automates the following process:
    1. Opens chess-results.com search page
    2. Fills in the search form (next 6 months)
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


    # Run robot framework
    robot_file: Path = script_dir / "scrape_tournaments.robot"

    cmd: List[str] = [
        "robot",
        "--outputdir", str(script_dir / "robot_results"),
        "--loglevel", "INFO",
        str(robot_file)
    ]


    result: subprocess.CompletedProcess[bytes] = subprocess.run(cmd, check=False)

    if result.returncode == 0:
        pass
    else:
        pass

    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
