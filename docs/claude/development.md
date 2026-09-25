# Development Workflows & Commands

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

## Development Workflows

### Prerequisites

- **Node.js:** 24 (LTS; `.nvmrc`, same as CI). Node 20 reached end of life in April 2026, and jsdom 30 needs 22.22+/24.15+
- **Python:** 3.11+ (for scraper, backend tests; CI runs 3.14)
- **npm:** 9+ (package management)

### Initial Setup

```bash
# Clone repository
git clone https://github.com/kobolcs/medtourney.git
cd medtourney

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Initialize Robot Framework Browser
rfbrowser init

# Install Playwright browsers
npx playwright install --with-deps

# Install pre-commit hooks (recommended)
pre-commit install
```

### Development Mode

```bash
# Start Vite dev server with HMR (Hot Module Replacement)
npm run dev
# → http://localhost:3000

# Development build with watch mode
npm run build:watch
```

### Build Process

```bash
# Production build (Vite)
npm run build:vite
# Creates optimized bundle in dist/ with:
# - Terser minification (removes console.logs)
# - Tree-shaking (removes unused code)
# - Code splitting (better caching)
# - Gzip + Brotli compression
# - Compiled down to Safari 12 / Chrome 64 (build.target)

# TypeScript build only
npm run build

# Type checking (no emit)
npm run type-check

# Clean build artifacts
npm run clean
npm run rebuild
```

### Linting & Code Quality

```bash
# ESLint for TypeScript
npm run lint
npm run lint:fix

# Ruff for Python
ruff check .

# Type checking
npm run type-check      # TypeScript
mypy TournamentProcessor.py run_scraper.py geocode_tournaments.py  # Python
```

### Useful Commands Reference

```bash
# Development
npm run dev                      # Start dev server with HMR
npm run build:watch              # Build with watch mode

# Building
npm run build                    # TypeScript build
npm run build:vite               # Production build (Vite)
npm run preview                  # Preview production build
npm run clean                    # Clean build artifacts
npm run rebuild                  # Clean + build

# Testing
npm test                         # All 290+ tests
npm run test:services            # Unit tests (100 tests)
npm run test:e2e                 # E2E tests (68 tests)
npm run test:benchmark           # Performance benchmarks
npm run test:coverage            # Code coverage report

# Code Quality
npm run type-check               # TypeScript type checking
npm run lint                     # ESLint
npm run lint:fix                 # Auto-fix linting issues

# Scraper
python3 run_scraper.py           # Run scraper locally

# Git
git push -u origin <branch>      # Push with upstream tracking
gh pr create                     # Create pull request
```
