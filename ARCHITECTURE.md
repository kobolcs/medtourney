# MedTourney Architecture

## Overview

MedTourney uses a **modular service-oriented architecture** with clear separation of concerns. The application was refactored in v3.0.0 from a monolithic 2,267-line file to a clean, maintainable structure with specialized service modules.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (Browser)                 │
│                      index.html + styles.css                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                   app.ts (Coordination Layer)                │
│                    573 lines │ -75% reduction                │
└───────┬──────────┬──────────┬──────────┬──────────┬─────────┘
        │          │          │          │          │
  ┌─────▼───┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────┐ ┌─▼──────────┐
  │ Cache   │ │ Filter │ │ Data   │ │ Export  │ │ UI         │
  │ Manager │ │ Service│ │ Service│ │ Service │ │ Manager    │
  └─────────┘ └────────┘ └────────┘ └─────────┘ └────────────┘
      │            │          │           │            │
  136 lines    246 lines  210 lines  163 lines   454 lines
```

## Service Modules

### 1. **CacheManager** (`src/services/CacheManager.ts`)

**Responsibility**: Manage all localStorage operations with versioning and TTL

**Features**:
- Save/load data with JSON serialization
- Version checking (prevents cache corruption across versions)
- TTL (Time To Live) validation (24-hour default)
- Cache key constants for consistency
- Type-safe generic methods

**Key Methods**:
```typescript
saveToCache<T>(key: string, data: T): void
loadFromCache<T>(key: string): T | null
clearCache(key?: string): void
clearAllCaches(): void
```

**Cache Keys**:
- `TOURNAMENTS` - Tournament data
- `CONFIG` - App configuration
- `THEME` - Dark/light mode preference
- `FILTERS_COLLAPSED` - Filter panel state
- `FILTER_PREFERENCES` - User's filter settings

**Dependencies**: None (uses browser localStorage)

---

### 2. **FilterService** (`src/services/FilterService.ts`)

**Responsibility**: Tournament filtering and sorting logic

**Features**:
- Multi-criteria filtering (category, location, date, time control)
- Sorting by date, name, location, country
- Filter result caching with FIFO eviction (50-item limit)
- Mediterranean location detection
- Youth/senior/women tournament detection
- Team tournament detection
- Time control filtering (classical, rapid, blitz)

**Key Methods**:
```typescript
filterTournaments(
  tournaments: Tournament[],
  filterState: FilterState,
  mediterraneanLocations: Set<string>
): Tournament[]

