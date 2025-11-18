# medtourney

[![Update Tournament Data Daily](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml)
[![Run Tests](https://github.com/kobolcs/medtourney/actions/workflows/test.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/test.yml)
[![Security Scanning](https://github.com/kobolcs/medtourney/actions/workflows/security.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/security.yml)

Advanced chess tournament search tool for chess-results.com with powerful filtering capabilities.

**Version 2.3.0** - Now with filter persistence, calendar export, enhanced SEO, mobile UX improvements, and expanded tournament coverage!

## 🌐 Web Tool

**Use the live web tool here:** [https://kobolcs.github.io/medtourney/](https://kobolcs.github.io/medtourney/)

The web-based version provides an intuitive interface to search and filter chess tournaments directly in your browser. No installation required!

## Overview

This tool helps you search for European chess tournaments in the next 6 months with advanced filtering options. Unlike the basic search on chess-results.com, this tool allows you to:

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

### For Development (TypeScript)

If you want to contribute or modify the frontend code:

1. Install Node.js dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
# or for development with watch mode
npm run build:watch
```

3. Run linting and type checking:
```bash
npm run lint
npm run type-check
```

4. Install pre-commit hooks (recommended):
```bash
pip install -r requirements-dev.txt
pre-commit install
```

## Usage

### Web Tool

1. Visit [https://kobolcs.github.io/medtourney/](https://kobolcs.github.io/medtourney/)
2. Set your desired filters (date range, categories, locations)
3. Click "Search Tournaments"
4. Browse the results and click on tournaments for more details

### Data Scraper (Manual Updates)

The scraper uses Robot Framework with Browser Library to automate chess-results.com and download real tournament data.

**Note:** The scraper runs **automatically every day** via GitHub Actions. Manual running is optional.

**Quick Start (Local):**
```bash
python3 run_scraper.py
```

**Manual Trigger (GitHub Actions):**
1. Go to [Actions tab](https://github.com/kobolcs/medtourney/actions)
2. Select "Update Tournament Data Daily" workflow
3. Click "Run workflow" button
4. Select branch (main)
5. Click "Run workflow"

**What it does:**
1. Opens https://s1.chess-results.com/TurnierSuche.aspx?lan=1
2. Fills in the search form (current date to 6 months ahead) - **dynamic dates**
3. Downloads up to 5000 tournament results as Excel file
4. Processes the Excel file using custom Python keywords
5. Filters for European tournaments only (Russia excluded)
6. Exports results to `tournaments_data.json`

**Monitoring:**
- Check workflow status: [GitHub Actions](https://github.com/kobolcs/medtourney/actions)
- View logs: Click on any workflow run for detailed logs
- On failure: Robot Framework logs are uploaded as artifacts

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
- ✅ Next 6 months timeframe
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

### 🤖 Automated Daily Updates (GitHub Actions)

The tournament data is **automatically updated daily** via GitHub Actions:

**Daily at 00:00 UTC:**
1. GitHub Actions workflow triggers
2. Runs Robot Framework scraper in CI environment
3. Scrapes chess-results.com with **dynamic date range** (today → 6 months ahead)
4. Downloads up to 5000 tournaments
5. Filters for European tournaments (Russia excluded)
6. Updates `tournaments_data.json`
7. Auto-commits and pushes to main branch
8. GitHub Pages deploys the new data automatically

**Status:** [![Workflow Status](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml)

**Benefits:**
- ✅ Always up-to-date tournament data
- ✅ Dynamic date range (always "tomorrow to 3 months from now")
- ✅ Fully automated - no manual intervention needed
- ✅ Version controlled - every update is tracked in Git history
- ✅ Can be manually triggered from GitHub Actions UI

### Manual Workflow (Optional)

You can also run the scraper manually anytime:

1. **Run Data Scraper Locally**:
   ```bash
   python3 run_scraper.py
   ```
   This generates/updates `tournaments_data.json` with latest tournament data

2. **Commit and Push to GitHub**:
   ```bash
   git add tournaments_data.json
   git commit -m "Update tournament data"
   git push
   ```

3. **GitHub Pages Serves the JSON**:
   - `tournaments_data.json` is now available at `https://kobolcs.github.io/medtourney/tournaments_data.json`
   - No server or database needed - just static file hosting

4. **Web App Loads the Data**:
   - Users visit the web app
   - App fetches `tournaments_data.json` from the repo
   - Applies client-side filters
   - Shows results instantly

**Result**: Tournament data is version-controlled, automatically deployed, and requires no backend server!

### Web Tool
The web tool loads tournament data with this priority:
1. **First**: Tries to load `tournaments_data.json` from the repository (GitHub Pages)
2. **Fallback**: Attempts to fetch from chess-results.com via CORS proxies (may fail due to restrictions)
3. **Best Practice**: Keep `tournaments_data.json` updated by running the scraper regularly

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

---

## 🚀 Version 2.3.0 - What's New (MedTourney v3)

### Phase 1: SEO, Mobile UX, and Enhanced Empty States
- ✅ **Comprehensive SEO**: Meta tags, Open Graph, Schema.org structured data, sitemap.xml, robots.txt
- ✅ **Mobile-First UX**: 48x48px minimum touch targets (WCAG 2.1 AA), sticky search button on mobile
- ✅ **Enhanced Empty States**: Contextual suggestions when no results found, one-click reset filters
- ✅ **Social Sharing**: Rich previews for Twitter, Facebook, LinkedIn with Open Graph tags

### Phase 2.1: Filter Persistence
- ✅ **localStorage Integration**: Automatically saves and restores your filter preferences across sessions
- ✅ **Auto-save on Change**: Every filter adjustment is instantly saved
- ✅ **Seamless Experience**: Your preferred filters are restored when you return

### Phase 2.2: Calendar Export
- ✅ **.ics File Generation**: Export tournaments to Google Calendar, Apple Calendar, Outlook
- ✅ **RFC 5545 Compliant**: Industry-standard iCalendar format
- ✅ **Smart Reminders**: Automatic 1-day advance reminder for each tournament
- ✅ **One-Click Export**: Calendar button on every tournament card

### Phase 2.4: Scraper Optimization
- ✅ **Extended Coverage**: Date range increased from 3 months → **6 months** (+100% time coverage)
- ✅ **Higher Capacity**: Result limit increased from 2,000 → **5,000** (+150% capacity)
- ✅ **More Tournaments**: Expected 58-84% increase in tournament count (38 → 60-70 tournaments)
- ✅ **Configurable Range**: Easy to adjust date ranges via `${DATE_RANGE_MONTHS}` variable

### Test Coverage
- ✅ **41 automated tests** with **97.6% pass rate**
- ✅ **Unit tests**: Filter persistence, calendar export (23 tests, 100% pass)
- ✅ **Integration tests**: Scraper optimization (18 tests, 94.4% pass)
- ✅ **E2E tests**: UI validation with Robot Framework (15 test cases)

### Version 2.0 Foundation (TypeScript Migration)
- ✅ **Full TypeScript conversion** of frontend code
- ✅ **Strict type checking** with comprehensive interfaces
- ✅ **Better IDE support** with autocomplete and error detection
- ✅ **Source maps** for easier debugging

### Code Quality Improvements (v2.0)
- ✅ **MyPy type checking** for Python code
- ✅ **Ruff linting** - fast Python linter and formatter
- ✅ **ESLint** for TypeScript/JavaScript
- ✅ **Pre-commit hooks** to catch issues before commits

### Security Enhancements
- ✅ **Content Security Policy** headers
- ✅ **Dependency scanning** (Python and NPM)
- ✅ **CodeQL security analysis**
- ✅ **XSS protection** with HTML escaping

### Accessibility
- ✅ **WCAG 2.1 AA compliance** improvements
- ✅ **ARIA labels** for screen readers
- ✅ **Semantic HTML5** roles
- ✅ **Keyboard navigation** support

### CI/CD Enhancements
- ✅ **Type checking** in CI/CD pipeline
- ✅ **Automated linting** on every push
- ✅ **Security scans** daily
- ✅ **Multi-stage testing** (type → lint → build → test)

See [IMPROVEMENTS_REPORT.md](IMPROVEMENTS_REPORT.md) for detailed analysis and future roadmap.

---
