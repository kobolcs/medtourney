# Architecture & Design Principles

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

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
