# Common Tasks

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

## Common Tasks

### Task 1: Adding a New Filter

**Which level does it belong in?**

The filters-card is two levels: `.filter-primary` (always visible — the
Seaside/Senior mode switch, date range, Time Control, Mediterranean Seaside
Only) and `<details id="advancedFilters">` (the "More filters" drawer —
everything else, including the Senior 50+/60+ checkboxes the mode switch
also drives). Default new filters to the drawer unless the filter is as
fundamental to the product as the ones above; the primary bar is
deliberately small so the first tournament card stays near the top of the
page. Filtering is live (`app.ts`'s `handleFilterChange()` /
`applyFiltersAndRender()`) — a new filter's `change` listener should call
into that same path rather than requiring a Search click.

**Steps:**
1. Update `FilterState` interface in `src/types.ts`
2. Add filter logic in `FilterService.filterTournaments()` method
3. Add checkbox/input in `index.html`, inside `.filter-primary` or inside
   `<details id="advancedFilters">` per the rule above
4. Wire up event listener in `app.ts`
5. If it lives in the drawer, add it to `updateAdvancedFilterCount()` in
   `app.ts` (compare against its default; `openOnly`/`excludeYouth` ship
   checked, so for those "active" means *unchecked*) — otherwise a filter
   that narrows results won't show up in the drawer's badge or auto-open it
6. Add unit tests in `tests/unit/services/test_FilterService.spec.js`
7. Add E2E test in `tests/e2e/search-and-filter.spec.ts`. On phones
   (<= 768px, the Mobile Chrome / Mobile Safari projects) the whole filters
   card is a bottom sheet (`src/services/FilterSheet.ts`): call
   `openFilters(page)` before using any control in it and `closeFilters(page)`
   before touching the results behind it; `setMode(page, mode)` clicks the
   Seaside/Senior switch, which sits above the results there. If the new
   control lives in the drawer, call `openAdvancedFilters(page)` (from
   `tests/e2e/_fixtures.ts`; it opens the sheet first) before interacting with it — either in the
   spec's `beforeEach`, or inline in just the tests that drive it if the spec
   asserts keyboard tab order (see `accessibility.spec.ts` /
   `keyboard-navigation.spec.ts` for that pattern)

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
