# CLAUDE.md - AI Assistant Guide for MedTourney

**Last Updated:** 2025-11-21
**Version:** 3.0.0
**Purpose:** Comprehensive guide for AI assistants (like Claude) working on the MedTourney codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Architecture & Design Principles](#architecture--design-principles)
4. [Development Workflows](#development-workflows)
5. [Testing Strategy](#testing-strategy)
6. [Key Conventions & Patterns](#key-conventions--patterns)
7. [Common Tasks](#common-tasks)
8. [Git & Deployment](#git--deployment)
9. [File Locations Reference](#file-locations-reference)
10. [Important Notes for AI Assistants](#important-notes-for-ai-assistants)

---

## Project Overview

### What is MedTourney?

MedTourney is an **advanced chess tournament search tool** for discovering European chess tournaments, with a focus on:

- **Mediterranean seaside locations** (Barcelona, Nice, Athens, Malta, etc.)
- **Senior (S50+) category tournaments**
- **Open category tournaments** (accessible to all skill levels)
- **Adult tournaments** (excluding youth-only events)

### Key Statistics

- **Version:** 3.0.0
- **Total Tests:** 296+ tests with 100% pass rate
- **Code Coverage:** 70%+
- **Bundle Size:** 25KB gzipped (70% reduction from v2.0)
- **Architecture:** Modular service-oriented (5 specialized services)
- **Technologies:** TypeScript (strict mode), Vite, Playwright, Robot Framework, Python

### Live Application

- **Live URL:** https://kobolcs.github.io/medtourney/
- **GitHub:** https://github.com/kobolcs/medtourney
- **Deployment:** GitHub Pages with automated daily updates

---

## Codebase Structure

### Directory Layout

```
medtourney/
├── src/                          # TypeScript source code
│   ├── app.ts                    # Main application coordinator (573 lines)
│   ├── main.ts                   # Entry point
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── services/                 # Service modules (modular architecture)
│   │   ├── CacheManager.ts       # localStorage with versioning & TTL (136 lines)
│   │   ├── FilterService.ts      # Multi-criteria filtering (246 lines)
│   │   ├── DataService.ts        # 3-tier fetch strategy (210 lines)
│   │   ├── ExportService.ts      # CSV & iCalendar exports (163 lines)
│   │   └── UIManager.ts          # DOM manipulation & rendering (454 lines)
│   └── utils/
│       ├── Logger.ts             # Logging utility
│       └── validators.ts         # Input validation
│
├── tests/                        # Comprehensive test suite (296+ tests)
│   ├── unit/                     # Service unit tests (75 tests)
│   │   └── services/             # Isolated service testing
│   ├── integration/              # Service integration tests (10 tests)
│   ├── e2e/                      # Playwright E2E tests (54+ tests)
│   │   ├── search-and-filter.spec.ts
│   │   ├── exports.spec.ts
│   │   ├── accessibility.spec.ts
│   │   ├── keyboard-navigation.spec.ts
│   │   └── dark-mode-and-ui.spec.ts
│   ├── performance/              # Benchmark tests (12 benchmarks)
│   ├── python/                   # Backend tests (47 tests)
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
├── TournamentProcessor.py        # Python backend for scraping
├── scrape_tournaments.robot      # Robot Framework scraper
├── run_scraper.py                # Scraper entry point
│
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration (strict mode)
├── playwright.config.ts          # E2E test configuration
├── .eslintrc.json                # ESLint rules
├── ruff.toml                     # Python linting
├── .c8rc.json                    # Coverage thresholds
│
└── Documentation/
    ├── ARCHITECTURE.md           # Architecture deep-dive
    ├── TESTING.md                # Testing guide
    ├── DEPLOYMENT.md             # Deployment guide
    ├── README.md                 # User-facing documentation
    ├── QUICK_START_GUIDE.md      # Getting started
    └── PRD_MEDTOURNEY_3.0.md     # Product requirements
```

### Service Modules (Core Architecture)

The application follows a **modular service-oriented architecture**. Each service is independent and testable:

| Service | File | Lines | Responsibility |
|---------|------|-------|----------------|
| **CacheManager** | `src/services/CacheManager.ts` | 136 | localStorage operations with versioning & TTL |
| **FilterService** | `src/services/FilterService.ts` | 246 | Multi-criteria filtering with FIFO cache |
| **DataService** | `src/services/DataService.ts` | 210 | 3-tier fetch strategy (cache → local → CORS proxies) |
| **ExportService** | `src/services/ExportService.ts` | 163 | CSV and iCalendar (RFC 5545) exports |
| **UIManager** | `src/services/UIManager.ts` | 454 | DOM manipulation, loading skeletons, dark mode |

---

## Architecture & Design Principles

### Service-Oriented Design

**Before v3.0:** Monolithic 2,267-line `app.js` file
**After v3.0:** Modular architecture with 5 specialized services (-75% main file size)

### Design Principles

1. **Single Responsibility** - Each service has one clear purpose
2. **Dependency Injection** - Services receive dependencies via constructor
3. **No Circular Dependencies** - Clean dependency tree
4. **Separation of Concerns** - Logic ≠ Presentation ≠ Data
5. **Testability** - All services can be tested in isolation
6. **Type Safety** - Full TypeScript coverage with strict mode

### Dependency Tree

```
app.ts (Coordination Layer)
  ├── CacheManager (no dependencies)
  ├── FilterService (no dependencies)
  ├── DataService (depends on CacheManager)
  ├── ExportService (no dependencies)
  └── UIManager (no dependencies)
```

### Data Flow

```
User Action
  ↓
app.ts coordinates services
  ↓
UIManager shows loading skeleton
  ↓
DataService fetches data (cache → local → proxies)
  ↓
CacheManager saves/loads from localStorage
  ↓
FilterService applies multi-criteria filters
  ↓
FilterService sorts results
  ↓
UIManager renders tournament cards
  ↓
User sees results
```

---

## Development Workflows

### Prerequisites

- **Node.js:** 18+ (for TypeScript, Vite, Playwright)
- **Python:** 3.11+ (for scraper, backend tests)
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
# - Legacy browser support

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
mypy TournamentProcessor.py run_scraper.py  # Python
```

---

## Testing Strategy

### Test Coverage Summary

| Test Type | Count | Coverage | Purpose |
|-----------|-------|----------|---------|
| **Service Unit Tests** | 75 tests | 70%+ | Isolated service testing with mocks |
| **Integration Tests** | 10 tests | 100% | Services working together |
| **E2E Tests (Playwright)** | 54+ tests | N/A | Full browser testing (3 browsers) |
| **Performance Benchmarks** | 12 benchmarks | N/A | ops/sec measurement |
| **Python Backend** | 47 tests | ~95% | Backend unit tests |
| **Python Integration** | 108 tests | ~95% | Integration tests |
| **Total** | **296+ tests** | **70%+** | **100% pass rate** |

### Running Tests

```bash
# All tests (296+ tests)
npm test

# Service unit tests (75 tests) - FAST (~5 seconds)
npm run test:services

# Individual services
npm run test:services:cache       # CacheManager (15 tests)
npm run test:services:filter      # FilterService (15 tests)
npm run test:services:export      # ExportService (18 tests)
npm run test:services:data        # DataService (12 tests)
npm run test:services:ui          # UIManager (15 tests)

# Integration tests (10 tests)
npm run test:integration:services

# E2E tests (54+ tests)
npm run test:e2e                  # Headless (all browsers)
npm run test:e2e:headed           # See browser
npm run test:e2e:ui               # Interactive UI mode
npm run test:e2e:debug            # Debug mode
npm run test:e2e:chromium         # Chromium only
npm run test:e2e:mobile           # Mobile devices

# Performance benchmarks (12 benchmarks)
npm run test:benchmark

# Code coverage
npm run test:coverage
open coverage/index.html

# Python tests
npm run test:python               # Backend (47 tests)
npm run test:meta                 # Meta-tests (12 tests)
npm run test:parity               # Parity tests (8 tests)
```

### Test Philosophy

- **Unit Tests:** Isolated, fast (<5s), mocked dependencies, 70%+ coverage
- **Integration Tests:** Realistic workflows, services working together
- **E2E Tests:** User-focused scenarios, cross-browser, WCAG 2.1 AA compliance
- **Performance Tests:** Measurable metrics (ops/sec), track regressions

### Adding New Tests

**Service Unit Test:**
```typescript
// tests/unit/services/test_MyService.spec.js
test('My new feature works correctly', () => {
    const service = new MyService();
    const result = service.myMethod(input);
    assertEqual(result, expected, 'Should return expected value');
});
```

**E2E Test:**
```typescript
// tests/e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('User can use new feature', async ({ page }) => {
    await page.goto('/');
    await page.click('#myFeatureButton');
    await expect(page.locator('.result')).toBeVisible();
});
```

---

## Key Conventions & Patterns

### TypeScript Conventions

1. **Strict Mode Enabled** - Full type coverage, no implicit `any`
2. **ES2020 Target** - Modern JavaScript features
3. **Explicit Return Types** - All functions should have return type annotations
4. **Interface over Type** - Use `interface` for object shapes
5. **No Unused Variables** - Enforced by ESLint (prefix with `_` if intentional)
6. **camelCase** - Variables and functions
7. **PascalCase** - Classes and interfaces

### File Naming

- **TypeScript:** `PascalCase.ts` for classes (e.g., `CacheManager.ts`)
- **Tests:** `test_FileName.spec.js` or `test_FileName.spec.ts`
- **Configuration:** `lowercase.json` or `lowercase.config.ts`

### Code Style

```typescript
// Good: Explicit return type, clear naming
function filterTournaments(tournaments: Tournament[]): Tournament[] {
    return tournaments.filter(t => t.category.includes('Open'));
}

// Bad: No return type, unclear naming
function filter(t) {
    return t.filter(x => x.cat.includes('Open'));
}

// Good: Dependency injection
class DataService {
    constructor(private readonly cacheManager: CacheManager) {}
}

// Bad: Direct instantiation (hard to test)
class DataService {
    private cacheManager = new CacheManager();
}
```

### Git Commit Messages

Follow conventional commits format:

```
feat: Add Mediterranean location filter
fix: Correct date parsing for DD/MM/YYYY format
test: Add unit tests for ExportService CSV escaping
refactor: Extract filtering logic to FilterService
docs: Update CLAUDE.md with testing strategy
chore: Update dependencies to latest versions
```

### Branch Naming

- **Feature branches:** `feature/description` or `feat/description`
- **Bug fixes:** `fix/description`
- **Claude branches:** `claude/claude-md-{session-id}` (auto-generated)
- **Main branches:** `main` (production), `develop` (development)

---

## Common Tasks

### Task 1: Adding a New Filter

**Steps:**
1. Update `FilterState` interface in `src/types.ts`
2. Add filter logic in `FilterService.filterTournaments()` method
3. Add checkbox/input in `index.html`
4. Wire up event listener in `app.ts`
5. Add unit tests in `tests/unit/services/test_FilterService.spec.js`
6. Add E2E test in `tests/e2e/search-and-filter.spec.ts`

**Example:**
```typescript
// 1. Update FilterState (src/types.ts)
interface FilterState {
    // ... existing filters
    myNewFilter: boolean;
}

// 2. Add filter logic (src/services/FilterService.ts)
filterTournaments(tournaments: Tournament[], filterState: FilterState): Tournament[] {
    let filtered = tournaments;

    if (filterState.myNewFilter) {
        filtered = filtered.filter(t => /* your logic */);
    }

    return filtered;
}

// 3. Add HTML (index.html)
<label>
    <input type="checkbox" id="myNewFilter">
    My New Filter
</label>

// 4. Wire up event (app.ts)
const myNewFilterElement = document.getElementById('myNewFilter') as HTMLInputElement;
myNewFilterElement?.addEventListener('change', () => this.searchTournaments());

// 5. Add test (tests/unit/services/test_FilterService.spec.js)
test('Filter by my new criteria', () => {
    const service = new FilterService();
    const tournaments = [/* test data */];
    const filtered = service.filterTournaments(
        tournaments,
        { myNewFilter: true }
    );
    assertEqual(filtered.length, expectedCount);
});
```

### Task 2: Adding a New Service

**Steps:**
1. Create `src/services/MyNewService.ts`
2. Define interface and implement methods
3. Add dependency injection in constructor if needed
4. Wire up in `app.ts` constructor
5. Create `tests/unit/services/test_MyNewService.spec.js`
6. Update `ARCHITECTURE.md`

**Template:**
```typescript
// src/services/MyNewService.ts
import { Logger } from '../utils/Logger';

export class MyNewService {
    private readonly logger = Logger.createScoped('MyNewService');

    constructor(/* dependencies */) {
        this.logger.info('MyNewService initialized');
    }

    public myMethod(input: string): string {
        // Implementation
        return input.toUpperCase();
    }
}
```

### Task 3: Fixing a Bug

**Workflow:**
1. **Reproduce:** Write a failing test first (TDD approach)
2. **Locate:** Use grep/search to find relevant code
3. **Fix:** Make minimal changes to fix the issue
4. **Test:** Ensure new test passes and all existing tests still pass
5. **Commit:** Use conventional commit format

**Example:**
```bash
# 1. Write failing test
# tests/unit/services/test_CacheManager.spec.js
test('Bug: Cache should handle special characters', () => {
    const cache = new CacheManager();
    cache.saveToCache('test', { name: 'O\'Reilly' });
    const result = cache.loadFromCache('test');
    assertEqual(result.name, 'O\'Reilly');
});

# 2. Run test to confirm failure
npm run test:services:cache

# 3. Fix code in src/services/CacheManager.ts

# 4. Verify test passes
npm run test:services:cache

# 5. Run all tests
npm test

# 6. Commit
git add .
git commit -m "fix: Handle special characters in CacheManager"
```

### Task 4: Updating Documentation

**When to update documentation:**
- Adding new features → Update `README.md` and `ARCHITECTURE.md`
- Changing architecture → Update `ARCHITECTURE.md` and `CLAUDE.md`
- Adding tests → Update `TESTING.md`
- Changing deployment → Update `DEPLOYMENT.md`

**Always update:**
- Version numbers in `package.json`
- Last updated dates in documentation headers

### Task 5: Running the Data Scraper

**Automated (recommended):**
- Runs daily at 00:00 UTC via GitHub Actions
- Check status: https://github.com/kobolcs/medtourney/actions

**Manual (local):**
```bash
# Run scraper
python3 run_scraper.py

# This will:
# 1. Open chess-results.com in automated browser
# 2. Fill search form (today → 6 months ahead)
# 3. Download up to 5000 tournaments as Excel
# 4. Filter for European tournaments only
# 5. Export to tournaments_data.json

# View logs
# Results in robot_results/log.html
```

**Manual (GitHub Actions):**
1. Go to [Actions tab](https://github.com/kobolcs/medtourney/actions)
2. Select "Update Tournament Data Daily" workflow
3. Click "Run workflow" button
4. Select branch (main)
5. Click "Run workflow"

---

## Git & Deployment

### Branching Strategy

- **main** - Production branch (protected, auto-deploys to GitHub Pages)
- **develop** - Development branch (optional)
- **claude/*** - AI assistant branches (auto-generated with session IDs)
- **feature/*** - Feature development branches
- **fix/*** - Bug fix branches

### Git Workflow

**For AI assistants (Claude):**

1. **Always develop on designated branch**
   ```bash
   # Branch format: claude/claude-md-{unique-session-id}
   git checkout -b claude/claude-md-mi9e8nxitld5tmr7-016N1n6yMJcV5hz8UWQCXnJt
   ```

2. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: Add comprehensive CLAUDE.md documentation"
   ```

3. **Push to remote**
   ```bash
   # ALWAYS use -u flag for first push
   git push -u origin claude/claude-md-mi9e8nxitld5tmr7-016N1n6yMJcV5hz8UWQCXnJt

   # CRITICAL: Branch must start with 'claude/' and end with matching session ID
   # Otherwise push will fail with 403 error
   ```

4. **Retry logic for network failures**
   - Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s)
   - For both push and fetch/pull operations

### Creating Pull Requests

**Workflow:**
1. Run `git status` to see changes
2. Run `git diff` to review changes
3. Run `git log` and `git diff main...HEAD` to see all commits
4. Analyze ALL commits (not just latest)
5. Create PR with comprehensive summary

**Example:**
```bash
# Check status and changes
git status
git diff

# Review all commits for PR
git log --oneline
git diff main...HEAD

# Push if needed
git push -u origin claude/my-feature-branch

# Create PR using gh CLI
gh pr create --title "Add comprehensive CLAUDE.md" --body "$(cat <<'EOF'
## Summary
- Created comprehensive AI assistant guide (CLAUDE.md)
- Documents codebase structure, workflows, conventions
- Includes common task guides and troubleshooting

## Test plan
- [ ] Verify CLAUDE.md renders correctly on GitHub
- [ ] Review all sections for accuracy
- [ ] Ensure links work correctly
EOF
)"
```

### GitHub Actions CI/CD

**Workflows:**

1. **test.yml** - Comprehensive test pipeline
   - Type checking (mypy)
   - Linting (ruff, ESLint)
   - TypeScript build
   - Unit tests (75 tests)
   - Integration tests (10 tests)
   - E2E tests (54+ tests)
   - Performance benchmarks
   - Lighthouse CI
   - Runs on: push, PR, daily schedule

2. **deploy.yml** - 3-stage deployment
   - Stage 1: Build (Vite production build)
   - Stage 2: Deploy (GitHub Pages)
   - Stage 3: Health Check (verify deployment)
   - Runs on: push to main

3. **security.yml** - Security scanning
   - CodeQL analysis
   - Dependency scanning
   - Runs on: push, PR, schedule

4. **update-tournaments.yml** - Daily data update
   - Runs daily at 00:00 UTC
   - Executes Robot Framework scraper
   - Updates tournaments_data.json
   - Auto-commits and pushes to main

### Deployment Process

**Automatic (recommended):**
1. Merge PR to main
2. GitHub Actions automatically:
   - Runs all tests
   - Builds production bundle (Vite)
   - Deploys to GitHub Pages
   - Runs health check
3. Live in ~5 minutes: https://kobolcs.github.io/medtourney/

**Manual (for testing):**
```bash
# Build production bundle
npm run build:vite

# Preview locally
npm run preview
# → http://localhost:4173

# Deploy manually (not recommended)
# GitHub Pages auto-deploys from main branch
```

---

## File Locations Reference

### Core Application Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/app.ts` | Main application coordinator | 573 |
| `src/main.ts` | Entry point | ~20 |
| `src/types.ts` | Shared TypeScript interfaces | ~100 |
| `index.html` | Main HTML file | ~400 |
| `styles.css` | Application styles | ~800 |
| `config.json` | App configuration | ~200 |

### Service Modules

| File | Purpose | Lines |
|------|---------|-------|
| `src/services/CacheManager.ts` | localStorage with versioning & TTL | 136 |
| `src/services/FilterService.ts` | Multi-criteria filtering | 246 |
| `src/services/DataService.ts` | 3-tier fetch strategy | 210 |
| `src/services/ExportService.ts` | CSV & iCalendar exports | 163 |
| `src/services/UIManager.ts` | DOM manipulation & rendering | 454 |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and scripts |
| `tsconfig.json` | TypeScript compiler configuration (strict mode) |
| `vite.config.ts` | Vite build configuration |
| `playwright.config.ts` | Playwright E2E test configuration |
| `.eslintrc.json` | ESLint rules for TypeScript |
| `ruff.toml` | Python linting configuration |
| `.c8rc.json` | Code coverage thresholds |
| `.pre-commit-config.yaml` | Pre-commit hooks |

### Test Files

| Directory | Purpose | Count |
|-----------|---------|-------|
| `tests/unit/services/` | Service unit tests | 75 tests |
| `tests/integration/` | Integration tests | 10 tests |
| `tests/e2e/` | Playwright E2E tests | 54+ tests |
| `tests/performance/` | Benchmark tests | 12 benchmarks |
| `tests/python/` | Backend unit tests | 47 tests |

### Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **AI assistant guide (this file)** |
| `README.md` | User-facing documentation |
| `ARCHITECTURE.md` | Architecture deep-dive |
| `TESTING.md` | Comprehensive testing guide |
| `DEPLOYMENT.md` | Deployment guide |
| `QUICK_START_GUIDE.md` | Getting started guide |
| `PRD_MEDTOURNEY_3.0.md` | Product requirements document |

### Backend/Scraper Files

| File | Purpose |
|------|---------|
| `TournamentProcessor.py` | Python backend for tournament processing |
| `scrape_tournaments.robot` | Robot Framework scraper automation |
| `run_scraper.py` | Scraper entry point |
| `requirements.txt` | Python dependencies |

---

## Important Notes for AI Assistants

### When Working on This Codebase

1. **Always run tests before committing**
   ```bash
   npm test  # Runs all 296+ tests
   ```

2. **Follow TypeScript strict mode**
   - No `any` types (except in tests)
   - Explicit return types
   - Proper null checking

3. **Use the service architecture**
   - Don't add logic to `app.ts` - create/use services
   - Follow dependency injection pattern
   - Keep services isolated and testable

4. **Write tests for new features**
   - Unit tests for services
   - Integration tests for workflows
   - E2E tests for user scenarios

5. **Update documentation**
   - Update `ARCHITECTURE.md` for architectural changes
   - Update `TESTING.md` for test changes
   - Update this file (`CLAUDE.md`) for workflow changes

6. **Code review checklist**
   - [ ] All tests pass (`npm test`)
   - [ ] Type checking passes (`npm run type-check`)
   - [ ] Linting passes (`npm run lint`)
   - [ ] Code coverage maintained/improved
   - [ ] Documentation updated
   - [ ] Commit messages follow convention

### Security Considerations

1. **Never commit sensitive data**
   - No API keys, credentials, or secrets
   - Use environment variables for sensitive config

2. **Validate user input**
   - Use validators from `src/utils/validators.ts`
   - Sanitize data before rendering

3. **CORS considerations**
   - DataService uses CORS proxies for chess-results.com
   - Prefer local `tournaments_data.json` (updated daily)

4. **CSP headers**
   - Content Security Policy configured for GitHub Pages
   - Be mindful when adding external resources

### Performance Considerations

1. **Bundle size**
   - Current: 25KB gzipped (excellent)
   - Avoid large dependencies
   - Use tree-shaking friendly imports

2. **Filtering performance**
   - Current: ~344K ops/sec for 100 items
   - FilterService uses FIFO cache (50-item limit)
   - Sub-linear scaling maintained

3. **Cache strategy**
   - CacheManager handles localStorage with 24h TTL
   - Version checking prevents cache corruption
   - Always use CacheManager for localStorage operations

### Common Pitfalls to Avoid

1. **Don't modify existing tests without understanding them**
   - Tests document expected behavior
   - If test fails, fix code not test (unless test is wrong)

2. **Don't break the dependency tree**
   - No circular dependencies
   - Services should be independent
   - Use dependency injection

3. **Don't skip type annotations**
   - TypeScript strict mode is enabled
   - Explicit types catch errors early

4. **Don't push directly to main**
   - Always use feature branches
   - Create PRs for review
   - CI/CD must pass

5. **Don't forget mobile users**
   - 60%+ traffic is mobile
   - Test responsive design
   - WCAG 2.1 AA compliance required

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
npm test                         # All 296+ tests
npm run test:services            # Unit tests (75 tests)
npm run test:e2e                 # E2E tests (54+ tests)
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

---

## Getting Help

### Documentation Resources

1. **Architecture:** See `ARCHITECTURE.md` for detailed architecture
2. **Testing:** See `TESTING.md` for comprehensive testing guide
3. **Deployment:** See `DEPLOYMENT.md` for deployment instructions
4. **Quick Start:** See `QUICK_START_GUIDE.md` for getting started

### External Resources

- **Vite:** https://vitejs.dev/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Playwright:** https://playwright.dev/
- **Robot Framework:** https://robotframework.org/
- **WCAG 2.1:** https://www.w3.org/WAI/WCAG21/quickref/

### Support

- **GitHub Issues:** https://github.com/kobolcs/medtourney/issues
- **GitHub Actions:** https://github.com/kobolcs/medtourney/actions
- **Live App:** https://kobolcs.github.io/medtourney/

---

**End of CLAUDE.md**

*This document should be updated whenever significant changes are made to the codebase structure, workflows, or conventions.*
