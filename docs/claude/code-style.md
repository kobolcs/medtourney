# Code Style

*Moved out of [`CLAUDE.md`](../../CLAUDE.md) to keep the always-loaded agent file short. The rules for working on this repo stay in CLAUDE.md.*

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
