# Testing Guide

## Test Coverage Summary

**Total: 296+ Tests** | **Pass Rate: 100%** | **JS unit coverage: ~88% of services/UI/utils (floors in `.c8rc.json`)**

### v3.0.0 Tests (Modular Architecture)

| Component | Tests | Coverage | Status |
|-----------|-------|----------|--------|
| **Service Unit Tests** | 211 tests | ~88% (see Code Coverage) | ✅ All run the real code |
| **Integration Tests** | 10 tests | 100% | ✅ Excellent |
| **E2E Tests (Playwright)** | 54+ tests | N/A | ✅ Excellent |
| **Performance Benchmarks** | 12 benchmarks | N/A | ✅ Good |
| **Python Backend** | 47 tests | ~95% | ✅ Excellent |
| **Python Integration** | 108 tests | ~95% | ✅ Excellent |
| **Meta-tests** | 12 tests | N/A | ✅ Good |
| **Parity Tests** | 8 tests | N/A | ✅ Good |
| **Total** | **296+ tests** | JS ~88% | ✅ |

### Test Breakdown by Category

#### Service Unit Tests (75 tests)
- **CacheManager** (15 tests) - localStorage operations, versioning, TTL
- **FilterService** (15 tests) - Multi-criteria filtering, sorting, caching
- **ExportService** (18 tests) - CSV export, iCalendar (RFC 5545)
- **DataService** (12 tests) - HTTP mocking, CORS fallback, caching
- **UIManager** (15 tests) - jsdom DOM testing, rendering, skeletons

#### Integration Tests (10 tests)
- Full workflow testing (Fetch → Filter → Export)
- Service composition scenarios
- Cache integration
- Multi-filter combinations

#### E2E Tests (54+ tests)
- **Search & Filter** (10 tests) - User search flows
- **Exports** (5 tests) - CSV and calendar downloads
- **Accessibility** (12 tests) - WCAG 2.1 AA compliance, screen readers
- **Keyboard Navigation** (15 tests) - Tab order, shortcuts, focus management
- **Dark Mode & UI** (12 tests) - Theme switching, responsive design

#### Performance Benchmarks (12 benchmarks)
- Filter performance (10, 100, 1000 items)
- Sort performance (3 dataset sizes)
- Export performance (CSV generation)
- Cache operations (save/load)
- Full pipeline (filter + sort)

## Running Tests

### Quick Start

```bash
# Run ALL tests (296+ tests)
npm test

# Service unit tests only (75 tests)
npm run test:services

# Integration tests (10 tests)
npm run test:integration:services

# E2E tests (54 tests)
npm run test:e2e

# Performance benchmarks (12 benchmarks)
npm run test:benchmark

# Code coverage report
npm run test:coverage
```

### Service Unit Tests

```bash
# All service tests (75 tests)
npm run test:services

# Individual services
npm run test:services:cache       # CacheManager (15 tests)
npm run test:services:filter      # FilterService (15 tests)
npm run test:services:export      # ExportService (18 tests)
npm run test:services:data        # DataService (12 tests)
npm run test:services:ui          # UIManager (15 tests)
```

### Integration Tests

```bash
# Service integration tests (10 tests)
npm run test:integration:services

# Python integration tests (108 tests)
npm run test:integration:python

# All integration tests
npm run test:integration
```

### E2E Tests (Playwright)

```bash
# All E2E tests (54+ tests)
npm run test:e2e

# Headed mode (see browser)
npm run test:e2e:headed

# UI mode (interactive)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Specific browsers
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Mobile devices
npm run test:e2e:mobile
```

### Performance Tests

```bash
# Run all benchmarks (12 tests)
npm run test:benchmark

# Output shows ops/sec for:
# - Filter 10/100/1000 tournaments
# - Sort 10/100/1000 tournaments
# - Export 10/100/1000 to CSV
# - Cache save/load (100 items)
# - Full filter + sort pipeline
```

### Code Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# Coverage floors (c8, .c8rc.json) - just under the current numbers,
# raise them as coverage improves: lines/statements/functions 85%,
# branches 80%. Scope: src/services (not MapView/FilterSheet) + src/utils
```

### Python Tests

```bash
# All Python tests (67 tests)
python3 -m pytest tests/python -v

# Backend only (47 tests)
npm run test:python

# Meta-tests only (12 tests)
npm run test:meta

