# CLAUDE.md - AI Assistant Guide for MedTourney

**Last Updated:** 2026-09-25
**Version:** 3.1.0
**Purpose:** Comprehensive guide for AI assistants (like Claude) working on the MedTourney codebase

---

## Reference pages

Loaded on demand - read the one that matches the task. Everything that is a rule for working here stays below.

- [Codebase structure & file locations](docs/claude/codebase-structure.md)
- [Architecture & design principles](docs/claude/architecture.md)
- [Development workflows & commands](docs/claude/development.md)
- [Testing strategy](docs/claude/testing.md)
- [Common tasks](docs/claude/common-tasks.md) - adding a filter or service, fixing a bug, docs, running the scraper
- [Git & deployment](docs/claude/git-and-deployment.md)
- [Getting help](docs/claude/getting-help.md)

---

## Project Overview

### What is MedTourney?

MedTourney is an **advanced chess tournament search tool** for discovering European chess tournaments, with a focus on:

- **Mediterranean seaside locations** (Barcelona, Nice, Athens, Malta, etc.)
- **Senior (S50+) category tournaments**
- **Open category tournaments** (accessible to all skill levels)
- **Adult tournaments** (excluding youth-only events)

### Key Statistics

- **Version:** 3.1.0
- **Total Tests:** 290+ (211 service unit, 8 service integration, 68 Playwright E2E per browser, 87 Python backend, 27 Python integration) — all currently passing; see Testing Strategy
- **Bundle Size:** ~33KB gzipped JS + ~8.4KB gzipped CSS for the main bundle (grown from the original 25KB as the results-first redesign, mobile fixes, flag icons, live filtering and the map toggle landed — still deliberately small; see Performance Considerations). The map view (MapView + Leaflet + markercluster, ~54KB gzipped) is lazy-loaded on first use and not part of it
- **Architecture:** Modular service-oriented (5 specialized services + focused utils)
- **Technologies:** TypeScript (strict mode), Vite, Playwright, Robot Framework, Python

### Live Application

- **Live URL:** https://kobolcs.github.io/medtourney/
- **GitHub:** https://github.com/kobolcs/medtourney
- **Deployment:** GitHub Pages with automated daily updates

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

See [docs/claude/code-style.md](docs/claude/code-style.md) for good/bad examples.

### File size guidelines (effective 2026-09-25, revise as needed)

Current thresholds (lines): .py 400, .ts 300, .robot 400, .md 500.
- Before adding significant code to a file near its threshold, propose a split first.
- Prefer small cohesive modules: one responsibility per file, functions ≲50 lines,
  Robot keywords ≲40 lines.
- Exceptions (generated code, fixtures, data tables, changelogs) are allowed
  if they are noted in this section.

Enforced in CI (`test.yml`) and pre-commit. Change a number here and in the tool together:
- File length, all four types: `scripts/check_file_lengths.py` (`LIMITS`, `KNOWN`).
- TS functions: ESLint `max-lines-per-function` 50 (`eslint.config.mjs`).
- Python functions: Ruff `C901` complexity 10, plus `PLR0915` statements 50 (`ruff.toml`).
- Robot: Robocop `too-long-keyword` / `too-long-test-case` 40, `file-too-long` 400 (`robocop.toml`).

To fix violations: run the linters and split the files using the rules above.

**Known exceptions.** These were over the limit when the rule came in. Split each
one the next time you work in it, then remove it from this list and from the tool.
They show as warnings; they fail only if they grow.
- Files (`KNOWN` in the script): `TournamentProcessor.py` 506, `tests/python/test_geocode.py` 420,
  `src/services/FilterService.ts` 433, `src/app.ts` 424,
  `tests/e2e/dark-mode-and-ui.spec.ts` 390, `src/services/ExportService.ts` 330,
  `tests/e2e/keyboard-navigation.spec.ts` 329, `src/services/DataService.ts` 319,
  `src/services/UIManager.ts` 306, `TESTING.md` 724, `ARCHITECTURE.md` 611.
