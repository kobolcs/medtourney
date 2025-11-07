#!/usr/bin/env python3
"""
Run the Robot Framework tournament scraper
"""

import sys
import subprocess
from pathlib import Path


def main():
    """Run the Robot Framework test suite"""
    script_dir = Path(__file__).parent

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
    robot_file = script_dir / "scrape_tournaments.robot"

    cmd = [
        "robot",
        "--outputdir", str(script_dir / "robot_results"),
        "--loglevel", "INFO",
        str(robot_file)
    ]

    print(f"Running: {' '.join(cmd)}")
    print()

    result = subprocess.run(cmd)

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