# Parity tests only (8 tests)
npm run test:parity
```

## Test Architecture

### 1. Service Unit Tests (75 tests)

**Philosophy**: Isolated testing with mocked dependencies

#### CacheManager Tests (15 tests)
**File**: `tests/unit/services/test_CacheManager.spec.js`

**What it tests**:
- Save/load data with JSON serialization
- Version checking (cache invalidation)
- TTL validation (24-hour expiration)
- Cache key constants
- Clear operations (single/all)

**Mock strategy**: Mock localStorage

**Example**:
```javascript
test('Cache expires after TTL', () => {
    const cache = new CacheManager();
    cache.saveToCache('test', { data: 'value' });

    // Simulate time passing (25 hours)
    mockTime(25 * 60 * 60 * 1000);

    const result = cache.loadFromCache('test');
    assertEqual(result, null); // Should be expired
});
```

#### FilterService Tests (15 tests)
**File**: `tests/unit/services/test_FilterService.spec.js`

**What it tests**:
- Open category filtering
- Mediterranean location detection
- Senior (S50+) category filtering
- Youth tournament exclusion
- Women's tournaments
- Team tournament filtering
- Time control filtering (classical, rapid, blitz)
- Date range filtering
- Country filtering
- Sorting (date, name, location)
- Filter cache (FIFO eviction)

**Mock strategy**: Pure functions, no mocks needed

**Example**:
```javascript
test('Filter Mediterranean locations', () => {
    const service = new FilterService();
    const tournaments = [
        { location: 'Barcelona, ESP', ... },
        { location: 'Madrid, ESP', ... }
    ];
    const medLocations = new Set(['barcelona']);

    const filtered = service.filterTournaments(
        tournaments,
        { mediterraneanOnly: true },
        medLocations
    );

    assertEqual(filtered.length, 1); // Only Barcelona
});
```

#### ExportService Tests (18 tests)
**File**: `tests/unit/services/test_ExportService.spec.js`

**What it tests**:
- CSV export with proper escaping
- iCalendar (RFC 5545) generation
- Special character handling (commas, quotes, newlines)
- Tournament ID generation
- Date formatting for ICS
- Description cleaning (HTML removal)
- Safe filename generation
- CRLF line endings
- Empty data handling

**Mock strategy**: No mocks, test output validation

**Example**:
```javascript
test('CSV escapes special characters', () => {
    const service = new ExportService();
    const tournaments = [{
        name: 'Tournament, with "quotes"',
        location: 'Barcelona',
        date: new Date('2025-06-01'),
        category: 'Open'
    }];

    const csv = service.exportToCSV(tournaments);
    assertContains(csv, '"Tournament, with ""quotes"""');
});
```

#### DataService Tests (12 tests)
**File**: `tests/unit/services/test_DataService.spec.js`

**What it tests**:
- Fetch from cache (strategy 0)
- Fetch from local file (strategy 1)
- CORS proxy fallback (strategy 2)
- HTTP fetch mocking (custom implementation)
- Date parsing (multiple formats)
- Tournament parsing
- Error handling
- Cache integration

**Mock strategy**: Custom fetch mock (no external libraries)

**Example**:
```javascript
global.fetch = async (url) => {
    if (url === '/tournaments_data.json') {
        return {
            ok: true,
            json: async () => mockTournamentData
        };
    }
    return { ok: false };
};

test('Fetch tournaments from local file', async () => {
    const service = new DataService(cacheManager);
    const tournaments = await service.fetchTournaments();
    assertEqual(tournaments.length, 3);
});
```

#### UIManager Tests (15 tests)
**File**: `tests/unit/services/test_UIManager.spec.js`

**What it tests**:
- Loading skeletons (6 animated cards)
- Tournament card rendering
- Empty state handling
- Results count updates
- Error/warning/success messages
- Dark mode toggle
- Export button visibility
- DOM manipulation
- Pagination

**Mock strategy**: jsdom for DOM testing

**Example**:
```javascript
const { JSDOM } = require('jsdom');

