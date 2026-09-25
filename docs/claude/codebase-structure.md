# Codebase Structure & File Locations

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

## Codebase Structure

### Directory Layout

```
medtourney/
├── src/                          # TypeScript source code
│   ├── app.ts                    # Main application coordinator (1,643 lines)
│   ├── app/                      # TournamentFinder's class chain: AppState (fields, constructor) + one *Part.ts per concern
│   ├── main.ts                   # Entry point
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── services/                 # Service modules (modular architecture)
│   │   ├── CacheManager.ts       # localStorage with versioning & TTL (168 lines)
│   │   ├── FilterService.ts      # Multi-criteria filtering (395 lines)
│   │   ├── DataService.ts        # 3-tier fetch strategy (319 lines)
│   │   ├── ExportService.ts      # CSV & iCalendar exports (330 lines)
│   │   ├── UIManager.ts          # DOM manipulation & rendering (807 lines)
│   │   ├── ui/                   # UIManager's class chain: UIState -> CardPart -> PaginationPart -> StatusViewsPart
│   │   ├── MapView.ts            # List/Map toggle's map (Leaflet + OSM tiles, lazy-loaded)
│   │   └── FilterSheet.ts        # Phones (<=768px): filters card as a bottom sheet
│   └── utils/
│       ├── Logger.ts             # Logging utility
│       ├── validators.ts         # Zod runtime schemas for fetched data
│       ├── countries.ts          # FED code -> name/flag-icon HTML for location display
│       ├── html.ts               # Shared escapeHTML() - see Security Considerations
│       ├── filterUrl.ts          # FilterState <-> URLSearchParams (shareable filtered links)
│       ├── timeControl.ts        # Scraped time control -> "90+30" notation
│       ├── durationLabel.ts      # Card duration pill ("Fri–Sun · 3 days")
│       ├── mapPlaces.ts          # Group tournaments into map markers (pure)
│       ├── seas.ts               # Seas + the Seaside rule (which coast counts)
│       ├── seaPicker.ts          # The Seaside mode's sea picker (DOM)
│       └── countrySelection.ts   # Country checklist selection (countries listed under 2+ regions)
│
├── tests/                        # Comprehensive test suite (290+ tests)
│   ├── unit/                     # Service unit tests (211 tests)
│   │   └── services/             # Isolated service testing
│   ├── integration/              # Service integration tests (8 tests)
│   ├── e2e/                      # Playwright E2E tests (68 tests)
│   │   ├── search-and-filter.spec.ts
│   │   ├── exports.spec.ts
│   │   ├── accessibility.spec.ts
│   │   ├── keyboard-navigation.spec.ts
│   │   └── dark-mode-and-ui.spec.ts
│   ├── performance/              # Benchmark tests (12 benchmarks)
│   ├── python/                   # Backend tests (87 tests)
│   └── javascript/               # Legacy JS tests
│
├── .github/workflows/            # GitHub Actions CI/CD
│   ├── test.yml                  # Comprehensive test pipeline
│   ├── deploy.yml                # 3-stage deployment workflow
│   ├── security.yml              # CodeQL & dependency scanning
│   └── update-tournaments.yml    # Daily data scraper automation
│
├── index.html                    # Main HTML file
├── styles.css                    # Application styles (dark mode support)
├── config.json                   # App configuration (countries, locations)
├── tournaments_data.json         # Tournament data (updated daily)
│
├── public/
│   ├── flags/                    # Self-hosted 20x15 flag icons (see countries.ts)
│   ├── robots.txt
│   └── sitemap.xml
│
├── TournamentProcessor.py        # Python backend for scraping
├── tournament_processing/        # TournamentProcessor mixins: excel, time_control, classify, config
├── scrape_tournaments.robot      # Robot Framework scraper
├── run_scraper.py                # Scraper entry point
├── geocode_tournaments.py        # CLI run after each scrape; the work is in geocoding/
├── geocoding/                    # places, geonames, coast, beachfront, airports, nominatim, geocoder, pipeline
├── geocode_cache.json            # Geocoding cache - committed, so daily runs only look up new places
├── data/southern_coast.json      # Coastline points per sea (med, atlantic, black, caspian) for the Seaside rule
├── data/airports.json            # Airports with airline routes + city (card's nearest-airport hint)
├── data/airport_cities.json      # City overrides where OurAirports gives a suburb (RMU -> Murcia)
├── scripts/                      # build_southern_coast.py, build_airports.py, og-image.html + render-og-image.mjs
│
├── vite.config.mts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration (strict mode)
├── playwright.config.ts          # E2E test configuration
├── eslint.config.mjs             # ESLint rules (flat config)
├── ruff.toml                     # Python linting
├── .c8rc.json                    # Coverage thresholds
│
└── Documentation/
    ├── ARCHITECTURE.md           # Architecture deep-dive
    ├── TESTING.md                # Testing guide
    ├── DEPLOYMENT.md             # Deployment guide
    └── README.md                 # User-facing documentation
```