sortTournaments(tournaments: Tournament[], sortBy: string): Tournament[]
clearCache(): void
```

**Filter Criteria**:
- Open category only
- Exclude youth tournaments
- Mediterranean seaside locations
- Senior (S50+) category
- Women's tournaments
- Team tournaments (include/exclude)
- Time controls (classical, rapid, blitz)
- Date range
- Country

**Dependencies**: Types from `src/types.ts`

**Performance**:
- ~3M ops/sec for small datasets (10 items)
- ~344K ops/sec for medium datasets (100 items)
- ~32K ops/sec for large datasets (1000 items)
- Sub-linear scaling (91.6x slowdown for 100x data)

---

### 3. **DataService** (`src/services/DataService.ts`)

**Responsibility**: Fetch and parse tournament data with fallback strategies

**Features**:
- 3-tier fetch strategy with automatic fallback
- Multi-format date parsing (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY)
- Config file loading
- Automatic caching of fetched data
- Error handling with meaningful messages

**Fetch Strategy** (in order):
1. **Cache** - Load from localStorage if valid
2. **Local File** - Fetch `tournaments_data.json` from same origin
3. **CORS Proxies** - Try multiple proxies:
   - `api.allorigins.win`
   - `corsproxy.io`
   - Direct fetch (fallback)

**Key Methods**:
```typescript
async fetchTournaments(): Promise<Tournament[]>
async loadConfig(): Promise<AppConfig>
parseDate(dateStr: string): Date
private parseTournaments(data: any): Tournament[]
```

**Dependencies**: CacheManager

---

### 4. **ExportService** (`src/services/ExportService.ts`)

**Responsibility**: Export tournaments to various formats

**Features**:
- CSV export with proper escaping (commas, quotes, newlines)
- iCalendar (RFC 5545) export for calendar apps
- Unique tournament ID generation
- Safe filename generation
- Description cleaning (HTML removal, length limiting)
- CRLF line endings for cross-platform compatibility

**Key Methods**:
```typescript
exportToCSV(tournaments: Tournament[]): string
exportToCalendar(tournament: Tournament): string
generateTournamentId(tournament: Tournament): string
formatDateForICS(date: Date): string
cleanDescription(description: string): string
generateSafeFilename(name: string): string
```

**iCalendar Features**:
- STATUS: CONFIRMED
- 1-day reminder alarm
- Proper escape sequences for special characters
- Tournament URL included
- Location and description fields

**Dependencies**: None

**Performance**:
- ~68K ops/sec for 10 items
- ~6.7K ops/sec for 100 items
- ~669 ops/sec for 1000 items

---

### 5. **UIManager** (`src/services/UIManager.ts`)

**Responsibility**: All DOM manipulation and UI rendering

**Features**:
- Loading skeletons (6 animated placeholder cards)
- Tournament card rendering with pagination
- Empty state handling
- Error/warning/success messages
- Dark mode toggle
- Results count updates
- Export button visibility management

**Key Methods**:
```typescript
showLoadingSkeletons(): void
displayTournaments(tournaments: Tournament[]): void
updateDisplayedTournaments(tournaments: Tournament[]): void
showError(message: string, type?: 'error' | 'warning' | 'success'): void
toggleDarkMode(): void
updateResultsCount(count: number): void
```

**UI States**:
- Loading (skeleton cards)
- Results (tournament cards)
- Empty (no results message)
- Error (error banner)

**Dependencies**: Types from `src/types.ts`

---

## Coordination Layer

### **app.ts** (573 lines, -75% from original)

**Responsibility**: Wire services together and handle user interactions

**What it does**:
- Initialize all service modules
- Load configuration
- Set up event listeners (click, keyboard)
- Coordinate between services for workflows
- Manage application state (filters, sorting)
- Handle keyboard shortcuts

**What it doesn't do** (delegated to services):
- ❌ DOM manipulation → UIManager
- ❌ Data fetching → DataService
- ❌ Filtering/sorting → FilterService
- ❌ Export logic → ExportService
- ❌ Cache operations → CacheManager

**Service Composition Example**:
```typescript
// User searches for Mediterranean open tournaments
async searchTournaments(): Promise<void> {
  // 1. Show loading UI
  this.uiManager.showLoadingSkeletons();

  // 2. Fetch data (with caching)
  const tournaments = await this.dataService.fetchTournaments();

  // 3. Apply filters
  const filtered = this.filterService.filterTournaments(
    tournaments,
    this.getFilterState(),
    this.mediterraneanLocations
  );

  // 4. Sort results
  const sorted = this.filterService.sortTournaments(filtered, this.currentSort);

  // 5. Render UI
  this.uiManager.displayTournaments(sorted);
}
```

---

## Shared Types

### **types.ts**

Centralized type definitions shared across all modules:

```typescript
interface Tournament {
  name: string;
  url: string;
  location: string;
  date: Date;
  category: string;
  description: string;
}

interface FilterState {
  openOnly: boolean;
  excludeYouth: boolean;
  mediterraneanOnly: boolean;
  seniorCategory: boolean;
  womenOnly: boolean;
  includeTeamTournaments: boolean;
  classicalTime: boolean;
  rapidTime: boolean;
  blitzTime: boolean;
  startDate: Date | null;
  endDate: Date | null;
  countryFilter: string;
}

interface AppConfig {
  europeanCountries: string[];
  nonEuropeanCountries: string[];
  mediterraneanLocations: string[];
  countryCodes: Record<string, CountryCode>;
}
```

---

## Build System

### **Vite** (`vite.config.ts`)

**Production Optimizations**:
- Terser minification (removes console.logs)
- Tree-shaking (removes unused code)
- Code splitting for better caching
- Gzip compression (.gz files)
- Brotli compression (.br files)
- Legacy browser support (`@vitejs/plugin-legacy`)
- CSS code splitting

**Bundle Size Reduction**:
- Before: 80 KB JavaScript (unminified)
- After: 27.77 KB modern + 42.13 KB legacy
- Gzipped: 8.05 KB modern + 11.09 KB legacy
- **70% reduction** in bundle size

**Build Process**:
```bash
npm run build:vite  # Production build
npm run dev         # Development server with HMR
npm run preview     # Preview production build
```

---

## Data Flow

### Search Flow
```
User clicks "Search"
     ↓
app.ts.searchTournaments()
     ↓
UIManager.showLoadingSkeletons() → User sees loading
     ↓
DataService.fetchTournaments() → Try cache → Local file → CORS proxies
     ↓
CacheManager.loadFromCache() / saveToCache()
     ↓
FilterService.filterTournaments() → Apply all filter criteria
     ↓
FilterService.sortTournaments() → Sort by user preference
     ↓
UIManager.displayTournaments() → Render cards
     ↓
User sees results
```

### Export Flow
```
User clicks "Export CSV"
     ↓
app.ts.exportToCSV()
     ↓
ExportService.exportToCSV() → Generate CSV with escaping
     ↓
Browser downloads file
```

### Calendar Export Flow
```
User clicks calendar icon on tournament card
     ↓
