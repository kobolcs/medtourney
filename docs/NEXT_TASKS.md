# Next Tasks (2026-09-30)

Written after cleaning up the repo on 2026-09-30. At that point there were no
open issues or PRs, and the last run of every workflow had passed. The data
counts are from `tournaments_data.json` at `d13bfbd` (1,540 tournaments).

Legend: `[x]` done · `[~]` partly done · `[ ]` not started

## P1 - Data quality (users see this)

- [ ] **1. Find out why 425 tournaments (28%) have no coordinates.** They don't
  appear on the map. Geocoding is meant to fill gaps a bit more each day
  (Nominatim + GeoNames, cached), so first check whether these are stuck
  (no match, bad location text) or just waiting their turn. Add a short report
  to `geocode_tournaments.py` (reason per place, e.g. no match, rate-limited,
  not tried yet) and fix the biggest group.
- [ ] **2. "Senior School" is marked S50+.** `CHESS JUNIOR CHESS TOURNAMENT`
  (venue "KHADIJA SENIOR SCHOOL", ALB) has both `S50+` and `Youth`. Change
  `_has_senior_category` (`tournament_processing/classify.py`) so the word
  "senior" in school names and venues doesn't count, and let a youth/school
  match win. Add a Python test for it. S50+ is one of the main filters, so a
  wrong match here is very visible.
- [ ] **3. 220 tournaments have no `details`** (organizer, rounds, system).
  Same kind of question as item 1: do they fill in over time, or do they
  fail every run?

## P2 - Keeping the code healthy

- [ ] **4. Fix JS coverage showing 0%** (c8, known since #50). Until it works,
  the "coverage maintained" item on the review checklist can't be checked.
- [ ] **5. Split the files over the size limit, starting with the source files.**
  Split each one when you next work in it, then remove it from `KNOWN` and
  CLAUDE.md:
  - [ ] `TournamentProcessor.py` 506 (do this with item 2)
  - [ ] `src/services/FilterService.ts` 431
  - [ ] `src/app.ts` 424
  - [ ] `src/services/ExportService.ts` 357
  - [ ] `src/services/DataService.ts` 319
  - [ ] Tests and docs: `test_geocode.py` 420, `dark-mode-and-ui.spec.ts` 383,
    `keyboard-navigation.spec.ts` 329, `TESTING.md` 719, `ARCHITECTURE.md` 610

## P3 - Features (for the S50+ / seaside audience)

- [ ] **6. "Notify me" for a saved filter.** An RSS or iCal feed per filter
  URL (e.g. S50+ Mediterranean), generated as a static file with each scrape,
  since there's no server.
- [ ] **7. Entry fee / prize fund on cards**, if the details scrape can
  extract them reliably.

## Parked

- [ ] **Scraper Excel-download diagnostic** (saves the page state when a
  download fails). It was deleted on 2026-09-23. Only rebuild it if download
  failures come back.
