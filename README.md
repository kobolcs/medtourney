# medtourney

Advanced chess tournament search tool for chess-results.com with powerful filtering capabilities.

## 🌐 Web Tool

**Use the live web tool here:** [https://kobolcs.github.io/medtourney/](https://kobolcs.github.io/medtourney/)

The web-based version provides an intuitive interface to search and filter chess tournaments directly in your browser. No installation required!

## Overview

This tool helps you search for European chess tournaments in the next 3 months with advanced filtering options. Unlike the basic search on chess-results.com, this tool allows you to:

- Filter for **Open category** tournaments
- Exclude **youth-only** tournaments (ensuring not all players are below 18)
- Filter for **S50+ (Senior)** category tournaments
- Filter for **Mediterranean seaside** locations
- Filter by specific **European countries**
- Combine multiple filters for precise searches

Available in two versions:
- **Web Tool**: User-friendly browser interface (recommended)
- **Data Scraper**: Robot Framework script to fetch fresh tournament data

## Installation

### Using the Web Tool (Recommended)

Simply visit [https://kobolcs.github.io/medtourney/](https://kobolcs.github.io/medtourney/) - no installation needed!

### Using the Data Scraper (For Updating Tournament Data)

1. Clone the repository:
```bash
git clone https://github.com/kobolcs/medtourney.git
cd medtourney
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Initialize Robot Framework Browser:
```bash
rfbrowser init
```

## Usage

### Web Tool

1. Visit [https://kobolcs.github.io/medtourney/](https://kobolcs.github.io/medtourney/)
2. Set your desired filters (date range, categories, locations)
3. Click "Search Tournaments"
4. Browse the results and click on tournaments for more details

### Data Scraper (Update Tournament Data)

The scraper uses Robot Framework with Browser Library to automate chess-results.com and download real tournament data.

**Quick Start:**
```bash
python3 run_scraper.py
```

**What it does:**
1. Opens https://s1.chess-results.com/TurnierSuche.aspx?lan=1
2. Fills in the search form (current date to 3 months ahead)
3. Downloads up to 2000 tournament results as Excel file
4. Processes the Excel file using custom Python keywords
5. Filters for European tournaments only (Russia excluded)
6. Exports results to `tournaments_data.json`

**Advanced Usage:**

Run the Robot Framework test directly:
```bash
robot scrape_tournaments.robot
```

View detailed logs:
```bash
# Results will be in robot_results/ directory
# Open robot_results/log.html in a browser for detailed execution log
```

**Manual Filtering:**

You can also use the custom Python keywords directly:
```python
from TournamentProcessor import TournamentProcessor

processor = TournamentProcessor()

# Load and filter tournaments
tournaments = processor.load_and_filter_tournaments('downloads/tournaments.xlsx')

# Apply additional filters
filtered = processor.filter_tournaments_by_criteria(
    tournaments,
    open_only=True,
    mediterranean_only=True,
    senior_only=True
)

# Export to JSON
processor.export_to_json(filtered, 'my_tournaments.json')
```

## Features

### Automatic Filters

By default, the tool applies these filters:
- ✅ European countries only
- ✅ Next 3 months timeframe
- ✅ Open category tournaments
- ✅ Tournaments with adult players (excludes youth-only events)

### Optional Filters

You can enable these additional filters:
- 🏖️ Mediterranean seaside locations (Barcelona, Nice, Split, Athens, Malta, etc.)
- 👴 S50+ (Senior/Veteran) category

### Supported Locations

**European Countries:** Albania, Andorra, Austria, Belarus, Belgium, Bosnia, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Monaco, Montenegro, Netherlands, North Macedonia, Norway, Poland, Portugal, Romania, Russia, San Marino, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Ukraine, United Kingdom

**Mediterranean Seaside:** Spain, France (Riviera), Italy, Greece, Croatia, Malta, Cyprus, Monaco, Albania, Montenegro, Slovenia (coast), Bosnia (coast)

## Testing

Run the test suite:

```bash
python3 -m pytest test_tournament_search.py -v
```

Or using unittest:

```bash
python3 test_tournament_search.py
```

## Example Output

```
Searching for European chess tournaments...
Date range: next 3 months (2025-11-07 to 2026-02-07)

Found 4 tournament(s):

================================================================================

Name: Barcelona Open Chess Championship 2025
Location: Barcelona, Spain
Date: 2025-11-22
Category: Open
Description: International open tournament with players of all ages
URL: https://chess-results.com/tournament1
--------------------------------------------------------------------------------

Name: Athens Senior Open
Location: Athens, Greece
Date: 2025-12-07
Category: Open, S50+
Description: Open tournament with special S50+ category
URL: https://chess-results.com/tournament2
--------------------------------------------------------------------------------
```

## Technical Details

### Web Tool
- **Technologies:** HTML5, CSS3, Vanilla JavaScript
- **Hosting:** GitHub Pages
- **Data Source:** chess-results.com (via CORS proxies or local data file)
- **Features:** Responsive design, real-time filtering, no backend required

### Data Scraper
- **Framework:** Robot Framework with Browser Library
- **Language:** Python 3.8+
- **Dependencies:** robotframework, robotframework-browser, openpyxl, python-dateutil
- **Architecture:**
  - Robot Framework test suite for browser automation
  - Custom Python keyword library for Excel processing
  - Modular filtering with European country detection
  - Automatic exclusion of non-European countries (Russia, Asia, Americas, etc.)

## How It Works

### Web Tool
The web tool attempts to fetch live tournament data from chess-results.com using CORS proxy services. If the fetch is unsuccessful, it can load data from a local `tournaments_data.json` file.

### Data Scraper
The scraper uses Robot Framework to:
1. **Automate Browser**: Opens chess-results.com search page using Browser Library (Playwright-based)
2. **Fill Form**: Automatically fills date range (today + 3 months) and sets result limit to 2000
3. **Download Excel**: Clicks the Excel download button and saves the file
4. **Process Data**: Uses custom Python keywords to:
   - Parse Excel file with openpyxl
   - Extract tournament name, location, date, category, URL
   - Filter for European countries only (strict checking)
   - Exclude non-European countries (Malaysia, UAE, Russia, etc.)
   - Export to JSON format

The custom Python keyword library (`TournamentProcessor.py`) provides reusable functions for:
- Loading and parsing Excel tournament data
- Filtering by geography, category, and date
- Exporting to JSON format
- Can be used standalone or within Robot Framework

## Contributing

Feel free to submit issues or pull requests to improve the tool.

## License

MIT License