app.ts.attachCalendarExportListeners() → Event handler
     ↓
ExportService.exportToCalendar() → Generate RFC 5545 iCalendar
     ↓
Browser downloads .ics file
```

---

## Testing Architecture

### Unit Tests (Isolated)
Each service is tested independently with mocked dependencies:

- **CacheManager**: 15 tests (localStorage mocking)
- **FilterService**: 15 tests (pure function testing)
- **ExportService**: 18 tests (output validation)
- **DataService**: 12 tests (HTTP fetch mocking)
- **UIManager**: 15 tests (jsdom for DOM testing)

**Total**: 75 service unit tests

### Integration Tests
Services working together:

- **Service Integration**: 10 tests (realistic workflows)
- **Python Integration**: 108 tests (backend)

**Total**: 118 integration tests

### End-to-End Tests
Full browser testing with Playwright:

- **Search & Filter**: 10 tests
- **Exports**: 5 tests
- **Accessibility**: 12 tests
- **Keyboard Navigation**: 15 tests
- **Dark Mode & UI**: 12 tests

**Total**: 54+ E2E tests

### Performance Tests
Benchmark suite measuring ops/sec:

- Filter performance (3 dataset sizes)
- Sort performance (3 dataset sizes)
- Export performance (3 dataset sizes)
- Cache performance
- Full pipeline performance

**Total**: 12 benchmarks

---

## Code Quality

### TypeScript
- Strict mode enabled
- ES2020 target
- Full type coverage
- No `any` types (except tests)

### Linting
- ESLint for TypeScript
- Ruff for Python
- Pre-commit hooks

### Code Coverage
- Tool: c8 (modern coverage for ES modules)
- Thresholds: 70% lines, 70% functions, 60% branches
- Reports: HTML, LCOV, JSON, text
- CI/CD: Coverage reports uploaded to artifacts

### Performance Monitoring
- Lighthouse CI in GitHub Actions
- Performance budget: 85/100
- Accessibility budget: 95/100
- SEO budget: 95/100

---

## Design Principles

### 1. **Single Responsibility**
Each service has one clear purpose and does it well.

### 2. **Dependency Injection**
Services receive dependencies via constructor (e.g., DataService receives CacheManager).

### 3. **No Circular Dependencies**
Clean dependency tree:
```
app.ts
  ├── CacheManager (no dependencies)
  ├── FilterService (no dependencies)
  ├── DataService (depends on CacheManager)
  ├── ExportService (no dependencies)
  └── UIManager (no dependencies)
```

### 4. **Separation of Concerns**
- Logic ≠ Presentation
- Data ≠ UI
- Caching ≠ Fetching

### 5. **Testability**
All services can be tested in isolation with mocked dependencies.

### 6. **Type Safety**
Full TypeScript coverage with strict mode ensures compile-time error detection.

---

## Benefits of This Architecture

### ✅ **Maintainability**
- 75% reduction in main file size (2,267 → 573 lines)
- Clear module boundaries
- Easy to locate and fix bugs

### ✅ **Testability**
- 296+ tests with 100% pass rate
- Mock-based unit tests
- Integration tests verify composition
- E2E tests ensure UI works

### ✅ **Performance**
- 70% bundle size reduction
- Sub-linear scaling for filters
- Efficient caching strategies
- Code splitting for faster loads

### ✅ **Developer Experience**
- Hot module replacement (HMR) in dev mode
- Fast test execution (<5 seconds for unit tests)
- Clear separation of concerns
- Type safety catches errors early

### ✅ **Extensibility**
- Easy to add new services
- Easy to swap implementations
- Easy to add features without breaking existing code

---

## Future Enhancements

### Potential Additions

1. **Service Worker** - Offline support and background sync
2. **State Management** - Centralized state with observables
3. **Router** - Multiple pages (tournament details, favorites, history)
4. **API Service** - Dedicated service for external API calls
5. **Analytics Service** - Track user interactions
6. **Notification Service** - User notifications and alerts

### Migration Path

The modular architecture makes it easy to:
- Migrate to React/Vue/Svelte (services stay the same)
- Add a backend API (DataService becomes API client)
- Implement server-side rendering (services work in Node.js)
- Create a mobile app (services work with React Native)

---

## Version History

- **v3.0.0** - Modular architecture, Vite bundler, advanced testing
- **v2.3.0** - Filter persistence, calendar export, SEO improvements
- **v2.0.0** - TypeScript migration, frontend rewrite
- **v1.0.0** - Initial Robot Framework scraper

---

## References

- [Source Code](https://github.com/kobolcs/medtourney)
- [Live Demo](https://kobolcs.github.io/medtourney/)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Contributing Guide](./CONTRIBUTING.md)