test('Show loading skeletons', () => {
    setupDOM(); // Creates virtual DOM
    const ui = new UIManager();

    ui.showLoadingSkeletons();

    const skeletons = document.querySelectorAll('.skeleton-card');
    assertEqual(skeletons.length, 6);
    assertEqual(skeletons[0].getAttribute('aria-hidden'), 'true');
});
```

### 2. Integration Tests (10 tests)

**Philosophy**: Services working together with realistic workflows

**File**: `tests/integration/test_services_integration.spec.js`

**What it tests**:
- Full workflow: Fetch → Filter → Sort → Export
- Data caching across multiple fetches
- Filter and sort combination
- Date range filtering
- Multiple filters combined
- Cache manager integration
- Service composition patterns
- Empty results handling

**Example**:
```javascript
test('Realistic user workflow', async () => {
    // Setup all services
    const cacheManager = new CacheManager();
    const dataService = new DataService(cacheManager);
    const filterService = new FilterService();
    const exportService = new ExportService();

    // User flow:
    // 1. Fetch all tournaments
    const all = await dataService.fetchTournaments();

    // 2. Apply filters: Mediterranean + Open only
    const filtered = filterService.filterTournaments(
        all,
        { openOnly: true, mediterraneanOnly: true },
        new Set(['barcelona', 'athens'])
    );

    // 3. Sort by date
    const sorted = filterService.sortTournaments(filtered, 'date-asc');

    // 4. Export to CSV
    const csv = exportService.exportToCSV(sorted);

    // Verify results
    assertEqual(sorted.length, 2);
    assertContains(csv, 'Barcelona Open');
});
```

### 3. E2E Tests (54+ tests)

**Philosophy**: Full browser testing with Playwright

**Framework**: Playwright (Chromium, Firefox, WebKit)

#### Search & Filter Tests (10 tests)
**File**: `tests/e2e/search-and-filter.spec.ts`

- Basic search functionality
- Filter toggles (open, Mediterranean, senior, etc.)
- Date range selection
- Country dropdown
- Results update on filter change
- Filter combinations
- Clear filters
- No results handling
- Loading states
- Error states

#### Export Tests (5 tests)
**File**: `tests/e2e/exports.spec.ts`

- CSV export downloads
- Calendar (.ics) export
- Export button visibility
- File naming
- Content validation

#### Accessibility Tests (12 tests)
**File**: `tests/e2e/accessibility.spec.ts`

- WCAG 2.1 AA compliance
- ARIA labels for screen readers
- Semantic HTML roles
- Color contrast (4.5:1 ratio)
- Focus indicators
- Alternative text
- Heading hierarchy
- Form labels
- Keyboard accessibility
- Skip links
- Language attributes
- Document title

**Tools**: @axe-core/playwright

**Example**:
```typescript
test('Page is accessible', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
});
```

#### Keyboard Navigation Tests (15 tests)
**File**: `tests/e2e/keyboard-navigation.spec.ts`

- Tab order (logical flow)
- Enter key submits search
- Escape closes modals
- Space toggles checkboxes
- Arrow keys in dropdowns
- Shift+Tab reverse navigation
- Focus visible indicators
- Focus trapping in modals
- Skip to main content
- Keyboard shortcuts

#### Dark Mode & UI Tests (12 tests)
**File**: `tests/e2e/dark-mode-and-ui.spec.ts`

- Theme toggle functionality
- Theme persistence (localStorage)
- Responsive design (mobile/tablet/desktop)
- Loading skeletons
- Empty states
- Error messages
- Success messages
- Pagination
- Tournament cards
- Filter panel collapse
- Results count

### 4. Performance Benchmarks (12 benchmarks)

**Philosophy**: Measure ops/sec across dataset sizes

**Framework**: Benchmark.js

**File**: `tests/performance/benchmark.spec.js`

**Benchmarks**:
1. Filter 10 tournaments (~3M ops/sec)
2. Filter 100 tournaments (~344K ops/sec)
3. Filter 1000 tournaments (~32K ops/sec)
4. Sort 10 tournaments
5. Sort 100 tournaments
6. Sort 1000 tournaments
7. Export 10 to CSV (~68K ops/sec)
8. Export 100 to CSV (~6.7K ops/sec)
9. Export 1000 to CSV (~669 ops/sec)
10. Cache save (100 items)
11. Cache load (100 items)
12. Filter + Sort pipeline (100 items)

**Performance insights**:
- Filtering scales sub-linearly: 91.6x slowdown for 100x data (excellent!)
- Sorting scales as expected: O(n log n)
- Export scales linearly with data size

**Example output**:
```
📊 Filter 10 tournaments           3,000,000 ops/sec ±1.2%
📊 Filter 100 tournaments            344,000 ops/sec ±0.8%
📊 Filter 1000 tournaments            32,700 ops/sec ±1.5%
📊 Export 100 to CSV                   6,700 ops/sec ±1.1%
```

### 5. Python Backend Tests (47 tests)

**File**: `tests/python/test_tournament_processor_*.py` (fixtures in `tests/python/conftest.py`)

**Coverage**: ~95% of backend code

**What it tests**:
- Date parsing (7 tests) - YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
- European location detection (8 tests)
- Category extraction (8 tests)
- Tournament filtering (11 tests)
- Excel loading (3 tests)
- JSON export (3 tests)
- Configuration (2 tests)
- Edge cases (5 tests)

### 6. Code Coverage

**Tool**: c8 (modern coverage for ES modules)

**Configuration**: `.c8rc.json`
```json
{
  "include": ["dist-test/**/*.js", "src/services/…", "src/utils/**/*.ts"],
  "exclude-after-remap": true,
  "check-coverage": true, "lines": 85, "statements": 85, "functions": 85, "branches": 80
}
```

**Reports**:
- HTML: `coverage/index.html` (interactive)
- LCOV: `coverage/lcov.info` (CI/CD)
- JSON: `coverage/coverage-final.json`
- Text: Console summary

**Current coverage** (Sep 2026): ~88% of lines. Every unit suite loads the real code from `dist-test/` (source-mapped to `src/`) via `tests/helpers/production.js` - never a copy pasted into the spec (CacheManager, DataService, UIManager and FilterService used to, and had drifted). UIManager runs against the real index.html in jsdom. `src/app/`, MapView and FilterSheet are covered by Playwright, not c8. CI runs this in the JavaScript/Frontend Tests job

## CI/CD Integration

Tests run automatically on:
- Every push to any branch
- Every pull request
- Scheduled daily runs

**GitHub Actions workflows**:
1. **Unit Tests** - All service tests
2. **Integration Tests** - Service composition + Python
3. **E2E Tests** - Playwright across 3 browsers
4. **Performance Tests** - Benchmarks (informational)
5. **Coverage Reports** - Upload to artifacts

**Workflow stages**:
```
Type Check → Lint → Build → Unit Tests → Integration → E2E → Deploy
```

## Test Philosophy

### Service Unit Tests
- ✅ **Isolated** - Each service tested independently
- ✅ **Fast** - Run in < 5 seconds
- ✅ **Coverage** - ~88% of services/UI/utils, with a floor so it can't drop
- ✅ **Mocked** - No external dependencies

### Integration Tests
- ✅ **Realistic** - Real workflows
- ✅ **Composed** - Services working together
- ✅ **Fast** - Run in < 2 seconds
- ✅ **Cached** - Minimal setup

### E2E Tests
- ✅ **User-focused** - Test real user scenarios
- ✅ **Cross-browser** - Chromium, Firefox, WebKit
- ✅ **Accessible** - WCAG 2.1 AA compliance
- ✅ **Comprehensive** - 54+ tests

### Performance Tests
- ✅ **Measurable** - ops/sec metrics
- ✅ **Comparable** - Track regressions
- ✅ **Informational** - No strict thresholds
- ✅ **Scalable** - Multiple dataset sizes

## Adding New Tests

### Service Unit Test

```javascript
// tests/unit/services/test_MyService.spec.js