### Service Modules (Core Architecture)

The application follows a **modular service-oriented architecture**. Each service is independent and testable:

| Service | File | Lines | Responsibility |
|---------|------|-------|----------------|
| **CacheManager** | `src/services/CacheManager.ts` | 168 | localStorage operations with versioning & TTL |
| **FilterService** | `src/services/FilterService.ts` | 395 | Multi-criteria filtering with FIFO cache |
| **DataService** | `src/services/DataService.ts` | 319 | 3-tier fetch strategy (cache → local → CORS proxies) |
| **ExportService** | `src/services/ExportService.ts` | 330 | CSV and iCalendar (RFC 5545) exports |
| **UIManager** | `src/services/UIManager.ts` | 807 | DOM manipulation, loading skeletons, dark mode |

## File Locations Reference

### Core Application Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/app.ts` | Main application coordinator | 1,643 |
| `src/app/*.ts` | TournamentFinder's class chain: `AppState` -> `ThemeHelpPart` -> ... -> `ResultsViewPart` -> `TournamentFinder` | - |
| `src/main.ts` | Entry point | 16 |
| `src/types.ts` | Shared TypeScript interfaces | 50 |
| `index.html` | Main HTML file | 481 |
| `styles.css` | Application styles | 2,467 |
| `config.json` | App configuration | 853 |

### Service Modules

| File | Purpose | Lines |
|------|---------|-------|
| `src/services/CacheManager.ts` | localStorage with versioning & TTL | 168 |
| `src/services/FilterService.ts` | Multi-criteria filtering | 395 |
| `src/services/DataService.ts` | 3-tier fetch strategy | 319 |
| `src/services/ExportService.ts` | CSV & iCalendar exports | 330 |
| `src/services/UIManager.ts` | DOM manipulation & rendering | 807 |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and scripts |
| `tsconfig.json` | TypeScript compiler configuration (strict mode) |
| `vite.config.mts` | Vite build configuration |
| `playwright.config.ts` | Playwright E2E test configuration |
| `eslint.config.mjs` | ESLint rules for TypeScript (flat config) |
| `ruff.toml` | Python linting configuration |
| `.c8rc.json` | Code coverage thresholds |
| `.pre-commit-config.yaml` | Pre-commit hooks |

### Test Files

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/unit/services/` | Service unit tests | 211 tests |
| `tests/integration/` | JS service integration + Python scraper integration (mixed dir) | 8 + 27 tests |
| `tests/e2e/` | Playwright E2E tests | 68 tests per browser |
| `tests/performance/` | Benchmark tests | 12 benchmarks |
| `tests/python/` | Backend unit tests (`TournamentProcessor.py`, scraper meta, frontend/backend parity) | 87 tests |

### Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **AI assistant guide (this file)** |
| `README.md` | User-facing documentation |
| `ARCHITECTURE.md` | Architecture deep-dive |
| `TESTING.md` | Comprehensive testing guide |
| `DEPLOYMENT.md` | Deployment guide |

### Backend/Scraper Files

| File | Purpose |
|------|---------|
| `TournamentProcessor.py` | Python backend for tournament processing |
| `tournament_processing/` | Its private helpers as mixins (Excel parsing, time control, classification, fallback config) |
| `scrape_tournaments.robot` | Robot Framework scraper automation |
| `run_scraper.py` | Scraper entry point |
| `requirements.txt` | Python dependencies |