- TS functions over 50 lines (a warning in the second block of `eslint.config.mjs`):
  `attachEventListeners` (`app.ts`), `updateFilterCompatibility`,
  `buildEmptyStateRelaxations`, `applyFilterPreferences`, `initKeyboardNavigation`,
  `fetchTournaments` (`DataService`), `filterTournaments` (`FilterService`),
  `createTournamentCard` (`CardPart`).
- Python: `geonames_match` (`geocoding/geonames.py`, `# noqa: C901`).
- Robot: `Fill Search Form` (`# robocop: off=too-long-keyword`).


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

## Important Notes for AI Assistants

### When Working on This Codebase

1. **Always run tests before committing**
   ```bash
   npm test  # Runs all 290+ tests
   ```

2. **Follow TypeScript strict mode**
   - No `any` types (except in tests)
   - Explicit return types
   - Proper null checking

3. **Use the service architecture**
   - Don't add logic to `app.ts` - create/use services
   - Follow dependency injection pattern
   - Keep services isolated and testable
   - `TournamentFinder` is split into a class chain: state in
     `src/app/AppState.ts`, methods by concern in `src/app/*Part.ts`, the rest
     in `app.ts`. A method called from a lower part but defined higher up
     needs a `protected abstract` declaration in `AppState`
   - **This has drifted:** `app.ts` has grown to 1,643 lines (from 573 at
     the v3.0 refactor) as event wiring, filter-preference persistence,
     the mode switch, active-filter chips, keyboard shortcuts, deep-linking,
     and shortlist management all accumulated there as the coordination
     layer. It's not yet back to the 2,267-line pre-refactor monolith this
     architecture was built to avoid, but it's trending that way -
     `filterUrl.ts` (FilterState <-> URLSearchParams) was pulled out as a
     `src/utils/` module rather than left as private methods here, since it
     had no `this` dependency; that's the pattern to follow next time
     something similarly self-contained accumulates. When adding a new
     feature, prefer extracting genuinely standalone logic into a service
     (or a focused `src/utils/` module, following `countries.ts`/`html.ts`)
     over adding
     another method to `app.ts`, even though that's the path of least
     resistance for wiring up a single new control.

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
   - Content Security Policy configured for GitHub Pages (a `<meta>` tag in
     `index.html` - Pages can't send headers, so `frame-ancestors` can't be
     used there)
   - No inline scripts: `script-src` is `'self'` plus Plausible, no hashes.
     Anything that must run before paint goes in a file (e.g.
     `public/theme-init.js`); `site-basics.spec.ts` ("no
     Content-Security-Policy violations") fails on an inline script
   - Browser support: `build.target` in `vite.config.mts` compiles ES2020 down
     to Chrome 64 / Firefox 67 / Safari 12, so iOS 12 iPads still work. No
     `@vitejs/plugin-legacy`: it was dropped in 2026 (pre-2018 browsers only)
   - Be mindful when adding external resources

### Performance Considerations

1. **Bundle size**
   - Current: ~33KB gzipped JS (`dist/assets/index-*.js`) + ~8.4KB gzipped CSS - validators use `zod/mini`, full `zod` is ~18KB more; the map (`MapView-*.js`, `leaflet-*.js`, `leaflet.markercluster-*.js`) loads only when someone opens it - keep it that way (dynamic `import()` in `src/app/ResultsViewPart.ts`/`MapView.ts`) - verify with `npm run build:vite` after any change that feels like it could be heavy
   - Flag icons (`public/flags/*.png`) are static assets served on demand, not part of this bundle - kept to ~4KB average per flag (rasterized small; several countries' full-detail SVG coats of arms were 30-180KB, wasted at 20px icon size)
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

See [docs/claude/development.md](docs/claude/development.md#useful-commands-reference).

---

**End of CLAUDE.md**

*This document should be updated whenever significant changes are made to the codebase structure, workflows, or conventions.*
