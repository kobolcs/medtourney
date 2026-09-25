# Testing Strategy

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

## Testing Strategy

### Test Coverage Summary

| Test Type | Count | Purpose |
|-----------|-------|---------|
| **Service Unit Tests** | 211 tests | Real service code (dist-test/), mocked fetch/localStorage/DOM |
| **Service Integration Tests** | 8 tests | Services working together |
| **E2E Tests (Playwright)** | 68 tests per project (chromium, firefox, webkit, Mobile Chrome, Mobile Safari, Microsoft Edge - `playwright.config.ts`) | Full browser + mobile-viewport testing |
| **Performance Benchmarks** | 12 benchmarks | ops/sec measurement |
| **Python (scraper, meta, parity)** | 87 tests | `tests/python/` - `TournamentProcessor.py` unit tests plus scraper-metadata and frontend/backend parity checks |
| **Python Integration** | 27 tests | `tests/integration/` - scraper file/config sanity checks (not live-network) |
| **Total** | **290+ tests** | **100% pass rate** as of this writing - see `npm test` / `pytest` output for current truth |

### Running Tests

```bash
# All tests (290+ tests)
npm test

# Service unit tests (211 tests) - FAST (~5 seconds)
npm run test:services

# Individual services
npm run test:services:cache       # CacheManager (15 tests)
npm run test:services:filter      # FilterService (15 tests)
npm run test:services:export      # ExportService (18 tests)
npm run test:services:data        # DataService (12 tests)
npm run test:services:ui          # UIManager (15 tests)

# Integration tests (8 tests)
npm run test:integration:services

# E2E tests (68 tests)
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
npm run test:python               # Backend (87 tests)
npm run test:meta                 # Meta-tests (12 tests)
npm run test:parity               # Parity tests (8 tests)
```

### Test Philosophy

- **Unit Tests:** Isolated, fast (<5s), mocked dependencies (`npm run test:coverage` for the current report)
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