test('My new feature works correctly', () => {
    const service = new MyService();
    const result = service.myMethod(input);
    assertEqual(result, expected, 'Should return expected value');
});
```

### Integration Test

```javascript
// tests/integration/test_services_integration.spec.js

test('Services work together for workflow', async () => {
    const service1 = new Service1();
    const service2 = new Service2(service1);

    const result = await service2.performWorkflow();
    assertEqual(result.success, true);
});
```

### E2E Test

```typescript
// tests/e2e/my-feature.spec.ts

import { test, expect } from '@playwright/test';

test('User can use new feature', async ({ page }) => {
    await page.goto('/');
    await page.click('#myFeatureButton');
    await expect(page.locator('.result')).toBeVisible();
});
```

### Performance Benchmark

```javascript
// tests/performance/benchmark.spec.js

suite.add('My operation (100 items)', () => {
    const service = new MyService();
    service.operation(mediumDataset);
});
```

## Performance Targets

| Operation | Target | Current | Status |
|-----------|--------|---------|--------|
| Filter 100 items | > 100K ops/sec | ~344K ops/sec | ✅ |
| Sort 100 items | > 50K ops/sec | > 50K ops/sec | ✅ |
| Export 100 to CSV | > 5K ops/sec | ~6.7K ops/sec | ✅ |
| Full pipeline | > 5K ops/sec | > 5K ops/sec | ✅ |

## Test Maintenance

### Weekly
- Review failed tests in CI/CD
- Update snapshots if needed
- Check coverage reports

### Monthly
- Review performance benchmarks
- Update E2E tests for new features
- Refactor flaky tests

### Quarterly
- Audit test coverage gaps
- Update testing dependencies
- Review testing strategy

## Troubleshooting

### Tests Failing Locally

```bash
# Clean and rebuild
npm run clean
npm install
npm run build

# Run specific test
npm run test:services:cache
```

### E2E Tests Timing Out

```bash
# Run in headed mode to debug
npm run test:e2e:headed

# Or use UI mode
npm run test:e2e:ui
```

### Coverage Too Low

```bash
# Generate detailed report
npm run test:coverage

# View in browser
open coverage/index.html

# Focus on uncovered lines
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Benchmark.js Documentation](https://benchmarkjs.com/)
- [c8 Coverage Tool](https://github.com/bcoe/c8)
- [jsdom Documentation](https://github.com/jsdom/jsdom)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last Updated**: 2025-11-19
**Total Tests**: 296+
**Pass Rate**: 100%
**Coverage**: JS ~88% of services/UI/utils
**Status**: ✅ All tests passing
