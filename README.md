# medtourney

[![Update Tournament Data Daily](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/update-tournaments.yml)
[![Run Tests](https://github.com/kobolcs/medtourney/actions/workflows/test.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/test.yml)
[![Security Scanning](https://github.com/kobolcs/medtourney/actions/workflows/security.yml/badge.svg)](https://github.com/kobolcs/medtourney/actions/workflows/security.yml)

Advanced chess tournament search tool for chess-results.com with powerful filtering capabilities and modular architecture.

**Version 3.0.0** - Modular service-oriented architecture, Vite bundler with 70% bundle size reduction, 296+ tests, and production-ready optimizations!

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

### For Development (TypeScript + Vite)

If you want to contribute or modify the frontend code:

1. Install Node.js dependencies:
```bash
npm install
```

2. **Development mode** (with hot module replacement):
```bash
npm run dev
# Vite dev server at http://localhost:5173
```

3. **Build for production** (Vite):
```bash
npm run build:vite
# Creates optimized bundle in dist/
# - Terser minification
# - Tree-shaking
# - Code splitting
# - Gzip + Brotli compression
```

4. **Preview production build**:
```bash
npm run preview
```

5. **Traditional TypeScript build**:
```bash
npm run build
# or for development with watch mode
npm run build:watch
```

6. **Run linting and type checking**:
```bash
npm run lint
npm run type-check
```

7. **Run tests**:
```bash
npm test                 # All 296+ tests
npm run test:services    # Service unit tests (75 tests)
npm run test:e2e         # Playwright E2E (54 tests)
npm run test:benchmark   # Performance benchmarks
npm run test:coverage    # Generate coverage report
```

8. **Install pre-commit hooks** (recommended):
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

**Total: 296+ Tests** | **Pass Rate: 100%** | **Coverage: 70%+**

Run the comprehensive test suite:

```bash
# All tests (296+ tests)
npm test

# Service unit tests (75 tests)
npm run test:services

# Integration tests (10 tests)
npm run test:integration:services

# E2E tests with Playwright (54 tests)
npm run test:e2e

# Performance benchmarks (12 benchmarks)
npm run test:benchmark

# Code coverage report
npm run test:coverage

# Python backend tests (47 tests)
python3 -m pytest tests/python -v
```

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

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

### Web Tool (v3.0.0)
- **Architecture:** Modular service-oriented (5 specialized services)
- **Technologies:** TypeScript (strict mode), HTML5, CSS3
- **Build System:** Vite with Terser minification, tree-shaking, code splitting
- **Bundle Size:** 70% reduction (80KB → 25KB gzipped)
- **Services:**
  - `CacheManager` - localStorage operations with TTL and versioning
  - `FilterService` - Multi-criteria filtering with FIFO cache
  - `DataService` - 3-tier fetch strategy (cache → local → CORS proxies)
  - `ExportService` - CSV and iCalendar (RFC 5545) export
  - `UIManager` - DOM manipulation, loading skeletons, dark mode
- **Performance:** Sub-linear filtering (344K ops/sec for 100 items)
- **Testing:** 296+ tests with 70%+ coverage
- **Hosting:** GitHub Pages with automated deployment
- **Features:** Responsive design, real-time filtering, offline-ready caching

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

## 🚀 Version 3.0.0 - What's New

### Major Architecture Overhaul
- ✅ **Modular Service-Oriented Architecture**: Refactored 2,267-line monolith into 5 specialized services (-75% main file size)
- ✅ **Service Modules**:
  - `CacheManager` (136 lines) - localStorage with versioning and TTL
  - `FilterService` (246 lines) - Multi-criteria filtering with FIFO cache
  - `DataService` (210 lines) - 3-tier fetch strategy with fallback
  - `ExportService` (163 lines) - CSV and RFC 5545 iCalendar
  - `UIManager` (454 lines) - DOM manipulation and loading skeletons
- ✅ **Dependency Injection**: Clean dependency tree, no circular dependencies
- ✅ **Testability**: Each service tested in isolation with mocked dependencies

### Production Build Optimizations
- ✅ **Vite Bundler**: Modern build system with HMR (Hot Module Replacement)
- ✅ **Bundle Size Reduction**: 70% smaller (80KB → 25KB gzipped)
- ✅ **Optimizations**:
  - Terser minification (removes console.logs)
  - Tree-shaking (removes unused code)
  - Code splitting (better caching)
  - Gzip + Brotli compression
  - Legacy browser support via @vitejs/plugin-legacy
- ✅ **Performance**: 344K ops/sec filtering, sub-linear scaling

### Advanced Testing Infrastructure
- ✅ **296+ Total Tests** with **100% pass rate**
- ✅ **Service Unit Tests** (75 tests) - Isolated testing with mocks
- ✅ **Integration Tests** (10 tests) - Services working together
- ✅ **E2E Tests** (54 tests) - Playwright across 3 browsers + 2 mobile devices
- ✅ **Performance Benchmarks** (12 benchmarks) - ops/sec measurement
- ✅ **Code Coverage**: 70%+ with c8 (HTML/LCOV/JSON reports)
- ✅ **Mock Testing**: Custom fetch mocking, jsdom for DOM tests
- ✅ **Accessibility Testing**: WCAG 2.1 AA compliance with @axe-core/playwright

### User Experience Improvements
- ✅ **Loading Skeletons**: 6 animated placeholder cards during data fetch
- ✅ **Deployment Automation**: 3-stage workflow (Build → Deploy → Health Check)
- ✅ **Error Handling**: Graceful fallbacks for network failures
- ✅ **Dark Mode**: Theme persistence with localStorage
- ✅ **Responsive Design**: Mobile-first with 48x48px touch targets

### v2.3.0 Features (Carried Forward)
- ✅ **Filter Persistence**: Auto-save preferences with localStorage
- ✅ **Calendar Export**: RFC 5545 .ics files with 1-day reminders
- ✅ **Extended Coverage**: 6-month date range, 5,000 tournament limit
- ✅ **SEO Optimization**: Meta tags, Open Graph, Schema.org, sitemap.xml
- ✅ **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation

### Code Quality & Security
- ✅ **TypeScript Strict Mode**: Full type coverage with ES2020 target
- ✅ **ESLint + Ruff**: Automated linting for TypeScript and Python
- ✅ **Pre-commit Hooks**: Catch issues before commits
- ✅ **Security Scanning**: CodeQL, dependency scanning, CSP headers
- ✅ **Lighthouse CI**: Performance budgets (85/100)

### Documentation
- ✅ **ARCHITECTURE.md**: Comprehensive architecture documentation
- ✅ **TESTING.md**: Testing guide with 296+ test documentation
- ✅ **DEPLOYMENT.md**: Vite build and deployment guide
- ✅ **QUICK_START_GUIDE.md**: Getting started guide

### Performance Metrics
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main file size | 2,267 lines | 573 lines | **-75%** |
| Bundle size (gzip) | ~40KB | ~12KB | **-70%** |
| Filter ops/sec (100 items) | ~200K | ~344K | **+72%** |
| Test coverage | 85 tests | 296+ tests | **+248%** |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and [TESTING.md](./TESTING.md) for comprehensive testing guide.

---
